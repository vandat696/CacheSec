"use client";
import { NumberInput } from "@/components/ui/forms/NumberInput";
import type { CatalogItem } from "../catalog";
export function NumberInputPreview({
  item,
}: {
  item: Extract<
    CatalogItem,
    {
      name: "NumberInput";
    }
  >;
}) {
  {
    const { value, ...options } = item.options;
    return <NumberInput {...options} defaultValue={value} />;
  }
}
