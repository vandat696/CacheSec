import { base, el } from "../core/dom.js";
import { life } from "../core/lifecycle.js";

export function Switch(options = {}) {
  const root = base("button", "nui-switch");
  root.type = "button";
  root.setAttribute("role", "switch");
  root.disabled = !!options.disabled;
  const track = el("span", "nui-switch-track");
  track.setAttribute("aria-hidden", "true");
  track.append(el("span", "nui-switch-thumb"));
  root.append(track, el("span", "", options.label || "Switch"));
  const instance = life(root);
  instance.setValue = (v) => root.setAttribute("aria-checked", String(!!v));
  instance.getValue = () => root.getAttribute("aria-checked") === "true";
  instance.setValue(options.checked);
  instance.on(root, "click", () => {
    instance.setValue(!instance.getValue());
    options.onChange?.(instance.getValue());
  });
  return instance;
}
