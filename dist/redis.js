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
const Stats_1 = require("./Stats");
var Stats_2 = require("./Stats");
Object.defineProperty(exports, "getStatistics", { enumerable: true, get: function () { return Stats_2.getStatistics; } });
function packObject(array) {
    const result = {};
    const length = array.length;
    for (let i = 1; i < length; i += 2) {
        result[array[i - 1]] = array[i];
    }
    return result;
}
exports.packObject = packObject;
function shuffleArray(arr) {
    return arr.map(value => ({ value, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ value }) => value);
}
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
            for (let i = 0; i < 5; i++) {
                const { sentinels, sentinelCommandTimeout, sentinelPassword, sentinelMaxConnections, sentinelReconnectStrategy, sentinelRetryStrategy, sentinelTLS, sentinelUsername, updateSentinels, enableTLSForSentinelMode, Connector, ...options } = this.options;
                const slave = new Redis.default(parseInt(port), host, { ...options });
                slaves.push(slave);
            }
        }
        return slaves;
    }
}
class RedisGraph extends Redis.default {
    constructor(graphName, { role = 'master', ...options }) {
        super({ ...options, failoverDetector: !process.env["IOREDIS_MASTER_ONLY"], role, Connector });
        this.graphName = graphName;
        // private masterPool: Array<Redis.Redis> = [];
        this.stats = new Map();
        this.queue = [];
        this.pool = new Promise((resolve) => {
            const pool = [];
            this.once("connect", async () => {
                if (!process.env["IOREDIS_MASTER_ONLY"]) {
                    const slaves = await this.connector.getSlaves();
                    pool.push(...slaves);
                    for (const node of slaves) {
                        if (["ready", "connect"].indexOf(node.status) == -1) {
                            await new Promise(resolve => node.once("connect", resolve));
                        }
                        const { remoteAddress, remotePort } = node.stream;
                        this.stats.set(`${remoteAddress}:${remotePort}`, { ops: 0, startTime: Date.now(), duration: 0 });
                    }
                    resolve(shuffleArray(pool));
                }
            });
        });
        setInterval(async () => {
            console.log("STATS:");
            for (let [key, stats] of await this.stats) {
                const now = Date.now();
                const { ops, startTime, duration } = stats;
                console.log("%s: ops/s %d, ops total: %d, duration: %d ms", key, ops / ((now - startTime) / 1000), ops, duration);
                this.stats.set(key, { ops: 0, startTime: Date.now(), duration: 0 });
            }
            console.log("QUEUE LENGTH %d POOL SIZE %d", this.queue.length, (await this.pool).length);
        }, 10000);
    }
    async getConnection(readOnly = false, cb) {
        if (!readOnly || process.env["IOREDIS_MASTER_ONLY"]) {
            return cb(this);
        }
        const pool = await this.pool;
        let node = pool.shift();
        while (!node) {
            node = await new Promise((resolve) => this.queue.push(resolve));
        }
        if (!node) {
            return cb(this);
        }
        return Promise.resolve(cb(node)).finally(() => {
            const resolve = this.queue.shift();
            if (resolve) {
                resolve(node);
            }
            else if (node) {
                pool.push(node);
            }
        });
    }
    async query(command, params, options = {}) {
        const _this = this;
        const { graphName = this.graphName, readOnly, timeout } = options;
        const graph = new Graph_1.Graph({ readOnly, graphName, timeout, });
        const [node, buf] = await Promise.all(await this.getConnection(readOnly, (node) => [node, node.sendCommand(graph.query(command, params))]));
        const response = new GraphResponse_1.GraphResponse(graph, this, graph.options);
        const data = response.parse(buf);
        data.then((x) => {
            const redisStats = (0, Stats_1.getStatistics)(x);
            if (node && node.stream) {
                const { remoteAddress, remotePort } = node.stream;
                if (redisStats && this.stats.has(`${remoteAddress}:${remotePort}`)) {
                    const stats = this.stats.get(`${remoteAddress}:${remotePort}`);
                    const { QueryInternalExecutionTime } = redisStats;
                    stats.duration += QueryInternalExecutionTime ?? 0;
                    stats.ops++;
                }
            }
        });
        return data;
    }
}
exports.RedisGraph = RedisGraph;
Redis.Pipeline.prototype.query = function (query, params, options = { readOnly: true }) {
    const { graphName = this.redis.graphName, readOnly } = options;
    const graph = new Graph_1.Graph({ readOnly, graphName });
    this.sendCommand(graph.query(query, params));
    return this;
};
