import test from 'node:test';
import assert from 'node:assert/strict';
const motion = await import('../src/motion/geometry.mjs').catch(() => ({}));

test('three reconstructed scenes have matching finite point counts for morphing', () => {
  assert.equal(typeof motion.createScenes, 'function');
  const scenes = motion.createScenes(180);
  assert.deepEqual(Object.keys(scenes), ['cad', 'energy', 'wiring']);
  for (const points of Object.values(scenes)) {
    assert.equal(points.length, 180);
    assert.ok(points.every(point => point.length === 3 && point.every(Number.isFinite)));
    assert.ok(points.every(point => point.every(value => Math.abs(value) < 2)));
  }
  assert.notDeepEqual(scenes.cad, scenes.energy);
  assert.notDeepEqual(scenes.energy, scenes.wiring);
});

test('camera projection stays finite under rotations and clamps an unsafe camera distance', () => {
  assert.equal(typeof motion.projectPoint, 'function');
  for (const point of [[0, 0, 0], [1, 1, 1], [0, 0, 100]]) {
    const projected = motion.projectPoint(point, .3, -.5, 600, 480);
    assert.ok([projected.x, projected.y, projected.depth].every(Number.isFinite));
  }
  const center = motion.projectPoint([0, 0, 0], 0, 0, 600, 480);
  assert.equal(center.x, 300);
  assert.equal(center.y, 240);
});

test('morphing is bounded and preserves exact scene endpoints', () => {
  assert.equal(typeof motion.interpolatePoint, 'function');
  assert.deepEqual(motion.interpolatePoint([0, 1, 2], [2, 3, 4], -1), [0, 1, 2]);
  assert.deepEqual(motion.interpolatePoint([0, 1, 2], [2, 3, 4], 2), [2, 3, 4]);
  assert.deepEqual(motion.interpolatePoint([0, 1, 2], [2, 3, 4], .5), [1, 2, 3]);
});

test('continuous animation stops for hidden, offscreen, reduced motion and save-data states', () => {
  assert.equal(typeof motion.shouldAnimate, 'function');
  const active = { visible: true, pageVisible: true, reduced: false, saveData: false };
  assert.equal(motion.shouldAnimate(active), true);
  for (const override of [{ visible: false }, { pageVisible: false }, { reduced: true }, { saveData: true }]) {
    assert.equal(motion.shouldAnimate({ ...active, ...override }), false);
  }
});

test('all scene meshes reference existing points without duplicate or self edges', () => {
  assert.equal(typeof motion.createEdges, 'function');
  for (const count of [32, 96, 180]) {
    const scenes = motion.createScenes(count);
    for (const [name, points] of Object.entries(scenes)) {
      const edges = motion.createEdges(name, points);
      assert.ok(edges.length > 0);
      assert.ok(edges.every(([a, b]) => Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a < count && b < count && a !== b));
      assert.equal(new Set(edges.map(([a, b]) => [a, b].sort((x, y) => x - y).join(':'))).size, edges.length);
    }
  }
});
