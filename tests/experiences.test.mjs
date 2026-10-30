import test from 'node:test';
import assert from 'node:assert/strict';

const cad = await import('../src/experiences/cad/model.mjs').catch(() => ({}));
const energy = await import('../src/experiences/energy/model.mjs').catch(() => ({}));
const wiring = await import('../src/experiences/wiring/model.mjs').catch(() => ({}));

test('drawing validation blocks missing material and thickness until corrected', () => {
  assert.equal(typeof cad.createDrawingSample, 'function');
  const records = cad.createDrawingSample('missing');
  assert.deepEqual(cad.validateDrawing(records).map(issue => issue.field).sort(), ['material', 'thickness']);
  const repaired = records.map(row => ({ ...row, material: row.material || 'Q235B', thickness: row.thickness || 8 }));
  assert.deepEqual(cad.validateDrawing(repaired), []);
});

test('duplicate drawing identifiers need explicit deduplication', () => {
  assert.equal(typeof cad.createDrawingSample, 'function');
  const records = cad.createDrawingSample('duplicate');
  assert.ok(cad.validateDrawing(records).some(issue => issue.field === 'partId'));
  const unique = cad.deduplicateDrawing(records);
  assert.equal(unique.length, 2);
  assert.deepEqual(cad.validateDrawing(unique), []);
  assert.equal(records.length, 3);
});

test('drawing handoff and flow cannot advance with invalid inputs', () => {
  assert.equal(typeof cad.advanceDrawingFlow, 'function');
  assert.equal(cad.advanceDrawingFlow(cad.createDrawingSample('missing'), 0).stage, 0);
  const records = cad.createDrawingSample('complete');
  let stage = 0;
  for (let i = 0; i < 4; i++) stage = cad.advanceDrawingFlow(records, stage).stage;
  assert.equal(stage, 4);
  assert.equal(cad.advanceDrawingFlow(records, stage).stage, 4);
  const handoff = cad.buildHandoff(records);
  assert.equal(handoff.parts.length, records.length);
  assert.deepEqual(Object.keys(handoff.parts[0]).sort(), ['material', 'part', 'project', 'thicknessMm']);
});

test('inventory permits reservations, release and use but rejects invalid transitions', () => {
  assert.equal(typeof cad.transitionInventory, 'function');
  assert.equal(cad.transitionInventory('available', 'reserve'), 'reserved');
  assert.equal(cad.transitionInventory('reserved', 'release'), 'available');
  assert.equal(cad.transitionInventory('reserved', 'use'), 'used');
  assert.throws(() => cad.transitionInventory('used', 'reserve'), /transition/);
  assert.throws(() => cad.transitionInventory('available', 'use'), /transition/);
});

test('inventory filters match the complete material grade and exact thickness', () => {
  assert.equal(typeof cad.filterInventory, 'function');
  const rows = [{ material: 'Q235B', thickness: 8 }, { material: 'Q355B', thickness: 12 }, { material: 'Q235B', thickness: 12 }];
  assert.equal(cad.filterInventory(rows, 'all', 'all').length, 3);
  assert.deepEqual(cad.filterInventory(rows, 'Q235B', '12'), [rows[2]]);
  assert.equal(cad.filterInventory(rows, 'Q235', 'all').length, 0);
});

test('forecast metrics match an independent signed-error fixture', () => {
  assert.equal(typeof energy.evaluateForecast, 'function');
  const metrics = energy.evaluateForecast([0.2, 0.4, 0.8], [0.3, 0.2, 0.9]);
  assert.ok(Math.abs(metrics.mae - 0.4 / 3) < 1e-12);
  assert.ok(Math.abs(metrics.rmse - Math.sqrt(0.06 / 3)) < 1e-12);
  assert.ok(Math.abs(metrics.bias) < 1e-12);
  assert.equal(energy.evaluateForecast([0, 1], [0, 1]).mae, 0);
  assert.throws(() => energy.evaluateForecast([], []), /samples/);
  assert.throws(() => energy.evaluateForecast([1], [NaN]), /finite/);
  assert.throws(() => energy.evaluateForecast([1], [1, 2]), /samples/);
});

test('forecast windows share a fixed origin and never use future values for persistence', () => {
  assert.equal(typeof energy.buildForecast, 'function');
  for (const scenario of ['steady', 'ramp', 'volatile']) {
    const short = energy.buildForecast(scenario, 4, 'sample');
    const long = energy.buildForecast(scenario, 24, 'sample');
    assert.deepEqual(short.points, long.points.slice(0, 4));
    assert.deepEqual(short.points.map(p => p.hour), [1, 2, 3, 4]);
    assert.ok(long.points.every(p => p.actual >= 0 && p.actual <= 1 && p.predicted >= 0 && p.predicted <= 1));
    const baseline = energy.buildForecast(scenario, 12, 'persistence');
    assert.ok(baseline.points.every(p => p.predicted === baseline.origin));
    assert.deepEqual(long, energy.buildForecast(scenario, 24, 'sample'));
  }
  assert.throws(() => energy.buildForecast('unknown', 24, 'sample'), /scenario/);
  assert.throws(() => energy.buildForecast('steady', 5, 'sample'), /horizon/);
});

test('confirmed network includes cross-page links and excludes pending, conflict and device interiors', () => {
  assert.equal(typeof wiring.queryConnections, 'function');
  const result = wiring.queryConnections(wiring.wiringSample, 'p1', 'network');
  assert.deepEqual(result.portIds.sort(), ['p1', 'p2', 'p3', 'p4']);
  assert.ok(result.edges.every(e => e.status === 'verified' && e.kind !== 'component'));
  assert.equal(wiring.queryConnections(wiring.wiringSample, 'p1', 'direct').portIds.length, 2);
});

test('pending connections stay separately queryable with their sample evidence', () => {
  assert.equal(typeof wiring.queryConnections, 'function');
  const result = wiring.queryConnections(wiring.wiringSample, 'p3', 'pending');
  assert.equal(result.edges[0].status, 'pending');
  assert.ok(result.edges.every(e => e.evidence.startsWith('样例')));
  const conflict = wiring.queryConnections(wiring.wiringSample, 'p2', 'pending');
  assert.equal(conflict.edges[0].status, 'conflict');
  assert.throws(() => wiring.queryConnections(wiring.wiringSample, 'unknown', 'direct'), /port/);
});

test('port search is case-insensitive and treats wildcard characters literally', () => {
  assert.equal(typeof wiring.searchPorts, 'function');
  assert.equal(wiring.searchPorts(wiring.wiringSample, 'a:1')[0].id, 'p1');
  assert.equal(wiring.searchPorts(wiring.wiringSample, '%').length, 0);
  assert.equal(wiring.searchPorts(wiring.wiringSample, '').length, wiring.wiringSample.ports.length);
});
