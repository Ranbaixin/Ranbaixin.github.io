import test from 'node:test';
import assert from 'node:assert/strict';
import { buildForecast, evaluateForecast } from '../src/experiences/energy/model.mjs';
import * as energy from '../src/experiences/energy/model.mjs';
import * as wiring from '../src/experiences/wiring/model.mjs';

const split = await import('../src/experiences/splitting/model.mjs').catch(() => null);
const ribbon = await import('../src/motion/ribbon.mjs').catch(() => null);

test('BH and BOX split into distinct physical plates, including equal-sized sides', () => {
  assert.ok(split, 'A public plate-splitting model is required');
  for (const [kind, count] of [['bh', 3], ['box', 4]]) {
    const result = split.splitPlates(split.createSplitSample(kind));
    assert.equal(result.status, 'accepted');
    assert.equal(result.plates.length, count);
    assert.equal(new Set(result.plates.map(p => p.id)).size, count);
    assert.equal(result.plates.find(p => p.role === 'web').width, 376);
  }
});

test('each lengthwise end receives the configured allowance while holes and identity stay fixed', () => {
  assert.ok(split, 'A public plate-splitting model is required');
  for (const kind of ['bh', 'box']) {
    const sample = split.createSplitSample(kind);
    const ordinary = split.splitPlates(sample, 0).plates;
    for (const allowance of [5, 10, 20, 0]) {
      const extended = split.splitPlates(sample, allowance).plates;
      assert.equal(ordinary.length, extended.length);
      ordinary.forEach((plate, i) => {
        assert.equal(extended[i].length, plate.length + 2 * allowance);
        assert.equal(extended[i].allowancePerEnd, allowance);
        assert.equal(extended[i].normalLength, plate.normalLength);
        assert.equal(extended[i].width, plate.width);
        assert.equal(extended[i].id, plate.id);
        assert.deepEqual(extended[i].holes, plate.holes);
        assert.ok(extended[i].holes.every(h => h.x - h.r > -allowance && h.x + h.r < plate.normalLength + allowance && h.y - h.r > 0 && h.y + h.r < plate.width));
      });
    }
  }
});

test('missing and impossible dimensions require review and produce no usable plates', () => {
  assert.ok(split, 'A public plate-splitting model is required');
  const sample = split.createSplitSample('bh');
  for (const broken of [split.createSplitSample('incomplete'), { ...sample, height: 20 }, { ...sample, length: -1 }, { ...sample, width: NaN }]) {
    const result = split.splitPlates(broken);
    assert.equal(result.status, 'review');
    assert.equal(result.plates.length, 0);
    assert.ok(result.issues.length > 0);
  }
  assert.throws(() => split.splitPlates(sample, -5));
});

test('all assembly, exploded and flat projections stay finite and selectable', () => {
  assert.ok(split, 'A public plate-splitting model is required');
  for (const kind of ['bh', 'box']) {
    const sample = split.createSplitSample(kind);
    for (const phase of [0, .25, .5, .75, 1]) {
      const geometry = split.projectSplit(sample, phase);
      assert.equal(geometry.length, kind === 'bh' ? 3 : 4);
      for (const plate of geometry) {
        assert.ok(plate.front.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 720 && y >= 0 && y <= 420));
        assert.equal(plate.front.length, 4);
      }
    }
  }
});

test('flat plate drawings retain physical length-to-width proportions', () => {
  for (const kind of ['bh', 'box']) {
    const sample = split.createSplitSample(kind);
    const plates = split.splitPlates(sample).plates;
    for (const shape of split.projectSplit(sample, 1)) {
      const plate = plates.find(p => p.id === shape.id);
      const width = shape.front[1][0] - shape.front[0][0];
      const height = shape.front[3][1] - shape.front[0][1];
      assert.ok(Math.abs(width / height - plate.length / plate.width) < 1e-10);
    }
  }
});

