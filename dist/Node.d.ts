import { Graph } from './Graph';
export declare class Node {
    #private;
    id: number;
    label: string;
    properties: Record<string, unknown>;
    constructor(graph: Graph, id: number, label: string, properties: Record<string, unknown>);
    toString(): string;
}
