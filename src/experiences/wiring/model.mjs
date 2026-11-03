import { wiringSample } from './sample.mjs';
export { wiringSample };

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
  if (mode === 'pending') edges = sample.edges.filter(edge => edge.kind !== 'component' && ['pending', 'conflict'].includes(edge.status) && adjacent(edge));
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
  return { port, edges, portIds: [...new Set([portId, ...edges.flatMap(edge => [edge.a, edge.b])])].filter(id => sample.ports.some(p => p.id === id)) };
}

/** Ordered path and drawing pages; a relation inside a device is never a conductor. */
export function tracePath(sample, sourceId, targetId) {
  if (![sourceId, targetId].every(id => sample.ports.some(p => p.id === id))) return null;
  const queue = [sourceId], visited = new Set(queue), previous = new Map();
  for (let i = 0; i < queue.length && !visited.has(targetId); i++) {
    for (const edge of sample.edges.filter(e => e.status === 'verified' && !['component', 'network'].includes(e.kind))) {
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

/** @param {{width: number, height: number}} sheet @param {{x: number, y: number, width: number, height: number} | null} focus */
export function drawingViewport(sheet, focus = null, zoom = 1) {
  const factor = Math.max(1, Math.min(3, Number.isFinite(zoom) ? zoom : 1));
  const width = sheet.width / factor, height = sheet.height / factor;
  const centerX = focus ? focus.x + focus.width / 2 : sheet.width / 2;
  const centerY = focus ? focus.y + focus.height / 2 : sheet.height / 2;
  return { x: Math.max(0, Math.min(sheet.width - width, centerX - width / 2)), y: Math.max(0, Math.min(sheet.height - height, centerY - height / 2)), width, height };
}

/** Reject unapproved source metadata before a public build. */
export function validateWiringSample(sample) {
  const errors = [], ids = new Set();
  const fields = (value, allowed) => { for (const key of Object.keys(value)) if (!allowed.includes(key)) errors.push(`unsupported drawing field: ${key}`); };
  fields(sample, ['version', 'disclosure', 'pages', 'ports', 'nodes', 'edges']);
  if (sample.version !== 'wiring-v3' || !sample.disclosure) errors.push('public drawing version required');
  const pages = new Map(sample.pages.map(p => [p.id, p]));
  for (const p of sample.pages) fields(p, ['id', 'title', 'code', 'width', 'height']);
  for (const p of [...sample.ports, ...sample.nodes]) {
    fields(p, ['id', 'label', 'page', 'x', 'y', 'device', 'terminal', 'description']);
    const page = pages.get(p.page);
    if (ids.has(p.id) || !page || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.y < 0 || p.x > page.width || p.y > page.height) errors.push('invalid public port');
    ids.add(p.id);
  }
  const edges = new Set();
  for (const e of sample.edges) {
    fields(e, ['id', 'a', 'b', 'kind', 'status', 'wire', 'evidence', 'note', 'views', 'strokes']);
    if (edges.has(e.id) || !ids.has(e.a) || !ids.has(e.b) || !['direct', 'network', 'component'].includes(e.kind) || !['verified', 'pending', 'conflict', 'boundary'].includes(e.status)) errors.push('invalid public relation');
    edges.add(e.id);
    if (e.kind !== 'component' && !e.views.length) errors.push('drawing evidence required');
    if (e.kind === 'direct' && e.status === 'verified' && new Set(e.views.map(v => v.page)).size !== 2) errors.push('both reference pages required');
    for (const v of e.views) {
      fields(v, ['page', 'zone', 'label', 'bounds']); fields(v.bounds, ['x', 'y', 'width', 'height']);
      const page = pages.get(v.page), b = v.bounds;
      if (!page || !v.zone || b.width <= 0 || b.height <= 0 || ![b.x, b.y, b.width, b.height].every(Number.isFinite) || b.x < 0 || b.y < 0 || b.x + b.width > page.width || b.y + b.height > page.height) errors.push('invalid evidence bounds');
    }
    for (const s of e.strokes) { fields(s, ['page', 'd']); if (!pages.has(s.page) || !/^[MLHV\d\s.,-]+$/.test(s.d)) errors.push('invalid public drawing stroke'); }
  }
  return errors;
}
