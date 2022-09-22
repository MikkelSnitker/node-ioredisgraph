
import * as Redis from "ioredis";
import { GraphCommand, CypherQueryOptions } from "./GraphCommand";
import { GraphResponse, RedisGraphResponse } from "./GraphResponse";


export class Graph {
  
    public nodes = new Map<number,{}>();
    public edges = new Map<number,{}>();
    constructor(public readonly options: CypherQueryOptions ){
  
    }

    get name(){
      return this.options.graphName;
    }
    query<T>(cypherQuery: string, params: Record<string, unknown>): GraphCommand {

      
      const command = GraphCommand.create(this, cypherQuery, params, this.options)!;
      return command;    
      
    }
}