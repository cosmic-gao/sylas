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
    public readonly nodes: Map<string, N> = new Map();
    public readonly edges: Map<string, E> = new Map();

    private indegree: Map<string, number> = new Map();

    public addNode(node: N) {
        this.nodes.set(node.id, node);
        this.indegree.set(node.id, 0);
    }

    public addEdge(edge: E) {
        const { target } = edge;

        this.edges.set(edge.id, edge);
        this.indegree.set(target.nodeId, (this.indegree.get(target.nodeId) ?? 0) + 1);
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
}
