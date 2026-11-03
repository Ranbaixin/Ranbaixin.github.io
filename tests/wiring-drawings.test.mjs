import test from 'node:test';
import assert from 'node:assert/strict';
import * as wiring from '../src/experiences/wiring/model.mjs';

test('public engineering sample has two documented sheets and four reciprocal references', () => {
  const sample = wiring.wiringSample;
  assert.equal(sample.version, 'wiring-v3');
  assert.deepEqual(sample.pages.map(p => p.id), ['P01', 'P02']);
  const direct = sample.edges.filter(e => e.kind === 'direct' && e.status === 'verified');
  assert.equal(direct.length, 4);
  for (const edge of direct) {
    assert.deepEqual(edge.views.map(v => v.page), ['P01', 'P02']);
    assert.ok(edge.views.every(v => v.zone && v.bounds.width > 0 && v.bounds.height > 0));
    assert.deepEqual(edge.strokes.map(s => s.page), ['P01', 'P02']);
  }
});

test('public drawing schema rejects unknown fields, private handles and missing evidence', () => {
  assert.equal(typeof wiring.validateWiringSample, 'function');
  assert.deepEqual(wiring.validateWiringSample(wiring.wiringSample), []);
  const extra = structuredClone(wiring.wiringSample);
  extra.ports[0].sourceHandle = 'private';
  assert.ok(wiring.validateWiringSample(extra).length);
  const missing = structuredClone(wiring.wiringSample);
  missing.edges[0].views = [];
  assert.ok(wiring.validateWiringSample(missing).length);
  const outside = structuredClone(wiring.wiringSample);
  outside.ports[0].x = 5000;
  assert.ok(wiring.validateWiringSample(outside).length);
});

test('same-network membership cannot become a physical trace or a direct conductor', () => {
  const sample = wiring.wiringSample;
  const network = wiring.queryConnections(sample, 'p15', 'network');
  assert.deepEqual(network.portIds.sort(), ['p15', 'p16', 'p20']);
  assert.ok(network.edges.every(e => e.kind === 'network'));
  assert.equal(wiring.queryConnections(sample, 'p15', 'direct').edges.length, 0);
  assert.equal(wiring.tracePath(sample, 'p15', 'p16'), null);
});

test('pending indicator branches and device interiors remain outside confirmed paths', () => {
  const sample = wiring.wiringSample;
  assert.deepEqual(wiring.tracePath(sample, 'p1', 'p4'), { portIds: ['p1', 'p4'], edgeIds: ['e1'], pages: ['P01', 'P02'] });
  for (const id of ['p5', 'p6', 'p7']) assert.equal(wiring.tracePath(sample, 'p1', id), null);
  assert.ok(wiring.queryConnections(sample, 'p1', 'pending').edges.some(e => e.b === 'p6'));
  assert.equal(wiring.queryConnections(sample, 'p5', 'pending').edges.length, 0);
});

test('drawing viewports keep focus and zoom bounded to their own sheet', () => {
  assert.equal(typeof wiring.drawingViewport, 'function');
  const sheet = { width: 1000, height: 640 };
  assert.deepEqual(wiring.drawingViewport(sheet, null, 1), { x: 0, y: 0, width: 1000, height: 640 });
  const view = wiring.drawingViewport(sheet, { x: 950, y: 600, width: 40, height: 30 }, 2);
  assert.deepEqual(view, { x: 500, y: 320, width: 500, height: 320 });
  for (const zoom of [-1, 0, 1.6, 3, 8]) {
    const v = wiring.drawingViewport(sheet, { x: -100, y: -100, width: 30, height: 30 }, zoom);
    assert.ok(v.x >= 0 && v.y >= 0 && v.x + v.width <= 1000 && v.y + v.height <= 640);
  }
});
