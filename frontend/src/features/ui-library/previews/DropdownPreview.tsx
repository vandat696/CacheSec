"use client";
import { useToast } from "@/components/ui/feedback/ToastProvider";
import { Dropdown } from "@/components/ui/navigation/Dropdown";
import type { CatalogItem } from "../catalog";
export function DropdownPreview({
  item,
}: {
  item: Extract<
    CatalogItem,
    {
      name: "Dropdown";
    }
  >;
}) {
  const showToast = useToast();
  return (
    <Dropdown
      {...item.options}
      onSelect={(value) => showToast(`onSelect: ${value}`)}
    />
  );
}
