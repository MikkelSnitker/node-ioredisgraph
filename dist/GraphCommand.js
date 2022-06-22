"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRedisCommand = exports.GraphCommand = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
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
class GraphCommand extends ioredis_1.default.Command {
    constructor(name, args) {
        super(name, args, { replyEncoding: "utf8" });
    }
    static create(node, cypherQuery, params, options) {
        const { readOnly = false, graphName } = options ?? {};
        if (!graphName) {
            throw new Error("Graphname missing");
        }
        const args = argumentTransformer([graphName, cypherQuery, params]);
        const command = new GraphCommand(readOnly ? 'GRAPH.RO_QUERY' : 'GRAPH.QUERY', args);
        if (isRedisCommand(command)) {
            if (readOnly) {
                command.isReadOnly = true;
            }
            return command;
        }
        return null;
    }
}
exports.GraphCommand = GraphCommand;
function isRedisCommand(x) {
    return x instanceof ioredis_1.default.Command;
}
exports.isRedisCommand = isRedisCommand;
