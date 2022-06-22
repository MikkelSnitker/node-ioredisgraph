"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Graph = void 0;
const GraphCommand_1 = require("./GraphCommand");
const GraphResponse_1 = require("./GraphResponse");
class Graph {
    constructor(node, options) {
        this.node = node;
        this.options = options;
        this.nodes = new Map();
        this.edges = new Map();
    }
    async query(cypherQuery, params) {
        const response = new GraphResponse_1.GraphResponse(this, this.options);
        return response.parse(await this.node.sendCommand(GraphCommand_1.GraphCommand.create(this.node, cypherQuery, params, this.options)));
    }
}
exports.Graph = Graph;
