import { Graph } from './Graph';
export declare class Edge {
    #private;
    relation: string;
    properties: Record<string, unknown>;
    id: number | undefined;
    constructor(graph: Graph, srcNodeId: number, relation: string, destNodeId: number, properties: Record<string, unknown>);
    get src(): {} | undefined;
    get dest(): {} | undefined;
    setId(id: number): void;
    toString(): string;
}
