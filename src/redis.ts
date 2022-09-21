
import { stat } from 'fs';
import * as Redis from 'ioredis'
import { WriteableStream } from 'ioredis/built/types';
import { off } from 'process';
import { Graph } from './Graph';
import { GraphCommand } from './GraphCommand';
import { GraphResponse, RedisGraphResponse } from './GraphResponse';
export { getStatistics } from './Stats'


declare module 'ioredis' {

}


interface Node extends Redis.Redis {
   flags: "slave" | "master" | "master-down" | "slave-down"
}
type Endpoint = { host: string, port: number};

export class RedisGraph extends Redis.default implements Redis.RedisCommander {
    
    
    private translate(node: Record<string, string> | {host: string, port: number | string}): Endpoint 
    private translate(host: string | Buffer, port: number | string | Buffer): Endpoint
    private translate(...args: unknown[]): Endpoint
    {
        let host = "127.0.0.1";
        let [node, port] = args as [string | Buffer | Record<string, string> | {host: string; port: number | string}, number | string | Buffer];
        if(node instanceof Buffer || typeof node === "string"){
            host = node.toString();
        } else if (node && typeof node === "object"){
            
            if("ip" in node){
                host = node["ip"];
            } else if ("host" in node) {
                host = node["host"];
            } else {
                throw new Error("Invalid host");
            }

            if ("port" in node){
                port = parseInt(node["port"].toString());
            } else {
                port = 6379;
            } 
            return { host, port };
        } 

        if(port instanceof Buffer || typeof port === "string") {
            port = parseInt(port.toString());
        }
        return (this.options && this.options.natMap && this.options.natMap[`${host}:${port}`]) ??  {host, port};
    }

    public nodes = new Map<string, Node>();

