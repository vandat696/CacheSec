let sequence = 0;

export const uid = () => `nui-${++sequence}`;

export const fmt = new Intl.NumberFormat("vi-VN");

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

export function base(tag = "div", className = "") {
  return el(tag, "nui nui-theme " + className);
}

export function buttonNode(label, variant = "secondary") {
  const b = el("button", "nui-button", label);
  b.type = "button";
  b.dataset.variant = variant;
  return b;
}
