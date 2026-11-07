export const ns = "http://www.w3.org/2000/svg";

export function svgNode(tag, attrs = {}, text) {
  const n = document.createElementNS(ns, tag);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, String(v)));
  if (text !== undefined) n.textContent = String(text);
  return n;
}
