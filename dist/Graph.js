"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Graph = void 0;
class Graph {
    constructor(connection) {
        this.connection = connection;
        this.nodes = new Map();
        this.edges = new Map();
    }
    getLabels(id) {
        return this.connection.getLabels(id);
    }
    getPropertyKeys(id) {
        return this.connection.getPropertyKeys(id);
    }
    getRelationshipTypes(id) {
        return this.connection.getRelationshipTypes(id);
    }
}
exports.Graph = Graph;
