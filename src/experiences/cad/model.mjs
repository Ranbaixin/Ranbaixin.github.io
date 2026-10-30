/** Rebuilt public geometry and records; no business drawing is embedded. */
export function createDrawingSample(scenario = 'complete') {
  if (!['complete', 'missing', 'duplicate'].includes(scenario)) throw new Error('Unknown drawing scenario');
  const records = [
    { id: 'plate-a', partId: 'DEMO-01', projectId: 'SAMPLE-A', material: 'Q235B', thickness: 8, points: '80,110 300,110 300,185 235,185 235,280 80,280', center: [172, 185] },
    { id: 'plate-b', partId: 'DEMO-02', projectId: 'SAMPLE-A', material: 'Q355B', thickness: 12, points: '355,110 620,110 620,280 490,280 490,230 355,230', center: [500, 180] },
    { id: 'plate-c', partId: 'DEMO-03', projectId: 'SAMPLE-B', material: 'Q235B', thickness: 8, points: '120,340 545,340 600,400 120,400', center: [350, 374] },
  ];
  if (scenario === 'missing') { records[1].material = ''; records[1].thickness = null; }
  if (scenario === 'duplicate') records[2].partId = records[0].partId;
  return records;
}

export function validateDrawing(records) {
  const seen = new Set();
  const issues = [];
  for (const row of records) {
    for (const [field, label] of [['partId', '零件标识'], ['projectId', '项目标识'], ['material', '材料']]) {
      if (!String(row[field] || '').trim()) issues.push({ recordId: row.id, field, message: `${row.id}：缺少${label}` });
    }
    if (!Number.isFinite(row.thickness) || row.thickness <= 0) issues.push({ recordId: row.id, field: 'thickness', message: `${row.id}：厚度须大于 0` });
    if (seen.has(row.partId)) issues.push({ recordId: row.id, field: 'partId', message: `${row.partId}：零件标识重复` });
    seen.add(row.partId);
  }
  return issues;
}

export function deduplicateDrawing(records) {
  const seen = new Set();
  return records.filter(row => { if (seen.has(row.partId)) return false; seen.add(row.partId); return true; });
}

export function advanceDrawingFlow(records, stage) {
  const issues = validateDrawing(records);
  return { stage: issues.length ? stage : Math.min(4, stage + 1), issues };
}

export function buildHandoff(records) {
  if (validateDrawing(records).length) throw new Error('Invalid drawing fields');
  return { schema: 'public-sample-v1', parts: records.map(row => ({ part: row.partId, project: row.projectId, material: row.material, thicknessMm: row.thickness })) };
}

export function transitionInventory(status, action) {
  const transitions = { 'available:reserve': 'reserved', 'reserved:release': 'available', 'reserved:use': 'used' };
  const next = transitions[`${status}:${action}`];
  if (!next) throw new Error('Invalid inventory transition');
  return next;
}

/**
 * @template {{material: string, thickness: number}} T
 * @param {T[]} rows
 */
export function filterInventory(rows, material = 'all', thickness = 'all') {
  return rows.filter(row => (material === 'all' || row.material === material) && (thickness === 'all' || row.thickness === Number(thickness)));
}

export function createInventory() {
  return [
    { id: 'stock-a', partId: 'SAMPLE-11', material: 'Q235B', thickness: 8, status: 'available' },
    { id: 'stock-b', partId: 'SAMPLE-12', material: 'Q355B', thickness: 12, status: 'reserved' },
    { id: 'stock-c', partId: 'SAMPLE-13', material: 'Q235B', thickness: 12, status: 'available' },
  ];
}
