"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { LineChart } from "@/components/ui/charts/LineChart";
import type { CatalogItem } from "../catalog";
export function LineChartPreview({
  item,
}: {
  item: Extract<
    CatalogItem,
    {
      name: "LineChart";
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
      <LineChart {...item.options} data={empty ? [] : item.options.data} />
      {toggleData}
    </>
  );
}
