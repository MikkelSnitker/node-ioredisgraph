import Redis, { Command } from 'ioredis'
import { Node } from './Node';
import { Edge } from './Edge'
import { Path } from './Path';
import { Graph } from './Graph'

function serialize(obj: unknown): string | null {
  if (obj === null || obj === undefined) {
    return null
  }

  if (Array.isArray(obj)) {
    return `[${obj.map(serialize).join(', ')}]`
  }

  if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
    return `{${Object.keys(obj).map(key => `${key}: ${serialize(obj[key as keyof typeof obj])}`).join(', ')}}`
  }

  return JSON.stringify(obj)
}

interface ClusterOptions extends Omit<Redis.ClusterOptions, "scaleReads"> {
  scaleReads?: "master" | "slave" | "all" | Function
}

enum ColumnType {
  COLUMN_UNKNOWN = 0,
  COLUMN_SCALAR = 1,
  COLUMN_NODE = 2,      // Unused, retained for client compatibility.
  COLUMN_RELATION = 3,  // Unused, retained for client compatibility.
};

enum ValueType {
  VALUE_UNKNOWN = 0,
  VALUE_NULL = 1,
  VALUE_STRING = 2,
  VALUE_INTEGER = 3,
  VALUE_BOOLEAN = 4,
  VALUE_DOUBLE = 5,
  VALUE_ARRAY = 6,
  VALUE_EDGE = 7,
  VALUE_NODE = 8,
  VALUE_PATH = 9,
  VALUE_MAP = 10,
  VALUE_POINT = 11
};

export type Stats = {
  LabelsAdded?: number;
  NodesCreated?: number;
  PropertiesSet?: number;
  NodesDeleted?: number;
  RelationshipsDeleted?: number;
  RelationshipsCreated?: number;
  QueryInternalExecutionTime?:  number;
}

function argumentTransformer(this: RedisGraphCluster, args: any[]) {
  const [graphName, cypher, params] = args

  const paramStr = Object.keys(params ?? {}).reduce((result, key) => result += `${key} = ${serialize(params[key as keyof typeof params])} `, '')

  return [graphName, `CYPHER ${paramStr} ${cypher}`, '--compact']
}

type Value<T = unknown> = [ValueType, T]
type QueryStatistics = string[];
type HeaderRow = Array<[ColumnType, string]>;
type ResultRow = Array<Value[]>

type RedisGraphResponse = [QueryStatistics] | [HeaderRow, ResultRow, QueryStatistics];

function parseStatistics(stats: QueryStatistics):Stats {
  function parseKey(key:string): keyof Stats{
    return key.split(" ").map(x=>x.replace(/^./, (a)=>a.toUpperCase())).join("") as keyof Stats;
  }


  function parseValue(key: keyof Stats, value: `${number} milliseconds` | `${number}`){
    switch(key){
      case "QueryInternalExecutionTime":
        return parseFloat(value);

      default:
        return parseInt(value);
    }
  }

  return stats.map(x => x.split(": ")).reduce((result, [prop, val]) =>{
    const key = parseKey(prop);
    const value = parseValue(key, val as `${number} milliseconds` | `${number}`);
    return Object.assign(result, { [key]: value });
  }, {} as Stats);
}

export const STATS = Symbol("stats");

async function parseValue(this: Graph, type: ValueType, value: unknown): Promise<unknown> {
  switch (type) {
    case ValueType.VALUE_UNKNOWN:
    case ValueType.VALUE_NULL:
    case ValueType.VALUE_STRING:
    case ValueType.VALUE_INTEGER:
      return value;
      break;
    case ValueType.VALUE_BOOLEAN:
      return value === "true"
      break;
    case ValueType.VALUE_DOUBLE:
      return parseFloat(value as string)
      break;
    case ValueType.VALUE_ARRAY:
      return Promise.all((value as Array<[ValueType, unknown]>).map(([type, value])=>parseValue.call(this, type, value)));
      break;
    case ValueType.VALUE_EDGE:{
      const [id, type, src, dest, props] = value as [number, number, number, number, [number, ValueType, unknown][]]
      const relationType = await this.getRelationshipTypes(type);
      const prop = {};
      for(let [prop, type, value] of props){
        const field = await this.getPropertyKeys(prop);
        if(field){
          Object.assign(prop, {[field]: await parseValue.call(this, type, value)});
        }
      }

      const edge = new Edge(this, src, relationType!, dest, prop);
        this.edges.set(id, edge);

        return edge;

      }
      break;
    case ValueType.VALUE_NODE:
      const prop = {};

      const [id, [label], props] = value as [number, number[], [number, ValueType, unknown][]];
      const labels = await this.getLabels(label);
      for(let [propId, type, value] of props){
        const key = await this.getPropertyKeys(propId);
        if(key){
          Object.assign(prop, {[key]: await parseValue.call(this, type, value)})
        }

      }


      const node =  new Node(this, id, labels!, prop);

      this.nodes.set(id, node);
      return node;

      break;
    case ValueType.VALUE_PATH:
      const [[nodesType,nodesValue], [edgesType,edgesValue]] = value as [[ValueType.VALUE_ARRAY, unknown], [ValueType.VALUE_ARRAY, unknown]];

      const [nodes, edges ] = await Promise.all([
        parseValue.call(this, nodesType, nodesValue),
        parseValue.call(this, edgesType, edgesValue)
      ]);

      const path = new Path(nodes as Node[], edges as Edge[])
      return path;

      break;
    case ValueType.VALUE_MAP:
      const obj = {}
      let values = (value as unknown[]);
       for(; values.length > 0; ){
        const [field = false, [type, value]] = values.splice(0,2) as [string, Value];
        if(field !== false){
          Object.assign(obj, {[field]: await parseValue.call(this, type, value)});
        }
       }
       return obj;
      break;
    case ValueType.VALUE_POINT:
      return (value as string[]).map(parseFloat) ;

      break;
  }
}

