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
exports.RedisGraphCluster = exports.STATS = void 0;
const ioredis_1 = __importStar(require("ioredis"));
const Node_1 = require("./Node");
const Edge_1 = require("./Edge");
const Path_1 = require("./Path");
const Graph_1 = require("./Graph");
/*
export class RedisGraph extends Redis {
    private graphName!:string;

    constructor (graphName:string, port?: number, host?: string, options?: Redis.RedisOptions);
    constructor (graphName:string, host?: string, options?: Redis.RedisOptions);
    constructor (graphName:string, options?: Redis.RedisOptions);
    constructor (graphName:string, ...args:any[]) {
      super(...args)
      this.graphName = graphName

      if (!this.graphName || this.graphName.length < 1) {
        throw new Error('Must specify a graph name in constructor')
      }

      Redis.Command.setArgumentTransformer('GRAPH.QUERY',argumentTransformer)
      Redis.Command.setReplyTransformer('GRAPH.QUERY',replyTransformer)
    }

    query (command:string) {
      const _this:any = this
      super.hset
      return _this.call('GRAPH.QUERY', this.graphName, `${command}`)
    }

    delete () {
      const _this:any = this
      return _this.call('GRAPH.DELETE', this.graphName)
    }

    explain (command:string) {
      const _this:any = this
      return _this.call('GRAPH.EXPLAIN', this.graphName, `${command}`)
    }
}
*/
const nodeId = Symbol('nodeId');
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
var ColumnType;
(function (ColumnType) {
    ColumnType[ColumnType["COLUMN_UNKNOWN"] = 0] = "COLUMN_UNKNOWN";
    ColumnType[ColumnType["COLUMN_SCALAR"] = 1] = "COLUMN_SCALAR";
    ColumnType[ColumnType["COLUMN_NODE"] = 2] = "COLUMN_NODE";
    ColumnType[ColumnType["COLUMN_RELATION"] = 3] = "COLUMN_RELATION";
})(ColumnType || (ColumnType = {}));
;
var ValueType;
(function (ValueType) {
    ValueType[ValueType["VALUE_UNKNOWN"] = 0] = "VALUE_UNKNOWN";
    ValueType[ValueType["VALUE_NULL"] = 1] = "VALUE_NULL";
    ValueType[ValueType["VALUE_STRING"] = 2] = "VALUE_STRING";
    ValueType[ValueType["VALUE_INTEGER"] = 3] = "VALUE_INTEGER";
    ValueType[ValueType["VALUE_BOOLEAN"] = 4] = "VALUE_BOOLEAN";
    ValueType[ValueType["VALUE_DOUBLE"] = 5] = "VALUE_DOUBLE";
    ValueType[ValueType["VALUE_ARRAY"] = 6] = "VALUE_ARRAY";
    ValueType[ValueType["VALUE_EDGE"] = 7] = "VALUE_EDGE";
    ValueType[ValueType["VALUE_NODE"] = 8] = "VALUE_NODE";
    ValueType[ValueType["VALUE_PATH"] = 9] = "VALUE_PATH";
    ValueType[ValueType["VALUE_MAP"] = 10] = "VALUE_MAP";
    ValueType[ValueType["VALUE_POINT"] = 11] = "VALUE_POINT";
})(ValueType || (ValueType = {}));
;
function argumentTransformer(args) {
    const [graphName, cypher, params] = args;
    const paramStr = Object.keys(params ?? {}).reduce((result, key) => result += `${key} = ${serialize(params[key])} `, '');
    return [graphName, `CYPHER ${paramStr}; ${cypher}`, '--compact'];
}
function parseStatistics(stats) {
    return stats.map(x => x.split(":")).reduce((result, [prop, val]) => Object.assign(result, { [prop.toUpperCase()]: val }));
}
exports.STATS = Symbol("stats");
async function parseValue(type, value) {
    switch (type) {
        case ValueType.VALUE_UNKNOWN:
        case ValueType.VALUE_NULL:
        case ValueType.VALUE_STRING:
        case ValueType.VALUE_INTEGER:
            return value;
            break;
        case ValueType.VALUE_BOOLEAN:
            return value === "true";
            break;
        case ValueType.VALUE_DOUBLE:
            return parseFloat(value);
            break;
        case ValueType.VALUE_ARRAY:
            return Promise.all(value.map(([type, value]) => parseValue.call(this, type, value)));
            break;
        case ValueType.VALUE_EDGE:
            {
                const [id, type, src, dest, props] = value;
                const relationType = await this.getRelationshipTypes(type);
                const prop = {};
                for (let [prop, type, value] of props) {
                    const field = await this.getPropertyKeys(prop);
                    if (field) {
                        Object.assign(prop, { [field]: await parseValue.call(this, type, value) });
                    }
                }
                const edge = new Edge_1.Edge(this, src, relationType, dest, prop);
                this.edges.set(id, edge);
                return edge;
            }
            break;
        case ValueType.VALUE_NODE:
            const prop = {};
            const [id, [label], props] = value;
            const labels = await this.getLabels(label);
            for (let [propId, type, value] of props) {
                const key = await this.getPropertyKeys(propId);
                if (key) {
                    Object.assign(prop, { [key]: await parseValue.call(this, type, value) });
                }
            }
            const node = new Node_1.Node(this, id, labels, prop);
            this.nodes.set(id, node);
            return node;
            break;
        case ValueType.VALUE_PATH:
            const [[nodesType, nodesValue], [edgesType, edgesValue]] = value;
            const [nodes, edges] = await Promise.all([
                parseValue.call(this, nodesType, nodesValue),
                parseValue.call(this, edgesType, edgesValue)
            ]);
            const path = new Path_1.Path(nodes, edges);
            return path;
            break;
        case ValueType.VALUE_MAP:
            const obj = {};
            let values = value;
            for (; values.length > 0;) {
                const [field = false, [type, value]] = values.splice(0, 2);
                if (field !== false) {
                    Object.assign(obj, { [field]: await parseValue.call(this, type, value) });
                }
            }
            return obj;
            break;
        case ValueType.VALUE_POINT:
            return value.map(parseFloat);
            break;
    }
}
async function replyTransformer(response) {
    const data = [];
    if (response.length === 3) {
        const graph = new Graph_1.Graph(this);
        const [header, result, stats] = response;
        for (let rows of result) {
            let index = 0;
            const obj = {};
            for (let [type, value] of rows) {
                const val = await parseValue.call(graph, type, value);
                const field = header[index][1];
                Object.assign(obj, { [field]: val });
                index++;
            }
            data.push(obj);
            Object.assign(data, { [exports.STATS]: parseStatistics(stats) });
        }
    }
    else {
        const [stats] = response;
        Object.assign(data, { [exports.STATS]: parseStatistics(stats) });
    }
    return data;
}
const labelCache = new WeakMap();
const typeCache = new WeakMap();
const propertyKeyCache = new WeakMap();
class RedisGraphCluster extends ioredis_1.default.Cluster {
    constructor(graphName, nodes, { scaleReads = "master", ...options } = {}) {
        super(nodes, {
            scaleReads(nodes, command) {
                if (typeof scaleReads === "function") {
                    return scaleReads(nodes, command);
                }
                if (command.isReadOnly) {
                    if (scaleReads === "all") {
                        return nodes;
                    }
                    return nodes.filter(x => x.options.readOnly);
                }
                else {
                    return nodes.filter(x => !x.options.readOnly);
                }
            }, ...options
        });
        this.graphName = graphName;
        ioredis_1.default.Command.setArgumentTransformer('GRAPH.QUERY', argumentTransformer.bind(this));
        ioredis_1.default.Command.setReplyTransformer('GRAPH.QUERY', replyTransformer.bind(this));
        ioredis_1.default.Command.setArgumentTransformer('GRAPH.RO_QUERY', argumentTransformer.bind(this));
        ioredis_1.default.Command.setReplyTransformer('GRAPH.RO_QUERY', replyTransformer.bind(this));
    }
    async getPropertyKeys(id) {
        let propertyKeys = propertyKeyCache.get(this);
        if (!propertyKeys || !propertyKeys[id]) {
            propertyKeys = (await this.query("call db.propertyKeys()", {}, { readOnly: true }))?.map(({ propertyKey }) => propertyKey);
            propertyKeyCache.set(this, propertyKeys);
        }
        if (!propertyKeys) {
            return null;
        }
        return propertyKeys[id];
    }
    async getRelationshipTypes(id) {
        let types = typeCache.get(this);
        if (!types || !types[id]) {
            types = (await this.query("call db.relationshipTypes()", {}, { readOnly: true }))?.map(({ relationshipType }) => relationshipType);
            typeCache.set(this, types);
        }
        if (!types) {
            return null;
        }
        return types[id];
    }
    async getLabels(id) {
        let labels = labelCache.get(this);
        if (!labels || !labels[id]) {
            labels = (await this.query("call db.labels()", {}, { readOnly: true }))?.map(({ label }) => label);
            labelCache.set(this, labels);
        }
        if (!labels) {
            return null;
        }
        return labels[id];
    }
    async sendCommand(...args) {
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
