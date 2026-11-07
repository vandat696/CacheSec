"use client";
import { useState } from "react";
import { Switch } from "@/components/ui/forms/Switch";
import type { CatalogItem } from "../catalog";
export function SwitchPreview({
  item,
}: {
  item: Extract<
    CatalogItem,
    {
      name: "Switch";
    }
  >;
}) {
  const [checked, setChecked] = useState(true);
  return <Switch {...item.options} checked={checked} onChange={setChecked} />;
}
