import Redis, { Command } from 'ioredis'
import camelCase from 'camelcase'
import _ from 'lodash'

export class RedisGraph extends Redis {
    private graphName!:string;

    constructor (graphName:string, port?: number, host?: string, options?: Redis.RedisOptions);
    constructor (graphName:string, host?: string, options?: Redis.RedisOptions);
    constructor (graphName:string, options?: Redis.RedisOptions);
    constructor (graphName:string, ...args:any[]) {
      super(...args)
      this.graphName = graphName

      if (!this.graphName || this.graphName.length < 1) {
        throw new Error('Must specify a graph name in constructor')
      }

      Redis.Command.setArgumentTransformer('GRAPH.QUERY',argumentTransformer)
      Redis.Command.setReplyTransformer('GRAPH.QUERY',replyTransformer)
    }

    query (command:string) {
      const _this:any = this
      super.hset
      return _this.call('GRAPH.QUERY', this.graphName, `${command}`)
    }

    delete () {
      const _this:any = this
      return _this.call('GRAPH.DELETE', this.graphName)
    }

    explain (command:string) {
      const _this:any = this
      return _this.call('GRAPH.EXPLAIN', this.graphName, `${command}`)
    }
}

function parseMetaInformation (array:string[]) {
  const meta: {[key:string]: string} = {}
  for (const prop of array) {
    let [name, value] = prop.split(': ')
    if (value) {
      value = value.trim()
      name = camelCase(name)
      meta[name] = value
    }
  }
  return meta
}

const nodeId = Symbol('nodeId')

function parseResult (columnHeaders:any[], singleResult:any) {
  const columns = columnHeaders.map((columnHeader, index) => {
    const name = columnHeader
    let value = singleResult[index]

    if (Array.isArray(value)) {
      value = _.fromPairs(value)
    }
    if (value == null) {
      return null
    }

    const { id } = value
    delete value.id
    Object.assign(value, { [nodeId]: id })

    if (value.properties) {
      _.defaults(value, _.fromPairs(value.properties))
      delete value.properties
    }

    return [name, value]
  }).filter(x => x !== null)

  if (columns.length === 0) {
    return null
  }

  return _.fromPairs(columns as [])
}

function serialize (obj:unknown):string | null {
  if (obj === null) {
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
  scaleReads?: "master" | "slave" | "all" | Function
}

function argumentTransformer(args:any[]){
  const [graphName, cypher, params] = args
    
  const paramStr = Object.keys(params ?? {}).reduce((result, key) => result += `${key} = ${serialize(params[key as keyof typeof params])} `, '')

  return [graphName, `CYPHER ${paramStr}; ${cypher}`]
}

function replyTransformer(result:any){
  const metaInformation = parseMetaInformation(result.pop())

      let parsedResults: Array<unknown> & {meta: unknown} = Object.assign([], { meta: null })
      parsedResults.meta = metaInformation

      if (result.length > 1) { // if there are results to parse
        const columnHeaders = result[0]
        const resultSet = result[1]

        parsedResults = resultSet.map((result:any) => {
          return parseResult(columnHeaders, result)
        })
      }

      return parsedResults.filter(x => x != null)
}

export class RedisGraphCluster extends Redis.Cluster {
  constructor (private graphName:string, nodes: Redis.ClusterNode[], {scaleReads = "master", ...options}:ClusterOptions) {
    super(nodes, {
      scaleReads(nodes: Redis.Redis[], command:any){
        if(typeof scaleReads === "function"){
          return scaleReads(nodes, command);
        }
        
        if(command.isReadOnly){
          if(scaleReads === "all"){
            return nodes;
          }

          return nodes.filter(x=>x.options.readOnly);
        } else {
          return nodes.filter(x=>!x.options.readOnly);
        }
        
     }, ...options} as any)
     this.nodes()
    Redis.Command.setArgumentTransformer('GRAPH.QUERY',argumentTransformer);
    Redis.Command.setReplyTransformer('GRAPH.QUERY', replyTransformer);


    Redis.Command.setArgumentTransformer('GRAPH.RO_QUERY',argumentTransformer);
    Redis.Command.setReplyTransformer('GRAPH.RO_QUERY', replyTransformer);
  }

  sendCommand(...args: any[]){
    if(args.length > 0 && args[0] instanceof Command){
      const command:any = args[0];
      if(command.name === "GRAPH.RO_QUERY"){
        command.isReadOnly = true;

      }
    }
 return   super.sendCommand.apply(this, args as any);
    
  }
  async query (command:string, params:any, options: {
    graphName?:string
    readOnly?: boolean
  } = {} ) {
    const _this:any = this
    const {graphName, readOnly} = options;
    return _this.call( readOnly ? 'GRAPH.RO_QUERY':'GRAPH.QUERY', graphName ?? this.graphName, `${command}`, params)
  }
}
