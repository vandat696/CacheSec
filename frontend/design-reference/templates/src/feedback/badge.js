import { base } from "../core/dom.js";
import { life } from "../core/lifecycle.js";

export function Badge(options = {}) {
  const node = base("span", "nui-badge");
  node.dataset.tone = options.tone || "primary";
  node.textContent = options.label || "Badge";
  return life(node);
}
