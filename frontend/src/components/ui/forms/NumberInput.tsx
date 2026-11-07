"use client";
import type { TextInputProps } from "./TextInput";
import { TextInput } from "./TextInput";
export function NumberInput(props: Omit<TextInputProps, "type">) {
  return <TextInput {...props} type="number" />;
}
