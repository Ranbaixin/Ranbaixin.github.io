import { wiringSample, queryConnections, searchPorts } from './model.mjs';
import { requireElement as get, node, enhance } from '../dom';

export function mount(root: HTMLElement) {
  let selected = 'p1';
  let mode = 'direct';
  const search = get<HTMLInputElement>(root, '[data-port-search]');
  const list = get<HTMLElement>(root, '[data-port-list]');
  const results = get<HTMLElement>(root, '[data-wiring-results]');
  const evidence = get<HTMLElement>(root, '[data-evidence]');
  const ports = get<SVGGElement>(root, '[data-wiring-ports]');
  const labels: Record<string, string> = { direct: '直接连接', network: '已确认网络', pending: '待核信息' };
  const states: Record<string, string> = { verified: '已确认', pending: '待核', conflict: '冲突' };
  const hints: Record<string, string> = { direct: '直接连接展示实际相邻的导线或桥接。', network: '沿已确认连接展开，跨页关系保留，器件内部不推断导通。', pending: '候选与冲突关系单独显示，不参与已确认网络计算。' };

  function resetEvidence() {
    evidence.replaceChildren(node('span', '图纸依据', 'control-eyebrow'), node('p', '选择一条结果的“查看依据”，定位它在样例图中的关系。'));
    root.querySelectorAll('[data-edge-id]').forEach(item => item.classList.remove('evidence-active'));
  }
  function renderSearch() {
    const matches = searchPorts(wiringSample, search.value);
    list.replaceChildren(...matches.map(port => {
      const button = node('button', '', 'port-search-result');
      button.type = 'button'; button.dataset.selectPort = port.id;
      button.setAttribute('aria-label', `选择端口 ${port.label}`);
      button.setAttribute('aria-pressed', String(selected === port.id));
      button.append(node('strong', port.label), node('span', `样例页 ${port.page}`));
      return button;
    }));
    if (!matches.length) list.append(node('p', '未找到匹配端口，图中仍保留当前选择。', 'empty-result'));
  }
  function render() {
    const result = queryConnections(wiringSample, selected, mode);
    resetEvidence(); renderSearch();
    get(root, '[data-wiring-selection]').textContent = `${result.port.label} · 样例页 ${result.port.page} · ${result.port.description}`;
    get(root, '[data-wiring-result-title]').textContent = `${result.port.label} 的${labels[mode]}`;
    get(root, '[data-wiring-count]').textContent = `${String(result.edges.length).padStart(2, '0')} RELATIONS`;
    get(root, '[data-query-hint]').textContent = hints[mode];
    root.querySelectorAll<HTMLElement>('[data-wiring-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.wiringMode === mode)));
    ports.querySelectorAll<SVGGElement>('[data-port-id]').forEach(group => {
      const port = wiringSample.ports.find(item => item.id === group.dataset.portId)!;
      group.setAttribute('role', 'button'); group.setAttribute('tabindex', '0');
      group.setAttribute('aria-label', `图中端口 ${port.label}`); group.setAttribute('aria-pressed', String(port.id === selected));
      group.classList.toggle('selected', port.id === selected); group.classList.toggle('connected', result.portIds.includes(port.id));
    });
    root.querySelectorAll<SVGGElement>('[data-edge-id]').forEach(edge => edge.classList.toggle('active', result.edges.some(item => item.id === edge.dataset.edgeId)));
    results.replaceChildren(...result.edges.map(edge => {
      const a = wiringSample.ports.find(port => port.id === edge.a)!;
      const b = wiringSample.ports.find(port => port.id === edge.b)!;
      const row = node('article', '', 'connection-row');
      row.append(node('strong', `${a.label} ↔ ${b.label}`), node('span', states[edge.status], `state-chip state-${edge.status}`), node('span', edge.note, 'connection-note'));
      const button = node('button', '查看依据 ↗', 'small-button');
      button.type = 'button'; button.dataset.evidenceId = edge.id;
      button.setAttribute('aria-label', `查看依据：${a.label} 与 ${b.label}`);
      row.append(button); return row;
    }));
    if (!result.edges.length) results.append(node('p', mode === 'pending' ? '当前端口没有单列的待核或冲突关系。试试 A:3 或 A:2。' : '当前范围未找到已确认连接；这不代表现场未接线。', 'empty-result'));
  }
  list.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-select-port]');
    if (!button?.dataset.selectPort) return;
    selected = button.dataset.selectPort; render();
    list.querySelector<HTMLButtonElement>(`[data-select-port="${selected}"]`)?.focus();
  });
  search.addEventListener('input', renderSearch);
  ports.addEventListener('click', event => {
    const group = (event.target as Element).closest<SVGGElement>('[data-port-id]');
    if (group?.dataset.portId) { selected = group.dataset.portId; render(); }
  });
  ports.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const group = (event.target as Element).closest<SVGGElement>('[data-port-id]');
    if (group?.dataset.portId) { event.preventDefault(); selected = group.dataset.portId; render(); group.focus(); }
  });
  root.querySelectorAll<HTMLButtonElement>('[data-wiring-mode]').forEach(button => button.addEventListener('click', () => { mode = button.dataset.wiringMode!; render(); }));
  results.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-evidence-id]');
    const edge = wiringSample.edges.find(item => item.id === button?.dataset.evidenceId);
    if (!edge) return;
    evidence.replaceChildren(node('span', states[edge.status], 'control-eyebrow'), node('h4', edge.evidence), node('p', edge.note));
    root.querySelectorAll<SVGGElement>('[data-edge-id]').forEach(item => item.classList.toggle('evidence-active', item.dataset.edgeId === edge.id));
    evidence.focus({ preventScroll: true });
  });
  get(root, '[data-demo-reset]').addEventListener('click', () => { selected = 'p1'; mode = 'direct'; search.value = ''; render(); });
  render(); enhance(root);
}
