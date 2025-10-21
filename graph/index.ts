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

export class Graph<N extends Node = Node, E extends Edge = Edge> {
    private nodes: Map<string, N> = new Map();
    private edges: Map<string, E> = new Map();

    private incoming: Map<string, Set<string>> = new Map();
    private outgoing: Map<string, Set<string>> = new Map();

    private links: WeakMap<N, Map<string, Set<string>>> = new WeakMap();

    private indegree: Map<string, number> = new Map();

    private order: string[] = [];

    private positions: Map<string, number> = new Map();

    public addNode(node: N) {
        this.nodes.set(node.id, node);

        this.incoming.set(node.id, new Set());
        this.outgoing.set(node.id, new Set());

        this.indegree.set(node.id, 0);

        this.positions.set(node.id, this.order.length);
        this.order.push(node.id);
    }

    public addEdge(edge: E) {
        const { source, target } = edge;

        this.edges.set(edge.id, edge);

        this.incoming.get(target.nodeId)!.add(edge.id);
        this.outgoing.get(source.nodeId)!.add(edge.id);

        this.indegree.set(target.nodeId, (this.indegree.get(target.nodeId) ?? 0) + 1);

        this.link(this.nodes.get(source.nodeId)!, source.name, edge.id);
        this.link(this.nodes.get(target.nodeId)!, target.name, edge.id);
    }

    public sort() {
        const indegree = new Map(this.indegree);
        const queue: string[] = []

        for (const [nodeId, deg] of indegree.entries()) {
            if (deg === 0) queue.push(nodeId);
        }

        const result: string[] = [];

        while (queue.length) {
            const nodeId = queue.shift()!;
            result.push(nodeId);

            for (const edge of this.edges.values()) {
                if (edge.source.nodeId === nodeId) {
                    const target = edge.target.nodeId;
                    indegree.set(target, (indegree.get(target) ?? 0) - 1);
                    if (indegree.get(target) === 0) queue.push(target);
                }
            }
        }

        return result;
    }

    public subgraph() { }

    private link(node: N, name: string, edgeId: string) { }

    private unlink() { }
}
