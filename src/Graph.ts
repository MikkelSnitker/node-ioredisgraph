import { RedisGraphCluster } from ".";

export class Graph {
  
    public nodes = new Map<number,{}>();
    public edges = new Map<number,{}>();
    constructor(private connection:RedisGraphCluster){
  
    }
  
    getLabels(id:number){
      return this.connection.getLabels(id);
    }
  
    getPropertyKeys(id:number){
      return this.connection.getPropertyKeys(id);
    }
  
    getRelationshipTypes(id:number){
      return this.connection.getRelationshipTypes(id);
    }
  
  }