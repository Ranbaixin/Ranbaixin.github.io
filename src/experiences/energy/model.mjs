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

/** Teaching curves with explicit, illustrative parameters, not a fitted site model. */
export function windPower(speed) {
  if (!Number.isFinite(speed) || speed < 0) throw new Error('Invalid wind speed');
  if (speed < 3 || speed >= 25) return 0;
  return speed >= 12 ? 1 : (speed ** 3 - 27) / 1701;
}
export function solarPower(irradiance, cellTemperature = 25) {
  if (!Number.isFinite(irradiance) || irradiance < 0 || !Number.isFinite(cellTemperature)) throw new Error('Invalid solar conditions');
  return Math.max(0, Math.min(1, irradiance / 1000 * (1 - .004 * (cellTemperature - 25))));
}

export function buildWeatherForecast({ kind = 'wind', scenario = 'ramp', horizon = 24, method = 'sample', windOffset = 0, irradianceScale = 1, temperature = 25 } = {}) {
  if (!['wind', 'solar'].includes(kind) || !['steady', 'ramp', 'volatile'].includes(scenario) || ![4, 12, 24].includes(horizon) || !['sample', 'persistence'].includes(method)) throw new Error('Unknown weather scenario');
  if (![windOffset, irradianceScale, temperature].every(Number.isFinite) || Math.abs(windOffset) > 3 || irradianceScale < .25 || irradianceScale > 1.25 || temperature < -10 || temperature > 70) throw new Error('Weather controls outside public sample range');
  const daylight = hour => Math.max(0, Math.sin((hour + 1) / 24 * 2 * Math.PI));
  const reference = hour => kind === 'wind' ? normalized(signal(scenario, hour) + .025 * Math.sin(hour * 1.7)) : daylight(hour) <= 0 ? 0 : normalized(daylight(hour) * (scenario === 'volatile' ? .65 + .2 * Math.cos(hour * 1.4) : scenario === 'ramp' ? .55 + .025 * Math.min(hour, 12) : .85) + .015 * Math.sin(hour));
  const origin = reference(0);
  const points = Array.from({ length: horizon }, (_, i) => {
    const hour = i + 1;
    const baseWeather = kind === 'wind' ? Math.cbrt(27 + 1701 * normalized(signal(scenario, hour - .7))) : 1000 * daylight(hour - .4) * (scenario === 'volatile' ? .7 + .17 * Math.cos(hour * 1.2) : scenario === 'ramp' ? .58 + .025 * Math.min(hour, 12) : .9);
    const weather = kind === 'wind' ? Math.max(0, baseWeather + windOffset) : Math.max(0, baseWeather * irradianceScale);
    const predicted = method === 'persistence' ? origin : normalized(kind === 'wind' ? windPower(weather) : solarPower(weather, temperature));
    return { hour, actual: reference(hour), predicted, weather, baseWeather };
  });
  return { kind, origin, points, metrics: evaluateForecast(points.map(p => p.actual), points.map(p => p.predicted)) };
}
