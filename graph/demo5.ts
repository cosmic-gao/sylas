// ------------------- 基础类型 -------------------
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

// ------------------- PairingHeap -------------------
export type Comparator<T> = (a: T, b: T) => number;

export type Nullable<T> = T | null;

export type NullableNode<T> = Nullable<PairingNode<T>>;

export interface PairingNode<T> {
    value: T;
    child: NullableNode<T>;
    next: NullableNode<T>;
    prev: NullableNode<T>;
}

export class PairingHeap<T> {
    private _size: number = 0;
    private root: NullableNode<T> = null;

    public get size(): number { return this._size; }

    constructor(protected readonly comparator: Comparator<T>) {}

    push(value: T): PairingNode<T> {
        const node: PairingNode<T> = { value, child: null, next: null, prev: null };
        this.root = this.meld(this.root, node);
        this._size++;
        return node;
    }

    peek(): T | undefined { return this.root?.value; }

    poll(): T | undefined {
        if (!this.root) return undefined;
        const topValue = this.root.value;
        this.root = this.collapse(this.root.child);
        if (this.root) this.root.prev = null;
        this._size--;
        return topValue;
    }

    private meld(a: NullableNode<T>, b: NullableNode<T>): NullableNode<T> {
        if (!a) return b;
        if (!b) return a;

        if (this.comparator(a.value, b.value) > 0) {
            b.prev = null;
            a.prev = b;
            a.next = b.child;
            if (b.child) b.child.prev = a;
            b.child = a;
            return b;
        }
        a.prev = null;
        b.prev = a;
        b.next = a.child;
        if (a.child) a.child.prev = b;
        a.child = b;
        return a;
    }

    private collapse(node: NullableNode<T>): NullableNode<T> {
        if (!node) return null;
        let tail: NullableNode<T> = null;
        let a: PairingNode<T>;
        let b: NullableNode<T>;
        let next: NullableNode<T> = node;
        let result: NullableNode<T> = null;

        while (next) {
            a = next;
            b = a.next;
            if (b) {
                next = b.next;
                a.next = null;
                b.next = null;
                const merged = this.meld(a, b);
                merged!.prev = tail;
                tail = merged;
            } else {
                a.prev = tail;
                tail = a;
                break;
            }
        }

        while (tail) {
            next = tail.prev;
            tail.prev = null;
            result = this.meld(result, tail);
            tail = next;
        }

        return result;
    }

    empty(): boolean { return this._size === 0 && this.root === null; }
}

// ------------------- Graph 类 -------------------
export class Graph<N extends Node = Node, E extends Edge = Edge> {
    private nodes: Map<NodeId, N> = new Map();
    private edges: Map<EdgeId, E> = new Map();

    // port-level
    private inEdges: Map<NodeId, Set<EdgeId>> = new Map();
    private outEdges: Map<NodeId, Set<EdgeId>> = new Map();

    // node-level adjacency
    private successors: Map<NodeId, Set<NodeId>> = new Map();
    private predecessors: Map<NodeId, Set<NodeId>> = new Map();

    // topo & rank
    private topo: NodeId[] = [];
    private rank: Map<NodeId, number> = new Map();

    // node indegree
    private indegree: Map<NodeId, number> = new Map();

    constructor() {}

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

    /** 添加边（增量 topo + heap 支持） */
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

        this.incrementalReorderWithHeap(src, dst);
    }

    /** 使用 PairingHeap 做局部增量 topo 排序 */
    private incrementalReorderWithHeap(u: NodeId, v: NodeId) {
        const rankU = this.rank.get(u)!;
        const rankV = this.rank.get(v)!;
        if (rankU < rankV) return;

        // -----------------------------
        // Step 1: 收集受影响节点 BFS
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
        // Step 2: 创建局部入度 map
        const localIndegree = new Map<NodeId, number>();
        for (const node of affected) {
            localIndegree.set(node, 0);
        }
        for (const node of affected) {
            for (const succ of this.successors.get(node) ?? []) {
                if (affected.has(succ)) {
                    localIndegree.set(succ, (localIndegree.get(succ) ?? 0) + 1);
                }
            }
        }

        // -----------------------------
        // Step 3: 初始化最小堆 (rank 小优先)
        const heap = new PairingHeap<NodeId>((a, b) => {
            return (this.rank.get(a)! - this.rank.get(b)!);
        });

        for (const [node, deg] of localIndegree) {
            if (deg === 0) heap.push(node);
        }

        // -----------------------------
        // Step 4: 局部拓扑排序生成
        const sorted: NodeId[] = [];
        while (!heap.empty()) {
            const node = heap.poll()!;
            sorted.push(node);
            for (const succ of this.successors.get(node) ?? []) {
                if (!affected.has(succ)) continue;
                const deg = (localIndegree.get(succ) ?? 0) - 1;
                localIndegree.set(succ, deg);
                if (deg === 0) heap.push(succ);
            }
        }

        // -----------------------------
        // Step 5: 更新 topo 数组
        const newTopo: NodeId[] = [];
        for (const n of this.topo) {
            if (!affected.has(n)) newTopo.push(n);
        }

        // 插入 sorted
        const insertIdx = Math.max(newTopo.indexOf(u), 0) + 1;
        newTopo.splice(insertIdx, 0, ...sorted);

        this.topo = newTopo;
        for (let i = 0; i < newTopo.length; i++) {
            this.rank.set(newTopo[i], i);
        }
    }

    /** 获取拓扑顺序 */
    public getTopologicalOrder(): NodeId[] {
        return [...this.topo];
    }

    /** 获取节点 */
    public getNode(id: NodeId): N | undefined {
        return this.nodes.get(id);
    }

    /** 输出 / 输入边 */
    public getOutputEdges(nodeId: NodeId): E[] {
        return [...(this.outEdges.get(nodeId) ?? [])].map(e => this.edges.get(e)!);
    }
    public getInputEdges(nodeId: NodeId): E[] {
        return [...(this.inEdges.get(nodeId) ?? [])].map(e => this.edges.get(e)!);
    }
}
