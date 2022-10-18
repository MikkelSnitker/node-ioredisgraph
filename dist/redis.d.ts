import * as Redis from 'ioredis';
export { getStatistics } from './Stats';
declare module 'ioredis' {
    interface ChainableCommander {
        query<T>(query: string, params: Record<string, unknown>, options: {
            readOnly: boolean;
            graphName?: string;
        }): ChainableCommander;
    }
    interface Pipeline {
        query<T>(query: string, params: Record<string, unknown>, options: {
            readOnly: boolean;
            graphName?: string;
        }): ChainableCommander;
    }
}
export declare function packObject(array: string[]): Record<string, any>;
export declare class RedisGraph extends Redis.default implements Redis.RedisCommander {
    private graphName;
    private pool;
    private stats;
    constructor(graphName: string, { role, ...options }: Redis.RedisOptions);
    queue: Function[];
    getConnection<T>(readOnly: boolean | undefined, cb: (redis: Redis.default) => T): Promise<T>;
    query<T = unknown>(command: string, params: any, options?: {
        graphName?: string;
        readOnly?: boolean;
        timeout?: number;
    }): Promise<T[]>;
}
