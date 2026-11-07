"use client";
import { Textarea } from "@/components/ui/forms/Textarea";
import type { CatalogItem } from "../catalog";
export function TextareaPreview({
  item,
}: {
  item: Extract<
    CatalogItem,
    {
      name: "Textarea";
    }
  >;
}) {
  return <Textarea {...item.options} />;
}
