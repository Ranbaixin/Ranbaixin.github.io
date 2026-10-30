import { selectProjects } from '../lib/model.mjs';

const root = document.documentElement;
const store = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* Preferences remain usable for this page. */ } };
const reduced = () => root.dataset.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches;

const themeButton = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
if (themeButton) {
  themeButton.hidden = false;
  themeButton.addEventListener('click', () => {
    const dark = root.dataset.theme === 'dark' || (root.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    root.dataset.theme = dark ? 'light' : 'dark';
    store('xyc-theme', root.dataset.theme);
    themeButton.setAttribute('aria-label', dark ? '切换为暗色主题' : '切换为浅色主题');
  });
}

const motionButton = document.querySelector<HTMLButtonElement>('[data-motion-toggle]');
if (motionButton) {
  motionButton.hidden = false;
  motionButton.setAttribute('aria-pressed', String(reduced()));
  motionButton.addEventListener('click', () => {
    const next = root.dataset.motion === 'reduce' ? 'auto' : 'reduce';
    root.dataset.motion = next;
    store('xyc-motion', next);
    motionButton.setAttribute('aria-pressed', String(reduced()));
    motionButton.textContent = next === 'reduce' ? '恢复系统动画设置' : '减少动画';
  });
}

const filters = document.querySelector<HTMLElement>('[data-filters]');
if (filters) {
  filters.hidden = false;
  const cards = [...document.querySelectorAll<HTMLElement>('[data-project-category]')].map(element => ({ element, category: element.dataset.projectCategory }));
  const buttons = [...filters.querySelectorAll<HTMLButtonElement>('[data-filter]')];
  buttons.forEach(button => button.addEventListener('click', () => {
    const selected = new Set(selectProjects(cards, button.dataset.filter || 'all'));
    for (const card of cards) card.element.hidden = !selected.has(card);
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    const count = document.querySelector('[data-filter-count]');
    if (count) count.textContent = `展示 ${selected.size} 个项目`;
    const empty = document.querySelector<HTMLElement>('[data-empty-state]');
    if (empty) empty.hidden = selected.size !== 0;
  }));
}

const copyButton = document.querySelector<HTMLButtonElement>('[data-copy-email]');
if (copyButton) {
  copyButton.hidden = false;
  copyButton.addEventListener('click', async () => {
    const status = document.querySelector('[data-copy-status]');
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(copyButton.dataset.copyEmail || '');
      if (status) status.textContent = '邮箱已复制';
    } catch {
      if (status) status.textContent = '请选中上方邮箱手动复制。';
    }
  });
}

const printButton = document.querySelector<HTMLButtonElement>('[data-print]');
if (printButton) { printButton.hidden = false; printButton.addEventListener('click', () => window.print()); }

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      entry.target.classList.toggle('is-visible', entry.isIntersecting);
      if (entry.isIntersecting && entry.target.hasAttribute('data-reveal')) observer.unobserve(entry.target);
    }
  }, { threshold: 0.08 });
  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach(element => {
    observer.observe(element);
    if (!reduced()) element.classList.add('js-reveal');
  });
  document.querySelectorAll<HTMLElement>('[data-hero-graph]').forEach(element => observer.observe(element));
}

const graph = document.querySelector<HTMLElement>('[data-hero-graph]');
if (graph && matchMedia('(pointer: fine)').matches) {
  let scheduled = false;
  graph.addEventListener('pointermove', event => {
    if (reduced() || scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      const bounds = graph.getBoundingClientRect();
      graph.style.setProperty('--pointer-x', String(Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1))));
      graph.style.setProperty('--pointer-y', String(Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1))));
      scheduled = false;
    });
  }, { passive: true });
  graph.addEventListener('pointerleave', () => { graph.style.setProperty('--pointer-x', '0'); graph.style.setProperty('--pointer-y', '0'); });
}
