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

    private endpointEdges: WeakMap<Endpoint, Set<EdgeId>> = new WeakMap();

    private neighbors: Map<NodeId, Set<NodeId>> = new Map();
    private indegree: Map<NodeId, number> = new Map();

    private topo: NodeId[] = [];
    private rank: Map<NodeId, number> = new Map();

    public addNode(node: N) {
        this.nodes.set(node.id, node);

        this.inEdges.set(node.id, new Set());
        this.outEdges.set(node.id, new Set());

        this.neighbors.set(node.id, new Set());
        this.indegree.set(node.id, 0);

        this.rank.set(node.id, this.topo.length);
        this.topo.push(node.id);
    }

    public addEdge(edge: E) {
        const { source, target } = edge;

        this.edges.set(edge.id, edge);

        this.inEdges.get(target.nodeId)!.add(edge.id);
        this.outEdges.get(source.nodeId)!.add(edge.id);

        this.neighbors.get(edge.source.nodeId)!.add(edge.target.nodeId);
        this.indegree.set(target.nodeId, (this.indegree.get(target.nodeId) ?? 0) + 1);

        this.linkEndpoint(source, edge.id);
        this.linkEndpoint(target, edge.id);

        this.reorder(source.nodeId, target.nodeId);
    }

    private linkEndpoint(endpoint: Endpoint, edgeId: EdgeId) {
        let set = this.endpointEdges.get(endpoint);
        if (!set) {
            set = new Set();
            this.endpointEdges.set(endpoint, set);
        }
        set.add(edgeId);
    }

    private reorder(srcId: NodeId, tgtId: NodeId) {
        const srcRank = this.rank.get(srcId);
        const tgtRank = this.rank.get(tgtId);
        if (srcRank === undefined || tgtRank === undefined) return;
        if (srcRank < tgtRank) return;

        const affected = new Set<NodeId>();
        const queue: NodeId[] = [tgtId];

        while (queue.length) {
            const node = queue.shift()!;
            if (affected.has(node)) continue;
            const r = this.rank.get(node)!;
            if (r < tgtRank) continue;
            affected.add(node);

            for (const neighbor of this.neighbors.get(node)!) {
                queue.push(neighbor);
            }
        }

        if (!affected.size) return;

        const moved = new Set(affected);
        const kept: NodeId[] = [];
        for (const n of this.topo) {
            if (!moved.has(n)) kept.push(n);
        }

        const index = kept.indexOf(srcId);
        const start = index >= 0 ? index + 1 : kept.length;
        kept.splice(start, 0, ...affected);

        this.topo = kept;
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