import Redis from 'ioredis';
interface ClusterOptions extends Omit<Redis.ClusterOptions, "scaleReads"> {
    scaleReads?: "master" | "slave" | "all" | Function;
}
export declare const STATS: unique symbol;
export declare class RedisGraphCluster extends Redis.Cluster {
    private graphName;
    getPropertyKeys(id: number): Promise<string | null>;
    getRelationshipTypes(id: number): Promise<string | null>;
    getLabels(id: number): Promise<string | null>;
    constructor(graphName: string, nodes: Redis.ClusterNode[], { scaleReads, ...options }?: ClusterOptions);
    sendCommand(...args: any[]): Promise<void>;
    query<T = unknown>(command: string, params: any, options?: {
        graphName?: string;
        readOnly?: boolean;
    }): Promise<T[]>;
}
export {};
