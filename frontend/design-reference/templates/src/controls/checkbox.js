import { base, el } from "../core/dom.js";
import { life } from "../core/lifecycle.js";

export function Checkbox(options = {}) {
  const root = base("label", "nui-check"),
    input = el("input");
  input.type = "checkbox";
  input.checked = !!options.checked;
  input.disabled = !!options.disabled;
  root.append(input, el("span", "", options.label || "Checkbox"));
  const instance = life(root);
  instance.input = input;
  instance.getValue = () => input.checked;
  instance.setValue = (v) => (input.checked = !!v);
  instance.on(input, "change", () => options.onChange?.(input.checked));
  return instance;
}
