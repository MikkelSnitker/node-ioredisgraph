import Redis from 'ioredis';
import { Node } from './Node';
import { Edge } from './Edge'
import { Path } from './Path';
import { Graph } from './Graph'
import {GraphResponse, RedisGraphResponse} from './GraphResponse';

declare module "ioredis" {
    interface Redis {
        sendCommand(command: unknown): Promise<RedisGraphResponse>;
    }
}



function serialize(obj: unknown): string | null {
    if (obj === null || obj === undefined) {
        return null
    }

    if (Array.isArray(obj)) {
        return `[${obj.map(serialize).join(', ')}]`
    }

    if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
        return `{${Object.keys(obj).map(key => `${key}: ${serialize(obj[key as keyof typeof obj])}`).join(', ')}}`
    }

    return JSON.stringify(obj)
}


function argumentTransformer(args: any[]) {
    const [graphName, cypher, params] = args

    const paramStr = Object.keys(params ?? {}).reduce((result, key) => result += `${key} = ${serialize(params[key as keyof typeof params])} `, '')

    return [graphName, `CYPHER ${paramStr} ${cypher}`, '--compact']
}





export class GraphCommand {

    static async create(node: Redis.Redis, cypherQuery: string, params?: Record<string, unknown>, options?: CypherQueryOptions) {
        const { readOnly = false, graphName } = options ?? {};
        if (!graphName) {
            throw new Error("Graphname missing")
        }

        const args = argumentTransformer([graphName, cypherQuery, params]);
        const command = new Redis.Command(readOnly ? 'GRAPH.RO_QUERY' : 'GRAPH.QUERY', args, {
            replyEncoding: "utf8"
        })

        if (isRedisCommand(command)) {
            if (readOnly) {
                command.isReadOnly = true;
            }
        }

        const response = new GraphResponse(node, options);
        const a = await response.parse(await node.sendCommand(command));
        return a;
    }
}

export interface CypherQueryOptions {
    graphName?: string
    readOnly?: boolean
}

export interface Command extends Redis.Command {
    name: string;
    isReadOnly?: boolean;
}

export function isRedisCommand(x: any): x is Command {
    return x instanceof Redis.Command;
}
