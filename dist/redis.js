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
exports.RedisGraph = exports.getStatistics = void 0;
const Redis = __importStar(require("ioredis"));
const Graph_1 = require("./Graph");
const GraphResponse_1 = require("./GraphResponse");
var Stats_1 = require("./Stats");
Object.defineProperty(exports, "getStatistics", { enumerable: true, get: function () { return Stats_1.getStatistics; } });
class Connector extends Redis.SentinelConnector {
    constructor(options) {
        super({
            ...options,
            preferredSlaves(slaves) {
                return slaves[Math.floor((Math.random() * slaves.length))];
            }
        });
        this.sentinelNatResolve = (node) => {
            return ({ ...node, host: '127.0.0.1' });
        };
    }
    async getSlave() {
        if (process.env["IOREDIS_MASTER_ONLY"]) {
            return null;
        }
        if (this.slave) {
            return this.slave;
        }
        let c = 0;
        let endpoint;
        while (c < 2) {
            const { value, done } = this.sentinelIterator.next();
            if (done) {
                this.sentinelIterator.reset(false);
            }
            else {
                endpoint = value;
                break;
            }
            c++;
        }
        const client = this.connectToSentinel(endpoint);
        if (!client)
            return null;
        endpoint = await this.resolveSlave(client);
        if (!endpoint)
            return null;
        const { sentinels, sentinelCommandTimeout, sentinelPassword, sentinelMaxConnections, sentinelReconnectStrategy, sentinelRetryStrategy, sentinelTLS, sentinelUsername, updateSentinels, enableTLSForSentinelMode, Connector, ...options } = this.options;
        const slave = new Redis.default({ ...options, ...endpoint, });
        const onerror = (err) => {
            this.slave = undefined;
            console.error(err);
        };
        slave.once("error", onerror);
        return this.slave = slave;
    }
}
class RedisGraph extends Redis.default {
    constructor(graphName, { role = 'master', ...options }) {
        super({ ...options, role, Connector });
        this.graphName = graphName;
    }
    async getSlave() {
        const connector = this.connector;
        return connector.getSlave();
    }
    async query(command, params, options = {}) {
        const _this = this;
        const { graphName = this.graphName, readOnly } = options;
        const graph = new Graph_1.Graph({ readOnly, graphName });
        let node = readOnly ? await this.getSlave() ?? this : this;
        const buf = await node.sendCommand(graph.query(command, params));
        const response = new GraphResponse_1.GraphResponse(graph, this, graph.options);
        return response.parse(buf);
    }
}
exports.RedisGraph = RedisGraph;
Redis.Pipeline.prototype.query = function (query, params, options = { readOnly: true }) {
    const { graphName = this.redis.graphName, readOnly } = options;
    const graph = new Graph_1.Graph({ readOnly, graphName });
    this.sendCommand(graph.query(query, params));
    return this;
};
