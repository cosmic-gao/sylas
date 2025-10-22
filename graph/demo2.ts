// ultra_dag_enhanced.ts

type NodeId = string;
type EdgeId = string;

interface Endpoint { name: string; }
interface EndpointHandle extends Endpoint { nodeId: NodeId; }

export interface Node {
  id: NodeId;
  weight?: number; // 节点权重（非必需，默认 0）
  inputs: Endpoint[];
  outputs: Endpoint[];
}

export interface Edge {
  id: EdgeId;
  weight?: number; // 边权重（非必需，默认 0）
  source: EndpointHandle;
  target: EndpointHandle;
}

// -------------------- Pairing Heap (轻量且带 parent 指针用于 decreaseKey 优化) --------------------
class PairingHeapNode<T> {
  value: T;
  key: number;
  parent: PairingHeapNode<T> | null = null;
  child: PairingHeapNode<T> | null = null;
  sibling: PairingHeapNode<T> | null = null;
  constructor(key: number, value: T) { this.key = key; this.value = value; }
}

class PairingHeap<T> {
  private root: PairingHeapNode<T> | null = null;
  size = 0;

  private link(a: PairingHeapNode<T> | null, b: PairingHeapNode<T> | null): PairingHeapNode<T> | null {
    if (!a) return b;
    if (!b) return a;
    if (a.key <= b.key) {
      // b becomes first child of a
      b.sibling = a.child;
      if (a.child) a.child.parent = a;
      a.child = b;
      b.parent = a;
      return a;
    } else {
      a.sibling = b.child;
      if (b.child) b.child.parent = b;
      b.child = a;
      a.parent = b;
      return b;
    }
  }

  insert(key: number, value: T): PairingHeapNode<T> {
    const node = new PairingHeapNode(key, value);
    this.root = this.link(this.root, node);
    if (this.root) this.root.parent = null;
    this.size++;
    return node;
  }

  findMin(): T | null {
    return this.root ? this.root.value : null;
  }

  extractMin(): T | null {
    if (!this.root) return null;
    const minNode = this.root;
    const child = minNode.child;
    if (child) child.parent = null;
    this.root = this.mergePairs(child);
    if (this.root) this.root.parent = null;
    this.size--;
    // cleanup minNode
    minNode.child = minNode.sibling = minNode.parent = null;
    return minNode.value;
  }

  // decreaseKey: newKey must be smaller
  decreaseKey(node: PairingHeapNode<T>, newKey: number) {
    if (newKey >= node.key) return;
    node.key = newKey;
    if (node === this.root) return;
    // cut node from sibling list / parent child list
    const parent = node.parent;
    if (!parent) return;
    if (parent.child === node) {
      parent.child = node.sibling;
      if (node.sibling) node.sibling.parent = parent;
    } else {
      // find previous sibling (linear to degree) — acceptable amortized for pairing heap
      let cur = parent.child;
      let prev: PairingHeapNode<T> | null = null;
      while (cur && cur !== node) { prev = cur; cur = cur.sibling!; }
      if (cur === node && prev) {
        prev.sibling = node.sibling;
        if (node.sibling) node.sibling.parent = prev;
      }
    }
    node.sibling = null;
    node.parent = null;
    this.root = this.link(this.root, node);
    if (this.root) this.root.parent = null;
  }

  private mergePairs(first: PairingHeapNode<T> | null): PairingHeapNode<T> | null {
    if (!first || !first.sibling) return first;
    const pairs: PairingHeapNode<T>[] = [];
    let cur: PairingHeapNode<T> | null = first;
    while (cur) {
      const a = cur;
      const b:any = cur.sibling;
      const next = b ? b.sibling : null;
      a.sibling = null;
      if (b) b.sibling = null;
      pairs.push(this.link(a, b ?? null)!);
      cur = next;
    }
    let res = pairs.pop()!;
    while (pairs.length) res = this.link(pairs.pop()!, res)!;
    return res;
  }
}

