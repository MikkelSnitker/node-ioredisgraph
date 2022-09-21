
import {Redis} from 'ioredis';
import { getStatistics, RedisGraph, RedisGraphCluster } from './';

const cluster = new RedisGraphCluster("Test1", [{ host: "35.228.49.188", port: 6379 }], {
    redisOptions: {
        password: '....',
    },
    scaleReads: 'all',
})

const redis = new RedisGraph("Test1", {

    sentinels: [{
        host: "redis-sentinel-develop",
        port: 26379
    }],
    sentinelPassword: '....',
    password: '....',
    name: "mymaster",
});

async function migrate(from: string, to: string) {
    const map = new Map<string, Redis>()
    for(const node of cluster.nodes("master")){
        const id = await node.cluster("MYID");
        map.set(id, node);
    }
    
    const src = map.get(from);
    const desc = map.get(to);
    function parseKV(data: unknown[]): any{
        if(Array.isArray(data)){
            const res = {
                
            }

            while(data.length > 0) {
                const field = data.shift();
                const value = data.shift();
                Object.assign(res, {[field]: value})
            }

            return res;
        }

        return data;
    }
    const shards: Array<{
        slots: Array<number>;
        nodes: Array<string[]>
    }> = (await cluster.cluster("SHARDS") as unknown[][]).map(parseKV);
    for(const shard of shards){
        const nodes: Array<{id: string}> =  shard.nodes.map(parseKV);
        if(nodes.find(x=>x.id == from)) {
            do {
                let [slot, end] = shard.slots.splice(0,2);
                do {
                    let keys = await cluster.cluster("GETKEYSINSLOT", slot, 100);
                    if (keys.length >0) {
                        console.log("MOVE %d FROM %s TO %s", slot++, from, to)
                    }

                    
                } while(slot++ < end)
            } while(shard.slots.length > 0)

        }
    }
    console.log(shards)


}

async function run() {
   await migrate("538f36627c210ae3f89b0d2af9f2059414d54ea9","5e0810a03f604e69ba61c13fd45333be7606b26b")


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
