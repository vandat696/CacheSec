"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/data/DataTable";
import type { CatalogItem } from "../catalog";
export function DataTablePreview({
  item,
}: {
  item: Extract<
    CatalogItem,
    {
      name: "DataTable";
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
      <DataTable {...item.options} rows={empty ? [] : item.options.rows} />
      {toggleData}
    </>
  );
}
