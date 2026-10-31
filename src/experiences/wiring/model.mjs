/** Entirely reconstructed port names, graph, page references and coordinates. */
export const wiringSample = {
  ports: [
    { id: 'p1', label: 'A:1', x: 90, y: 150, page: '01', description: '样例输入端' },
    { id: 'p2', label: 'A:2', x: 270, y: 150, page: '01', description: '样例桥接端' },
    { id: 'p3', label: 'A:3', x: 450, y: 150, page: '01', description: '样例跨页端' },
    { id: 'p4', label: 'B:1', x: 680, y: 150, page: '02', description: '样例器件输入端' },
    { id: 'p5', label: 'B:2', x: 680, y: 345, page: '02', description: '样例器件另一端' },
    { id: 'p6', label: 'C:1', x: 450, y: 345, page: '01', description: '待核目标端' },
    { id: 'p7', label: 'C:2', x: 270, y: 345, page: '01', description: '存在冲突的引用目标' },
    { id: 'p8', label: 'D:1', x: 90, y: 345, page: '01', description: '独立支路端' },
  ],
  edges: [
    { id: 'e1', a: 'p1', b: 'p2', kind: 'direct', status: 'verified', evidence: '样例页 01 · 上方导线', note: '已确认导线' },
    { id: 'e2', a: 'p2', b: 'p3', kind: 'bridge', status: 'verified', evidence: '样例页 01 · 端子桥接', note: '已确认桥接' },
    { id: 'e3', a: 'p3', b: 'p4', kind: 'cross-page', status: 'verified', evidence: '样例页 01 ↔ 02 · 跨页对应', note: '已确认跨页关系' },
    { id: 'e4', a: 'p4', b: 'p5', kind: 'component', status: 'verified', evidence: '样例页 02 · 器件边界', note: '器件内部关系不推断导通' },
    { id: 'e5', a: 'p3', b: 'p6', kind: 'direct', status: 'pending', evidence: '样例页 01 · 下方候选线', note: '目标端尚待核对' },
    { id: 'e6', a: 'p2', b: 'p7', kind: 'cross-page', status: 'conflict', evidence: '样例页 01 · 引用冲突', note: '两个引用解释存在冲突' },
    { id: 'e7', a: 'p7', b: 'p8', kind: 'direct', status: 'verified', evidence: '样例页 01 · 独立支路', note: '已确认导线' },
  ],
};

/** @param {typeof wiringSample} sample @param {string} query */
export function searchPorts(sample, query) {
  const text = query.trim().toLocaleLowerCase();
  return sample.ports.filter(port => `${port.label} ${port.description} ${port.page}`.toLocaleLowerCase().includes(text));
}

/** @param {typeof wiringSample} sample @param {string} portId */
export function queryConnections(sample, portId, mode = 'direct') {
  const port = sample.ports.find(item => item.id === portId);
  if (!port) throw new Error('Unknown port');
  if (!['direct', 'network', 'pending'].includes(mode)) throw new Error('Unknown query mode');
  const confirmed = sample.edges.filter(edge => edge.status === 'verified' && edge.kind !== 'component');
  const adjacent = edge => edge.a === portId || edge.b === portId;
  /** @type {typeof wiringSample.edges} */
  let edges = [];
  if (mode === 'pending') edges = sample.edges.filter(edge => edge.status !== 'verified' && adjacent(edge));
  else if (mode === 'direct') edges = confirmed.filter(edge => ['direct', 'bridge'].includes(edge.kind) && adjacent(edge));
  else {
    const visited = new Set([portId]);
    const queue = [portId];
    for (let index = 0; index < queue.length; index++) {
      for (const edge of confirmed) {
        const next = edge.a === queue[index] ? edge.b : edge.b === queue[index] ? edge.a : null;
        if (next && !visited.has(next)) { visited.add(next); queue.push(next); }
      }
    }
    edges = confirmed.filter(edge => visited.has(edge.a) && visited.has(edge.b));
  }
  return { port, edges, portIds: [...new Set([portId, ...edges.flatMap(edge => [edge.a, edge.b])])] };
}

/** Ordered path and drawing pages; a relation inside a device is never a conductor. */
export function tracePath(sample, sourceId, targetId) {
  if (![sourceId, targetId].every(id => sample.ports.some(p => p.id === id))) return null;
  const queue = [sourceId], visited = new Set(queue), previous = new Map();
  for (let i = 0; i < queue.length && !visited.has(targetId); i++) {
    for (const edge of sample.edges.filter(e => e.status === 'verified' && e.kind !== 'component')) {
      const next = edge.a === queue[i] ? edge.b : edge.b === queue[i] ? edge.a : null;
      if (!next || visited.has(next)) continue;
      visited.add(next); previous.set(next, { port: queue[i], edge: edge.id }); queue.push(next);
    }
  }
  if (!visited.has(targetId)) return null;
  const portIds = [targetId], edgeIds = [];
  while (portIds[0] !== sourceId) {
    const step = previous.get(portIds[0]);
    portIds.unshift(step.port); edgeIds.unshift(step.edge);
  }
  return { portIds, edgeIds, pages: [...new Set(portIds.map(id => sample.ports.find(p => p.id === id).page))] };
}