    constructor(private graphName: string, options: Redis.RedisOptions) {
        super({ ...options });
        this.translate = this.translate.bind(this);
        const {nodes} = this;
        if (options.sentinels) {
           
            const sentinels = new Map<string, Redis.Redis>();

            function getMaster(): Redis.Redis{
                return Array.from(nodes.values()).find(x=>x.flags === "master")!;
            }

            function getSlave(random = true): Redis.Redis {
                const slaves = Array.from(nodes.values()).filter(x=>x.flags === "slave");
                if(random){
                   return slaves[Math.floor(Math.random() * slaves.length)];
                }

                return slaves[0]

            }
            const {translate} = this;

            function initSentinal({ host, port }: { port: number, host: string }) {
                const sentinel = new Redis.default({
                    port, host,
                    sentinels: undefined,
                    password: options.sentinelPassword,
                });
                sentinels.set(`${host}:${port}`, sentinel);
                sentinel.once("ready", async () => {

                    function parseResponse(data: Buffer[]): Record<string, string> {
                        const res = {}
                        while (data.length > 1) {
                            Object.assign(res, { [data.shift()?.toString()!]: data.shift()?.toString() })
                        }
                        return res;
                    }

                    async function fetchMaster() {
                        const [hostBuf, portBuf] = await sentinel.sendCommand(new Redis.Command("SENTINEL", ['get-master-addr-by-name', options.name!])) as Array<Buffer>;
                        const { host, port } = translate(hostBuf, portBuf);
                        let master = nodes.get(`${host}:${port}`);
                        if (!master) {
                            master = Object.assign(new Redis.default({
                                ...options,
                                port, host,
                                sentinels: undefined,
                            }), { flags: "master" as const});
                            nodes.set(`${host}:${port}`, master);
                        }

                        return master;
                    }

                    async function fetchSlaves() {
                        const response = await sentinel.sendCommand(new Redis.Command("SENTINEL", ['SLAVES', options.name!])) as Array<Buffer[]>;
                        for (const data of response) {
                            const slaveData = parseResponse(data);

                            const { host, port } = translate(slaveData);

                            let slave = nodes.get(`${host}:${port}`);
                            if (!slave) {
                                slave = Object.assign(new Redis.default({
                                    ...options,
                                    port, host,
                                    sentinels: undefined,
                                }), { flags: "slave" as const});
                                nodes.set(`${host}:${port}`, slave);
                            }
                        }
                    }

                    async function* getSentinels() {
                        const response = await sentinel.sendCommand(new Redis.Command("SENTINEL", ['sentinels', options.name!])) as Array<Buffer[]>;
                        for (const data of response) {
                            const { ip, port } = parseResponse(data);
                            let sentinelNode = (options.natMap && options.natMap[`${ip}:${port}`])
                            if (!sentinelNode) {
                                sentinelNode = { host: ip, port: parseInt(port) };
                            }

                            yield sentinelNode;
                        }
                    }
                    await Promise.all([
                        fetchMaster(),
                        fetchSlaves(),
                    ]);

                    for await (let { host, port } of getSentinels()) {
                        if (!sentinels.has(`${host}:${port}`)) {
                            initSentinal({ host, port });
                        }
                    } 
                    
                    function updateRole([host, port]: [host:string, port: string | number], role: "master" | "slave", ){
                        const node = nodes.get(`${host}:${port}`);
                        if(node) {
                            const [,flags] = node.flags.split("-") as ['master' | 'slave', 'down' | null];
                            node.flags = [role, flags].filter(x=>x).join("-") as typeof node.flags
                        }
                    }

                    function updateStatus([host, port]: [host:string, port: string | number], status: "+odown" | "-odown", ){
                        const node = nodes.get(`${host}:${port}`);
                        if(node) {
                            switch(status) {
                                case "+odown": {
                                const [role] = node.flags.split("-") as ['master' | 'slave', 'down' | undefined];
                                node.flags = `${role}-down`;
                                }
                                break;

                                case "+odown": {
                                const [role] = node.flags.split("-") as ['master' | 'slave', 'down' | undefined];
                                node.flags = role;
                                }
                                break;

                                
                            }
                            
                        }
                    }

                   const sub = await  sentinel.psubscribe("*");
                   sentinel.on("pmessage", (...args: [channel: Buffer, type: Buffer, data: Buffer]) => {

                    type EventType = '+slave' | '+odown' | '-odown' | '+sentinel' | '+switch-master';
                    const [, type,  payload] = args.map(x=>x.toString());
                    switch(type as EventType) {
                        case "+switch-master":{
                           const [name, oldIp, oldPort, ip, port] = payload.split(" ");
                            updateRole([ip, port],'master');
                            updateRole([oldIp, oldPort],'slave');
                        }
                        break;

                        case "+odown":{
                            const [,,ip,port] = payload.split(" ");
                            updateStatus([ip, port], type as '+odown');
                        }

                        case "-odown":{
                            const [,,ip,port] = payload.split(" ");
                            updateStatus([ip, port], type as '-odown');
                        }

                    }

                });
                   
                })
            }

            options.sentinels.forEach(({ port, host }) => initSentinal({ port: port!, host: host! }));

            this.getNode = async (isReadOnly: boolean) => {
                if (!isReadOnly) {
                    return getMaster();
                } else {
                    return getSlave();
                }
            }

            (this as any).setStatus("connect");
        }
    }


    async getNode(isReadOnly: boolean, key: string): Promise<Redis.Redis> {
        return this;
    }


    async sendCommand(command: Redis.Command | GraphCommand, stream?: WriteableStream): Promise<unknown> {
        let node;
        if (this.options.sentinels && this.options.name) {
            node = await this.getNode(command.isReadOnly ?? false, this.options.name);
            if (command instanceof GraphCommand) {
                const { graph, isReadOnly } = command;
                if (node) {
                    const response = await node.sendCommand(command, stream);
                    return await new GraphResponse(graph, this, graph.options).parse(response as RedisGraphResponse);
                }
            } else if (node) {
                return node.sendCommand(command, stream);
            }
        }
        return super.sendCommand(command, stream);
    }


    async query<T = unknown>(command: string, params: any, options: {
        graphName?: string
        readOnly?: boolean
    } = {}): Promise<T[]> {
        const _this: any = this

        const { graphName = this.graphName, readOnly } = options;

        const graph = new Graph({ readOnly, graphName });
        return this.sendCommand(graph.query<T>(command, params)) as Promise<T[]>;
    }
}
