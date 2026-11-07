"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { BarChart } from "@/components/ui/charts/BarChart";
import type { CatalogItem } from "../catalog";
export function BarChartPreview({
  item,
}: {
  item: Extract<
    CatalogItem,
    {
      name: "BarChart";
    }
  >;
}) {
  const [empty, setEmpty] = useState(false);
  const toggleData = (
    <Button variant="tertiary" onClick={() => setEmpty(!empty)}>
      {empty ? "Khôi phục dữ liệu mẫu" : "Thử dữ liệu rỗng"}
    </Button>
  );
  return (
    <>
      <BarChart {...item.options} data={empty ? [] : item.options.data} />
      {toggleData}
    </>
  );
}
