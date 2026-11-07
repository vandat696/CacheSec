import { base, el } from "../core/dom.js";
import { life } from "../core/lifecycle.js";

export function Alert(options = {}) {
  const root = base("div", "nui-alert");
  root.setAttribute("role", options.tone === "danger" ? "alert" : "status");
  root.append(
    el("strong", "", options.title || "Thông báo"),
    el("p", "nui-help", options.description || ""),
  );
  return life(root);
}
