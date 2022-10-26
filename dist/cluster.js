"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
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
exports.RedisGraphCluster = exports.getStatistics = void 0;
const Redis = __importStar(require("ioredis"));
const Graph_1 = require("./Graph");
const GraphCommand_1 = require("./GraphCommand");
const GraphResponse_1 = require("./GraphResponse");
var Stats_1 = require("./Stats");
Object.defineProperty(exports, "getStatistics", { enumerable: true, get: function () { return Stats_1.getStatistics; } });
class RedisGraphCluster extends Redis.Cluster {
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
    async sendCommand(command, stream, node) {
        if (command instanceof GraphCommand_1.GraphCommand) {
            const { graph, isReadOnly } = command;
            const node = await this.getNode(isReadOnly ?? false, graph.name);
            if (node) {
                const response = await super.sendCommand(command, stream);
                return await new GraphResponse_1.GraphResponse(graph, this, graph.options).parse(response);
            }
        }
        return super.sendCommand(command, stream);
    }
    async query(command, params, options = {}) {
        const _this = this;
        const { graphName = this.graphName, readOnly } = options;
        //let redis: Redis.Redis = (await this.getNode(readOnly ?? false, graphName))!;
        const graph = new Graph_1.Graph({ readOnly, graphName });
        return this.sendCommand(graph.query(command, params));
    }
}
exports.RedisGraphCluster = RedisGraphCluster;
