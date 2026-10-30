const root = document.documentElement;
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const reduced = () => root.dataset.motion === 'reduce' || reducedQuery.matches;
const animations = new Set<Animation>();
function play(element: Element, frames: Keyframe[], options: KeyframeAnimationOptions) {
  if (reduced() || typeof element.animate !== 'function') return;
  const animation = element.animate(frames, options);
  animations.add(animation);
  animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
}

const letters = [...document.querySelectorAll<HTMLElement>('.kinetic-letter')];
letters.forEach((letter, index) => {
  play(letter, [{ transform: 'translateY(70%) rotate(9deg)', opacity: 0 }, { transform: 'translateY(0) rotate(0)', opacity: 1 }], { duration: 850, delay: 60 + index * 48, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
  letter.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse') return;
    play(letter, [{ transform: 'translateY(0) rotate(0)' }, { transform: `translateY(-13%) rotate(${index % 2 ? 5 : -5}deg)`, offset: .35 }, { transform: 'translateY(0) rotate(0)' }], { duration: 650, easing: 'cubic-bezier(.22,.8,.3,1)' });
  });
});

const projectRows = [...document.querySelectorAll<HTMLElement>('.project-row')];
const ribbon = document.querySelector<HTMLElement>('[data-motion-ribbon]');
const progress = document.createElement('div');
progress.className = 'reading-progress'; progress.setAttribute('aria-hidden', 'true');
if (!document.body.classList.contains('resume-view')) document.body.append(progress);
let scrollFrame = 0;
function updateScroll() {
  scrollFrame = 0;
  const total = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  progress.style.transform = `scaleX(${Math.max(0, Math.min(1, scrollY / total))})`;
  if (reduced()) return;
  for (const row of projectRows) {
    if (row.hidden) continue;
    const bounds = row.getBoundingClientRect();
    if (bounds.bottom < 0 || bounds.top > innerHeight) continue;
    const fraction = Math.max(-1, Math.min(1, (bounds.top + bounds.height / 2 - innerHeight / 2) / innerHeight));
    row.style.setProperty('--scroll-shift', `${fraction * 22}px`);
    row.style.setProperty('--scroll-rotate', `${fraction * -2.2}deg`);
  }
  if (ribbon) {
    const bounds = ribbon.getBoundingClientRect();
    if (bounds.bottom > 0 && bounds.top < innerHeight) ribbon.style.setProperty('--ribbon-shift', `${(bounds.top / innerHeight - .5) * 150}px`);
  }
}
window.addEventListener('scroll', () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll); }, { passive: true });
window.addEventListener('resize', () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll); }, { passive: true });

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const element = entry.target as HTMLElement;
      element.classList.toggle('is-motion-visible', entry.isIntersecting);
      if (entry.isIntersecting && !element.dataset.motionSeen) {
        element.dataset.motionSeen = 'true';
        const paths = [...element.querySelectorAll<SVGGeometryElement>('.project-art .art-line')].slice(0, 7);
        paths.forEach((path, index) => {
          try {
            const length = path.getTotalLength();
            play(path, [{ strokeDasharray: `${length}`, strokeDashoffset: length }, { strokeDasharray: `${length}`, strokeDashoffset: 0 }], { duration: 1100, delay: index * 65, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' });
          } catch { /* A decorative geometry can remain static. */ }
        });
      }
    }
  }, { threshold: .1 });
  projectRows.forEach(row => observer.observe(row));
}

const magnets = [...document.querySelectorAll<HTMLElement>('.button-primary, .header-resume')];
for (const magnet of magnets) {
  magnet.dataset.magnetic = '';
  magnet.addEventListener('pointermove', event => {
    if (!finePointer.matches || reduced() || event.pointerType !== 'mouse') return;
    const bounds = magnet.getBoundingClientRect();
    magnet.style.setProperty('--magnet-x', `${Math.max(-7, Math.min(7, (event.clientX - bounds.left - bounds.width / 2) * .12))}px`);
    magnet.style.setProperty('--magnet-y', `${Math.max(-5, Math.min(5, (event.clientY - bounds.top - bounds.height / 2) * .15))}px`);
  });
  magnet.addEventListener('pointerleave', () => { magnet.style.setProperty('--magnet-x', '0px'); magnet.style.setProperty('--magnet-y', '0px'); });
}
for (const row of projectRows) {
  row.addEventListener('pointermove', event => {
    if (!finePointer.matches || reduced() || event.pointerType !== 'mouse') return;
    const bounds = row.getBoundingClientRect();
    row.style.setProperty('--card-rx', `${-(event.clientY - bounds.top - bounds.height / 2) / bounds.height * 7}deg`);
    row.style.setProperty('--card-ry', `${(event.clientX - bounds.left - bounds.width / 2) / bounds.width * 8}deg`);
  }, { passive: true });
  row.addEventListener('pointerleave', () => { row.style.setProperty('--card-rx', '0deg'); row.style.setProperty('--card-ry', '0deg'); });
}

let cursor: HTMLDivElement | null = null;
if (finePointer.matches && !document.body.classList.contains('resume-view')) {
  cursor = document.createElement('div'); cursor.className = 'motion-cursor'; cursor.setAttribute('aria-hidden', 'true'); cursor.textContent = '↗'; document.body.append(cursor);
  let pointerFrame = 0, x = 0, y = 0, active = false;
  document.addEventListener('pointermove', event => {
    x = event.clientX; y = event.clientY;
    active = !!(event.target as Element).closest('.project-visual-link, .case-link, .next-project, .email-link');
    if (pointerFrame) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      if (!cursor) return;
      cursor.style.transform = `translate3d(${x - 23}px,${y - 23}px,0)`;
      cursor.classList.toggle('is-active', active && !reduced());
    });
  }, { passive: true });
  document.addEventListener('pointerleave', () => cursor?.classList.remove('is-active'));
}

document.querySelectorAll<HTMLElement>('[data-case-panel]').forEach(panel => {
  const observer = new MutationObserver(() => {
    if (!panel.hidden) play(panel, [{ opacity: .35, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 380, easing: 'cubic-bezier(.2,.7,.3,1)' });
  });
  observer.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
});
const metrics = document.querySelector('.metric-grid');
if (metrics) {
  const observer = new MutationObserver(() => {
    metrics.querySelectorAll('strong').forEach(value => play(value, [{ opacity: .5, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 320, easing: 'ease-out' }));
  });
  observer.observe(metrics, { childList: true, subtree: true, characterData: true });
}

function syncMotion() {
  if (reduced()) {
    animations.forEach(animation => animation.cancel()); animations.clear();
    projectRows.forEach(row => {
      for (const property of ['--scroll-shift','--scroll-rotate','--card-rx','--card-ry']) row.style.removeProperty(property);
    });
    magnets.forEach(magnet => { magnet.style.removeProperty('--magnet-x'); magnet.style.removeProperty('--magnet-y'); });
    cursor?.classList.remove('is-active'); ribbon?.style.removeProperty('--ribbon-shift');
  }
  updateScroll();
}
const preferenceObserver = new MutationObserver(syncMotion);
preferenceObserver.observe(root, { attributes: true, attributeFilter: ['data-motion'] });
reducedQuery.addEventListener('change', syncMotion);
window.addEventListener('pagehide', () => {
  animations.forEach(animation => animation.cancel());
  if (scrollFrame) cancelAnimationFrame(scrollFrame);
  scrollFrame = 0;
});
window.addEventListener('pageshow', updateScroll);
updateScroll();