test('teaching wind and solar curves have explicit independent numerical checks', () => {
  assert.equal(typeof energy.windPower, 'function', 'A weather-to-power model is required');
  assert.equal(energy.windPower(2), 0);
  assert.equal(energy.windPower(3), 0);
  assert.equal(energy.windPower(12), 1);
  assert.equal(energy.windPower(25), 0);
  assert.ok(Math.abs(energy.windPower(6) - 189 / 1701) < 1e-12);
  assert.ok(Math.abs(energy.solarPower(800, 45) - .736) < 1e-12);
  assert.equal(energy.solarPower(0, 25), 0);
  assert.equal(energy.solarPower(1400, 25), 1);
});

test('weather adjustments change forecasts without rewriting reference observations', () => {
  assert.equal(typeof energy.buildWeatherForecast, 'function', 'Weather-series simulation is required');
  for (const kind of ['wind', 'solar']) {
    const initial = energy.buildWeatherForecast({ kind });
    const changed = energy.buildWeatherForecast({ kind, windOffset: 2, irradianceScale: .5, temperature: 45 });
    assert.deepEqual(initial.points.map(p => p.actual), changed.points.map(p => p.actual));
    assert.notDeepEqual(initial.points.map(p => p.predicted), changed.points.map(p => p.predicted));
    assert.ok(changed.points.every(p => p.predicted >= 0 && p.predicted <= 1));
  }
});

test('weather evaluation excludes T+0 and uses exactly the selected aligned window', () => {
  assert.equal(typeof energy.buildWeatherForecast, 'function', 'Weather-series simulation is required');
  for (const kind of ['wind', 'solar']) {
    const full = energy.buildWeatherForecast({ kind });
    const short = energy.buildWeatherForecast({ kind, horizon: 4 });
    assert.deepEqual(short.points, full.points.slice(0, 4));
    assert.deepEqual(short.points.map(p => p.hour), [1, 2, 3, 4]);
    const baseline = energy.buildWeatherForecast({ kind, horizon: 12, method: 'persistence', windOffset: 3 });
    assert.ok(baseline.points.every(p => p.predicted === baseline.origin));
    const errors = short.points.map(p => p.predicted - p.actual);
    assert.ok(Math.abs(short.metrics.mae - errors.reduce((s, x) => s + Math.abs(x), 0) / 4) < 1e-12);
    assert.ok(Math.abs(short.metrics.rmse - Math.sqrt(errors.reduce((s, x) => s + x * x, 0) / 4)) < 1e-12);
    assert.ok(Math.abs(short.metrics.bias - errors.reduce((s, x) => s + x, 0) / 4) < 1e-12);
  }
});

test('solar reference output is zero during generated nighttime hours', () => {
  const solar = energy.buildWeatherForecast({ kind: 'solar' });
  assert.ok(solar.points.filter(p => p.hour >= 12 && p.hour <= 23).every(p => p.actual === 0));
});

test('cross-page traces are ordered and never traverse pending, conflict or component interiors', () => {
  assert.equal(typeof wiring.tracePath, 'function', 'Ordered cross-page evidence tracing is required');
  const sample = wiring.wiringSample;
  const path = wiring.tracePath(sample, 'p1', 'p4');
  assert.deepEqual(path.portIds, ['p1', 'p2', 'p3', 'p4']);
  assert.deepEqual(path.edgeIds, ['e1', 'e2', 'e3']);
  assert.deepEqual(path.pages, ['01', '02']);
  for (const target of ['p5', 'p6', 'p7']) assert.equal(wiring.tracePath(sample, 'p1', target), null);
  assert.deepEqual(wiring.tracePath(sample, 'p4', 'p1').edgeIds, ['e3', 'e2', 'e1']);
});

test('ribbon repeats cover wide viewports throughout positive and reverse scrolling', () => {
  assert.ok(ribbon, 'A measured looping ribbon is required');
  for (const width of [390, 768, 1440, 1920, 2560, 3440]) {
    for (const period of [300, 713.5, 1607]) {
      const copies = ribbon.ribbonCopies(width, period);
      for (const scroll of [-10000, -100, 0, 100, 99999]) {
        const shift = ribbon.ribbonOffset(scroll, period);
        assert.ok(shift <= 0 && shift > -period);
        assert.ok(copies * period + shift >= width);
      }
    }
  }
});
