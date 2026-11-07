"use client";
import { Select } from "@/components/ui/forms/Select";
import type { CatalogItem } from "../catalog";
export function SelectPreview({
  item,
}: {
  item: Extract<
    CatalogItem,
    {
      name: "Select";
    }
  >;
}) {
  {
    const { value, ...options } = item.options;
    return <Select {...options} defaultValue={value} />;
  }
}
