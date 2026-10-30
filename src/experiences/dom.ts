export function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing experience element: ${selector}`);
  return element;
}

export function node<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const item = document.createElement(tag);
  item.textContent = text;
  item.className = className;
  return item;
}

export function svgNode<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number> = {}, text = ''): SVGElementTagNameMap[K] {
  const item = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) item.setAttribute(key, String(value));
  if (text) item.textContent = text;
  return item;
}

export function enhance(root: HTMLElement) {
  root.dataset.enhanced = 'true';
  root.querySelectorAll<HTMLElement>('[data-demo-controls], [data-demo-reset], [data-inventory-filters]').forEach(item => item.hidden = false);
}
