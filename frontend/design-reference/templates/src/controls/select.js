import { field } from "../core/field.js";
import { el } from "../core/dom.js";

export function Select(options = {}) {
  const instance = field(options, "select");
  (options.options || []).forEach((item) => {
    const p = typeof item === "string" ? { value: item, label: item } : item;
    const option = el("option", "", p.label);
    option.value = String(p.value);
    instance.input.append(option);
  });
  if (options.value !== undefined) instance.setValue(options.value);
  return instance;
}
