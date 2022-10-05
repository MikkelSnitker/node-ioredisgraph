import * as Redis from 'ioredis';
import { Edge } from './Edge';
import { Node } from './Node';
import { Path } from './Path';
import { Graph } from "./Graph";
import { parseStatistics, QueryStatistics, STATS } from './Stats'
import { GraphCommand, CypherQueryOptions} from "./GraphCommand";


const labelCache = new WeakMap<Redis.RedisCommander, string[]>();
const typeCache = new WeakMap<Redis.RedisCommander, string[]>();
const propertyKeyCache = new WeakMap<Redis.RedisCommander, string[]>();


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

type Value<T = unknown> = [ValueType, T]
type HeaderRow = Array<[ColumnType, string]>;
type ResultRow = Array<Value[]>

export type RedisGraphResponse = [QueryStatistics] | [HeaderRow, ResultRow, QueryStatistics];

export class GraphResponse {
    
    constructor(private graph: Graph, private node: Redis.Redis | Redis.Cluster, private options?: CypherQueryOptions) {
      
    }

    private async sendCommand(command: string) {
        const response = await this.node.sendCommand(GraphCommand.create(this.graph, command, {}, this.options)!);
        return response as any;
      //  return this.parse(response as RedisGraphResponse);
    }

    private async getPropertyKeys(id: number) {
        let propertyKeys = propertyKeyCache.get(this.node);

        if (!propertyKeys || !propertyKeys[id]) {
            propertyKeys = (await this.sendCommand("call db.propertyKeys()"))?.map(({ propertyKey }: any) => propertyKey)!;
            propertyKeyCache.set(this.node, propertyKeys!)
        }

        if (!propertyKeys) {
            return null;
        }

        return propertyKeys[id]
    }

    private async getRelationshipTypes(id: number) {
        let types = typeCache.get(this.node);

        if (!types || !types[id]) {
            types = (await this.sendCommand("call db.relationshipTypes()"))?.map(({ relationshipType }: any) => relationshipType)!;
            typeCache.set(this.node, types!)
        }

        if (!types) {
            return null;
        }

        return types[id]
    }

    private async getLabels(id: number) {
        let labels = labelCache.get(this.node);

        if (!labels || !labels[id]) {
            labels = (await this.sendCommand("call db.labels()"))?.map(({ label }: any) => label)!;
            labelCache.set(this.node, labels!)
        }

        if (!labels) {
            return null;
        }

        return labels[id]
    }

    private async parseValue(type: ValueType, value: unknown): Promise<unknown> {
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
                return Promise.all((value as Array<[ValueType, unknown]>).map(([type, value]) => this.parseValue(type, value)));
                break;
            case ValueType.VALUE_EDGE: {
                const [id, type, src, dest, props] = value as [number, number, number, number, [number, ValueType, unknown][]]
                const relationType = await this.getRelationshipTypes(type);
                const prop = {};
                for (let [propId, type, value] of props) {
                    const field = await this.getPropertyKeys(propId);
                    if (field) {
                        Object.assign(prop, { [field]: await this.parseValue(type, value) });
                    }
                }

                const edge = new Edge(this.graph, src, relationType!, dest, prop);
                this.graph.edges.set(id, edge);

                return edge;

            }
                break;
            case ValueType.VALUE_NODE:
                const prop = {};

                const [id, [label], props] = value as [number, number[], [number, ValueType, unknown][]];
                const labels = await this.getLabels(label);
                for (let [propId, type, value] of props) {
                    const key = await this.getPropertyKeys(propId);
                    if (key) {
                        Object.assign(prop, { [key]: await this.parseValue(type, value) })
                    }

                }


                const node = new Node(this.graph, id, labels!, prop);

                this.graph.nodes.set(id, node);
                return node;

                break;
            case ValueType.VALUE_PATH:
                const [[nodesType, nodesValue], [edgesType, edgesValue]] = value as [[ValueType.VALUE_ARRAY, unknown], [ValueType.VALUE_ARRAY, unknown]];

                const [nodes, edges] = await Promise.all([
                    this.parseValue(nodesType, nodesValue),
                    this.parseValue(edgesType, edgesValue)
                ]);

                const path = new Path(nodes as Node[], edges as Edge[])
                return path;

                break;
            case ValueType.VALUE_MAP:
                const obj = {}
                let values = (value as unknown[]);
                for (; values.length > 0;) {
                    const [field = false, [type, value]] = values.splice(0, 2) as [string, Value];
                    if (field !== false) {
                        Object.assign(obj, { [field]: await this.parseValue(type, value) });
                    }
                }
                return obj;
                break;
            case ValueType.VALUE_POINT:
                return (value as string[]).map(parseFloat);

                break;
        }
    }

    async parse<T extends {}>(response: RedisGraphResponse) {
        const data: Array<T> = [];
        if (response.length === 3) {
            const [header, result, stats] = response;

            for (let rows of result) {
                let index = 0;
                const obj: T = {} as T;
                for (let [type, value] of rows) {
                    const val = await this.parseValue(type, value);
                    const field = header[index][1];
                    Object.assign(obj, { [field]: val });
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
}