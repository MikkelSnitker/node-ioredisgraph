"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRedisCommand = exports.GraphCommand = void 0;
const Redis = __importStar(require("ioredis"));
/*

declare module "ioredis" {


    interface Commander {
        sendCommand(command: unknown): Promise<RedisGraphResponse>;
    }

    interface Redis extends Commander {
    
    }
}
*/
function serialize(obj) {
    if (obj === null || obj === undefined) {
        return null;
    }
    if (Array.isArray(obj)) {
        return `[${obj.map(serialize).join(', ')}]`;
    }
    if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
        return `{${Object.keys(obj).map(key => `${key}: ${serialize(obj[key])}`).join(', ')}}`;
    }
    return JSON.stringify(obj);
}
function argumentTransformer(args) {
    const [graphName, cypher, params] = args;
    const paramStr = Object.keys(params ?? {}).reduce((result, key) => result += `${key} = ${serialize(params[key])} `, '');
    return [graphName, `CYPHER ${paramStr} ${cypher}`, '--compact'];
}
class GraphCommand extends Redis.Command {
    constructor(graph, name, args) {
        super(name, args, { replyEncoding: "utf8" });
        this.graph = graph;
    }
    static create(graph, cypherQuery, params, options) {
        const { readOnly = false, graphName, timeout = 10000 } = options ?? {};
        if (!graphName) {
            throw new Error("Graphname missing");
        }
        const args = argumentTransformer([graphName, cypherQuery, params]);
        const command = new GraphCommand(graph, readOnly ? 'GRAPH.RO_QUERY' : 'GRAPH.QUERY', readOnly ? [...args, 'TIMEOUT', timeout] : args);
        if (isRedisCommand(command)) {
            if (readOnly) {
                command.isReadOnly = true;
            }
            return command;
        }
    }
}
exports.GraphCommand = GraphCommand;
function isRedisCommand(x) {
    return x instanceof Redis.Command;
}
exports.isRedisCommand = isRedisCommand;
