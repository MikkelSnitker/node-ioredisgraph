
import { stat } from 'fs';
import * as Redis from 'ioredis'
import { WriteableStream } from 'ioredis/built/types';
import { off } from 'process';
import { ConnectionOptions } from 'tls';
import { Graph } from './Graph';
import { GraphCommand } from './GraphCommand';
import { GraphResponse, RedisGraphResponse } from './GraphResponse';
export { getStatistics } from './Stats'


declare module 'ioredis' {

    interface ChainableCommander {
        query<T>(query: string, params: Record<string, unknown>, options: { readOnly: boolean, graphName?: string }): ChainableCommander;
    }
    interface Pipeline {
        query<T>(query: string, params: Record<string, unknown>, options: { readOnly: boolean, graphName?: string }): ChainableCommander;
    }
}

interface AddressFromResponse {
    port: string;
    ip: string;
    flags?: string;
  }
  
  
type Endpoint = { host: string, port: number };


class Connector extends Redis.SentinelConnector {
    private slave?: Redis.Redis;
    constructor(options: unknown) {
        super({
            ...options as any,
            preferredSlaves(slaves:AddressFromResponse[]){
                return slaves[Math.floor((Math.random()*slaves.length))];
            }
        });

        (this as any).sentinelNatResolve = (node:any)=>{
            return ({...node, host: '127.0.0.1' });
        }
    }

   
    async getSlave(){
        if(process.env["IOREDIS_MASTER_ONLY"]){
            return null;
        }


        if(this.slave){
            return this.slave;
        }

       let c =0 ;
       let endpoint;
        while(c < 2)
        {
            const {value, done} = this.sentinelIterator.next();    
            if(done){
                this.sentinelIterator.reset(false);
            }  else {
                endpoint = value;
                break;
            }
            c++;    
        }
        
        const client = (this as any).connectToSentinel(endpoint);
        if(!client) return null;
        endpoint = await (this as any).resolveSlave(client);

        if(!endpoint) return null;
        const { sentinels, sentinelCommandTimeout, sentinelPassword, sentinelMaxConnections, sentinelReconnectStrategy, sentinelRetryStrategy, sentinelTLS, sentinelUsername, updateSentinels, enableTLSForSentinelMode, Connector, ...options  } = ( this.options as Redis.RedisOptions & Redis.SentinelConnectionOptions)
        const slave = new Redis.default({ ...options, ...endpoint,})
        const onerror = (err:Error)=> {
            this.slave = undefined;
            console.error(err);
        }
        slave.once("error", onerror);


        return this.slave = slave;

    }
}

export class RedisGraph extends Redis.default implements Redis.RedisCommander {
    private slave?: RedisGraph;
    constructor(private graphName: string,{role = 'master', ...options}: Redis.RedisOptions){
        super({...options, role, Connector})
        
    }

    async getSlave(){
        const connector = (this as any).connector;
       return connector.getSlave();
    }

    async query<T = unknown>(command: string, params: any, options: {
        graphName?: string
        readOnly?: boolean
    } = {}): Promise<T[]> {
        const _this: any = this;

        const { graphName = this.graphName, readOnly } = options;
        const graph = new Graph({ readOnly, graphName });
        
        let node:any = readOnly ? await this.getSlave() ?? this: this;
        const buf = await node.sendCommand(graph.query<T>(command, params));
        const response = new GraphResponse(graph, this, graph.options);
        return response.parse(buf as any as RedisGraphResponse) as any;
    }
}   

Redis.Pipeline.prototype.query = function <T>(this: Redis.Pipeline & { redis: {graphName: string}, options: any }, query: string, params: Record<string, unknown>, options: { readOnly: boolean, graphName?: string } = { readOnly: true }) {
    const { graphName =this.redis.graphName, readOnly } = options;
    const graph = new Graph({ readOnly, graphName });
    this.sendCommand(graph.query(query, params));
    return this as Redis.Pipeline;

}