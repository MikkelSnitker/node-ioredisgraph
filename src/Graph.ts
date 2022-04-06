
import { Redis } from "ioredis";
import { GraphCommand } from "./GraphCommand";


export class Graph {
  
    public nodes = new Map<number,{}>();
    public edges = new Map<number,{}>();
    constructor(){
  
    }
}