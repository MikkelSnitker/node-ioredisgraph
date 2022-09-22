"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Graph = void 0;
const GraphCommand_1 = require("./GraphCommand");
class Graph {
    constructor(options) {
        this.options = options;
        this.nodes = new Map();
        this.edges = new Map();
    }
    get name() {
        return this.options.graphName;
    }
    query(cypherQuery, params) {
        const command = GraphCommand_1.GraphCommand.create(this, cypherQuery, params, this.options);
        return command;
    }
}
exports.Graph = Graph;
