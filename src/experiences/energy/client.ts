import { buildWeatherForecast, scenarioNotes } from './model.mjs';
import { requireElement as get, svgNode, enhance } from '../dom';

export function mount(root: HTMLElement) {
  const scenario = get<HTMLSelectElement>(root, '[data-forecast-scenario]');
  const horizon = get<HTMLSelectElement>(root, '[data-forecast-horizon]');
  const method = get<HTMLSelectElement>(root, '[data-forecast-method]');
  const time = get<HTMLInputElement>(root, '[data-forecast-time]');
  const points = get<SVGGElement>(root, '[data-forecast-points]');
  const kind = get<HTMLSelectElement>(root, 'select[data-energy-kind]');
  const wind = get<HTMLInputElement>(root, '[data-weather-wind]');
  const solar = get<HTMLInputElement>(root, '[data-weather-solar]');
  const temperature = get<HTMLInputElement>(root, '[data-weather-temperature]');
  let forecast = buildWeatherForecast();
  let selected = 1;
  const x = (index: number) => 68 + index / Math.max(1, forecast.points.length - 1) * 660;
  const baseline = root.dataset.variant === 'compact' ? 235 : 355;
  const y = (value: number) => baseline - value * (root.dataset.variant === 'compact' ? 170 : 285);

  function selectPoint(hour: number) {
    selected = Math.max(1, Math.min(forecast.points.length, hour));
    const point = forecast.points[selected - 1];
    time.value = String(selected);
    get(root, '[data-point-hour]').textContent = `T+${point.hour} h`;
    get(root, '[data-time-caption]').textContent = `T+${point.hour} h`;
    get(root, '[data-point-actual]').textContent = point.actual.toFixed(4);
    get(root, '[data-point-predicted]').textContent = point.predicted.toFixed(4);
    get(root, '[data-point-weather]').textContent = `${point.weather.toFixed(1)} ${kind.value === 'wind' ? 'm/s' : 'W/m²'}`;
    const error = point.predicted - point.actual;
    get(root, '[data-point-error]').textContent = `${error > 0 ? '+' : ''}${error.toFixed(4)}`;
    const cursor = get(root, '[data-forecast-cursor]');
    cursor.setAttribute('x1', String(x(selected - 1))); cursor.setAttribute('x2', String(x(selected - 1)));
    points.querySelectorAll('[data-forecast-point]').forEach(item => {
      const active = Number(item.getAttribute('data-forecast-point')) === selected;
      item.setAttribute('aria-pressed', String(active)); item.classList.toggle('selected', active);
    });
  }

  function render() {
    forecast = buildWeatherForecast({ kind: kind.value, scenario: scenario.value, horizon: Number(horizon.value), method: method.value, windOffset: Number(wind.value), irradianceScale: Number(solar.value), temperature: Number(temperature.value) });
    root.dataset.powerKind = kind.value;
    root.querySelectorAll<HTMLElement>('[data-wind-controls]').forEach(el => el.hidden = kind.value !== 'wind');
    root.querySelectorAll<HTMLElement>('[data-solar-controls]').forEach(el => el.hidden = kind.value !== 'solar');
    get(root, '[data-wind-value]').textContent = `${Number(wind.value) >= 0 ? '+' : ''}${Number(wind.value).toFixed(1)} m/s`;
    get(root, '[data-solar-value]').textContent = `${Number(solar.value).toFixed(2)}×`;
    get(root, '[data-temperature-value]').textContent = `${temperature.value} °C`;
    get(root, '[data-energy-heading]').textContent = kind.value === 'wind' ? '风速变化，如何传递到出力？' : '辐照与组件温度，如何影响出力？';
    get(root, '[data-weather-axis]').textContent = kind.value === 'wind' ? '气象输入 / 风速 m/s' : '气象输入 / 辐照 W/m²';
    get(root, '[data-weather-window]').textContent = `T+1 → T+${horizon.value} h`;
    const names = kind.value === 'wind' ? ['平稳过程', '持续爬坡', '阵风波动'] : ['晴天过程', '云量减小', '过云波动'];
    [...scenario.options].forEach((option, index) => option.textContent = names[index]);
    get(root, '[data-weather-path]').setAttribute('d', forecast.points.map((point, index) => `${index ? 'L' : 'M'}${x(index)},${105 - point.weather / (kind.value === 'wind' ? 25 : 1250) * 80}`).join(' '));
    const path = (key: 'actual' | 'predicted') => forecast.points.map((point, index) => `${index ? 'L' : 'M'}${x(index)},${y(point[key])}`).join(' ');
    get(root, '[data-forecast-reference]').setAttribute('d', path('actual'));
    get(root, '[data-forecast-prediction]').setAttribute('d', path('predicted'));
    get(root, '[data-forecast-area]').setAttribute('d', `${path('actual')} L728,${baseline} L68,${baseline} Z`);
    points.replaceChildren(...forecast.points.map((point, index) => svgNode('circle', { 'data-forecast-point': point.hour, cx: x(index), cy: y(point.actual), r: 8, class: 'forecast-point', role: 'button', tabindex: 0, 'aria-label': `查看 T+${point.hour} 小时，参考 ${point.actual.toFixed(4)}，预测 ${point.predicted.toFixed(4)}` })));
    const axis = get(root, '[data-forecast-axis]');
    axis.replaceChildren(svgNode('text', { x: 68, y: baseline + 34, class: 'axis-label' }, 'T+1 h'), svgNode('text', { x: 398, y: baseline + 34, class: 'axis-label', 'text-anchor': 'middle' }, `T+${Math.round(Number(horizon.value) / 2)} h`), svgNode('text', { x: 728, y: baseline + 34, class: 'axis-label', 'text-anchor': 'end' }, `T+${horizon.value} h`));
    for (const key of ['mae', 'rmse', 'bias'] as const) get(root, `[data-metric="${key}"]`).textContent = forecast.metrics[key].toFixed(4);
    get(root, '[data-method-legend]').textContent = method.value === 'sample' ? '演示预测' : '持续性基线';
    get(root, '[data-forecast-note]').textContent = `生成样例 · 教学计算。${kind.value === 'wind' ? scenarioNotes[scenario.value as keyof typeof scenarioNotes] : '调节辐照与组件温度，参考出力保持固定。'}`;
    time.max = horizon.value;
    selectPoint(Math.min(selected, Number(horizon.value)));
  }
  for (const select of [kind, scenario, horizon, method]) select.addEventListener('change', render);
  for (const input of [wind, solar, temperature]) input.addEventListener('input', render);
  time.addEventListener('input', () => selectPoint(Number(time.value)));
  points.addEventListener('click', event => {
    const point = (event.target as Element).closest('[data-forecast-point]');
    if (point) selectPoint(Number(point.getAttribute('data-forecast-point')));
  });
  points.addEventListener('keydown', event => {
    const point = (event.target as Element).closest('[data-forecast-point]');
    if (!point) return;
    const hour = Number(point.getAttribute('data-forecast-point'));
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectPoint(hour); }
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault(); selectPoint(hour + (event.key === 'ArrowRight' ? 1 : -1));
      points.querySelector<SVGCircleElement>(`[data-forecast-point="${selected}"]`)?.focus();
    }
  });
  get(root, '[data-demo-reset]').addEventListener('click', () => {
    kind.value = 'wind'; wind.value = '0'; solar.value = '1'; temperature.value = '25'; scenario.value = 'ramp'; horizon.value = '24'; method.value = 'sample'; selected = 1; render();
  });
  render(); enhance(root);
}
