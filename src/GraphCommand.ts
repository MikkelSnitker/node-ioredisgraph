import Redis, { ValueType } from 'ioredis';
import { Node } from './Node';
import { Edge } from './Edge'
import { Path } from './Path';
import { Graph } from './Graph'
import {GraphResponse, RedisGraphResponse} from './GraphResponse';


declare module "ioredis" {


    interface Commander {
        sendCommand(command: unknown): Promise<RedisGraphResponse>;
    }

    interface Redis extends Commander {
    
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


export class GraphCommand extends Redis.Command {

    private constructor(name: string,args: ValueType[]) {
        super(name, args, { replyEncoding: "utf8"})
    }
    static create(node: Redis.Commander, cypherQuery: string, params?: Record<string, unknown>, options?: CypherQueryOptions) {
    
        const { readOnly = false, graphName } = options ?? {};
        if (!graphName) {
            throw new Error("Graphname missing")
        }

        
        const args = argumentTransformer([graphName, cypherQuery, params]);
        const command = new GraphCommand(readOnly ? 'GRAPH.RO_QUERY' : 'GRAPH.QUERY', args)

        if (isRedisCommand(command)) {
            if (readOnly) {
                command.isReadOnly = true;
            }

            return command;
        }
        return null;
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
