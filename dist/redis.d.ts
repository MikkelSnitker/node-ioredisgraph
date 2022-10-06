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
export declare class RedisGraph extends Redis.default implements Redis.RedisCommander {
    private graphName;
    private slave?;
    constructor(graphName: string, { role, ...options }: Redis.RedisOptions);
    getSlave(): Promise<any>;
    query<T = unknown>(command: string, params: any, options?: {
        graphName?: string;
        readOnly?: boolean;
    }): Promise<T[]>;
}
