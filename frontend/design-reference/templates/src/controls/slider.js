import { base, uid, el } from "../core/dom.js";
import { life } from "../core/lifecycle.js";

export function Slider(options = {}) {
  const root = base("div", "nui-field"),
    id = uid(),
    label = el("label", "", options.label || "Slider"),
    row = el("div", "nui-slider-controls"),
    range = el("input", "nui-range"),
    number = el("input", "nui-input"),
    help = el("p", "nui-help", options.help || ""),
    error = el("p", "nui-error"),
    instance = life(root);
  label.htmlFor = id;
  range.type = "range";
  range.id = id;
  range.setAttribute("aria-label", options.label || "Slider");
  number.type = "number";
  number.setAttribute("aria-label", (options.label || "Slider") + " · giá trị");
  [range, number].forEach((input) => {
    input.min = options.min ?? 0;
    input.max = options.max ?? 100;
    input.step = options.step ?? 1;
    input.disabled = !!options.disabled;
  });
  help.id = uid();
  error.id = uid();
  error.hidden = true;
  error.setAttribute("aria-live", "polite");
  [range, number].forEach((input) =>
    input.setAttribute("aria-describedby", help.id + " " + error.id),
  );
  row.append(range, number);
  root.append(label, row, help, error);
  instance.setValue = (value) => {
    const v = Math.min(
      Number(range.max),
      Math.max(Number(range.min), Number(value)),
    );
    range.value = String(Number.isFinite(v) ? v : Number(range.min));
    number.value = range.value;
    number.setAttribute("aria-invalid", "false");
    error.hidden = true;
  };
  instance.getValue = () => (number.value === "" ? null : Number(number.value));
  instance.validate = () => {
    const valid = number.value !== "" && number.checkValidity();
    number.setAttribute("aria-invalid", String(!valid));
    error.textContent = `Nhập số từ ${range.min} đến ${range.max}, bước ${range.step}.`;
    error.hidden = valid;
    return valid;
  };
  instance.on(range, "input", () => {
    number.value = range.value;
    instance.validate();
    options.onChange?.(Number(range.value));
  });
  instance.on(number, "input", () => {
    if (number.value !== "" && number.checkValidity()) {
      range.value = number.value;
      options.onChange?.(Number(number.value));
    }
  });
  instance.on(number, "blur", instance.validate);
  instance.setValue(options.value ?? options.min ?? 0);
  return instance;
}
