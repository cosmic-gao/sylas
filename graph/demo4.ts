export type NodeId = string;
export type EdgeId = string;

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

    // ✅ port-level storage
    private inEdges: Map<NodeId, Set<EdgeId>> = new Map();
    private outEdges: Map<NodeId, Set<EdgeId>> = new Map();

    // ✅ node-level adjacency
    private successors: Map<NodeId, Set<NodeId>> = new Map();
    private predecessors: Map<NodeId, Set<NodeId>> = new Map();

    private indegree: Map<NodeId, number> = new Map();
    private topo: NodeId[] = [];
    private rank: Map<NodeId, number> = new Map();

    constructor() { }

    /** 添加节点 */
    public addNode(node: N) {
        if (this.nodes.has(node.id)) return;

        this.nodes.set(node.id, node);
        this.inEdges.set(node.id, new Set());
        this.outEdges.set(node.id, new Set());
        this.successors.set(node.id, new Set());
        this.predecessors.set(node.id, new Set());
        this.indegree.set(node.id, 0);

        this.rank.set(node.id, this.topo.length);
        this.topo.push(node.id);
    }

    /** 添加边（自动维护拓扑序） */
    public addEdge(edge: E) {
        if (this.edges.has(edge.id)) return;

        const { source, target } = edge;
        const src = source.nodeId;
        const dst = target.nodeId;

        this.edges.set(edge.id, edge);
        this.outEdges.get(src)!.add(edge.id);
        this.inEdges.get(dst)!.add(edge.id);

        if (!this.successors.get(src)!.has(dst)) {
            this.successors.get(src)!.add(dst);
            this.predecessors.get(dst)!.add(src);
            this.indegree.set(dst, (this.indegree.get(dst) ?? 0) + 1);
        }

        this.incrementalReorder(src, dst);
    }

    private incrementalReorder(u: NodeId, v: NodeId) {
        const rankU = this.rank.get(u)!;
        const rankV = this.rank.get(v)!;

        // 如果顺序已经合法，不需要调整
        if (rankU < rankV) return;

        // -----------------------------
        // Step 1: 收集所有受影响节点 S
        // S = 所有在 u→v 插入后可能被“违反拓扑”的节点
        // 我们不用 rank 限制，而是 BFS 从 v 向后遍历可到节点
        const affected = new Set<NodeId>();
        const queue: NodeId[] = [v];
        affected.add(v);

        while (queue.length) {
            const node = queue.shift()!;
            for (const succ of this.successors.get(node) ?? []) {
                if (!affected.has(succ)) {
                    affected.add(succ);
                    queue.push(succ);
                }
            }
        }

        // 同时要包含 u 及其前驱节点，确保局部序列完整
        const queue2: NodeId[] = [u];
        affected.add(u);

        while (queue2.length) {
            const node = queue2.shift()!;
            for (const pred of this.predecessors.get(node) ?? []) {
                if (!affected.has(pred)) {
                    affected.add(pred);
                    queue2.push(pred);
                }
            }
        }

        // -----------------------------
        // Step 2: 从 topo 数组移除 affected 节点
        const newTopo: NodeId[] = [];
        for (const id of this.topo) {
            if (!affected.has(id)) newTopo.push(id);
        }

        // -----------------------------
        // Step 3: 局部拓扑排序 affected 节点
        // 使用简单 DFS 拓扑排序（受影响节点较少时足够快）
        const tempVisited = new Set<NodeId>();
        const sorted: NodeId[] = [];

        const dfs = (node: NodeId) => {
            if (tempVisited.has(node)) return;
            tempVisited.add(node);
            for (const succ of this.successors.get(node) ?? []) {
                if (affected.has(succ)) dfs(succ);
            }
            sorted.push(node); // 后序加入
        };

        for (const node of affected) {
            dfs(node);
        }

        sorted.reverse(); // 后序 DFS 转为合法拓扑

        // -----------------------------
        // Step 4: 插入局部排序节点到 newTopo
        // 插入位置：找到 u 在 newTopo 中的索引，如果没有，直接放到末尾
        const insertIdx = Math.max(newTopo.indexOf(u), 0) + 1;
        newTopo.splice(insertIdx, 0, ...sorted);

        // -----------------------------
        // Step 5: 更新 topo 和 rank
        this.topo = newTopo;
        for (let i = 0; i < newTopo.length; i++) {
            this.rank.set(newTopo[i], i);
        }
    }

    /** 获取节点 */
    public getNode(id: NodeId): N | undefined {
        return this.nodes.get(id);
    }

    /** 获取某节点的出端口对应边 */
    public getOutputEdges(nodeId: NodeId): E[] {
        return [...(this.outEdges.get(nodeId) ?? [])].map(e => this.edges.get(e)!);
    }

    /** 获取某节点的输入端口对应边 */
    public getInputEdges(nodeId: NodeId): E[] {
        return [...(this.inEdges.get(nodeId) ?? [])].map(e => this.edges.get(e)!);
    }
}
