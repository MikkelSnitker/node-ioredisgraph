"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _1 = require("./");
const cluster = new _1.RedisGraphCluster("Test1", [{ host: "35.228.49.188", port: 6379 }], {
    redisOptions: {
        password: 'zweYSkkTLo',
    },
    scaleReads: 'all',
});
/*
const redis = new RedisGraph("Test1", {

    sentinels: [{
        host: "redis-sentinel-develop",
        port: 26379
    }],
    sentinelPassword: '....',
    password: '....',
    name: "mymaster",
});*/
async function migrate(from, to) {
    const nodes = cluster.nodes("master");
    for (const node of nodes) {
        const [id, host, , , , , , , ...slots] = (await node.cluster("NODES")).split("\n").map(x => x.split(" ")).find(x => x[2] === "myself,master") ?? [];
        for (const [slot, end] of slots.map(x => x.split("-").map(x => parseInt(x)))) {
            for (let i = slot; i < end; i++) {
                let keys = [];
                let KEY_BATCH_SIZE = 100;
                let cursor = 0;
                do {
                    keys = await node.cluster("GETKEYSINSLOT", i, KEY_BATCH_SIZE * (++cursor));
                } while (KEY_BATCH_SIZE * (cursor) <= keys.length);
                if (keys.length > 0) {
                    const response = await node.migrate(to.host, to.port, "", 0, 10000, "COPY", "REPLACE", "AUTH", to.password, "KEYS", ...keys);
                    console.log(response);
                }
            }
        }
    }
}
async function run() {
    await new Promise((resolve) => cluster.once("connect", resolve));
    await migrate("538f36627c210ae3f89b0d2af9f2059414d54ea9", {
        host: "redis-sentinel-develop-node-2.redis-sentinel-develop-headless.develop.svc.cluster.local",
        port: 6379,
        password: "WLaBMNzloe"
    });
    /*
      const foo = await redis.get("foo");
      console.log(foo);
      
      const nodes = redis.nodes;
      const master = Array.from(nodes.values()).find(x=>x.flags == "master");
      let {host, port, password} = master?.options ?? {}
      if(host && port){
          host = '10.92.6.124'
          const migration = await src.migrate(host, port, "foo", 0, 5000, "COPY", "REPLACE", "AUTH", password!);
          console.log(migration);
          
      }*/
}
run();
