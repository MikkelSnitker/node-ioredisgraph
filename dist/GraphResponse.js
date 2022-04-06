"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphResponse = void 0;
const Edge_1 = require("./Edge");
const Node_1 = require("./Node");
const Path_1 = require("./Path");
const Graph_1 = require("./Graph");
const Stats_1 = require("./Stats");
const GraphCommand_1 = require("./GraphCommand");
const labelCache = new WeakMap();
const typeCache = new WeakMap();
const propertyKeyCache = new WeakMap();
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
class GraphResponse {
    constructor(node, options) {
        this.node = node;
        this.options = options;
        this.graph = new Graph_1.Graph();
    }
    async sendCommand(command) {
        return await GraphCommand_1.GraphCommand.create(this.node, command, {}, this.options);
    }
    async getPropertyKeys(id) {
        let propertyKeys = propertyKeyCache.get(this.node);
        if (!propertyKeys || !propertyKeys[id]) {
            propertyKeys = (await this.sendCommand("call db.propertyKeys()"))?.map(({ propertyKey }) => propertyKey);
            propertyKeyCache.set(this.node, propertyKeys);
        }
        if (!propertyKeys) {
            return null;
        }
        return propertyKeys[id];
    }
    async getRelationshipTypes(id) {
        let types = typeCache.get(this.node);
        if (!types || !types[id]) {
            types = (await this.sendCommand("call db.relationshipTypes()"))?.map(({ relationshipType }) => relationshipType);
            typeCache.set(this.node, types);
        }
        if (!types) {
            return null;
        }
        return types[id];
    }
    async getLabels(id) {
        let labels = labelCache.get(this.node);
        if (!labels || !labels[id]) {
            labels = (await this.sendCommand("call db.labels()"))?.map(({ label }) => label);
            labelCache.set(this.node, labels);
        }
        if (!labels) {
            return null;
        }
        return labels[id];
    }
    async parseValue(type, value) {
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
                return Promise.all(value.map(([type, value]) => this.parseValue(type, value)));
                break;
            case ValueType.VALUE_EDGE:
                {
                    const [id, type, src, dest, props] = value;
                    const relationType = await this.getRelationshipTypes(type);
                    const prop = {};
                    for (let [propId, type, value] of props) {
                        const field = await this.getPropertyKeys(propId);
                        if (field) {
                            Object.assign(prop, { [field]: await this.parseValue(type, value) });
                        }
                    }
                    const edge = new Edge_1.Edge(this.graph, src, relationType, dest, prop);
                    this.graph.edges.set(id, edge);
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
                        Object.assign(prop, { [key]: await this.parseValue(type, value) });
                    }
                }
                const node = new Node_1.Node(this.graph, id, labels, prop);
                this.graph.nodes.set(id, node);
                return node;
                break;
            case ValueType.VALUE_PATH:
                const [[nodesType, nodesValue], [edgesType, edgesValue]] = value;
                const [nodes, edges] = await Promise.all([
                    this.parseValue(nodesType, nodesValue),
                    this.parseValue(edgesType, edgesValue)
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
                        Object.assign(obj, { [field]: await this.parseValue(type, value) });
                    }
                }
                return obj;
                break;
            case ValueType.VALUE_POINT:
                return value.map(parseFloat);
                break;
        }
    }
    async parse(response) {
        const data = [];
        if (response.length === 3) {
            const [header, result, stats] = response;
            for (let rows of result) {
                let index = 0;
                const obj = {};
                for (let [type, value] of rows) {
                    const val = await this.parseValue(type, value);
                    const field = header[index][1];
                    Object.assign(obj, { [field]: val });
                    index++;
                }
                data.push(obj);
            }
            Object.assign(data, { [Stats_1.STATS]: (0, Stats_1.parseStatistics)(stats) });
        }
        else {
            const [stats] = response;
            Object.assign(data, { [Stats_1.STATS]: (0, Stats_1.parseStatistics)(stats) });
        }
        return data;
    }
}
exports.GraphResponse = GraphResponse;
