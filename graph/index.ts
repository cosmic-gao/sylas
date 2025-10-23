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
        return this
    }

    public addEdge(edge: E) {
        const { source, target } = edge;

        this.edges.set(edge.id, edge);

        this.inEdges.get(target.nodeId)!.add(edge.id);
        this.outEdges.get(source.nodeId)!.add(edge.id);

        this.neighbors.get(edge.source.nodeId)!.add(edge.target.nodeId);
        this.indegree.set(target.nodeId, (this.indegree.get(target.nodeId) ?? 0) + 1);

        this.reorder(source.nodeId, target.nodeId);
        return this
    }


    private reorder(srcId: NodeId, tgtId: NodeId) {
        const srcRank = this.rank.get(srcId);
        const tgtRank = this.rank.get(tgtId);
        if (srcRank === undefined || tgtRank === undefined) return;
        if (srcRank < tgtRank) return;

        const visited = new Set<NodeId>();
        const queue = [tgtId];
        const affected: NodeId[] = [];

        while (queue.length) {
            const node = queue.pop()!;
            if (visited.has(node)) continue;
            visited.add(node);
            affected.push(node);
            for (const n of this.neighbors.get(node) ?? []) {
                if (!visited.has(n)) queue.push(n);
            }
        }

        const moved = new Set(visited);
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

const A = { id: 'A', inputs: [], outputs: [{ name: 'a-out1' }, { name: 'a-out2' }] }
const B = { id: 'B', inputs: [{ name: 'b-in1' }], outputs: [{ name: 'b-out1' }, { name: 'b-out1' }] }
const C = { id: 'C', inputs: [{ name: 'c-in1' }], outputs: [{ name: 'c-out1' }, { name: 'c-out2' }] }
const D = { id: 'D', inputs: [{ name: 'd-in1' }], outputs: [{ name: 'd-out1' }, { name: 'd-out2' }] }
const E = { id: 'E', inputs: [{ name: 'e-in1' }, { name: 'e-in2' }], outputs: [{ name: 'e-out1' }, { name: 'e-out2' }] }
const F = { id: 'F', inputs: [{ name: 'f-in1' }], outputs: [{ name: 'f-out1' }, { name: 'f-out2' }] }

const AB = { id: 'AB', source: { nodeId: 'A', name: "a-out1" }, target: { nodeId: 'B', name: 'b-in1' } }
const AC = { id: 'AC', source: { nodeId: 'A', name: "a-out1" }, target: { nodeId: 'C', name: 'c-in1' } }
const AE = { id: 'AE', source: { nodeId: 'A', name: "a-out2" }, target: { nodeId: 'E', name: 'e-in1' } }
const BD = { id: 'BD', source: { nodeId: 'B', name: "b-out1" }, target: { nodeId: 'D', name: 'd-in1' } }
const DF = { id: 'DF', source: { nodeId: 'D', name: "d-out1" }, target: { nodeId: 'F', name: 'f-in1' } }
const EF = { id: 'EF', source: { nodeId: 'E', name: "e-out1" }, target: { nodeId: 'F', name: 'f-in2' } }
const ED = { id: 'ED', source: { nodeId: 'E', name: "e-out2" }, target: { nodeId: 'D', name: 'd-in2' } }

const graph = new Graph()

graph
    .addNode(A)
    .addNode(B)
    .addNode(C)
    .addNode(D)
    .addNode(E)
    .addNode(F)
    .addEdge(AB)
    .addEdge(AC)
    .addEdge(AE)
    .addEdge(BD)
    .addEdge(DF)
    .addEdge(EF)
    .addEdge(ED)

console.log(graph)