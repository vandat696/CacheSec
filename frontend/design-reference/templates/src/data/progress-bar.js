import { base, el, uid, fmt } from "../core/dom.js";
import { life } from "../core/lifecycle.js";

export function ProgressBar(options = {}) {
  const root = base("div", "nui-field"),
    label = el("label", "", options.label || "Mức sử dụng"),
    bar = el("progress", "nui-progress"),
    description = el("span", "nui-help"),
    instance = life(root);
  bar.id = uid();
  label.htmlFor = bar.id;
  root.append(label, bar, description);
  instance.setValue = (value, max = options.max ?? 100) => {
    bar.max =
      Number.isFinite(Number(max)) && Number(max) > 0 ? Number(max) : 100;
    bar.value = Math.max(0, Math.min(bar.max, Number(value) || 0));
    bar.textContent = Math.round((bar.value / bar.max) * 100) + "%";
    description.textContent = `${fmt.format(bar.value)} / ${fmt.format(bar.max)}${options.unit ? " " + options.unit : ""} · ${Math.round((bar.value / bar.max) * 100)}%`;
  };
  instance.setValue(options.value ?? 0);
  return instance;
}
