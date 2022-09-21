/// <reference types="@types/ioredis" />
import Redis from 'ioredis';
import { RedisGraphResponse } from './GraphResponse';

export declare class GraphCommand extends Redis.Command {
    private constructor();
    static create(node: Redis.Commander, cypherQuery: string, params?: Record<string, unknown>, options?: CypherQueryOptions): (GraphCommand & Command) | null;
}
export interface CypherQueryOptions {
    graphName?: string;
    readOnly?: boolean;
}
export interface Command extends Redis.Command {
    name: string;
    isReadOnly?: boolean;
}
export declare function isRedisCommand(x: any): x is Command;