// -------------------- UltraDAG Enhanced --------------------
export class UltraDAG {
  private nodes = new Map<NodeId, Node>();
  private edges = new Map<EdgeId, Edge>();

  private inEdges = new Map<NodeId, Set<Edge>>();
  private outEdges = new Map<NodeId, Set<Edge>>();
  private indegree = new Map<NodeId, number>();
  private neighbors = new Map<NodeId, Set<NodeId>>();
  private endpointEdges = new WeakMap<Endpoint, Set<Edge>>();

  // label-based rank: 核心：稀疏数值标签（越小表示越前）
  private label = new Map<NodeId, number>();

  // weightedRank: 用于加权拓扑排序（关键路径式： max(parentWeighted + edge.weight) + node.weight ）
  private weightedRank = new Map<NodeId, number>();

  // 配对堆仅用于生成 weighted topo（按优先级选择）
  constructor(private MIN_GAP = 1e-9) {}

  // ---------------- node/edge 基本操作 ----------------
  addNode(node: Node) {
    if (this.nodes.has(node.id)) throw new Error(`Node ${node.id} exists`);
    this.nodes.set(node.id, node);
    this.inEdges.set(node.id, new Set());
    this.outEdges.set(node.id, new Set());
    this.neighbors.set(node.id, new Set());
    this.indegree.set(node.id, 0);

    // 初始 label 使用当前节点数量（稀疏）
    const initLabel = this.nodes.size;
    this.label.set(node.id, initLabel);

    // 初始化 weightedRank 为 node.weight（没有前驱）
    this.weightedRank.set(node.id, node.weight ?? 0);
  }

  removeNode(nodeId: NodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return false;
    // 删除相关边
    for (const e of Array.from(this.inEdges.get(nodeId) || [])) this.removeEdge(e.id);
    for (const e of Array.from(this.outEdges.get(nodeId) || [])) this.removeEdge(e.id);
    this.nodes.delete(nodeId);
    this.inEdges.delete(nodeId);
    this.outEdges.delete(nodeId);
    this.indegree.delete(nodeId);
    this.neighbors.delete(nodeId);
    this.label.delete(nodeId);
    this.weightedRank.delete(nodeId);
    return true;
  }

  addEdge(edge: Edge) {
    if (this.edges.has(edge.id)) throw new Error(`Edge ${edge.id} exists`);
    if (!this.nodes.has(edge.source.nodeId) || !this.nodes.has(edge.target.nodeId)) {
      throw new Error('Invalid node reference');
    }
    if (edge.source.nodeId === edge.target.nodeId) throw new Error('Self-loop not allowed');

    this.edges.set(edge.id, edge);
    this.outEdges.get(edge.source.nodeId)!.add(edge);
    this.inEdges.get(edge.target.nodeId)!.add(edge);
    this.neighbors.get(edge.source.nodeId)!.add(edge.target.nodeId);
    this.indegree.set(edge.target.nodeId, (this.indegree.get(edge.target.nodeId) ?? 0) + 1);

    this.linkEndpoint(edge.source, edge);
    this.linkEndpoint(edge.target, edge);

    // 核心：标签调整 + 增量加权传播
    this.ensureTopoLabels(edge.source.nodeId, edge.target.nodeId);
    this.propagateWeightedRank([edge.target.nodeId]);
  }

  removeEdge(edgeId: EdgeId) {
    const edge = this.edges.get(edgeId);
    if (!edge) return false;
    const src = edge.source.nodeId;
    const tgt = edge.target.nodeId;
    this.outEdges.get(src)?.delete(edge);
    this.inEdges.get(tgt)?.delete(edge);
    this.neighbors.get(src)?.delete(tgt);
    this.indegree.set(tgt, Math.max(0, (this.indegree.get(tgt) ?? 1) - 1));
    this.unlinkEndpoint(edge.source, edge);
    this.unlinkEndpoint(edge.target, edge);
    this.edges.delete(edgeId);
    // 删除边后 weightedRank 可能需要降低 —— 复杂（需重算下游），这里不做自动减小以保持实现简单。
    // 若需要支持权值减小，请调用 recomputeWeightedFromSources 或对受影响子图完全重算。
    return true;
  }

