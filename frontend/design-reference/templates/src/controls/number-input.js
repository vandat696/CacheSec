import { field } from "../core/field.js";

export function NumberInput(options = {}) {
  const instance = field(options, "input", "number");
  ["min", "max", "step"].forEach((k) => {
    if (options[k] !== undefined) instance.input[k] = String(options[k]);
  });
  instance.getValue = () =>
    instance.input.value === "" ? null : Number(instance.input.value);
  return instance;
}
