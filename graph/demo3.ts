type NodeId = string;
type EdgeId = string;

interface Endpoint {
    name: string;
}

interface EndpointHandle extends Endpoint {
    nodeId: NodeId;
}

interface Edge {
    readonly id: EdgeId;
    source: EndpointHandle;
    target: EndpointHandle;
}

interface Node {
    readonly id: NodeId;
    inputs: Endpoint[];
    outputs: Endpoint[];
}

// 链表节点
class ListNode {
    id: NodeId;
    prev: ListNode | null = null;
    next: ListNode | null = null;

    constructor(id: NodeId) {
        this.id = id;
    }
}

export class Graph<N extends Node = Node, E extends Edge = Edge> {
    private nodes: Map<NodeId, N> = new Map();
    private edges: Map<EdgeId, E> = new Map();

    private inEdges: Map<NodeId, Set<EdgeId>> = new Map();
    private outEdges: Map<NodeId, Set<EdgeId>> = new Map();
    private neighbors: Map<NodeId, Set<NodeId>> = new Map();
    private endpointEdges: WeakMap<Endpoint, Set<EdgeId>> = new WeakMap();

    private indegree: Map<NodeId, number> = new Map();

    // 链表头尾
    private head: ListNode | null = null;
    private tail: ListNode | null = null;

    // NodeId -> ListNode 映射
    private nodeMap: Map<NodeId, ListNode> = new Map();

    public addNode(node: N) {
        this.nodes.set(node.id, node);
        this.inEdges.set(node.id, new Set());
        this.outEdges.set(node.id, new Set());
        this.neighbors.set(node.id, new Set());
        this.indegree.set(node.id, 0);

        const listNode = new ListNode(node.id);
        if (!this.head) {
            this.head = this.tail = listNode;
        } else {
            this.tail!.next = listNode;
            listNode.prev = this.tail;
            this.tail = listNode;
        }
        this.nodeMap.set(node.id, listNode);
    }

    public addEdge(edge: E) {
        const { source, target } = edge;

        this.edges.set(edge.id, edge);

        this.inEdges.get(target.nodeId)!.add(edge.id);
        this.outEdges.get(source.nodeId)!.add(edge.id);
        this.neighbors.get(source.nodeId)!.add(target.nodeId);

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
        const srcNode = this.nodeMap.get(srcId);
        const tgtNode = this.nodeMap.get(tgtId);
        if (!srcNode || !tgtNode) return;

        // 如果 src 在 tgt 前面，不需要调整
        let curr:any = srcNode;
        while (curr && curr !== tgtNode) curr = curr.next;
        if (!curr) return; // src 在 tgt 后面，需要调整

        // BFS 找到所有受影响节点
        const affected: ListNode[] = [];
        const queue: NodeId[] = [tgtId];
        const seen = new Set<NodeId>([tgtId]);

        while (queue.length) {
            const nodeId = queue.shift()!;
            affected.push(this.nodeMap.get(nodeId)!);
            for (const nxt of this.neighbors.get(nodeId) || []) {
                if (!seen.has(nxt)) {
                    seen.add(nxt);
                    queue.push(nxt);
                }
            }
        }

        if (!affected.length) return;

        // 移除 affected 节点
        for (const node of affected) {
            if (node.prev) node.prev.next = node.next;
            if (node.next) node.next.prev = node.prev;
            if (node === this.head) this.head = node.next;
            if (node === this.tail) this.tail = node.prev;
            node.prev = node.next = null;
        }

        // 插入到 srcNode 后面
        let insertAfter = srcNode;
        let nextNode = insertAfter.next;
        for (const node of affected) {
            insertAfter.next = node;
            node.prev = insertAfter;
            insertAfter = node;
        }
        insertAfter.next = nextNode;
        if (nextNode) nextNode.prev = insertAfter;
        else this.tail = insertAfter;
    }

    // 获取拓扑排序结果
    public getTopo(): NodeId[] {
        const result: NodeId[] = [];
        let curr = this.head;
        while (curr) {
            result.push(curr.id);
            curr = curr.next;
        }
        return result;
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

console.log(graph,2)