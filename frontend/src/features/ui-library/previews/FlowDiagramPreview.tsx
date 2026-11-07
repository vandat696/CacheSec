"use client";
import { useState } from "react";
import { FlowDiagram } from "@/components/ui/diagrams/FlowDiagram";
import type { CatalogItem } from "../catalog";
export function FlowDiagramPreview({
  item,
}: {
  item: Extract<
    CatalogItem,
    {
      name: "FlowDiagram";
    }
  >;
}) {
  const [selectedNode, setSelectedNode] = useState("input");
  return (
    <FlowDiagram
      {...item.options}
      selectedId={selectedNode}
      onSelect={setSelectedNode}
    />
  );
}
