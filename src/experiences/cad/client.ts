import { createDrawingSample, validateDrawing, deduplicateDrawing, advanceDrawingFlow, buildHandoff, createInventory, filterInventory, transitionInventory } from './model.mjs';
import { requireElement as get, node, svgNode, enhance } from '../dom';

export function mount(root: HTMLElement) {
  let records = createDrawingSample();
  let inventory = createInventory();
  let selected = records[0].id;
  let stage = 0;
  const scenario = get<HTMLSelectElement>(root, '[data-cad-scenario]');
  const shapes = get<SVGGElement>(root, '[data-cad-shapes]');
  const form = get<HTMLFormElement>(root, '[data-cad-form]');
  const material = get<HTMLSelectElement>(form, '[name="material"]');
  const thickness = get<HTMLInputElement>(form, '[name="thickness"]');
  const next = get<HTMLButtonElement>(root, '[data-cad-next]');
  const status = get<HTMLElement>(root, '[data-cad-status]');
  const repair = get<HTMLButtonElement>(root, '[data-cad-repair]');
  const dedupe = get<HTMLButtonElement>(root, '[data-cad-dedupe]');
  const stockList = get<HTMLElement>(root, '[data-stock-list]');
  const stockMaterial = get<HTMLSelectElement>(root, '[data-stock-material]');
  const stockThickness = get<HTMLSelectElement>(root, '[data-stock-thickness]');
  const names: Record<string, string> = { available: '可用', reserved: '已预留', used: '已使用' };
  const actions: Record<string, string> = { reserve: '预留', release: '释放', use: '领用' };

  function renderDrawing() {
    const row = records.find(record => record.id === selected) || records[0];
    selected = row.id;
    material.value = row.material;
    thickness.value = row.thickness === null ? '' : String(row.thickness);
    material.disabled = thickness.disabled = stage > 0;
    const saveButton = get<HTMLButtonElement>(form, 'button[type="submit"]');
    saveButton.disabled = stage > 0;
    saveButton.textContent = stage > 0 ? '字段已锁定，重置后可编辑' : '保存对象字段';
    get(root, '[data-cad-selection]').textContent = `${row.partId} · ${row.material || '材料待补'} · ${row.thickness || '厚度待补'}${row.thickness ? ' mm' : ''}`;
    get(root, '[data-cad-count]').textContent = `${String(records.length).padStart(2, '0')} PARTS`;
    shapes.replaceChildren(...records.map(record => {
      const issue = validateDrawing([record]).length > 0;
      const group = svgNode('g', { 'data-cad-part': record.id, class: `cad-part${record.id === selected ? ' selected' : ''}${issue ? ' has-issue' : ''}`, role: 'button', tabindex: 0, 'aria-label': `查看对象 ${record.partId}`, 'aria-pressed': String(record.id === selected) });
      group.append(svgNode('polygon', { points: record.points }), svgNode('text', { x: record.center[0], y: record.center[1] }, record.partId));
      return group;
    }));
    repair.hidden = !validateDrawing(records).some(issue => issue.field === 'material' || issue.field === 'thickness');
    dedupe.hidden = !validateDrawing(records).some(issue => issue.field === 'partId');
    root.querySelectorAll<HTMLElement>('[data-cad-steps] li').forEach((item, i) => {
      item.dataset.state = i < stage ? 'done' : i === stage ? 'current' : 'next';
      if (i === stage) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
    });
    next.textContent = ['校验并继续', '转换数据', '确认交接', '登记入库', '已完成入库'][stage];
    next.disabled = stage === 4;
    get(root, '[data-handoff]').textContent = stage >= 2 ? JSON.stringify(buildHandoff(records), null, 2) : '完成“转换数据”后，这里会显示交接字段。';
  }

  function renderStock() {
    const rows = filterInventory(inventory, stockMaterial.value, stockThickness.value);
    stockList.replaceChildren(...rows.map(row => {
      const article = node('article', '', 'stock-row');
      article.dataset.stockId = row.id;
      article.tabIndex = -1;
      article.append(node('strong', row.partId), node('span', `${row.material} · ${row.thickness} mm`), node('span', names[row.status], `state-chip state-${row.status}`));
      const controls = node('div', '', 'stock-actions');
      const available = row.status === 'available' ? ['reserve'] : row.status === 'reserved' ? ['release', 'use'] : [];
      for (const action of available) {
        const button = node('button', actions[action], 'small-button');
        button.type = 'button'; button.dataset.stockAction = action; controls.append(button);
      }
      if (!available.length) controls.append(node('span', '流转完成', 'muted'));
      article.append(controls);
      return article;
    }));
    if (!rows.length) stockList.append(node('p', '没有符合当前筛选的样例余料。', 'empty-result'));
  }

  function reset() {
    records = createDrawingSample(scenario.value);
    inventory = createInventory(); selected = records[0].id; stage = 0;
    stockMaterial.value = stockThickness.value = 'all';
    status.textContent = scenario.value === 'missing' ? '这里有材料和厚度缺失。选中第二个对象，尝试校验与补全。' : scenario.value === 'duplicate' ? '有两个对象使用了相同的零件标识。先校验，再处理重复记录。' : '完整样例包含 3 条有效记录。选择一个对象，查看字段如何进入后续流程。';
    renderDrawing(); renderStock();
  }

  shapes.addEventListener('click', event => {
    const target = (event.target as Element).closest<SVGGElement>('[data-cad-part]');
    if (target?.dataset.cadPart) { selected = target.dataset.cadPart; renderDrawing(); }
  });
  shapes.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = (event.target as Element).closest<SVGGElement>('[data-cad-part]');
    if (target?.dataset.cadPart) { event.preventDefault(); selected = target.dataset.cadPart; renderDrawing(); shapes.querySelector<SVGGElement>(`[data-cad-part="${selected}"]`)?.focus(); }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (stage > 0) return;
    records = records.map(row => row.id === selected ? { ...row, material: material.value, thickness: Number(thickness.value) } : row);
    stage = 0; status.textContent = '对象字段已保存。重新校验后继续流转。'; renderDrawing();
  });
  repair.addEventListener('click', () => {
    records = records.map(row => ({ ...row, material: row.material || 'Q355B', thickness: row.thickness || 12 }));
    stage = 0; status.textContent = '已补入明确的示例材料和厚度，可重新校验。'; renderDrawing(); next.focus();
  });
  dedupe.addEventListener('click', () => {
    records = deduplicateDrawing(records); stage = 0;
    status.textContent = '已保留首次出现的记录并移除重复项，可重新校验。'; renderDrawing(); next.focus();
  });
  next.addEventListener('click', () => {
    const result = advanceDrawingFlow(records, stage);
    if (result.issues.length) { status.textContent = `校验发现 ${result.issues.length} 项：${result.issues.map(issue => issue.message).join('；')}。修正后才能继续。`; return; }
    stage = result.stage;
    if (stage === 4) {
      inventory.push(...records.map(row => ({ id: `import-${row.id}`, partId: row.partId, material: row.material, thickness: row.thickness!, status: 'available' })));
      renderStock();
    }
    status.textContent = ['', `字段校验通过：${records.length} 条记录可转换。`, `已转换 ${records.length} 条记录，字段映射可在“交接结构”中查看。`, '交接字段已核对，接下来将这些记录登记到样例余料库。', `已将 ${records.length} 条记录登记入库，试试预留和领用。`][stage];
    renderDrawing();
  });
  stockList.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-stock-action]');
    const row = button?.closest<HTMLElement>('[data-stock-id]');
    const record = inventory.find(item => item.id === row?.dataset.stockId);
    if (!button || !record) return;
    record.status = transitionInventory(record.status, button.dataset.stockAction!);
    status.textContent = `${record.partId}：${names[record.status]}。`;
    renderStock();
    const updated = stockList.querySelector<HTMLElement>(`[data-stock-id="${record.id}"]`);
    (updated?.querySelector<HTMLButtonElement>('button') || updated)?.focus();
  });
  scenario.addEventListener('change', reset);
  stockMaterial.addEventListener('change', renderStock);
  stockThickness.addEventListener('change', renderStock);
  get(root, '[data-demo-reset]').addEventListener('click', () => { scenario.value = 'complete'; reset(); });
  renderDrawing(); renderStock(); enhance(root);
}
