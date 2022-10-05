"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATS = exports.parseStatistics = exports.getStatistics = void 0;
function getStatistics(response) {
    if (exports.STATS in response) {
        return response[exports.STATS];
    }
    return null;
}
exports.getStatistics = getStatistics;
function parseStatistics(stats) {
    function parseKey(key) {
        return key.split(" ").map(x => x.replace(/^./, (a) => a.toUpperCase())).join("");
    }
    function parseValue(key, value) {
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
            const value = parseValue(key, val);
            return Object.assign(result, { [key]: value });
        }, {});
    }
    catch (err) {
        console.error(err);
        console.error(stats);
        throw err;
    }
}
exports.parseStatistics = parseStatistics;
exports.STATS = Symbol("stats");
