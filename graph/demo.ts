type NodeId = string;
type EdgeId = string;

interface Endpoint {
  name: string;
}

interface EndpointHandle extends Endpoint {
  nodeId: NodeId;
}

interface Node {
  id: NodeId;
  inputs: Endpoint[];
  outputs: Endpoint[];
}

interface Edge {
  id: EdgeId;
  source: EndpointHandle;
  target: EndpointHandle;
}

/**
 * UltraDAG：端点驱动的高性能增量拓扑 DAG
 * - WeakMap 端点连接索引（对象级懒加载）
 * - 最小拓扑调整 reorder
 */
class UltraDAG {
  private nodes = new Map<NodeId, Node>();
  private edges = new Map<EdgeId, Edge>();

  private inEdges = new Map<NodeId, Set<Edge>>();
  private outEdges = new Map<NodeId, Set<Edge>>();
  private neighbors = new Map<NodeId, Set<NodeId>>();
  private indegree = new Map<NodeId, number>();

  // 🔥 直接 WeakMap：端点对象 => 边集合
  private endpointEdges = new WeakMap<Endpoint, Set<Edge>>();

  // 拓扑序
  private topo: NodeId[] = [];
  private rank = new Map<NodeId, number>();

  // ------------------ 节点 ------------------
  addNode(node: Node) {
    if (this.nodes.has(node.id)) throw new Error(`Node ${node.id} exists`);
    this.nodes.set(node.id, node);
    this.inEdges.set(node.id, new Set());
    this.outEdges.set(node.id, new Set());
    this.neighbors.set(node.id, new Set());
    this.indegree.set(node.id, 0);

    const pos = this.topo.length;
    this.topo.push(node.id);
    this.rank.set(node.id, pos);
  }

  removeNode(id: NodeId) {
    const node = this.nodes.get(id);
    if (!node) return false;

    const allEdges = [...(this.inEdges.get(id) || []), ...(this.outEdges.get(id) || [])];
    for (const e of allEdges) this.removeEdge(e.id);

    this.nodes.delete(id);
    this.inEdges.delete(id);
    this.outEdges.delete(id);
    this.neighbors.delete(id);
    this.indegree.delete(id);

    const idx = this.rank.get(id);
    if (idx !== undefined) {
      this.topo.splice(idx, 1);
      this.rank.delete(id);
      for (let i = idx; i < this.topo.length; i++) {
        this.rank.set(this.topo[i], i);
      }
    }
    return true;
  }

  // ------------------ 边 ------------------
  addEdge(edge: Edge) {
    if (this.edges.has(edge.id)) throw new Error(`Edge ${edge.id} exists`);
    const src = this.nodes.get(edge.source.nodeId);
    const tgt = this.nodes.get(edge.target.nodeId);
    if (!src || !tgt) throw new Error(`Invalid node reference`);
    if (edge.source.nodeId === edge.target.nodeId) throw new Error(`Self-loop not allowed`);

    this.edges.set(edge.id, edge);
    this.outEdges.get(edge.source.nodeId)!.add(edge);
    this.inEdges.get(edge.target.nodeId)!.add(edge);
    this.neighbors.get(edge.source.nodeId)!.add(edge.target.nodeId);
    this.indegree.set(edge.target.nodeId, (this.indegree.get(edge.target.nodeId) || 0) + 1);

    // 🔗 WeakMap：注册端点与边
    this.linkEndpoint(edge.source, edge);
    this.linkEndpoint(edge.target, edge);

    // 局部拓扑更新
    this.reorder(edge.source.nodeId, edge.target.nodeId);
  }

  removeEdge(edgeId: EdgeId) {
    const edge = this.edges.get(edgeId);
    if (!edge) return false;

    const src = edge.source.nodeId;
    const tgt = edge.target.nodeId;

    this.outEdges.get(src)?.delete(edge);
    this.inEdges.get(tgt)?.delete(edge);
    this.neighbors.get(src)?.delete(tgt);
    this.indegree.set(tgt, Math.max(0, (this.indegree.get(tgt) || 1) - 1));

    // 🔗 WeakMap 自动更新
    this.unlinkEndpoint(edge.source, edge);
    this.unlinkEndpoint(edge.target, edge);

    this.edges.delete(edgeId);
    return true;
  }

  // ------------------ WeakMap helpers ------------------
  private linkEndpoint(ep: Endpoint, edge: Edge) {
    let set = this.endpointEdges.get(ep);
    if (!set) {
      set = new Set();
      this.endpointEdges.set(ep, set);
    }
    set.add(edge);
  }

  private unlinkEndpoint(ep: Endpoint, edge: Edge) {
    const set = this.endpointEdges.get(ep);
    if (set) {
      set.delete(edge);
      if (set.size === 0) this.endpointEdges.delete(ep);
    }
  }

  // ------------------ 增量拓扑 ------------------
  private reorder(u: NodeId, v: NodeId) {
    const ru = this.rank.get(u);
    const rv = this.rank.get(v);
    if (ru === undefined || rv === undefined) return;
    if (ru < rv) return;

    const affected: NodeId[] = [];
    const q = [v];
    const seen = new Set([v]);

    while (q.length) {
      const cur = q.shift()!;
      affected.push(cur);
      for (const nxt of this.neighbors.get(cur) || []) {
        const r = this.rank.get(nxt);
        if (r !== undefined && r <= ru && !seen.has(nxt)) {
          seen.add(nxt);
          q.push(nxt);
        }
      }
    }
    if (!affected.length) return;

    const moved = new Set(affected);
    const kept = this.topo.filter(n => !moved.has(n));
    const idx = kept.indexOf(u) + 1;
    kept.splice(idx, 0, ...affected);

    this.topo = kept;
    for (let i = 0; i < kept.length; i++) this.rank.set(kept[i], i);
  }

  // ------------------ 查询 ------------------
  getEdgesByEndpoint(ep: Endpoint): Edge[] {
    return Array.from(this.endpointEdges.get(ep) || []);
  }

  getNeighbors(id: NodeId): NodeId[] {
    return Array.from(this.neighbors.get(id) || []);
  }

  getTopo(): NodeId[] {
    return [...this.topo];
  }
}


// 如果你要在高频动态调度（每秒几千次更新）下使用，可以再提升：

// 批量模式

// 累积多条边更新后再统一 reorderBatch()。

// 避免每次边添加都触发局部排序。

// 拓扑索引树（Topological Index Tree）

// 使用平衡树维护 rank（比如 Order-Maintenance Tree）。

// 在节点移动时 O(log n) 调整 rank，而不是 O(k) 扫描。

// 延迟修正（Lazy Reorder）

// 标记脏区间（dirty zone），只在真正需要时修正。