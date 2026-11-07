import { base, el } from "../core/dom.js";
import { life } from "../core/lifecycle.js";

export function StatCard(options = {}) {
  const root = base("article", "nui-surface nui-stat");
  root.append(
    el("span", "nui-help", options.label || "Chỉ số"),
    el("strong", "nui-value", options.value ?? "—"),
    el("span", "nui-help", options.description || ""),
  );
  return life(root);
}
