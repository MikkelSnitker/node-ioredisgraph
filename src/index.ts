import Redis from 'ioredis'
import { GraphCommand } from './GraphCommand';
export { getStatistics } from './Stats'



interface ClusterOptions extends Omit<Redis.ClusterOptions, "scaleReads"> {
  scaleReads?: "master" | "slave" | "all" 
}

export class RedisGraphCluster extends Redis.Cluster implements Redis.Commands {

  constructor(private graphName: string, nodes: Redis.ClusterNode[], { scaleReads = "all", ...options }: ClusterOptions = {}) {
    super(nodes, {
      scaleReads, ...options
    } as any)
  }

  getNode(isReadOnly: boolean) {
    let nodes: Redis.Redis[];
    let { scaleReads } = this.options
    if (isReadOnly) {
      if(typeof scaleReads === "function") {
        scaleReads = "all"
      }
      nodes = this.nodes(scaleReads as "all" | "slave" | "master" | undefined);
    } else {
      nodes = this.nodes("master");
    }

    return nodes[Math.floor((Math.random() * nodes.length))];
  }

  async query<T = unknown>(command: string, params: any, options: {
    graphName?: string
    readOnly?: boolean
  } = {}): Promise<T[]> {
    const _this: any = this
    const { graphName = this.graphName, readOnly } = options;

    if (this.status !== "ready") {
      await new Promise((resolve) => this.once("ready", resolve));
    }

    let redis = this.getNode(readOnly ?? false);
    return GraphCommand.create(redis, command, params, { readOnly, graphName }) as Promise<T[]>;
  }
}
