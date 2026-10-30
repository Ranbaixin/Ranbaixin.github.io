import { buildForecast, scenarioNotes } from './model.mjs';
import { requireElement as get, svgNode, enhance } from '../dom';

export function mount(root: HTMLElement) {
  const scenario = get<HTMLSelectElement>(root, '[data-forecast-scenario]');
  const horizon = get<HTMLSelectElement>(root, '[data-forecast-horizon]');
  const method = get<HTMLSelectElement>(root, '[data-forecast-method]');
  const time = get<HTMLInputElement>(root, '[data-forecast-time]');
  const points = get<SVGGElement>(root, '[data-forecast-points]');
  let forecast = buildForecast();
  let selected = 1;
  const x = (index: number) => 68 + index / Math.max(1, forecast.points.length - 1) * 660;
  const y = (value: number) => 355 - value * 285;

  function selectPoint(hour: number) {
    selected = Math.max(1, Math.min(forecast.points.length, hour));
    const point = forecast.points[selected - 1];
    time.value = String(selected);
    get(root, '[data-point-hour]').textContent = `T+${point.hour} h`;
    get(root, '[data-point-actual]').textContent = point.actual.toFixed(4);
    get(root, '[data-point-predicted]').textContent = point.predicted.toFixed(4);
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
    forecast = buildForecast(scenario.value, Number(horizon.value), method.value);
    const path = (key: 'actual' | 'predicted') => forecast.points.map((point, index) => `${index ? 'L' : 'M'}${x(index)},${y(point[key])}`).join(' ');
    get(root, '[data-forecast-reference]').setAttribute('d', path('actual'));
    get(root, '[data-forecast-prediction]').setAttribute('d', path('predicted'));
    get(root, '[data-forecast-area]').setAttribute('d', `${path('actual')} L728,355 L68,355 Z`);
    points.replaceChildren(...forecast.points.map((point, index) => svgNode('circle', { 'data-forecast-point': point.hour, cx: x(index), cy: y(point.actual), r: 8, class: 'forecast-point', role: 'button', tabindex: 0, 'aria-label': `查看 T+${point.hour} 小时，参考 ${point.actual.toFixed(4)}，预测 ${point.predicted.toFixed(4)}` })));
    const axis = get(root, '[data-forecast-axis]');
    axis.replaceChildren(svgNode('text', { x: 68, y: 389, class: 'axis-label' }, 'T+1 h'), svgNode('text', { x: 398, y: 389, class: 'axis-label', 'text-anchor': 'middle' }, `T+${Math.round(Number(horizon.value) / 2)} h`), svgNode('text', { x: 728, y: 389, class: 'axis-label', 'text-anchor': 'end' }, `T+${horizon.value} h`));
    for (const key of ['mae', 'rmse', 'bias'] as const) get(root, `[data-metric="${key}"]`).textContent = forecast.metrics[key].toFixed(4);
    get(root, '[data-method-legend]').textContent = method.value === 'sample' ? '演示预测' : '持续性基线';
    get(root, '[data-forecast-note]').textContent = scenarioNotes[scenario.value as keyof typeof scenarioNotes];
    time.max = horizon.value;
    selectPoint(Math.min(selected, Number(horizon.value)));
  }
  for (const select of [scenario, horizon, method]) select.addEventListener('change', render);
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
    scenario.value = 'ramp'; horizon.value = '24'; method.value = 'sample'; selected = 1; render();
  });
  render(); enhance(root);
}
