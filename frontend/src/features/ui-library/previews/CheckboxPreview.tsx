"use client";
import { useState } from "react";
import { Checkbox } from "@/components/ui/forms/Checkbox";
import type { CatalogItem } from "../catalog";
export function CheckboxPreview({
  item,
}: {
  item: Extract<
    CatalogItem,
    {
      name: "Checkbox";
    }
  >;
}) {
  const [checked, setChecked] = useState(true);
  return (
    <Checkbox
      label={item.options.label}
      checked={checked}
      onChange={(event) => setChecked(event.target.checked)}
    />
  );
}
