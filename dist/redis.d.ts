import * as Redis from 'ioredis';
import { WriteableStream } from 'ioredis/built/types';
import { GraphCommand } from './GraphCommand';
export { getStatistics } from './Stats';
declare module 'ioredis' {
}
interface Node extends Redis.Redis {
    flags: "slave" | "master" | "master-down" | "slave-down";
}
export declare class RedisGraph extends Redis.default implements Redis.RedisCommander {
    private graphName;
    private translate;
    nodes: Map<string, Node>;
    constructor(graphName: string, options: Redis.RedisOptions);
    getNode(isReadOnly: boolean, key: string): Promise<Redis.Redis>;
    sendCommand(command: Redis.Command | GraphCommand, stream?: WriteableStream): Promise<unknown>;
    query<T = unknown>(command: string, params: any, options?: {
        graphName?: string;
        readOnly?: boolean;
    }): Promise<T[]>;
}
