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
exports.RedisGraph = exports.packObject = exports.getStatistics = void 0;
const Redis = __importStar(require("ioredis"));
const Graph_1 = require("./Graph");
const GraphResponse_1 = require("./GraphResponse");
var Stats_1 = require("./Stats");
Object.defineProperty(exports, "getStatistics", { enumerable: true, get: function () { return Stats_1.getStatistics; } });
function packObject(array) {
    const result = {};
    const length = array.length;
    for (let i = 1; i < length; i += 2) {
        result[array[i - 1]] = array[i];
    }
    return result;
}
exports.packObject = packObject;
class Connector extends Redis.SentinelConnector {
    constructor(options) {
        super({
            ...options,
        });
    }
    async getSlaves() {
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
        const result = await client.sentinel("slaves", this.options.name);
        const availableSlaves = result.map(packObject)
            .filter((slave) => slave.flags && !slave.flags.match(/(disconnected|s_down|o_down)/));
        const slaves = [];
        for (const { ip: host, port } of availableSlaves) {
            const { sentinels, sentinelCommandTimeout, sentinelPassword, sentinelMaxConnections, sentinelReconnectStrategy, sentinelRetryStrategy, sentinelTLS, sentinelUsername, updateSentinels, enableTLSForSentinelMode, Connector, ...options } = this.options;
            const slave = new Redis.default(parseInt(port), host, { ...options });
            slaves.push(slave);
        }
        return slaves;
    }
}
class RedisGraph extends Redis.default {
    constructor(graphName, { role = 'master', ...options }) {
        super({ ...options, failoverDetector: !process.env["IOREDIS_MASTER_ONLY"], role, Connector });
        this.graphName = graphName;
        this.pool = [];
        this.masterPool = [];
        this.once("connect", async () => {
            for (let i = 0; i < 4; i++) {
                const { sentinels, sentinelCommandTimeout, sentinelPassword, sentinelMaxConnections, sentinelReconnectStrategy, sentinelRetryStrategy, sentinelTLS, sentinelUsername, updateSentinels, enableTLSForSentinelMode, Connector, ...options } = this.options;
                const master = new Redis.default(this.stream.remotePort, this.stream.remoteAddress, { ...options });
                this.masterPool.push(master);
            }
            if (!process.env["IOREDIS_MASTER_ONLY"]) {
                const slaves = await this.connector.getSlaves();
                this.pool.push(...slaves);
            }
        });
    }
    async getConnection(readOnly = true, cb) {
        if (!readOnly || process.env["IOREDIS_MASTER_ONLY"]) {
            const node = this.masterPool.shift();
            if (node) {
                this.masterPool.push(node);
            }
            return cb(node ?? this);
        }
        const node = this.pool.shift();
        if (!node) {
            return cb(this);
        }
        this.pool.push(node);
        return cb(node);
    }
    async query(command, params, options = {}) {
        const _this = this;
        const { graphName = this.graphName, readOnly, timeout } = options;
        const graph = new Graph_1.Graph({ readOnly, graphName, timeout, });
        const buf = await this.getConnection(readOnly, (node) => node.sendCommand(graph.query(command, params)));
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