  private linkEndpoint(ep: Endpoint, e: Edge) {
    let set = this.endpointEdges.get(ep);
    if (!set) { set = new Set(); this.endpointEdges.set(ep, set); }
    set.add(e);
  }

  private unlinkEndpoint(ep: Endpoint, e: Edge) {
    const set = this.endpointEdges.get(ep);
    if (!set) return;
    set.delete(e);
    if (set.size === 0) this.endpointEdges.delete(ep);
  }

  // ---------------- label / reorder 逻辑 ----------------
  // 确保 src 在 tgt 之前的标签关系；否则尝试在两个标签之间插入 tgt 的新标签
  private ensureTopoLabels(srcId: NodeId, tgtId: NodeId) {
    const rSrc = this.label.get(srcId)!;
    const rTgt = this.label.get(tgtId)!;
    if (rSrc < rTgt) return; // 已满足

    // 目标：把 tgt 移到 src 之后。为此需要找到 src 之后的“后继标签”（nextLabel）
    // 找到所有节点的标签 > rSrc 的最小标签（即下一个节点的标签）
    let nextLabel = Infinity;
    for (const [, l] of this.label) {
      if (l > rSrc && l < nextLabel) nextLabel = l;
    }
    if (!isFinite(nextLabel)) nextLabel = rSrc + 1; // 如果没有下一个节点，直接用 rSrc + 1

    // 尝试取中点
    const mid = (rSrc + nextLabel) / 2;
    if (Math.abs(mid - rSrc) > this.MIN_GAP && Math.abs(nextLabel - mid) > this.MIN_GAP) {
      this.label.set(tgtId, mid);
      return;
    }

    // 若间隙太小（接近精度极限），则需要局部 re-label（relabelRange）
    // 我们收集从 src 开始，向后按依赖传播的一小段节点，然后重新打标签
    this.relabelRange(srcId, tgtId);
  }

