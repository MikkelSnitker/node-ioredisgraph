/// <reference types="@types/ioredis" />
import Redis from 'ioredis';
import { RedisGraphResponse } from './GraphResponse';
declare module "ioredis" {
    interface Redis {
        sendCommand(command: unknown): Promise<RedisGraphResponse>;
    }
}
export declare class GraphCommand {
    static create(node: Redis.Redis, cypherQuery: string, params?: Record<string, unknown>, options?: CypherQueryOptions): Promise<{}[]>;
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
