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
var _Path_nodes, _Path_edges;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Path = void 0;
class Path {
    constructor(nodes, edges) {
        _Path_nodes.set(this, void 0);
        _Path_edges.set(this, void 0);
        __classPrivateFieldSet(this, _Path_nodes, nodes, "f");
        __classPrivateFieldSet(this, _Path_edges, edges, "f");
    }
    get nodes() {
        return __classPrivateFieldGet(this, _Path_nodes, "f");
    }
    get edges() {
        return __classPrivateFieldGet(this, _Path_edges, "f");
    }
    getNode(index) {
        return __classPrivateFieldGet(this, _Path_nodes, "f")[index];
    }
    getEdge(index) {
        return __classPrivateFieldGet(this, _Path_edges, "f")[index];
    }
    get firstNode() {
        return __classPrivateFieldGet(this, _Path_nodes, "f")[0];
    }
    get lastNode() {
        return __classPrivateFieldGet(this, _Path_nodes, "f")[__classPrivateFieldGet(this, _Path_nodes, "f").length - 1];
    }
    get nodeCount() {
        return __classPrivateFieldGet(this, _Path_nodes, "f").length;
    }
    get edgeCount() {
        return __classPrivateFieldGet(this, _Path_edges, "f").length;
    }
    toString() {
        return JSON.stringify(this);
    }
}
exports.Path = Path;
_Path_nodes = new WeakMap(), _Path_edges = new WeakMap();
