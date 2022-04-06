export declare type QueryStatistics = string[];
export declare type Stats = {
    LabelsAdded?: number;
    NodesCreated?: number;
    PropertiesSet?: number;
    NodesDeleted?: number;
    RelationshipsDeleted?: number;
    RelationshipsCreated?: number;
    QueryInternalExecutionTime?: number;
};
export declare function getStatistics(response: unknown[]): Stats | null;
export declare function parseStatistics(stats: QueryStatistics): Stats;
export declare const STATS: unique symbol;
