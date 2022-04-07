
import { Redis, Commander } from "ioredis";
import { GraphCommand, CypherQueryOptions } from "./GraphCommand";
import { GraphResponse } from "./GraphResponse";


export class Graph {
  
    public nodes = new Map<number,{}>();
    public edges = new Map<number,{}>();
    constructor(public node: Commander, private options: CypherQueryOptions ){
  
    }

    async query<T>(cypherQuery: string, params: Record<string, unknown>): Promise<T[]> {

      const response = new GraphResponse(this, this.options)
      return response.parse(await this.node.sendCommand(GraphCommand.create(this.node, cypherQuery, params, this.options)));
      
    }
}