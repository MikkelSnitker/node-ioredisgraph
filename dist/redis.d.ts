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
    private pool;
    private masterPool;
    private stats;
}
