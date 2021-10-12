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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisGraphCluster = exports.RedisGraph = void 0;
const ioredis_1 = __importStar(require("ioredis"));
const camelcase_1 = __importDefault(require("camelcase"));
const lodash_1 = __importDefault(require("lodash"));
class RedisGraph extends ioredis_1.default {
    constructor(graphName, ...args) {
        super(...args);
        this.graphName = graphName;
        if (!this.graphName || this.graphName.length < 1) {
            throw new Error('Must specify a graph name in constructor');
        }
        ioredis_1.default.Command.setArgumentTransformer('GRAPH.QUERY', argumentTransformer);
        ioredis_1.default.Command.setReplyTransformer('GRAPH.QUERY', replyTransformer);
    }
    query(command) {
        const _this = this;
        super.hset;
        return _this.call('GRAPH.QUERY', this.graphName, `${command}`);
    }
    delete() {
        const _this = this;
        return _this.call('GRAPH.DELETE', this.graphName);
    }
    explain(command) {
        const _this = this;
        return _this.call('GRAPH.EXPLAIN', this.graphName, `${command}`);
    }
}
exports.RedisGraph = RedisGraph;
function parseMetaInformation(array) {
    const meta = {};
    for (const prop of array) {
        let [name, value] = prop.split(': ');
        if (value) {
            value = value.trim();
            name = camelcase_1.default(name);
            meta[name] = value;
        }
    }
    return meta;
}
const nodeId = Symbol('nodeId');
function parseResult(columnHeaders, singleResult) {
    const columns = columnHeaders.map((columnHeader, index) => {
        const name = columnHeader;
        let value = singleResult[index];
        if (Array.isArray(value)) {
            value = lodash_1.default.fromPairs(value);
        }
        if (value == null) {
            return null;
        }
        const { id } = value;
        delete value.id;
        Object.assign(value, { [nodeId]: id });
        if (value.properties) {
            lodash_1.default.defaults(value, lodash_1.default.fromPairs(value.properties));
            delete value.properties;
        }
        return [name, value];
    }).filter(x => x !== null);
    if (columns.length === 0) {
        return null;
    }
    return lodash_1.default.fromPairs(columns);
}
function serialize(obj) {
    if (obj === null) {
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
    return [graphName, `CYPHER ${paramStr}; ${cypher}`];
}
function replyTransformer(result) {
    const metaInformation = parseMetaInformation(result.pop());
    let parsedResults = Object.assign([], { meta: null });
    parsedResults.meta = metaInformation;
    if (result.length > 1) { // if there are results to parse
        const columnHeaders = result[0];
        const resultSet = result[1];
        parsedResults = resultSet.map((result) => {
            return parseResult(columnHeaders, result);
        });
    }
    return parsedResults.filter(x => x != null);
}
class RedisGraphCluster extends ioredis_1.default.Cluster {
    constructor(graphName, nodes, options) {
        super(nodes, {
            scaleReads(nodes, command) {
                if (command.isReadOnly) {
                    return nodes.slice(1);
                }
                return nodes[0];
            }, ...options
        });
        this.graphName = graphName;
        ioredis_1.default.Command.setArgumentTransformer('GRAPH.QUERY', argumentTransformer);
        ioredis_1.default.Command.setReplyTransformer('GRAPH.QUERY', replyTransformer);
        ioredis_1.default.Command.setArgumentTransformer('GRAPH.RO_QUERY', argumentTransformer);
        ioredis_1.default.Command.setReplyTransformer('GRAPH.RO_QUERY', replyTransformer);
    }
    sendCommand(...args) {
        if (args.length > 0 && args[0] instanceof ioredis_1.Command) {
            const command = args[0];
            if (command.name === "GRAPH.RO_QUERY") {
                command.isReadOnly = true;
            }
        }
        return super.sendCommand.apply(this, args);
    }
    async query(command, params, options = {}) {
        const _this = this;
        const { graphName, readOnly } = options;
        return _this.call(readOnly ? 'GRAPH.RO_QUERY' : 'GRAPH.QUERY', graphName ?? this.graphName, `${command}`, params);
    }
}
exports.RedisGraphCluster = RedisGraphCluster;
