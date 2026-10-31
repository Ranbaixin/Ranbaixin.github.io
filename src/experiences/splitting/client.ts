import { createSplitSample, splitPlates, projectSplit } from './model.mjs';
import { requireElement as get, svgNode, node, enhance } from '../dom';

export function mount(root: HTMLElement) {
  const kind = get<HTMLSelectElement>(root, '[data-split-kind]');
  const slider = get<HTMLInputElement>(root, '[data-split-phase]');
  const allowance = get<HTMLInputElement>(root, '[data-split-allowance]');
  const parts = get(root, '[data-split-parts]');
  const drawing = get(root, '[data-split-geometry]');
  let sample = createSplitSample(), selected = 'top', phase = 0, target = 0, frame = 0;
  const reduced = () => document.documentElement.dataset.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const points = (values: number[][]) => values.map(point => point.join(',')).join(' ');
  function renderGeometry() {
    const hadFocus = drawing.contains(document.activeElement);
    drawing.replaceChildren(...projectSplit(sample, phase).map(plate => {
      const group = svgNode('g', { 'data-plate-id': plate.id, class: `split-plate plate-${plate.id}${selected === plate.id ? ' selected' : ''}`, role: 'button', tabindex: 0, 'aria-label': `图中${plate.label}`, 'aria-pressed': String(selected === plate.id) });
      group.append(svgNode('polygon', { class: 'plate-side', points: points(plate.side) }), svgNode('polygon', { class: 'plate-front', points: points(plate.front) }));
      plate.holes.forEach(hole => group.append(svgNode('circle', { class: 'plate-hole', cx: hole.point[0], cy: hole.point[1], r: 3 })));
      group.append(svgNode('text', { x: plate.labelPoint[0], y: plate.labelPoint[1], class: 'plate-tag', 'text-anchor': 'middle' }, plate.label));
      return group;
    }));
    if (hadFocus) drawing.querySelector<SVGElement>(`[data-plate-id="${selected}"]`)?.focus();
    get(root, '[data-split-scene-step]').textContent = phase < .25 ? '01 / 合拢' : phase < .75 ? '02 / 拆开' : '03 / 展平';
    slider.value = String(Math.round(target * 100));
    root.querySelectorAll<HTMLButtonElement>('[data-split-action]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.splitAction) === target)));
  }
  function stop() { if (frame) cancelAnimationFrame(frame); frame = 0; phase = target; renderGeometry(); }
  function move(next: number, animate = true) {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; target = next;
    if (!animate || reduced() || document.hidden || root.dataset.paused === 'true') { phase = target; renderGeometry(); return; }
    const initial = phase, start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 550);
      phase = initial + (target - initial) * (1 - (1 - t) ** 3);
      renderGeometry(); frame = t < 1 ? requestAnimationFrame(tick) : 0;
    };
    frame = requestAnimationFrame(tick);
  }
  function renderSelection() {
    const result = splitPlates(sample, Number(allowance.value));
    const plate = result.plates.find(item => item.id === selected);
    get(root, '[data-split-status]').textContent = result.status === 'review' ? '待核：长度尺寸缺失，不能生成可采用结果。' : `${result.plates.length} 块独立板件 · 相同尺寸保留独立身份`;
    get<HTMLButtonElement>(root, '[data-split-generate]').disabled = result.status !== 'accepted';
    get(root, '[data-allowance-value]').textContent = `${allowance.value} mm`;
    parts.querySelectorAll<HTMLElement>('[data-split-part]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.splitPart === selected)));
    get(root, '[data-split-output]').textContent = '选择板件，核对尺寸与普通／余量结果。';
    if (!plate) {
      get(root, '[data-split-selection]').textContent = '缺少长度尺寸 · 需要补充依据';
      get(root, '[data-split-dimensions]').textContent = '当前样例无可采用的拆板结果。';
      get(root, '[data-compare-geometry]').replaceChildren(); renderGeometry(); return;
    }
    get(root, '[data-split-selection]').textContent = `${plate.label} · ${plate.normalLength} × ${plate.width} × ${plate.thickness} mm`;
    get(root, '[data-split-dimensions]').textContent = `普通长度 ${plate.normalLength} mm → 余量长度 ${plate.length} mm · 板宽 ${plate.width} mm`;
    const scale = 560 / (sample.length! + 20);
    get(root, '[data-compare-geometry]').replaceChildren(
      svgNode('rect', { x: 80, y: 50, width: plate.length * scale, height: plate.width * scale, class: 'compare-allowance' }),
      svgNode('rect', { x: 80, y: 50, width: plate.normalLength * scale, height: plate.width * scale, class: 'compare-normal' }),
      ...plate.holes.map(hole => svgNode('circle', { 'data-compare-hole': '', cx: 80 + hole.x * scale, cy: 50 + hole.y * scale, r: hole.r * scale })),
    );
    renderGeometry();
  }
  function resetSample() {
    sample = createSplitSample(kind.value); selected = 'top';
    const result = splitPlates(sample);
    parts.replaceChildren(...result.plates.map(plate => {
      const button = node('button'); button.type = 'button'; button.dataset.splitPart = plate.id;
      button.append(node('i', '', `part-dot plate-${plate.id}`), node('span', plate.label)); return button;
    }));
    get(root, '[data-split-scene-title]').textContent = kind.value === 'incomplete' ? '尺寸不完整，先核对依据。' : `${sample.kind.toUpperCase()} · ${result.plates.length === 3 ? '三' : '四'}块板，组成一根构件。`;
    get(root, '[data-split-canvas-note]').textContent = `${sample.kind.toUpperCase()} / H400 × ${sample.width} · ${sample.length ? 'L1200 mm' : '长度待核'}`;
    get(root, '[data-split-drawing]').setAttribute('aria-label', `${sample.kind.toUpperCase()} 构件与 ${result.plates.length} 块独立板件`);
    move(0, false); renderSelection();
  }
  kind.addEventListener('change', resetSample);
  slider.addEventListener('input', () => move(Number(slider.value) / 100, false));
  root.querySelectorAll<HTMLButtonElement>('[data-split-action]').forEach(button => button.addEventListener('click', () => move(Number(button.dataset.splitAction))));
  parts.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLElement>('[data-split-part]');
    if (button?.dataset.splitPart) { selected = button.dataset.splitPart; renderSelection(); }
  });
  const choose = (event: Event) => {
    const group = (event.target as Element).closest<HTMLElement>('[data-plate-id]');
    if (group?.dataset.plateId) { selected = group.dataset.plateId; renderSelection(); }
  };
  drawing.addEventListener('click', choose);
  drawing.addEventListener('keydown', (event: Event) => { const key = event as KeyboardEvent; if (key.key === 'Enter' || key.key === ' ') { key.preventDefault(); choose(event); } });
  allowance.addEventListener('input', renderSelection);
  get(root, '[data-split-generate]').addEventListener('click', () => {
    const result = splitPlates(sample, Number(allowance.value));
    if (result.status === 'accepted') get(root, '[data-split-output]').textContent = `${sample.id} · ${result.plates.length} 块独立板件；普通／余量配对，${result.plates.reduce((sum, plate) => sum + plate.holes.length, 0)} 个样例孔位保持一致。`;
  });
  get(root, '[data-demo-reset]').addEventListener('click', () => { kind.value = 'bh'; allowance.value = '0'; resetSample(); });
  root.addEventListener('demo:pause', stop);
  window.addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  const preferenceObserver = new MutationObserver(() => { if (reduced()) stop(); });
  preferenceObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => { if (reduced()) stop(); });
  resetSample(); enhance(root);
}
