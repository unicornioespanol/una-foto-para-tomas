export function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
export function button(label, action, className = 'button') {
  const node = el('button', className, label);
  node.type = 'button'; node.addEventListener('click', action); return node;
}
export function pressed(node, selected) { node.setAttribute('aria-pressed', String(Boolean(selected))); return node; }
