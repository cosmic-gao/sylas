export type NodeId = string
export type EdgeId = string

export interface Endpoint {
    name: string;
}

export interface EndpointHandle extends Endpoint {
    nodeId: NodeId;
}

export interface Edge {
    readonly id: EdgeId;
    source: EndpointHandle;
    target: EndpointHandle;
}

export interface Node {
    readonly id: NodeId;
    inputs: Endpoint[];
    outputs: Endpoint[];
}

export class Graph<N extends Node = Node, E extends Edge = Edge> {
    private nodes: Map<NodeId, N> = new Map();
    private edges: Map<EdgeId, E> = new Map();

    private incoming: Map<NodeId, Set<EdgeId>> = new Map();
    private outgoing: Map<NodeId, Set<EdgeId>> = new Map();

    private connections: WeakMap<N, Map<string, Set<EdgeId>>> = new WeakMap();

    private neighbors: Map<NodeId, Set<NodeId>> = new Map();

    private indegree: Map<NodeId, number> = new Map();

    private order: NodeId[] = [];

    private positions: Map<NodeId, number> = new Map();

    public addNode(node: N) {
        this.nodes.set(node.id, node);

        this.incoming.set(node.id, new Set());
        this.outgoing.set(node.id, new Set());

        this.neighbors.set(node.id, new Set());

        this.indegree.set(node.id, 0);

        this.positions.set(node.id, this.order.length);
        this.order.push(node.id);
    }

    public addEdge(edge: E) {
        const { source, target } = edge;

        this.edges.set(edge.id, edge);

        this.incoming.get(target.nodeId)!.add(edge.id);
        this.outgoing.get(source.nodeId)!.add(edge.id);

        this.neighbors.get(edge.source.nodeId)!.add(edge.target.nodeId);

        this.indegree.set(target.nodeId, (this.indegree.get(target.nodeId) ?? 0) + 1);
    }

    private connect() { }

    private disconnect() { }
}
