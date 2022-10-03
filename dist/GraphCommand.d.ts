import * as Redis from 'ioredis';
import { Graph } from './Graph';
export declare class GraphCommand extends Redis.Command {
    readonly graph: Graph;
    private constructor();
    static create(graph: Graph, cypherQuery: string, params?: Record<string, unknown>, options?: CypherQueryOptions): GraphCommand | undefined;
}
export interface CypherQueryOptions {
    graphName?: string;
    readOnly?: boolean;
    timeout?: number;
}
export interface Command extends Redis.Command {
    name: string;
    isReadOnly?: boolean;
}
export declare function isRedisCommand(x: any): x is Command;
