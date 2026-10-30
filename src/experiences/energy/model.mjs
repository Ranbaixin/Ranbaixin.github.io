/** Deterministic illustrative series. These are not a trained power model. */
const normalized = value => Number(Math.max(0, Math.min(1, value)).toFixed(4));
const signal = (scenario, hour) => {
  if (scenario === 'steady') return 0.48 + 0.055 * Math.sin(hour / 3);
  if (scenario === 'ramp') return 0.2 + 0.025 * hour + 0.045 * Math.sin(hour / 3);
  return 0.5 + 0.2 * Math.sin(hour / 2.1) + 0.075 * Math.cos(hour / 0.9);
};

export function evaluateForecast(actual, predicted) {
  if (!actual.length || actual.length !== predicted.length) throw new Error('Aligned non-empty samples are required');
  if (![...actual, ...predicted].every(Number.isFinite)) throw new Error('Every sample must be finite');
  const errors = predicted.map((value, i) => value - actual[i]);
  return {
    mae: errors.reduce((sum, value) => sum + Math.abs(value), 0) / errors.length,
    rmse: Math.sqrt(errors.reduce((sum, value) => sum + value ** 2, 0) / errors.length),
    bias: errors.reduce((sum, value) => sum + value, 0) / errors.length,
  };
}

export function buildForecast(scenario = 'ramp', horizon = 24, method = 'sample') {
  if (!['steady', 'ramp', 'volatile'].includes(scenario)) throw new Error('Unknown scenario');
  if (![4, 12, 24].includes(horizon)) throw new Error('Unsupported horizon');
  if (!['sample', 'persistence'].includes(method)) throw new Error('Unknown forecast method');
  const origin = normalized(signal(scenario, 0));
  const points = Array.from({ length: horizon }, (_, i) => {
    const hour = i + 1;
    const actual = normalized(signal(scenario, hour) + 0.025 * Math.sin(hour * 1.7));
    const predicted = method === 'persistence' ? origin : normalized(signal(scenario, hour - 0.7) + 0.035 * Math.cos(hour / 3.2));
    return { hour, actual, predicted };
  });
  return { origin, points, metrics: evaluateForecast(points.map(p => p.actual), points.map(p => p.predicted)) };
}

export const scenarioNotes = {
  steady: '平稳过程里，小幅偏差也值得观察。',
  ramp: '出力持续爬坡时，固定起点的基线会逐步滞后。',
  volatile: '波动越快，平均误差与局部偏差越需要一起看。',
};
