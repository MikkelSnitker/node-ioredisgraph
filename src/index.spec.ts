import { getStatistics, RedisGraph } from './';

const redis = new  RedisGraph("Test1", {
    
    sentinels: [{
        host: "172.17.0.1",
        port: 55414
    }],
    natMap: {
        '172.22.0.2:6379': {host: "172.17.0.1", port :55407},
        '172.22.0.3:6379': {host: "172.17.0.1", port :55412},
        '172.22.0.4:26379': { host: "172.17.0.1", port: 55413},
        '172.22.0.5:26379': { host: "172.17.0.1", port: 55414},
        '172.22.0.6:26379': { host: "172.17.0.1", port: 55419},
    
    },
    name: "mymaster",
});

async function  run() {
    const r = await redis.get("FOO");
    console.log(r);

    const b = await redis.get("FOO");
    console.log(b);
    
    const response = await redis.query("MATCH (a) return a", {}, {
        readOnly: true
    });

    console.log(response);
}
 
run();
