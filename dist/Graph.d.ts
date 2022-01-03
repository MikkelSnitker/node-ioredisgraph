import { RedisGraphCluster } from ".";
export declare class Graph {
    private connection;
    nodes: Map<number, {}>;
    edges: Map<number, {}>;
    constructor(connection: RedisGraphCluster);
    getLabels(id: number): Promise<string | null>;
    getPropertyKeys(id: number): Promise<string | null>;
    getRelationshipTypes(id: number): Promise<string | null>;
}
