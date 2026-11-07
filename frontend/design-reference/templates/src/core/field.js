import { base, uid, el } from "./dom.js";
import { life } from "./lifecycle.js";

export function field(options = {}, tag = "input", type = "text") {
  const root = base("div", "nui-field"),
    id = uid(),
    label = el("label", "", options.label || "Nhãn"),
    input = el(tag, "nui-input"),
    help = el("span", "nui-help", options.help || ""),
    error = el("span", "nui-error");
  label.htmlFor = id;
  input.id = id;
  help.id = id + "-help";
  error.id = id + "-error";
  error.hidden = true;
  error.setAttribute("aria-live", "polite");
  input.setAttribute("aria-describedby", help.id + " " + error.id);
  if (tag === "input") input.type = type;
  input.required = !!options.required;
  input.disabled = !!options.disabled;
  if (input.required) label.append(document.createTextNode(" *"));
  if (options.placeholder) input.placeholder = options.placeholder;
  root.append(label, input, help, error);
  const instance = life(root);
  instance.input = input;
  instance.setValue = (value) => {
    input.value = String(value ?? "");
  };
  instance.getValue = () =>
    type === "number"
      ? input.value === ""
        ? null
        : Number(input.value)
      : input.value;
  instance.validate = () => {
    const custom = options.validate?.(instance.getValue());
    const valid = input.checkValidity() && !custom;
    error.textContent =
      custom || options.error || "Kiểm tra giá trị và giới hạn của trường này.";
    error.hidden = valid;
    input.setAttribute("aria-invalid", String(!valid));
    return valid;
  };
  instance.on(input, "blur", instance.validate);
  instance.on(input, "change", () => options.onChange?.(instance.getValue()));
  instance.setValue(options.value ?? "");
  return instance;
}
