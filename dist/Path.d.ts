import { Node } from './Node';
import { Edge } from './Edge';
export declare class Path {
    #private;
    constructor(nodes: Node[], edges: Edge[]);
    get nodes(): Node[];
    get edges(): Edge[];
    getNode(index: number): Node;
    getEdge(index: number): Edge;
    get firstNode(): Node;
    get lastNode(): Node;
    get nodeCount(): number;
    get edgeCount(): number;
    toString(): string;
}
