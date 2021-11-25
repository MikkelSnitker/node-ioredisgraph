import Redis from 'ioredis';
export declare class RedisGraph extends Redis {
    private graphName;
    constructor(graphName: string, port?: number, host?: string, options?: Redis.RedisOptions);
    constructor(graphName: string, host?: string, options?: Redis.RedisOptions);
    constructor(graphName: string, options?: Redis.RedisOptions);
    query(command: string): any;
    delete(): any;
    explain(command: string): any;
}
interface ClusterOptions extends Omit<Redis.ClusterOptions, "scaleReads"> {
    scaleReads?: "master" | "slave" | "all" | Function;
}
export declare class RedisGraphCluster extends Redis.Cluster {
    private graphName;
    constructor(graphName: string, nodes: Redis.ClusterNode[], { scaleReads, ...options }: ClusterOptions);
    sendCommand(...args: any[]): void;
    query(command: string, params: any, options?: {
        graphName?: string;
        readOnly?: boolean;
    }): Promise<any>;
}
export {};
