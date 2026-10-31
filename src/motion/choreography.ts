import { ribbonCopies, ribbonOffset } from './ribbon.mjs';
const root = document.documentElement;
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => root.dataset.motion === 'reduce' || reducedQuery.matches;
const animations = new Set<Animation>();
function play(element: Element, frames: Keyframe[], options: KeyframeAnimationOptions) {
  if (reduced() || typeof element.animate !== 'function' || element.closest('[hidden]')) return;
  const animation = element.animate(frames, options); animations.add(animation);
  animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
}
document.querySelectorAll<HTMLElement>('.kinetic-letter').forEach((letter, index) => {
  play(letter, [{ transform: 'translateY(45%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 700, delay: index * 45, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
});
const ribbon = document.querySelector<HTMLElement>('[data-motion-ribbon]');
const track = ribbon?.querySelector<HTMLElement>('.kinetic-ribbon-track');
const original = track?.querySelector<HTMLElement>('.kinetic-ribbon-group');
let period = 0;
function measureRibbon() {
  if (!ribbon || !track || !original) return;
  ribbon.hidden = false; period = original.getBoundingClientRect().width;
  if (!(period > 0)) return;
  const count = ribbonCopies(ribbon.getBoundingClientRect().width, period);
  while (track.children.length > count) track.lastElementChild!.remove();
  while (track.children.length < count) track.append(original.cloneNode(true));
  updateScroll();
}
const progress = document.createElement('div');
progress.className = 'reading-progress'; progress.setAttribute('aria-hidden', 'true');
if (!document.body.classList.contains('resume-view')) document.body.append(progress);
let scrollFrame = 0;
function updateScroll() {
  scrollFrame = 0;
  const total = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  progress.style.transform = `scaleX(${Math.max(0, Math.min(1, scrollY / total))})`;
  if (track) track.style.transform = `translate3d(${reduced() ? 0 : ribbonOffset(scrollY * .28, period)}px,0,0)`;
}
window.addEventListener('scroll', () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll); }, { passive: true });
window.addEventListener('resize', measureRibbon, { passive: true });
if (ribbon && original) {
  const observer = new ResizeObserver(measureRibbon); observer.observe(ribbon); observer.observe(original);
  document.fonts?.ready.then(measureRibbon); measureRibbon();
}
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.querySelectorAll<SVGGeometryElement>('.project-art .art-line').forEach((path, index) => {
        try { const length = path.getTotalLength(); play(path, [{ strokeDasharray: `${length}`, strokeDashoffset: length }, { strokeDasharray: `${length}`, strokeDashoffset: 0 }], { duration: 900, delay: index * 55, fill: 'backwards', easing: 'ease-out' }); } catch {}
      });
      observer.unobserve(entry.target);
    }
  }, { threshold: .1 });
  document.querySelectorAll('.project-row').forEach(row => observer.observe(row));
}
document.querySelectorAll<HTMLElement>('[data-case-panel]').forEach(panel => {
  const observer = new MutationObserver(() => { if (!panel.hidden) play(panel, [{ opacity: .4 }, { opacity: 1 }], { duration: 250 }); });
  observer.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
});
function syncMotion() {
  if (reduced()) { animations.forEach(animation => animation.cancel()); animations.clear(); }
  updateScroll();
}
new MutationObserver(syncMotion).observe(root, { attributes: true, attributeFilter: ['data-motion'] });
reducedQuery.addEventListener('change', syncMotion);
window.addEventListener('pagehide', () => { animations.forEach(animation => animation.cancel()); if (scrollFrame) cancelAnimationFrame(scrollFrame); scrollFrame = 0; });
window.addEventListener('pageshow', () => { measureRibbon(); updateScroll(); });
updateScroll();
