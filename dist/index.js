"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisGraphCluster = exports.getStatistics = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const Graph_1 = require("./Graph");
var Stats_1 = require("./Stats");
Object.defineProperty(exports, "getStatistics", { enumerable: true, get: function () { return Stats_1.getStatistics; } });
class RedisGraphCluster extends ioredis_1.default.Cluster {
    constructor(graphName, nodes, { scaleReads = "all", ...options } = {}) {
        super(nodes, {
            scaleReads, ...options
        });
        this.graphName = graphName;
        this.keySlotCache = new Map();
    }
    async getNode(isReadOnly, key) {
        let keySlot = this.keySlotCache.get(key);
        if (!keySlot) {
            keySlot = await this.call("CLUSTER", "KEYSLOT", key);
            this.keySlotCache.set(key, keySlot);
        }
        const hasSlot = ({ options }, keySlot) => {
            const slot = this.slots[keySlot] ?? [];
            return slot.includes(`${options.host}:${options.port}`);
        };
        let nodes;
        let { scaleReads } = this.options;
        if (isReadOnly) {
            if (typeof scaleReads === "function") {
                scaleReads = "all";
            }
            nodes = this.nodes(scaleReads);
        }
        else {
            nodes = this.nodes("master");
        }
        nodes = nodes.filter((node) => hasSlot(node, keySlot));
        if (nodes.length == 0 && isReadOnly) {
            return this.getNode(false, key);
        }
        return nodes[Math.floor((Math.random() * nodes.length))];
    }
    async query(command, params, options = {}) {
        const _this = this;
        const { graphName = this.graphName, readOnly } = options;
        if (this.status !== "ready") {
            await new Promise((resolve) => this.once("ready", resolve));
        }
        let redis = await this.getNode(readOnly ?? false, graphName);
        const graph = new Graph_1.Graph(redis || this, { readOnly, graphName });
        return graph.query(command, params);
    }
}
exports.RedisGraphCluster = RedisGraphCluster;
