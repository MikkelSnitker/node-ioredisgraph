import { Node } from './Node';
import { Edge } from './Edge';


export class Path {
    #nodes!: Node[];
    #edges!: Edge[];
    constructor(nodes: Node[], edges: Edge[]){
        this.#nodes = nodes;
        this.#edges = edges;
    }

    get nodes(){
        return this.#nodes;
    }

    get edges(){
        return this.#edges;
    }

    getNode(index: number){
        return this.#nodes[index];
    }

    getEdge(index: number){
        return this.#edges[index];
    }

    get firstNode(){
        return this.#nodes[0];
    }

    get lastNode(){
        return this.#nodes[this.#nodes.length-1];
    }

    get nodeCount(){
        return this.#nodes.length;
    }

    get edgeCount(){
        return this.#edges.length;
    }

    toString(){
        return JSON.stringify(this);
    }
}