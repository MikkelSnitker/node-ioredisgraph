import * as Redis from 'ioredis';
import { WriteableStream } from 'ioredis/built/types';
import { GraphCommand } from './GraphCommand';
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
interface Node extends Redis.Redis {
    flags: "slave" | "master" | "master-down" | "slave-down";
}
export declare class RedisGraph extends Redis.default implements Redis.RedisCommander {
    private graphName;
    private translate;
    nodes: Map<string, Node>;
    constructor(graphName: string, options: Redis.RedisOptions);
    getNode(isReadOnly: boolean, key: string): Redis.Redis;
    _sendCommand(node: Redis.Redis, command: Redis.Command | GraphCommand, stream?: WriteableStream & {
        isPipeline: boolean;
        destination: {
            redis: Redis.Redis;
        };
    }): Promise<unknown>;
    sendCommand(command: Redis.Command | GraphCommand, stream?: WriteableStream & {
        isPipeline: boolean;
        destination: {
            redis: Redis.Redis;
        };
    }): Promise<unknown>;
    query<T = unknown>(command: string, params: any, options?: {
        graphName?: string;
        readOnly?: boolean;
    }): Promise<T[]>;
}