async function replyTransformer(this: RedisGraphCluster, response: RedisGraphResponse) {
  const data: Array<{}> = [];
  if (response.length === 3) {
    const graph = new Graph(this);
    const [header, result, stats] = response;

    for (let rows of result) {
      let index = 0;
      const obj = {};
      for (let [type, value] of rows) {
        const val = await parseValue.call(graph, type, value);
        const field = header[index][1];
        Object.assign(obj, {[field]: val});
        index++;
      }
      data.push(obj);
    }
    Object.assign(data, { [STATS]: parseStatistics(stats) });
  } else {
    const [stats] = response;

    Object.assign(data, { [STATS]: parseStatistics(stats) });
  }


  return data;
}

const labelCache = new WeakMap<RedisGraphCluster, string[]>();
const typeCache =  new WeakMap<RedisGraphCluster, string[]>();
const propertyKeyCache =  new WeakMap<RedisGraphCluster, string[]>();

export class RedisGraphCluster extends Redis.Cluster implements Redis.Commands {

  async getPropertyKeys(id: number){
    let propertyKeys = propertyKeyCache.get(this);

    if(!propertyKeys || !propertyKeys[id]){
      propertyKeys = (await this.query("call db.propertyKeys()", {}, {readOnly: true}))?.map(({propertyKey}:any)=>propertyKey)!;
      propertyKeyCache.set(this, propertyKeys!)
    }

    if(!propertyKeys){
      return null;
    }

    return propertyKeys[id]
  }

  async getRelationshipTypes(id: number){
    let types = typeCache.get(this);

    if(!types || !types[id]){
      types = (await this.query("call db.relationshipTypes()", {}, {readOnly: true}))?.map(({relationshipType}:any)=>relationshipType)!;
      typeCache.set(this, types!)
    }

    if(!types){
      return null;
    }

    return types[id]
  }

  async getLabels(id:number){
    let labels = labelCache.get(this);

    if(!labels || !labels[id]){
      labels = (await this.query("call db.labels()", {}, {readOnly: true}))?.map(({label}:any)=>label)!;
      labelCache.set(this, labels!)
    }

    if(!labels){
      return null;
    }

    return labels[id]
  }

  constructor(private graphName: string, nodes: Redis.ClusterNode[], { scaleReads = "master", ...options }: ClusterOptions = {}) {
    super(nodes, {
      scaleReads(nodes: Redis.Redis[], command: any) {
        if (typeof scaleReads === "function") {
          return scaleReads(nodes, command);
        }

        if (command.isReadOnly) {
          if (scaleReads === "all") {
            return nodes;
          }

          return nodes.filter(x => x.options.readOnly);
        } else {
          return nodes.filter(x => !x.options.readOnly);
        }

      }, ...options
    } as any)

    Redis.Command.setArgumentTransformer('GRAPH.QUERY', argumentTransformer.bind(this));
    Redis.Command.setReplyTransformer('GRAPH.QUERY', replyTransformer.bind(this));

    Redis.Command.setArgumentTransformer('GRAPH.RO_QUERY', argumentTransformer.bind(this));
    Redis.Command.setReplyTransformer('GRAPH.RO_QUERY', replyTransformer.bind(this));
  }



  async sendCommand(...args: any[]) {
    if (args.length > 0 && args[0] instanceof Command) {
      const command: any = args[0];
      if (command.name === "GRAPH.RO_QUERY") {
        command.isReadOnly = true;

      }
    }

    return super.sendCommand.apply(this, args as any);

  }
  async query<T = unknown>(command: string, params: any, options: {
    graphName?: string
    readOnly?: boolean
  } = {}) : Promise<T[]> {
    const _this: any = this
    const { graphName, readOnly } = options;
    return _this.call(readOnly ? 'GRAPH.RO_QUERY' : 'GRAPH.QUERY', graphName ?? this.graphName, `${command}`, params)
  }
}


export function getStatistics(response: unknown[]): Stats | null{
  if (STATS in response){
    return (response as any)[STATS];
  }

  return null;
}
