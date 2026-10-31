const roots = [...document.querySelectorAll<HTMLElement>('[data-experience]')];
const mounted = new WeakSet<HTMLElement>();
const mounting = new WeakSet<HTMLElement>();
const visible = (root: HTMLElement) => {
  const bounds = root.getBoundingClientRect();
  return !document.hidden && !root.closest('[hidden]') && bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 && bounds.top < innerHeight;
};
async function load(root: HTMLElement) {
  if (mounted.has(root) || mounting.has(root)) return;
  mounting.add(root);
  try {
    switch (root.dataset.experience) {
      case 'plate-split': (await import('./splitting/client')).mount(root); break;
      case 'cad-flow': (await import('./cad/client')).mount(root); break;
      case 'output-forecast': (await import('./energy/client')).mount(root); break;
      case 'wiring-query': (await import('./wiring/client')).mount(root); break;
      default: throw new Error('Unsupported public experience');
    }
    mounted.add(root);
  } catch {
    const message = document.createElement('p'); message.className = 'no-script-note';
    message.textContent = '交互暂未加载，静态样例仍可阅读。刷新后可重试。'; root.append(message);
  } finally { mounting.delete(root); }
}
function synchronize() {
  for (const root of roots) {
    const active = visible(root);
    if (root.dataset.paused !== String(!active)) {
      root.dataset.paused = String(!active);
      if (!active) root.dispatchEvent(new Event('demo:pause'));
    }
    if (active) void load(root);
  }
}
const homeTabs = document.querySelector<HTMLElement>('[data-home-tabs]');
if (homeTabs) {
  const buttons = [...homeTabs.querySelectorAll<HTMLButtonElement>('[data-home-tab]')];
  const panels = [...document.querySelectorAll<HTMLElement>('[data-home-panel]')];
  const activate = (button: HTMLButtonElement) => {
    buttons.forEach(item => { item.setAttribute('aria-selected', String(item === button)); item.tabIndex = item === button ? 0 : -1; });
    panels.forEach(panel => panel.hidden = panel.dataset.homePanel !== button.dataset.homeTab);
    synchronize();
  };
  buttons.forEach((button, i) => {
    button.addEventListener('click', () => activate(button));
    button.addEventListener('keydown', event => {
      const next = event.key === 'ArrowRight' ? (i + 1) % buttons.length : event.key === 'ArrowLeft' ? (i + buttons.length - 1) % buttons.length : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : -1;
      if (next >= 0) { event.preventDefault(); activate(buttons[next]); buttons[next].focus(); }
    });
  });
  homeTabs.hidden = false; activate(buttons[0]);
}
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(synchronize, { rootMargin: '0px', threshold: 0 });
  roots.forEach(root => observer.observe(root));
}
const mutations = new MutationObserver(synchronize);
mutations.observe(document.querySelector('main') || document.body, { attributes: true, subtree: true, attributeFilter: ['hidden', 'open'] });
window.addEventListener('pageshow', synchronize);
document.addEventListener('visibilitychange', synchronize);
window.addEventListener('pagehide', () => roots.forEach(root => { root.dataset.paused = 'true'; root.dispatchEvent(new Event('demo:pause')); }));
synchronize();
