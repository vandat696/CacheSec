import { field } from "../core/field.js";

export const TextInput = (options) =>
  field(options, "input", options?.type || "text");
