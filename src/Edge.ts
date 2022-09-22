import { Graph } from './Graph';
import { Node } from './Node';

export class Edge {
    public id:number|undefined;
    #graph!: Graph;
    #srcNodeId!: number;
    #destNodeId!: number;
    constructor(graph: Graph, srcNodeId: number, public relation: string, destNodeId: number, public properties: Record<string, unknown>){
        this.#graph = graph;
        this.#destNodeId = destNodeId;
        this.#srcNodeId = srcNodeId;
    }

    get src(){
        return this.#graph.nodes.get(this.#srcNodeId);
    }

    get dest(){
        return this.#graph.nodes.get(this.#destNodeId);
    }

    setId(id:number){
        this.id = id;
    }

    toString(){
        return JSON.stringify(this)
    }
    

}