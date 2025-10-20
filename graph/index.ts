export interface Endpoint {
    name: string;
}

export interface EndpointHandle extends Endpoint {
    nodeId: string;
}

export interface Edge {
    readonly id: string;
    source: EndpointHandle;
    target: EndpointHandle;
}

export interface Node {
    readonly id: string;
    inputs: Endpoint[];
    outputs: Endpoint[];
}

export class Graph<N extends Node, E extends Edge> {
    public readonly nodes: Map<string, N> = new Map();
    public readonly edges: Map<string, E> = new Map();

    public addNode(node: N) { }

    public addEdge(edge: E) { }
}