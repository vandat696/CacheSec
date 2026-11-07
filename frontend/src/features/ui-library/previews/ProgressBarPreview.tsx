"use client";
import { ProgressBar } from "@/components/ui/data/ProgressBar";
import type { CatalogItem } from "../catalog";
export function ProgressBarPreview({
  item,
}: {
  item: Extract<
    CatalogItem,
    {
      name: "ProgressBar";
    }
  >;
}) {
  return <ProgressBar {...item.options} />;
}
