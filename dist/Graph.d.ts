import { Commander } from "ioredis";
import { CypherQueryOptions } from "./GraphCommand";
export declare class Graph {
    node: Commander;
    private options;
    nodes: Map<number, {}>;
    edges: Map<number, {}>;
    constructor(node: Commander, options: CypherQueryOptions);
    query<T>(cypherQuery: string, params: Record<string, unknown>): Promise<T[]>;
}
