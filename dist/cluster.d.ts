import * as Redis from 'ioredis';
import { WriteableStream } from 'ioredis/built/types';
import { GraphCommand } from './GraphCommand';
export { getStatistics } from './Stats';
declare module "ioredis" {
    interface Cluster {
        slots: Array<string[]>;
    }
}
interface ClusterOptions extends Omit<Redis.ClusterOptions, "scaleReads"> {
    scaleReads?: "master" | "slave" | "all";
}
export declare class RedisGraphCluster extends Redis.Cluster {
    private graphName;
    private keySlotCache;
    constructor(graphName: string, nodes: Redis.ClusterNode[], { scaleReads, ...options }?: ClusterOptions);
    getNode(isReadOnly: boolean, key: string): Promise<Redis.Redis | undefined>;
    sendCommand(command: Redis.Command | GraphCommand, stream?: WriteableStream, node?: any): Promise<unknown>;
    query<T = unknown>(command: string, params: any, options?: {
        graphName?: string;
        readOnly?: boolean;
    }): Promise<T[]>;
}
