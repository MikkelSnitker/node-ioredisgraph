import * as Redis from 'ioredis';
import { Graph } from "./Graph";
import { QueryStatistics } from './Stats';
import { CypherQueryOptions } from "./GraphCommand";
declare enum ColumnType {
    COLUMN_UNKNOWN = 0,
    COLUMN_SCALAR = 1,
    COLUMN_NODE = 2,
    COLUMN_RELATION = 3
}
declare enum ValueType {
    VALUE_UNKNOWN = 0,
    VALUE_NULL = 1,
    VALUE_STRING = 2,
    VALUE_INTEGER = 3,
    VALUE_BOOLEAN = 4,
    VALUE_DOUBLE = 5,
    VALUE_ARRAY = 6,
    VALUE_EDGE = 7,
    VALUE_NODE = 8,
    VALUE_PATH = 9,
    VALUE_MAP = 10,
    VALUE_POINT = 11
}
declare type Value<T = unknown> = [ValueType, T];
declare type HeaderRow = Array<[ColumnType, string]>;
declare type ResultRow = Array<Value[]>;
export declare type RedisGraphResponse = [QueryStatistics] | [HeaderRow, ResultRow, QueryStatistics];
export declare class GraphResponse {
    private graph;
    private node;
    private options?;
    constructor(graph: Graph, node: Redis.Redis | Redis.Cluster, options?: CypherQueryOptions | undefined);
    private sendCommand;
    private getPropertyKeys;
    private getRelationshipTypes;
    private getLabels;
    private parseValue;
    parse<T extends {}>(response: RedisGraphResponse): Promise<T[]>;
}
export {};
