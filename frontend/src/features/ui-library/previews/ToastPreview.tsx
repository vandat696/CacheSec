"use client";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/feedback/ToastProvider";
import type { CatalogItem } from "../catalog";
export function ToastPreview({
  item,
}: {
  item: Extract<
    CatalogItem,
    {
      name: "Toast";
    }
  >;
}) {
  const showToast = useToast();
  return (
    <Button variant="secondary" onClick={() => showToast(item.options.message)}>
      Hiển thị Toast
    </Button>
  );
}
