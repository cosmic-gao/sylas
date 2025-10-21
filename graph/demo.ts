type NodeId = string;
type EdgeId = string;

interface Node {
  id: NodeId;
  inputs: { name: string }[];
  outputs: { name: string }[];
}

interface EndpointHandle {
  nodeId: NodeId;
  name: string;
}

interface Edge {
  id: EdgeId;
  source: EndpointHandle;
  target: EndpointHandle;
}

/**
 * 高性能增量 DAG（WeakMap 懒加载端点映射 + 最小调整增量拓扑）
 */
class IndustrialDAG {
  private nodes: Map<NodeId, Node> = new Map();
  private edges: Map<EdgeId, Edge> = new Map();

  // 边集合（按 nodeId 存边 id）
  private in: Map<NodeId, Set<EdgeId>> = new Map();
  private out: Map<NodeId, Set<EdgeId>> = new Map();

  // 直接邻居（出邻居 nodeId），避免每次通过 edges 查 target
  private neighbors: Map<NodeId, Set<NodeId>> = new Map();

  // 入度（用于其他用途或检查）
  private indegree: Map<NodeId, number> = new Map();

  // WeakMap 懒加载端点映射：nodeObject -> Map<portName, Set<EdgeId>>
  private connections: WeakMap<Node, Map<string, Set<EdgeId>>> = new WeakMap();

  // 拓扑序 + 位置缓存 (rank)
  private topoOrder: NodeId[] = [];
  private nodePosition: Map<NodeId, number> = new Map();

  // -------------------- 节点操作 --------------------
  addNode(node: Node) {
    if (this.nodes.has(node.id)) throw new Error(`Node ${node.id} exists`);
    this.nodes.set(node.id, node);

    this.in.set(node.id, new Set());
    this.out.set(node.id, new Set());
    this.neighbors.set(node.id, new Set());
    this.indegree.set(node.id, 0);

    // 默认将新节点追加到 topoOrder 尾部（便于增量）
    const pos = this.topoOrder.length;
    this.topoOrder.push(node.id);
    this.nodePosition.set(node.id, pos);
  }

  removeNode(nodeId: NodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    // 删除相关边（复制集合以免迭代时修改）
    const inEdges = Array.from(this.in.get(nodeId) || []);
    const outEdges = Array.from(this.out.get(nodeId) || []);
    for (const eid of inEdges) this.removeEdge(eid);
    for (const eid of outEdges) this.removeEdge(eid);

    // 删除 node 相关结构
    this.nodes.delete(nodeId);
    this.in.delete(nodeId);
    this.out.delete(nodeId);
    this.neighbors.delete(nodeId);
    this.indegree.delete(nodeId);

    // 从 topoOrder 中移除并更新位置（一次线性更新）
    const idx = this.nodePosition.get(nodeId);
    if (idx !== undefined) {
      this.topoOrder.splice(idx, 1);
      this.nodePosition.delete(nodeId);
      for (let i = idx; i < this.topoOrder.length; i++) {
        this.nodePosition.set(this.topoOrder[i], i);
      }
    }

    // WeakMap 的 entry 会在 node 对象不可达时被回收（无需手动删除）
    return true;
  }

  // -------------------- 边操作 --------------------
  addEdge(edge: Edge) {
    if (this.edges.has(edge.id)) throw new Error(`Edge ${edge.id} exists`);
    const srcNode = this.nodes.get(edge.source.nodeId);
    const tgtNode = this.nodes.get(edge.target.nodeId);
    if (!srcNode) throw new Error(`Source node ${edge.source.nodeId} not found`);
    if (!tgtNode) throw new Error(`Target node ${edge.target.nodeId} not found`);
    if (edge.source.nodeId === edge.target.nodeId) throw new Error('Self-loop not allowed');

    this.edges.set(edge.id, edge);

    // 更新边集合
    this.out.get(edge.source.nodeId)!.add(edge.id);
    this.in.get(edge.target.nodeId)!.add(edge.id);

    // 更新邻居集合（保持 nodeId set）
    this.neighbors.get(edge.source.nodeId)!.add(edge.target.nodeId);

    // 更新入度
    this.indegree.set(edge.target.nodeId, (this.indegree.get(edge.target.nodeId) || 0) + 1);

    // WeakMap 懒加载端点映射
    this.addConnection(srcNode, edge.source.name, edge.id);
    this.addConnection(tgtNode, edge.target.name, edge.id);

    // 增量调整拓扑（最小移动）
    this.reorder(edge.source.nodeId, edge.target.nodeId);
  }

  removeEdge(edgeId: EdgeId) {
    const edge = this.edges.get(edgeId);
    if (!edge) return false;

    const src = edge.source.nodeId;
    const tgt = edge.target.nodeId;
    const srcNode = this.nodes.get(src)!;
    const tgtNode = this.nodes.get(tgt)!;

    // 更新边集合
    this.out.get(src)!.delete(edgeId);
    this.in.get(tgt)!.delete(edgeId);

    // 若 src->tgt 不再有任何边，移除 neighbors 关系
    let stillConnected = false;
    for (const eid of this.out.get(src)!) {
      if (this.edges.get(eid)!.target.nodeId === tgt) {
        stillConnected = true;
        break;
      }
    }
    if (!stillConnected) this.neighbors.get(src)!.delete(tgt);

    // 更新入度
    this.indegree.set(tgt, Math.max(0, (this.indegree.get(tgt) || 1) - 1));

    // 更新 WeakMap connections
    this.removeConnection(srcNode, edge.source.name, edgeId);
    this.removeConnection(tgtNode, edge.target.name, edgeId);

    this.edges.delete(edgeId);
    return true;
  }

