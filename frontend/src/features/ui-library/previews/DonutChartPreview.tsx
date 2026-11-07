"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DonutChart } from "@/components/ui/charts/DonutChart";
import type { CatalogItem } from "../catalog";
export function DonutChartPreview({
  item,
}: {
  item: Extract<
    CatalogItem,
    {
      name: "DonutChart";
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
      <DonutChart {...item.options} data={empty ? [] : item.options.data} />
      {toggleData}
    </>
  );
}
