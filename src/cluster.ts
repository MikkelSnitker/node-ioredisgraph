import * as Redis  from 'ioredis'
import { WriteableStream } from 'ioredis/built/types';
import { Graph } from './Graph';
import { GraphCommand } from './GraphCommand';
import { GraphResponse, RedisGraphResponse } from './GraphResponse';
export { getStatistics } from './Stats'

declare module "ioredis" {
  interface Cluster {
    slots: Array<string[]>;
  }
}

interface ClusterOptions extends Omit<Redis.ClusterOptions, "scaleReads"> {
  scaleReads?: "master" | "slave" | "all" 
}

export class RedisGraphCluster extends Redis.Cluster {
  private keySlotCache = new Map<string, number>();
  constructor(private graphName: string, nodes: Redis.ClusterNode[], { scaleReads = "all", ...options }: ClusterOptions = {}) {
    super(nodes, {
      scaleReads, ...options
    } as any)
  }

  async getNode(isReadOnly: boolean, key: string): Promise<Redis.Redis | undefined> {
    let keySlot = this.keySlotCache.get(key);
    if(!keySlot) {
        keySlot = await (this as any).call("CLUSTER", "KEYSLOT", key);
        this.keySlotCache.set(key, keySlot!);
    }

    const hasSlot = ({options}: Redis.Redis, keySlot: number) => {
      const slot = this.slots[keySlot] ?? [];
      return slot.includes(`${options.host}:${options.port}`)
    }

    let nodes: Redis.Redis[];
    let { scaleReads } = this.options
    if (isReadOnly) {
      if(typeof scaleReads === "function") {
        scaleReads = "all"
      }
      nodes = this.nodes(scaleReads as "all" | "slave" | "master" | undefined);
      
    } else {
      nodes = this.nodes("master");
    }

    nodes = nodes.filter((node) => hasSlot(node, keySlot!));
    if(nodes.length == 0 && isReadOnly){
      return this.getNode(false, key);
    }
    return nodes[Math.floor((Math.random() * nodes.length))];
  }

  async sendCommand(command: Redis.Command | GraphCommand, stream?: WriteableStream, node?: any): Promise<unknown> {
    if(command instanceof GraphCommand) {
      const {graph, isReadOnly} = command;
      const node = await this.getNode(isReadOnly ?? false, graph.name!);

      if(node) {
        const response = await super.sendCommand(command, stream);
        return await new GraphResponse(graph, this, graph.options).parse(response as RedisGraphResponse);
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
  
    //let redis: Redis.Redis = (await this.getNode(readOnly ?? false, graphName))!;
    const graph = new Graph({ readOnly, graphName });
    return this.sendCommand(graph.query<T>(command, params)) as unknown as Promise<T[]>;
  }
}