  // -------------------- WeakMap connections helpers --------------------
  private addConnection(nodeObj: Node, portName: string, edgeId: EdgeId) {
    let portMap = this.connections.get(nodeObj);
    if (!portMap) {
      portMap = new Map<string, Set<EdgeId>>();
      this.connections.set(nodeObj, portMap);
    }
    let set = portMap.get(portName);
    if (!set) {
      set = new Set<EdgeId>();
      portMap.set(portName, set);
    }
    set.add(edgeId);
  }

  private removeConnection(nodeObj: Node, portName: string, edgeId: EdgeId) {
    const portMap = this.connections.get(nodeObj);
    if (!portMap) return;
    const set = portMap.get(portName);
    if (!set) return;
    set.delete(edgeId);
    if (set.size === 0) portMap.delete(portName);
    // 若 portMap 为空，WeakMap 会随着 nodeObj 不可达自动回收
  }

  // -------------------- 最小调整增量拓扑（局部移动实现） --------------------
  // 单词名字：reorder
  private reorder(u: NodeId, v: NodeId) {
    const rankU = this.nodePosition.get(u);
    const rankV = this.nodePosition.get(v);
    if (rankU === undefined || rankV === undefined) return;
    if (rankU < rankV) return; // 已合法，无需调整

    // BFS/队列 查找受影响节点：从 v 可达且当前 rank <= rankU 的节点
    const visited = new Set<NodeId>();
    const affected: NodeId[] = [];
    const q: NodeId[] = [v];
    visited.add(v);

    while (q.length) {
      const cur = q.shift()!;
      affected.push(cur);
      const outs = this.neighbors.get(cur);
      if (!outs) continue;
      for (const nxt of outs) {
        const r = this.nodePosition.get(nxt);
        if (r !== undefined && r <= rankU && !visited.has(nxt)) {
          visited.add(nxt);
          q.push(nxt);
        }
      }
    }

    if (affected.length === 0) return;

    // 为减少 work：affected 保持 BFS 发现顺序（通常已为拓扑可用顺序），不再全排序
    const movedSet = new Set<NodeId>(affected);

    // 在 topoOrder 中原地移除所有 affected 节点并插入到 u 后面
    // 1) 构建未移动的序列（before），保留原顺序
    const before: NodeId[] = [];
    before.length = this.topoOrder.length - movedSet.size; // 预分配（提示）

    // 填充 before（一次遍历）
    let bi = 0;
    for (let i = 0; i < this.topoOrder.length; i++) {
      const nid = this.topoOrder[i];
      if (!movedSet.has(nid)) {
        before[bi++] = nid;
      }
    }
    before.length = bi; // 修正长度

    // 2) 找到插入位置（u 在 before 中的位置）
    const insertIdx = before.indexOf(u) + 1; // indexOf 只有一次（受控成本）

    // 3) 在 before 中插入 affected（保持 affected 的发现顺序）
    // 直接 splice
    before.splice(insertIdx, 0, ...affected);

    // 4) 替换 topoOrder 并一次性更新 nodePosition
    this.topoOrder = before;
    for (let i = 0; i < this.topoOrder.length; i++) {
      this.nodePosition.set(this.topoOrder[i], i);
    }
  }

  // -------------------- 查询 --------------------
  getEdgesByEndpoint(endpoint: EndpointHandle, type: 'input' | 'output'): Edge[] {
    const nodeObj = this.nodes.get(endpoint.nodeId);
    if (!nodeObj) return [];
    const portMap = this.connections.get(nodeObj);
    if (!portMap) return [];
    const set = portMap.get(endpoint.name);
    if (!set) return [];
    return Array.from(set).map(id => this.edges.get(id)!).filter(Boolean);
  }

  getNeighbors(nodeId: NodeId): NodeId[] {
    return Array.from(this.neighbors.get(nodeId) || []);
  }

  getPredecessors(nodeId: NodeId): NodeId[] {
    const inSet = this.in.get(nodeId) || new Set();
    const preds: NodeId[] = [];
    for (const eid of inSet) {
      const e = this.edges.get(eid);
      if (e) preds.push(e.source.nodeId);
    }
    return preds;
  }

  getInDegree(nodeId: NodeId): number {
    return this.indegree.get(nodeId) || 0;
  }

  getOutDegree(nodeId: NodeId): number {
    return this.out.get(nodeId)?.size || 0;
  }

  getTopoOrder(): NodeId[] {
    return [...this.topoOrder];
  }

  clear() {
    this.nodes.clear();
    this.edges.clear();
    this.in.clear();
    this.out.clear();
    this.neighbors.clear();
    this.indegree.clear();
    this.connections = new WeakMap();
    this.topoOrder = [];
    this.nodePosition.clear();
  }
}
