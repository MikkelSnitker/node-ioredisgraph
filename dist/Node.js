"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var _Node_graph;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Node = void 0;
class Node {
    constructor(graph, id, label, properties) {
        this.id = id;
        this.label = label;
        this.properties = properties;
        _Node_graph.set(this, void 0);
        __classPrivateFieldSet(this, _Node_graph, graph, "f");
    }
    toString() {
        return JSON.stringify(this);
    }
}
exports.Node = Node;
_Node_graph = new WeakMap();
