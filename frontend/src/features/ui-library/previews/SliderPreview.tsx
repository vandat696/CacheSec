"use client";
import { useState } from "react";
import { Slider } from "@/components/ui/forms/Slider";
import type { CatalogItem } from "../catalog";
export function SliderPreview({
  item,
}: {
  item: Extract<
    CatalogItem,
    {
      name: "Slider";
    }
  >;
}) {
  const [temperature, setTemperature] = useState(0.7);
  return (
    <Slider {...item.options} value={temperature} onChange={setTemperature} />
  );
}
