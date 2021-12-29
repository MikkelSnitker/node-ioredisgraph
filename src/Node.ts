import { Graph } from './Graph'

export class Node {
    #graph!: Graph;
    constructor(graph: Graph, public id: number, public label: string, public properties: Record<string,unknown>){
        this.#graph = graph;
    }


    toString(){
        return JSON.stringify(this);
    }   
}
