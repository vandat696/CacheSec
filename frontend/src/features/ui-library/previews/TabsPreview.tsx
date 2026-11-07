"use client";
import { Tabs } from "@/components/ui/navigation/Tabs";
import type { CatalogItem } from "../catalog";
export function TabsPreview({
  item,
}: {
  item: Extract<
    CatalogItem,
    {
      name: "Tabs";
    }
  >;
}) {
  return <Tabs {...item.options} />;
}
