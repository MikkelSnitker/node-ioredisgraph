"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisGraphCluster = exports.getStatistics = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const GraphCommand_1 = require("./GraphCommand");
var Stats_1 = require("./Stats");
Object.defineProperty(exports, "getStatistics", { enumerable: true, get: function () { return Stats_1.getStatistics; } });
class RedisGraphCluster extends ioredis_1.default.Cluster {
    constructor(graphName, nodes, { scaleReads = "all", ...options } = {}) {
        super(nodes, {
            scaleReads, ...options
        });
        this.graphName = graphName;
    }
    getNode(isReadOnly) {
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
        return nodes[Math.floor((Math.random() * nodes.length))];
    }
    async query(command, params, options = {}) {
        const _this = this;
        const { graphName = this.graphName, readOnly } = options;
        if (this.status !== "ready") {
            await new Promise((resolve) => this.once("ready", resolve));
        }
        let redis = this.getNode(readOnly ?? false);
        return GraphCommand_1.GraphCommand.create(redis, command, params, { readOnly, graphName });
    }
}
exports.RedisGraphCluster = RedisGraphCluster;
