"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisGraph = exports.getStatistics = void 0;
const Redis = __importStar(require("ioredis"));
const Graph_1 = require("./Graph");
const GraphCommand_1 = require("./GraphCommand");
const GraphResponse_1 = require("./GraphResponse");
var Stats_1 = require("./Stats");
Object.defineProperty(exports, "getStatistics", { enumerable: true, get: function () { return Stats_1.getStatistics; } });
class RedisGraph extends Redis.default {
    constructor(graphName, options) {
        super({ ...options });
        this.graphName = graphName;
        this.nodes = new Map();
        this.translate = this.translate.bind(this);
        const { nodes } = this;
        if (options.sentinels) {
            const sentinels = new Map();
            function getMaster() {
                return Array.from(nodes.values()).find(x => x.flags === "master");
            }
            function getSlave(random = true) {
                const slaves = Array.from(nodes.values()).filter(x => x.flags === "slave");
                if (random) {
                    return slaves[Math.floor(Math.random() * slaves.length)];
                }
                return slaves[0];
            }
            const { translate } = this;
            function initSentinal({ host, port }) {
                const sentinel = new Redis.default({
                    port, host,
                    sentinels: undefined,
                    password: options.sentinelPassword,
                });
                sentinels.set(`${host}:${port}`, sentinel);
                sentinel.once("ready", async () => {
                    function parseResponse(data) {
                        const res = {};
                        while (data.length > 1) {
                            Object.assign(res, { [data.shift()?.toString()]: data.shift()?.toString() });
                        }
                        return res;
                    }
                    async function fetchMaster() {
                        const [hostBuf, portBuf] = await sentinel.sendCommand(new Redis.Command("SENTINEL", ['get-master-addr-by-name', options.name]));
                        const { host, port } = translate(hostBuf, portBuf);
                        let master = nodes.get(`${host}:${port}`);
                        if (!master) {
                            master = Object.assign(new Redis.default({
                                ...options,
                                port, host,
                                sentinels: undefined,
                            }), { flags: "master" });
                            nodes.set(`${host}:${port}`, master);
                        }
                        return master;
                    }
                    async function fetchSlaves() {
                        const response = await sentinel.sendCommand(new Redis.Command("SENTINEL", ['SLAVES', options.name]));
                        for (const data of response) {
                            const slaveData = parseResponse(data);
                            const { host, port } = translate(slaveData);
                            let slave = nodes.get(`${host}:${port}`);
                            if (!slave) {
                                slave = Object.assign(new Redis.default({
                                    ...options,
                                    port, host,
                                    sentinels: undefined,
                                }), { flags: "slave" });
                                nodes.set(`${host}:${port}`, slave);
                            }
                        }
                    }
                    async function* getSentinels() {
                        const response = await sentinel.sendCommand(new Redis.Command("SENTINEL", ['sentinels', options.name]));
                        for (const data of response) {
                            const { ip, port } = parseResponse(data);
                            let sentinelNode = (options.natMap && options.natMap[`${ip}:${port}`]);
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
                    function updateRole([host, port], role) {
                        const node = nodes.get(`${host}:${port}`);
                        if (node) {
                            const [, flags] = node.flags.split("-");
                            node.flags = [role, flags].filter(x => x).join("-");
                        }
                    }
                    function updateStatus([host, port], status) {
                        const node = nodes.get(`${host}:${port}`);
                        if (node) {
                            switch (status) {
                                case "+odown":
                                    {
                                        const [role] = node.flags.split("-");
                                        node.flags = `${role}-down`;
                                    }
                                    break;
                                case "+odown":
                                    {
                                        const [role] = node.flags.split("-");
                                        node.flags = role;
                                    }
                                    break;
                            }
                        }
                    }
                    const sub = await sentinel.psubscribe("*");
                    sentinel.on("pmessage", (...args) => {
                        const [, type, payload] = args.map(x => x.toString());
                        switch (type) {
                            case "+switch-master":
                                {
                                    const [name, oldIp, oldPort, ip, port] = payload.split(" ");
                                    updateRole([ip, port], 'master');
                                    updateRole([oldIp, oldPort], 'slave');
                                }
                                break;
                            case "+odown": {
                                const [, , ip, port] = payload.split(" ");
                                updateStatus([ip, port], type);
                            }
                            case "-odown": {
                                const [, , ip, port] = payload.split(" ");
                                updateStatus([ip, port], type);
                            }
                        }
                    });
                });
            }
            options.sentinels.forEach(({ port, host }) => initSentinal({ port: port, host: host }));
            this.getNode = async (isReadOnly) => {
                if (!isReadOnly) {
                    return getMaster();
                }
                else {
                    return getSlave();
                }
            };
            this.setStatus("connect");
        }
    }
    translate(...args) {
        let host = "127.0.0.1";
        let [node, port] = args;
        if (node instanceof Buffer || typeof node === "string") {
            host = node.toString();
        }
        else if (node && typeof node === "object") {
            if ("ip" in node) {
                host = node["ip"];
            }
            else if ("host" in node) {
                host = node["host"];
            }
            else {
                throw new Error("Invalid host");
            }
            if ("port" in node) {
                port = parseInt(node["port"].toString());
            }
            else {
                port = 6379;
            }
            return { host, port };
        }
        if (port instanceof Buffer || typeof port === "string") {
            port = parseInt(port.toString());
        }
        return (this.options && this.options.natMap && this.options.natMap[`${host}:${port}`]) ?? { host, port };
    }
    async getNode(isReadOnly, key) {
        return this;
    }
    async sendCommand(command, stream) {
        let node;
        if (this.options.sentinels && this.options.name) {
            node = await this.getNode(command.isReadOnly ?? false, this.options.name);
            if (command instanceof GraphCommand_1.GraphCommand) {
                const { graph, isReadOnly } = command;
                if (node) {
                    const response = await node.sendCommand(command, stream);
                    return await new GraphResponse_1.GraphResponse(graph, this, graph.options).parse(response);
                }
            }
            else if (node) {
                return node.sendCommand(command, stream);
            }
        }
        return super.sendCommand(command, stream);
    }
    async query(command, params, options = {}) {
        const _this = this;
        const { graphName = this.graphName, readOnly } = options;
        const graph = new Graph_1.Graph({ readOnly, graphName });
        return this.sendCommand(graph.query(command, params));
    }
}
exports.RedisGraph = RedisGraph;
