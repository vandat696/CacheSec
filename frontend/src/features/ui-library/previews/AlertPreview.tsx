"use client";
import { Alert } from "@/components/ui/feedback/Alert";
import type { CatalogItem } from "../catalog";
export function AlertPreview({
  item,
}: {
  item: Extract<
    CatalogItem,
    {
      name: "Alert";
    }
  >;
}) {
  return <Alert title={item.options.title}>{item.options.description}</Alert>;
}
