export type QueryStatistics = string[];
export type Stats = {
    LabelsAdded?: number;
    NodesCreated?: number;
    PropertiesSet?: number;
    NodesDeleted?: number;
    RelationshipsDeleted?: number;
    RelationshipsCreated?: number;
    QueryInternalExecutionTime?: number;
}

export function getStatistics(response: unknown[]): Stats | null {
    if (STATS in response) {
        return (response as any)[STATS];
    }

    return null;
}



export function parseStatistics(stats: QueryStatistics): Stats {
    function parseKey(key: string): keyof Stats {
        return key.split(" ").map(x => x.replace(/^./, (a) => a.toUpperCase())).join("") as keyof Stats;
    }


    function parseValue(key: keyof Stats, value: `${number} milliseconds` | `${number}`) {
        switch (key) {
            case "QueryInternalExecutionTime":
                return parseFloat(value);

            default:
                return parseInt(value);
        }
    }
    try {
    return stats.map(x => x.split(": ")).reduce((result, [prop, val]) => {
        const key = parseKey(prop);
        const value = parseValue(key, val as `${number} milliseconds` | `${number}`);
        return Object.assign(result, { [key]: value });
    }, {} as Stats);
} catch (err){
    console.error(err);
    console.error(stats);
    throw err;
}
}

export const STATS = Symbol("stats");