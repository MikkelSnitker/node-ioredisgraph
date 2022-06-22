"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _1 = require("./");
const redis = new _1.RedisGraphCluster("Test1", [
    {
        host: "172.17.0.1",
        port: 6379
    }
]);
async function run() {
    const response = await redis.query("MATCH  a= (c:card)-[l:LOCALIZATION]->(c) return a", 
    // const response = await redis.query("MATCH (a:wish{id:$wishId})-[r:RESERVED_BY]->(u:user) RETURN a, r, u, point({latitude: 55.785290, longitude: 12.321330}) as geo",
    //const response = await redis.query("MATCH a = (a:wish{id:$wishId})-[r:RESERVED_BY]->(u:user) RETURN a",
    { wishId: "qBNImEi8gsbEcYnF27iya" }, { readOnly: false });
    const stats = (0, _1.getStatistics)(response);
    console.log(response);
}
run();
