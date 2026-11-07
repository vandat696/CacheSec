import { base, el } from "../core/dom.js";
import { life } from "../core/lifecycle.js";

export function FlowDiagram(options = {}) {
  const root = base("div", "nui-flow"),
    track = el("div", "nui-flow-track"),
    detail = el("div", "nui-flow-detail"),
    instance = life(root),
    nodes = options.nodes || [],
    buttons = [];
  detail.setAttribute("role", "status");
  root.append(track, detail);
  instance.select = (id) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    buttons.forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.nodeId === id)),
    );
    detail.replaceChildren(
      el("strong", "", node.label),
      el("p", "nui-help", node.description || ""),
    );
    options.onSelect?.(node);
  };
  nodes.forEach((node, i) => {
    if (i) {
      const arrow = el("span", "nui-arrow", "→");
      arrow.setAttribute("aria-hidden", "true");
      track.append(arrow);
    }
    const b = el("button", "nui-node");
    b.type = "button";
    b.dataset.nodeId = node.id;
    b.append(
      el("span", "", String(i + 1).padStart(2, "0")),
      el("strong", "", node.label),
    );
    if (node.helper) b.append(el("span", "", node.helper));
    track.append(b);
    buttons.push(b);
    instance.on(b, "click", () => instance.select(node.id));
  });
  if (nodes.length) instance.select(options.selectedId || nodes[0].id);
  else detail.append(el("p", "nui-empty", "Chưa có bước xử lý."));
  return instance;
}
