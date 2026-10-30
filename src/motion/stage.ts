import { createScenes, createEdges, interpolatePoint, projectPoint, shouldAnimate } from './geometry.mjs';

type Scene = 'cad' | 'energy' | 'wiring';
const stage = document.querySelector<HTMLElement>('[data-motion-stage]');
if (stage) mount(stage);

function mount(stage: HTMLElement) {
  const canvas = stage.querySelector<HTMLCanvasElement>('[data-stage-canvas]');
  let context: CanvasRenderingContext2D | null = null;
  try { context = canvas?.getContext('2d', { alpha: true }) || null; } catch { /* Static SVG remains available. */ }
  if (!canvas || !context) return;
  const surface = canvas;
  const ctx = context;
  const root = document.documentElement;
  const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const colorQuery = matchMedia('(prefers-color-scheme: dark)');
  const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
  const count = matchMedia('(max-width: 600px)').matches || saveData ? 96 : 180;
  const scenes = createScenes(count);
  const edges = { cad: createEdges('cad', scenes.cad), energy: createEdges('energy', scenes.energy), wiring: createEdges('wiring', scenes.wiring) };
  const descriptions: Record<Scene, string> = { cad: '图纸结构 / 预处理与集成', energy: '预测曲面 / 数据与评估', wiring: '连接网络 / 解析与依据' };
  let scene: Scene = 'cad';
  let from = scenes.cad;
  let current = scenes.cad;
  let morphStart = 0;
  let morphing = false;
  let width = 570, height = 460;
  let visible = true;
  let available = true;
  let frame = 0;
  let lastDraw = 0;
  let rotation = -.45;
  let rotationX = -.32;
  let hoverX = 0, hoverY = 0;
  let dragging = false;
  let pointerX = 0, pointerY = 0;
  let color = getComputedStyle(stage).getPropertyValue('--stage-rgb').trim() || '39, 95, 231';
  const reduced = () => root.dataset.motion === 'reduce' || reducedQuery.matches;
  const active = () => available && shouldAnimate({ visible, pageVisible: !document.hidden, reduced: reduced(), saveData });

  function draw(now = performance.now()) {
    if (!available) return;
    if (morphing) {
      const raw = Math.min(1, (now - morphStart) / 850);
      const mix = reduced() || saveData ? 1 : raw * raw * (3 - 2 * raw);
      current = from.map((point, i) => interpolatePoint(point, scenes[scene][i], mix));
      if (mix >= 1) morphing = false;
    }
    ctx.clearRect(0, 0, width, height);
    const projected = current.map(point => projectPoint(point, rotationX + hoverY, rotation + hoverX, width, height));
    const floor = ctx.createRadialGradient(width * .5, height * .77, 0, width * .5, height * .77, width * .29);
    floor.addColorStop(0, `rgba(${color}, .09)`); floor.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = floor; ctx.beginPath(); ctx.ellipse(width / 2, height * .79, width * .3, height * .055, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = scene === 'cad' ? 1.1 : .8;
    for (const [a, b] of edges[scene]) {
      const first = projected[a], second = projected[b];
      const alpha = Math.max(.08, Math.min(.7, .8 - (first.depth + second.depth) / 17));
      ctx.strokeStyle = `rgba(${color}, ${alpha})`;
      ctx.beginPath(); ctx.moveTo(first.x, first.y); ctx.lineTo(second.x, second.y); ctx.stroke();
    }
    projected.forEach((point, index) => {
      if (scene === 'cad' && index % 5 !== 0) return;
      const focus = index % 19 === 0;
      const radius = (focus ? 3.2 : scene === 'wiring' ? 1.9 : 1.3) * 4.2 / point.depth;
      ctx.fillStyle = `rgba(${color}, ${focus ? .95 : .55})`;
      ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.fill();
      if (focus && scene === 'wiring') {
        ctx.strokeStyle = `rgba(${color}, .18)`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(point.x, point.y, radius + 4, 0, Math.PI * 2); ctx.stroke();
      }
    });
    const angle = stage.querySelector('[data-stage-angle]');
    if (angle) angle.textContent = `θ ${String(Math.round(((rotation * 180 / Math.PI) % 360 + 360) % 360)).padStart(3, '0')}°`;
  }

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; lastDraw = 0; stage.dataset.playing = 'false';
  }
  function tick(now: number) {
    frame = 0;
    if (!active()) { stop(); return; }
    if (!lastDraw || now - lastDraw >= 32) {
      const elapsed = lastDraw ? Math.min(.08, (now - lastDraw) / 1000) : 0;
      if (!dragging) rotation += elapsed * .11;
      draw(now); lastDraw = now;
    }
    stage.dataset.playing = 'true'; frame = requestAnimationFrame(tick);
  }
  function updatePolicy() {
    color = getComputedStyle(stage).getPropertyValue('--stage-rgb').trim() || color;
    if (!active()) { stop(); draw(); }
    else if (!frame) { lastDraw = 0; stage.dataset.playing = 'true'; frame = requestAnimationFrame(tick); }
  }
  function resize() {
    const bounds = surface.parentElement!.getBoundingClientRect();
    width = Math.max(1, bounds.width); height = Math.max(1, bounds.height);
    const ratio = Math.min(devicePixelRatio || 1, 1.6);
    surface.width = Math.round(width * ratio); surface.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); draw();
  }
  stage.querySelectorAll<HTMLButtonElement>('[data-scene-button]').forEach(button => {
    button.addEventListener('click', () => {
      const next = button.dataset.sceneButton as Scene;
      if (!scenes[next] || next === scene) return;
      from = current.map(point => [...point]); scene = next; morphStart = performance.now(); morphing = true;
      stage.dataset.scene = scene;
      stage.querySelectorAll<HTMLButtonElement>('[data-scene-button]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      const caption = stage.querySelector('[data-scene-caption]'); if (caption) caption.textContent = descriptions[scene];
      const index = stage.querySelector('[data-scene-index]'); if (index) index.textContent = `${String(['cad','energy','wiring'].indexOf(scene) + 1).padStart(2, '0')} / 03`;
      color = getComputedStyle(stage).getPropertyValue('--stage-rgb').trim() || color;
      if (reduced() || saveData) { current = scenes[scene]; morphing = false; draw(); }
      else { draw(); updatePolicy(); }
    });
  });
  surface.addEventListener('pointerdown', event => {
    dragging = true; pointerX = event.clientX; pointerY = event.clientY;
    surface.setPointerCapture(event.pointerId); stage.classList.add('is-dragging');
  });
  surface.addEventListener('pointermove', event => {
    if (dragging) {
      rotation += (event.clientX - pointerX) * .008;
      rotationX = Math.max(-1.2, Math.min(1.2, rotationX + (event.clientY - pointerY) * .006));
      pointerX = event.clientX; pointerY = event.clientY; stage.dataset.interacted = 'true'; draw();
    } else if (event.pointerType === 'mouse' && !reduced()) {
      const bounds = surface.getBoundingClientRect();
      hoverX = (event.clientX - bounds.left - bounds.width / 2) / bounds.width * .25;
      hoverY = (event.clientY - bounds.top - bounds.height / 2) / bounds.height * .15;
    }
  }, { passive: true });
  const release = () => { dragging = false; stage.classList.remove('is-dragging'); };
  surface.addEventListener('pointerup', release); surface.addEventListener('pointercancel', release);
  surface.addEventListener('lostpointercapture', release); window.addEventListener('blur', release);
  surface.addEventListener('pointerleave', () => { hoverX = hoverY = 0; });
  surface.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') { rotation = -.45; rotationX = -.32; }
    if (event.key === 'ArrowLeft') rotation -= .15;
    if (event.key === 'ArrowRight') rotation += .15;
    if (event.key === 'ArrowUp') rotationX -= .1;
    if (event.key === 'ArrowDown') rotationX += .1;
    stage.dataset.interacted = 'true'; draw();
  });
  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; updatePolicy(); }, { threshold: .05 });
  observer.observe(stage);
  const sizeObserver = new ResizeObserver(resize); sizeObserver.observe(surface.parentElement!);
  const preferenceObserver = new MutationObserver(updatePolicy);
  preferenceObserver.observe(root, { attributes: true, attributeFilter: ['data-motion','data-theme'] });
  reducedQuery.addEventListener('change', updatePolicy);
  colorQuery.addEventListener('change', updatePolicy);
  document.addEventListener('visibilitychange', updatePolicy);
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', updatePolicy);
  surface.addEventListener('contextlost', () => {
    available = false; stop(); surface.hidden = true; stage.dataset.render = 'fallback'; stage.dataset.scene = 'cad';
    const caption = stage.querySelector('[data-scene-caption]'); if (caption) caption.textContent = '图纸结构 / 静态概念示意';
    const index = stage.querySelector('[data-scene-index]'); if (index) index.textContent = '01 / 03';
    const hint = stage.querySelector('.stage-drag-hint'); if (hint) hint.textContent = '静态概念示意 · 项目入口';
    const controls = stage.querySelector<HTMLElement>('[data-stage-controls]'); if (controls) controls.hidden = true;
  });
  surface.hidden = false; stage.dataset.render = 'canvas';
  const hint = stage.querySelector('.stage-drag-hint'); if (hint) hint.textContent = '拖动旋转 · 概念示意';
  const controls = stage.querySelector<HTMLElement>('[data-stage-controls]'); if (controls) controls.hidden = false;
  resize(); updatePolicy();
}
