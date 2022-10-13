
import { stat } from 'fs';
import * as Redis from 'ioredis'
import { WriteableStream } from 'ioredis/built/types';
import { off } from 'process';
import { ConnectionOptions } from 'tls';
import { Graph } from './Graph';
import { GraphCommand } from './GraphCommand';
import { GraphResponse, RedisGraphResponse } from './GraphResponse';
import { getStatistics } from './Stats';
export { getStatistics } from './Stats'

interface Sentinel {
    sentinel(subcommand: "sentinels" | "get-master-addr-by-name" | "slaves", name: string): Promise<string[]>;
    subscribe(...channelNames: string[]): Promise<number>;
    on(
        event: "message",
        callback: (channel: string, message: string) => void
    ): void;
    on(event: "error", callback: (error: Error) => void): void;
    on(event: "reconnecting", callback: () => void): void;
    disconnect(): void;
}

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

export function packObject(array: string[]): Record<string, any> {
    const result: Record<string, string> = {};
    const length = array.length;

    for (let i = 1; i < length; i += 2) {
        result[array[i - 1]] = array[i];
    }

    return result;
}



class Connector extends Redis.SentinelConnector {
    constructor(options: unknown) {
        super({
            ...options as any,
        });
    }

    async getSlaves() {
        let c = 0;
        let endpoint;
        while (c < 2) {
            const { value, done } = this.sentinelIterator.next();
            if (done) {
                this.sentinelIterator.reset(false);
            } else {
                endpoint = value;
                break;
            }
            c++;
        }

        const client: Sentinel = (this as any).connectToSentinel(endpoint);
        const result = await client.sentinel("slaves", this.options.name!);
        const availableSlaves = result.map<AddressFromResponse>(
            packObject as (value: any) => AddressFromResponse
        )
            .filter(
                (slave) =>
                    slave.flags && !slave.flags.match(/(disconnected|s_down|o_down)/)
            );

        const slaves = [];

        for (const {ip:host,port} of availableSlaves) {
            const { sentinels, sentinelCommandTimeout, sentinelPassword, sentinelMaxConnections, sentinelReconnectStrategy, sentinelRetryStrategy, sentinelTLS, sentinelUsername, updateSentinels, enableTLSForSentinelMode, Connector, ...options } = (this.options as Redis.RedisOptions & Redis.SentinelConnectionOptions)
            const slave = new Redis.default(parseInt(port), host, { ...options })
            slaves.push(slave);
        }

        return slaves;

    }


}

export class RedisGraph extends Redis.default implements Redis.RedisCommander {
    private pool: Array<Redis.Redis> = []
    private masterPool: Array<Redis.Redis> = [];
    private stats = new WeakMap<Redis.Redis, {ops: number; startTime:number; duration: number}>();

    constructor(private graphName: string, { role = 'master', ...options }: Redis.RedisOptions) {
        super({ ...options, failoverDetector: !process.env["IOREDIS_MASTER_ONLY"], role, Connector });
        
            this.once("connect", async () => {

                for(let i = 0; i < 4; i++ ){
                    const { sentinels, sentinelCommandTimeout, sentinelPassword, sentinelMaxConnections, sentinelReconnectStrategy, sentinelRetryStrategy, sentinelTLS, sentinelUsername, updateSentinels, enableTLSForSentinelMode, Connector, ...options } = (this.options as Redis.RedisOptions & Redis.SentinelConnectionOptions)
                    
                    const master = new Redis.default(this.stream.remotePort!, this.stream.remoteAddress!, { ...options })
                    this.masterPool.push(master);
                }

                if (!process.env["IOREDIS_MASTER_ONLY"]) {
                const slaves = await ((this as any).connector as Connector).getSlaves();
                this.pool.push(...slaves);
                for(const node of slaves){
                    this.stats.set(node, {ops: 0, startTime: Date.now(), duration:0});
                }
            }
            });
        
            setInterval(()=>{
                console.log("STATS:");
                for(let node of this.pool){
                    if(this.stats.has(node)) {
                    const stats = this.stats.get(node)!;
                    const now = Date.now();
                    const {ops, startTime, duration} = stats;

                    console.log("%s: ops/s %d, ops total: %d, duration: %d ms",node.stream.remoteAddress, ops/((now-startTime)/1000), ops, duration)

                    this.stats.set(node, {ops: 0, startTime: Date.now(), duration:0});

                    }
                }

            }, 10_000);

        
    }


    async getConnection<T>(readOnly: boolean = false, cb: (redis: Redis.default) => T): Promise<T> {
        
        if (!readOnly || process.env["IOREDIS_MASTER_ONLY"]) {
            const node = this.masterPool.shift();
            if(node){
                this.masterPool.push(node);
            }
            
            return cb(node ?? this);
        }

        const node = this.pool.shift();

        if (!node) {
            return cb(this);
        }
        this.pool.push(node);
        return cb(node);

    }

    async query<T = unknown>(command: string, params: any, options: {
        graphName?: string;
        readOnly?: boolean;
        timeout?: number;
    } = {}): Promise<T[]> {
        const _this: any = this;

        const { graphName = this.graphName, readOnly, timeout } = options;
        const graph = new Graph({ readOnly, graphName, timeout, });

        
        

        const [node, buf] = await Promise.all(await this.getConnection(readOnly, (node) =>[node, node.sendCommand(graph.query<T>(command, params))] as [Redis.Redis, Buffer[]]))
        const response = new GraphResponse(graph, this, graph.options);
        
        const data = response.parse(buf as any as RedisGraphResponse) as any;
        data.then((x:T[])=>{
            const redisStats =  getStatistics(x);
            if (redisStats && this.stats.has(node)){
                const stats = this.stats.get(node)!;
                const { QueryInternalExecutionTime } = redisStats;
                stats.duration += QueryInternalExecutionTime ?? 0;
                stats.ops++;

            }
        });

        return data;

    }
}

Redis.Pipeline.prototype.query = function <T>(this: Redis.Pipeline & { redis: { graphName: string }, options: any }, query: string, params: Record<string, unknown>, options: { readOnly: boolean, graphName?: string } = { readOnly: true }) {
    const { graphName = this.redis.graphName, readOnly } = options;
    const graph = new Graph({ readOnly, graphName });
    this.sendCommand(graph.query(query, params));
    return this as Redis.Pipeline;

}