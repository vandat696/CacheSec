"use client";
import { Badge } from "@/components/ui/feedback/Badge";
import type { CatalogItem } from "../catalog";
export function BadgePreview({
  item,
}: {
  item: Extract<
    CatalogItem,
    {
      name: "Badge";
    }
  >;
}) {
  return (
    <>
      {(["success", "primary", "neutral", "danger"] as const).map((tone) => (
        <Badge key={tone} tone={tone}>
          {tone === "success" ? item.options.label : tone}
        </Badge>
      ))}
    </>
  );
}
