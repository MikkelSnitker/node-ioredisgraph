import { RedisGraphCluster } from './';

const redis = new  RedisGraphCluster("Test1", [
 {
     host: "redis-cluster.redis.svc.cluster.local",
     port: 6379
 }   
]);

async function  run() {
    const response = await redis.query("MATCH (a:wish{id:$wishId})-[r:RESERVED_BY]->(u:user) RETURN null as n, 1 as int, 1.5 as float, true as boolean, r {.id, .quantity} as reservation, collect(u { .firstName }) as users, u.id as id",
   // const response = await redis.query("MATCH (a:wish{id:$wishId})-[r:RESERVED_BY]->(u:user) RETURN a, r, u, point({latitude: 55.785290, longitude: 12.321330}) as geo",
   //const response = await redis.query("MATCH a = (a:wish{id:$wishId})-[r:RESERVED_BY]->(u:user) RETURN a",
        {wishId: "qBNImEi8gsbEcYnF27iya"},
        {readOnly: true}
    );

    console.log(response)

}

run();
