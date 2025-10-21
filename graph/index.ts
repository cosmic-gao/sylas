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

    private inEdges: Map<NodeId, Set<EdgeId>> = new Map();
    private outEdges: Map<NodeId, Set<EdgeId>> = new Map();

    private endpointEdges: WeakMap<Endpoint, Set<Edge>> = new WeakMap();

    private neighbors: Map<NodeId, Set<NodeId>> = new Map();

    private indegree: Map<NodeId, number> = new Map();

    private order: NodeId[] = [];

    private rank: Map<NodeId, number> = new Map();

    public addNode(node: N) {
        this.nodes.set(node.id, node);

        this.inEdges.set(node.id, new Set());
        this.outEdges.set(node.id, new Set());

        this.neighbors.set(node.id, new Set());

        this.indegree.set(node.id, 0);

        this.rank.set(node.id, this.order.length);
        this.order.push(node.id);
    }

    //
    public addEdge(edge: E) {
        const { source, target } = edge;

        this.edges.set(edge.id, edge);

        this.inEdges.get(target.nodeId)!.add(edge.id);
        this.outEdges.get(source.nodeId)!.add(edge.id);

        this.neighbors.get(edge.source.nodeId)!.add(edge.target.nodeId);

        this.indegree.set(target.nodeId, (this.indegree.get(target.nodeId) ?? 0) + 1);

        this.linkEndpoint(source, edge);
        this.linkEndpoint(target, edge);

        this.reorder(source.nodeId, target.nodeId);
    }

    private linkEndpoint(endpoint: Endpoint, edge: Edge) {
        let set = this.endpointEdges.get(endpoint);
        if (!set) {
            set = new Set();
            this.endpointEdges.set(endpoint, set);
        }
        set.add(edge);
    }

    private reorder(srcId: NodeId, tgtId: NodeId) {
        const srcRank = this.rank.get(srcId);
        const tgtRank = this.rank.get(tgtId);
        if (srcRank === undefined || tgtRank === undefined) return;
        if (srcRank < tgtRank) return;

        const affected: NodeId[] = [];
        const queue: NodeId[] = [tgtId];
        const seen = new Set([tgtId]);

        while (queue.length) {
            const nodeId = queue.shift()!;
            affected.push(nodeId)
            for (const nxt of this.neighbors.get(nodeId) || []) {
                const r = this.rank.get(nxt);
                if (r !== undefined && r <= srcRank && !seen.has(nxt)) {
                    seen.add(nxt);
                    queue.push(nxt);
                }
            }
        }

        if (!affected.length) return;

        const moved = new Set(affected);
        const kept = this.order.filter(n => !moved.has(n));
        const idx = kept.indexOf(srcId) + 1;
        kept.splice(idx, 0, ...affected);

        this.order = kept;
        for (let i = 0; i < kept.length; i++) this.rank.set(kept[i], i);
    }
}


const graph = new Graph();

const A = { id: 'A', inputs: [], outputs: [{ name: 'out' }] };
const B = { id: 'B', inputs: [{ name: 'in' }], outputs: [{ name: 'out' }] };
const C = { id: 'C', inputs: [{ name: 'in' }], outputs: [{ name: 'out' }] };

graph.addNode(A);
graph.addNode(B);
graph.addNode(C);

graph.addEdge({ id: 'e1', source: { nodeId: 'A', name: 'out' }, target: { nodeId: 'C', name: 'in' } });
graph.addEdge({ id: 'e2', source: { nodeId: 'C', name: 'out' }, target: { nodeId: 'B', name: 'in' } });

console.log(graph)