"use client";
import { StatCard } from "@/components/ui/data/StatCard";
import type { CatalogItem } from "../catalog";
export function StatCardPreview({
  item,
}: {
  item: Extract<
    CatalogItem,
    {
      name: "StatCard";
    }
  >;
}) {
  return <StatCard {...item.options} />;
}
