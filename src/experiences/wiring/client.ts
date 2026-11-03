import { wiringSample, queryConnections, searchPorts, tracePath, drawingViewport } from './model.mjs';
import { requireElement as get, node, enhance } from '../dom';

export function mount(root: HTMLElement) {
  let selected = 'p1', mode = 'direct', activePage = 'P01';
  const search = get<HTMLInputElement>(root, '[data-port-search]');
  const list = get<HTMLElement>(root, '[data-port-list]');
  const results = get<HTMLElement>(root, '[data-wiring-results]');
  const evidence = get<HTMLElement>(root, '[data-evidence]');
  const viewport = get<HTMLElement>(root, '[data-drawing-viewport]');
  const views = new Map<string, ReturnType<typeof drawingViewport>>();
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduce';
  const labels: Record<string, string> = { direct: '直接连接', network: '已确认网络', pending: '待核信息' };
  const port = (id: string) => wiringSample.ports.find(p => p.id === id)!;
  const endpoint = (id: string) => wiringSample.ports.find(p => p.id === id) || wiringSample.nodes.find(p => p.id === id)!;
  const sheet = () => wiringSample.pages.find(p => p.id === activePage)!;
  const svg = () => get<SVGSVGElement>(root, `svg[data-drawing-page="${activePage}"]`);
  function syncPortFocus() {
    const view = views.get(activePage); if (!view) return;
    root.querySelectorAll<SVGElement>('[data-port-id]').forEach(group => {
      const p = port(group.dataset.portId!);
      const visible = p.page === activePage && p.x - 27 >= view.x && p.x + 27 <= view.x + view.width && p.y - 25 >= view.y && p.y + 25 <= view.y + view.height;
      group.setAttribute('tabindex', visible ? '0' : '-1');
    });
  }
  function renderViewport() {
    const page = sheet();
    if (!views.has(activePage)) {
      const p = wiringSample.ports.find(p => p.page === activePage)!;
      views.set(activePage, drawingViewport(page, innerWidth < 600 ? { x: p.x, y: p.y, width: 0, height: 0 } : null, innerWidth < 600 ? 1.5 : 1));
    }
    const view = views.get(activePage)!;
    root.querySelectorAll<SVGSVGElement>('svg[data-drawing-page]').forEach(el => el.toggleAttribute('hidden', el.dataset.drawingPage !== activePage));
    svg().setAttribute('viewBox', `${view.x} ${view.y} ${view.width} ${view.height}`);
    root.dataset.activeSheet = activePage;
    viewport.dataset.zoomed = String(view.width < page.width);
    root.querySelectorAll<HTMLButtonElement>('[data-sheet-button]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.sheetButton === activePage)));
    get(root, '[data-page-status]').textContent = `${page.id} · ${page.title} / ${Math.round(page.width / view.width * 100)}%`;
    syncPortFocus();
  }
  function showPage(id: string, bounds?: { x: number; y: number; width: number; height: number }) {
    activePage = id;
    if (bounds) { const page = sheet(), zoom = Math.max(1, Math.min(2.4, page.width / (bounds.width + 80), page.height / (bounds.height + 80))); views.set(id, drawingViewport(page, bounds, zoom)); }
    renderViewport();
  }
  function zoom(action: string) {
    const current = views.get(activePage)!, page = sheet();
    views.set(activePage, drawingViewport(page, action === 'fit' ? null : { x: current.x + current.width / 2, y: current.y + current.height / 2, width: 0, height: 0 }, action === 'fit' ? 1 : page.width / current.width + (action === 'in' ? .5 : -.5)));
    renderViewport();
  }
  function resetEvidence() {
    evidence.replaceChildren(node('span', '双端图纸依据', 'control-eyebrow'), node('p', '选择“查看依据”，对照接线页的去向标注与端子排的来源行。'));
    root.querySelectorAll('[data-edge-id]').forEach(el => el.classList.remove('evidence-active', 'traced'));
    root.querySelectorAll('[data-evidence-focus]').forEach(el => el.setAttribute('visibility', 'hidden'));
    get(root, '[data-trace-summary]').textContent = '选择起点与目标，追踪已核对双端引用的连接。';
  }
  function renderSearch() {
    const matches = searchPorts(wiringSample, search.value), visible = matches.slice(0, 6);
    list.replaceChildren(...visible.map(p => {
      const button = node('button', '', 'port-search-result'); button.type = 'button'; button.dataset.selectPort = p.id;
      button.setAttribute('aria-label', `选择端口 ${p.label}`); button.setAttribute('aria-pressed', String(p.id === selected));
      button.append(node('strong', p.label), node('span', `${p.page} · ${p.description}`)); return button;
    }));
    if (!matches.length) list.append(node('p', '未找到匹配端口。', 'empty-result'));
    get(root, '[data-search-count]').textContent = matches.length > visible.length ? `${matches.length} 个端口，输入代号缩小范围` : `${matches.length} 个匹配端口`;
  }
  function render() {
    const result = queryConnections(wiringSample, selected, mode);
    get<HTMLSelectElement>(root, '[data-trace-source]').value = selected;
    resetEvidence(); renderSearch();
    get(root, '[data-wiring-selection]').textContent = `${result.port.label} · ${result.port.page} · ${result.port.description}`;
    get(root, '[data-wiring-result-title]').textContent = `${result.port.label} 的${labels[mode]}`;
    get(root, '[data-wiring-count]').textContent = `${String(result.edges.length).padStart(2, '0')} RELATIONS`;
    get(root, '[data-query-hint]').textContent = mode === 'direct' ? '双端引用已对应。没有结果不代表现场没有接线。' : mode === 'network' ? '同网集合单独标记，不转为新增的逐段直连。' : '待核引用保留，不能用于已确认追线。';
    root.querySelectorAll<HTMLButtonElement>('[data-wiring-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.wiringMode === mode)));
    root.querySelectorAll<SVGGElement>('[data-port-id]').forEach(group => {
      const p = port(group.dataset.portId!); group.setAttribute('role', 'button'); group.setAttribute('tabindex', '0');
      group.setAttribute('aria-label', `图中端口 ${p.label}`); group.setAttribute('aria-pressed', String(p.id === selected));
      group.classList.toggle('selected', p.id === selected); group.classList.toggle('connected', result.portIds.includes(p.id));
    });
    root.querySelectorAll<SVGGElement>('[data-edge-id]').forEach(el => el.classList.toggle('active', result.edges.some(e => e.id === el.dataset.edgeId)));
    results.replaceChildren(...result.edges.map(edge => {
      const row = node('article', '', 'connection-row');
      const state = edge.status === 'verified' ? edge.kind === 'network' ? '同网成员' : '双端对应' : edge.status === 'conflict' ? '引用冲突' : '待核引用';
      row.append(node('strong', `${endpoint(edge.a).label} ↔ ${endpoint(edge.b).label}`), node('span', state, `state-chip state-${edge.status}`), node('span', edge.note, 'connection-note'));
      const button = node('button', '查看依据 ↗', 'small-button'); button.type = 'button'; button.dataset.evidenceId = edge.id;
      button.setAttribute('aria-label', `查看依据：${endpoint(edge.a).label} 与 ${endpoint(edge.b).label}`); row.append(button); return row;
    }));
    if (!result.edges.length) results.append(node('p', mode === 'pending' ? '当前端口没有单列的待核关系。试试 Q01:2 或 HL01。' : '当前范围没有已确认连接；可切换“已确认网络”或“待核信息”。', 'empty-result'));
    syncPortFocus();
  }
  function choose(id: string, focus = false) {
    selected = id; render(); const p = port(id);
    showPage(p.page, { x: p.x - 90, y: p.y - 70, width: 180, height: 140 });
    if (focus) root.querySelector<SVGElement>(`[data-port-id="${id}"]`)?.focus({ preventScroll: true });
  }
  function showEvidence(id: string, index?: number) {
    const edge = wiringSample.edges.find(e => e.id === id)!;
    const selectedView = index ?? Math.max(0, edge.views.findIndex(v => v.page !== port(selected).page));
    const view = edge.views[selectedView]; if (!view) return;
    root.querySelectorAll<SVGElement>('[data-edge-id]').forEach(el => el.classList.toggle('evidence-active', el.dataset.edgeId === id));
    root.querySelectorAll<SVGElement>('[data-evidence-focus]').forEach(el => el.setAttribute('visibility', 'hidden'));
    showPage(view.page, view.bounds);
    const box = svg().querySelector<SVGRectElement>('[data-evidence-focus]')!;
    for (const [key, value] of Object.entries(view.bounds)) box.setAttribute(key, String(value)); box.setAttribute('visibility', 'visible');
    const facts = node('dl', '', 'evidence-facts');
    for (const [label, value] of [['端点', `${endpoint(edge.a).label} ↔ ${endpoint(edge.b).label}`], ['依据', edge.evidence], ['线号', edge.kind === 'direct' && edge.status === 'verified' ? `${edge.wire} · 公开重编` : edge.wire], ['线材字段', '截面积未公开；材质、颜色未核验']]) { const group = node('div'); group.append(node('dt', label), node('dd', value)); facts.append(group); }
    const nav = node('div', '', 'evidence-navigation');
    edge.views.forEach((v, i) => { const button = node('button', `${v.page} / ${v.zone} · ${v.label}`, 'small-button'); button.type = 'button'; button.dataset.evidenceId = edge.id; button.dataset.evidenceView = String(i); button.setAttribute('aria-pressed', String(i === selectedView)); nav.append(button); });
    evidence.replaceChildren(node('span', '图纸依据 / IDENTITIES REBUILT', 'control-eyebrow'), node('h4', `${view.page} / ${view.zone} · ${view.label}`), node('p', edge.note), facts, nav);
    viewport.scrollIntoView({ behavior: reduced() ? 'instant' : 'smooth', block: 'center' }); svg().focus({ preventScroll: true });
  }
  list.addEventListener('click', event => { const id = (event.target as Element).closest<HTMLElement>('[data-select-port]')?.dataset.selectPort; if (id) choose(id); });
  search.addEventListener('input', renderSearch);
  viewport.addEventListener('click', event => { const id = (event.target as Element).closest<SVGElement>('[data-port-id]')?.dataset.portId; if (id) choose(id); });
  viewport.addEventListener('keydown', event => {
    const id = (event.target as Element).closest<SVGElement>('[data-port-id]')?.dataset.portId;
    if (id && ['Enter', ' '].includes(event.key)) { event.preventDefault(); choose(id, true); return; }
    if (event.target !== svg()) return;
    if (['+', '=', '-'].includes(event.key)) { event.preventDefault(); zoom(event.key === '-' ? 'out' : 'in'); return; }
    const directions: Record<string, number[]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = directions[event.key], view = views.get(activePage)!;
    if (direction && view.width < sheet().width) { event.preventDefault(); const page = sheet(); view.x = Math.max(0, Math.min(page.width - view.width, view.x + direction[0] * view.width * .12)); view.y = Math.max(0, Math.min(page.height - view.height, view.y + direction[1] * view.height * .12)); renderViewport(); }
  });
  let pan: { pointer: number; x: number; y: number; view: ReturnType<typeof drawingViewport> } | null = null;
  viewport.addEventListener('pointerdown', event => {
    if (event.button !== 0 || (event.target as Element).closest('[data-port-id]') || viewport.dataset.zoomed !== 'true') return;
    pan = { pointer: event.pointerId, x: event.clientX, y: event.clientY, view: { ...views.get(activePage)! } }; svg().focus({ preventScroll: true }); viewport.setPointerCapture(event.pointerId); viewport.dataset.panning = 'true'; event.preventDefault();
  });
  viewport.addEventListener('pointermove', event => {
    if (!pan || pan.pointer !== event.pointerId) return;
    const page = sheet(), rect = svg().getBoundingClientRect(), view = views.get(activePage)!;
    view.x = Math.max(0, Math.min(page.width - view.width, pan.view.x - (event.clientX - pan.x) / rect.width * pan.view.width)); view.y = Math.max(0, Math.min(page.height - view.height, pan.view.y - (event.clientY - pan.y) / rect.height * pan.view.height)); renderViewport();
  });
  const endPan = () => { pan = null; viewport.dataset.panning = 'false'; };
  viewport.addEventListener('pointerup', endPan); viewport.addEventListener('pointercancel', endPan); viewport.addEventListener('lostpointercapture', endPan);
  root.querySelectorAll<HTMLButtonElement>('[data-sheet-button]').forEach(button => button.addEventListener('click', () => showPage(button.dataset.sheetButton!)));
  root.querySelectorAll<HTMLButtonElement>('[data-drawing-zoom]').forEach(button => button.addEventListener('click', () => zoom(button.dataset.drawingZoom!)));
  root.querySelectorAll<HTMLButtonElement>('[data-wiring-mode]').forEach(button => button.addEventListener('click', () => { mode = button.dataset.wiringMode!; render(); }));
  const evidenceClick = (event: Event) => { const button = (event.target as Element).closest<HTMLElement>('[data-evidence-id]'); if (button?.dataset.evidenceId) showEvidence(button.dataset.evidenceId, button.dataset.evidenceView === undefined ? undefined : Number(button.dataset.evidenceView)); };
  results.addEventListener('click', evidenceClick); evidence.addEventListener('click', evidenceClick);
  get<HTMLSelectElement>(root, '[data-trace-source]').addEventListener('change', event => choose((event.target as HTMLSelectElement).value));
  get(root, '[data-trace-start]').addEventListener('click', () => {
    mode = 'network'; render(); const target = get<HTMLSelectElement>(root, '[data-trace-target]').value;
    const path = tracePath(wiringSample, selected, target);
    get(root, '[data-trace-summary]').textContent = path ? `${path.portIds.map(id => port(id).label).join(' → ')} · ${path.pages.join(' ↔ ')}` : '未找到已确认的逐段路径；同网成员、待核引用与器件内部均不自动穿越。';
    root.querySelectorAll<SVGElement>('[data-edge-id]').forEach(el => { const index = path?.edgeIds.indexOf(el.dataset.edgeId!) ?? -1; el.classList.toggle('traced', index >= 0); el.style.setProperty('--trace-order', String(Math.max(0, index))); });
    if (path?.edgeIds.length) showEvidence(path.edgeIds[path.edgeIds.length - 1]);
  });
  get(root, '[data-demo-reset]').addEventListener('click', () => { selected = 'p1'; mode = 'direct'; search.value = ''; get<HTMLSelectElement>(root, '[data-trace-target]').value = 'p4'; views.clear(); showPage('P01'); render(); });
  const print = (printing: boolean) => { if (printing) root.querySelectorAll<SVGSVGElement>('svg[data-drawing-page]').forEach(el => el.setAttribute('viewBox', '0 0 1000 640')); else renderViewport(); };
  window.addEventListener('beforeprint', () => print(true)); window.addEventListener('afterprint', () => print(false)); matchMedia('print').addEventListener('change', event => print(event.matches));
  root.querySelectorAll<SVGSVGElement>('svg[data-drawing-page]').forEach(el => el.setAttribute('tabindex', '0'));
  get<HTMLElement>(root, '[data-drawing-toolbar]').hidden = false;
  render(); renderViewport(); enhance(root);
}
