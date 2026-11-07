"use client";
import { TextInput } from "@/components/ui/forms/TextInput";
import type { CatalogItem } from "../catalog";
export function TextInputPreview({
  item,
}: {
  item: Extract<
    CatalogItem,
    {
      name: "TextInput";
    }
  >;
}) {
  return <TextInput {...item.options} />;
}
