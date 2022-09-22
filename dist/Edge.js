"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _Edge_graph, _Edge_srcNodeId, _Edge_destNodeId;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Edge = void 0;
class Edge {
    constructor(graph, srcNodeId, relation, destNodeId, properties) {
        this.relation = relation;
        this.properties = properties;
        _Edge_graph.set(this, void 0);
        _Edge_srcNodeId.set(this, void 0);
        _Edge_destNodeId.set(this, void 0);
        __classPrivateFieldSet(this, _Edge_graph, graph, "f");
        __classPrivateFieldSet(this, _Edge_destNodeId, destNodeId, "f");
        __classPrivateFieldSet(this, _Edge_srcNodeId, srcNodeId, "f");
    }
    get src() {
        return __classPrivateFieldGet(this, _Edge_graph, "f").nodes.get(__classPrivateFieldGet(this, _Edge_srcNodeId, "f"));
    }
    get dest() {
        return __classPrivateFieldGet(this, _Edge_graph, "f").nodes.get(__classPrivateFieldGet(this, _Edge_destNodeId, "f"));
    }
    setId(id) {
        this.id = id;
    }
    toString() {
        return JSON.stringify(this);
    }
}
exports.Edge = Edge;
_Edge_graph = new WeakMap(), _Edge_srcNodeId = new WeakMap(), _Edge_destNodeId = new WeakMap();
