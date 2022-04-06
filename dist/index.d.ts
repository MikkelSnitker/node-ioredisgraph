/// <reference types="@types/ioredis" />
import Redis from 'ioredis';
export { getStatistics } from './Stats';
interface ClusterOptions extends Omit<Redis.ClusterOptions, "scaleReads"> {
    scaleReads?: "master" | "slave" | "all";
}
export declare class RedisGraphCluster extends Redis.Cluster implements Redis.Commands {
    private graphName;
    constructor(graphName: string, nodes: Redis.ClusterNode[], { scaleReads, ...options }?: ClusterOptions);
    getNode(isReadOnly: boolean): Redis.Redis;
    query<T = unknown>(command: string, params: any, options?: {
        graphName?: string;
        readOnly?: boolean;
    }): Promise<T[]>;
}