  // 局部重编号：重编号受影响区间，保证有足够间隙用于插入
  private relabelRange(srcId: NodeId, tgtId: NodeId) {
    // 收集要重标的节点集：从 src 开始向前（包括 src）直到覆盖 tgt 或达到限制
    // 实用策略：收集 src 的后续 K 个节点（按 label 顺序）或收集受影响子图
    const K = 1000; // 局部重编号的最大节点数（可调）
    // 先把所有节点按 label 排序，切片出从 src 后面开始的一段
    const nodesSorted = [...this.label.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
    const idxSrc = nodesSorted.indexOf(srcId);
    const start = Math.max(0, idxSrc);
    const end = Math.min(nodesSorted.length, start + K);
    const slice = nodesSorted.slice(start, end);

    // 重新分配等间隔 labels，在 [oldLabelStart, oldLabelEnd] 区间均匀分配
    const oldStart = this.label.get(slice[0])!;
    const oldEnd = this.label.get(slice[slice.length - 1])!;
    const span = Math.max(1, oldEnd - oldStart); // 避免 0
    for (let i = 0; i < slice.length; i++) {
      // 分配为 oldStart + (i+1) * span / (slice.length + 1)
      const newLabel = oldStart + (i + 1) * (span / (slice.length + 1));
      this.label.set(slice[i], newLabel);
    }

    // 最后把 tgtId 放在 src 后面第一个位置（如果 tgt 在 slice 外仍然会被 mid 处理）
    const rSrc = this.label.get(srcId)!;
    // 找 src 之后的最小 label
    let nextLabel = Infinity;
    for (const [, l] of this.label) {
      if (l > rSrc && l < nextLabel) nextLabel = l;
    }
    if (!isFinite(nextLabel)) nextLabel = rSrc + 1;
    this.label.set(tgtId, (rSrc + nextLabel) / 2);
  }

  // ---------------- weightedRank 增量传播 ----------------
  // 从给定起点（通常是新边的 target）向下游传播，当 newWeighted > old 时继续
  private propagateWeightedRank(startNodes: NodeId[]) {
    const q: NodeId[] = [...startNodes];
    const inQueue = new Set(startNodes);

    while (q.length) {
      const cur = q.shift()!;
      inQueue.delete(cur);
      const node = this.nodes.get(cur)!;
      // 计算以 cur 为 target 时所有父的贡献的最大值
      let best = Number.NEGATIVE_INFINITY;
      const inE = this.inEdges.get(cur);
      if (inE && inE.size > 0) {
        for (const e of inE) {
          const p = e.source.nodeId;
          const parentWR = this.weightedRank.get(p) ?? 0;
          const contrib = parentWR + (e.weight ?? 0);
          if (contrib > best) best = contrib;
        }
      } else {
        best = 0; // 没有父节点时视为 0
      }
      const newWR = best + (node.weight ?? 0);
      const oldWR = this.weightedRank.get(cur) ?? Number.NEGATIVE_INFINITY;
      if (newWR > oldWR + 1e-12) { // 细微数值噪声忽略
        this.weightedRank.set(cur, newWR);
        // 推送子节点
        for (const e of this.outEdges.get(cur) || []) {
          const t = e.target.nodeId;
          if (!inQueue.has(t)) { inQueue.add(t); q.push(t); }
        }
      }
    }
  }

  // ---------------- 查询接口 ----------------
  // 返回节点按 label 排序的完整拓扑（成本 O(V log V)）
  // 仅当你需要完整序列时调用，否则尽量用局部/流式接口
  getTopo(): NodeId[] {
    return [...this.nodes.keys()].sort((a, b) => {
      return (this.label.get(a)! - this.label.get(b)!);
    });
  }

  // 返回当前某节点的 label（顺序标签）
  getLabel(nodeId: NodeId): number | undefined { return this.label.get(nodeId); }

  // 返回当前 weightedRank
  getWeightedRank(nodeId: NodeId): number | undefined { return this.weightedRank.get(nodeId); }

  // 使用配对堆生成按 weightedRank 优先的拓扑序（非破坏性）
  // 优先级： weightedRank 越大越先被调度 => heap 使用 -weightedRank (min-heap)
  weightedTopologicalOrder(): NodeId[] {
    // 复制 indegree
    const indeg = new Map<NodeId, number>();
    for (const [id, d] of this.indegree) indeg.set(id, d);

    const heap = new PairingHeap<NodeId>();
    // push all indeg 0 nodes
    for (const [id, d] of indeg) {
      if (d === 0) {
        const wr = this.weightedRank.get(id) ?? 0;
        heap.insert(-wr, id);
      }
    }

    const result: NodeId[] = [];
    while (heap.size > 0) {
      const id = heap.extractMin();
      if (id === null || id === undefined) break;
      result.push(id);
      for (const e of this.outEdges.get(id) || []) {
        const tgt = e.target.nodeId;
        indeg.set(tgt, (indeg.get(tgt) ?? 1) - 1);
        if (indeg.get(tgt) === 0) {
          const wr = this.weightedRank.get(tgt) ?? 0;
          heap.insert(-wr, tgt);
        }
      }
    }
    // 若 result.length < nodes => 存在环（不应在 DAG 中）
    return result;
  }

  // 获取通过某端点关联的边（端点对象为键）
  getEdgesByEndpoint(ep: Endpoint): Edge[] {
    return Array.from(this.endpointEdges.get(ep) || []);
  }

  getNeighbors(nodeId: NodeId): NodeId[] {
    return Array.from(this.neighbors.get(nodeId) || []);
  }
}
