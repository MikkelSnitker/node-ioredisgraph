import { GraphCommand, CypherQueryOptions } from "./GraphCommand";
export declare class Graph {
    readonly options: CypherQueryOptions;
    nodes: Map<number, {}>;
    edges: Map<number, {}>;
    constructor(options: CypherQueryOptions);
    get name(): string | undefined;
    query<T>(cypherQuery: string, params: Record<string, unknown>): GraphCommand;
}
