"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LineChart, BarChart, DonutChart } from "@/components/ui/charts";
import {
  DataTable,
  FlowDiagram,
  ProgressBar,
  StatCard,
} from "@/components/ui/data-display";
import { Alert, Badge, Dialog, useToast } from "@/components/ui/feedback";
import {
  Checkbox,
  NumberInput,
  Select,
  Slider,
  Switch,
  Textarea,
  TextInput,
} from "@/components/ui/fields";
import { Dropdown, Tabs } from "@/components/ui/navigation";
import type { CatalogItem } from "./catalog-data";

export function TemplatePreview({ item }: { item: CatalogItem }) {
  const [checked, setChecked] = useState(true);
  const [temperature, setTemperature] = useState(0.7);
  const [selectedNode, setSelectedNode] = useState("input");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showToast = useToast();
  useEffect(() => () => clearTimeout(timer.current), []);
  const toggleData = (
    <Button variant="tertiary" onClick={() => setEmpty(!empty)}>
      {empty ? "Khôi phục dữ liệu mẫu" : "Thử dữ liệu rỗng"}
    </Button>
  );

  switch (item.name) {
    case "Button":
      return (
        <>
          <Button onClick={() => showToast("Button: onClick được gọi")}>
            {item.options.label}
          </Button>
          {(["secondary", "tertiary", "danger"] as const).map((variant) => (
            <Button
              key={variant}
              variant={variant}
              onClick={() => showToast(`Button / ${variant}`)}
            >
              {variant}
            </Button>
          ))}
          <Button disabled>Disabled</Button>
          <Button
            variant="secondary"
            loading={loading}
            onClick={() => {
              setLoading(true);
              timer.current = setTimeout(() => setLoading(false), 900);
            }}
          >
            Thử loading
          </Button>
        </>
      );
    case "TextInput":
      return <TextInput {...item.options} />;
    case "Textarea":
      return <Textarea {...item.options} />;
    case "Select": {
      const { value, ...options } = item.options;
      return <Select {...options} defaultValue={value} />;
    }
    case "NumberInput": {
      const { value, ...options } = item.options;
      return <NumberInput {...options} defaultValue={value} />;
    }
    case "Slider":
      return (
        <Slider
          {...item.options}
          value={temperature}
          onChange={setTemperature}
        />
      );
    case "Checkbox":
      return (
        <Checkbox
          label={item.options.label}
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
        />
      );
    case "Switch":
      return (
        <Switch {...item.options} checked={checked} onChange={setChecked} />
      );
    case "Tabs":
      return <Tabs {...item.options} />;
    case "Dropdown":
      return (
        <Dropdown
          {...item.options}
          onSelect={(value) => showToast(`onSelect: ${value}`)}
        />
      );
    case "Badge":
      return (
        <>
          {(["success", "primary", "neutral", "danger"] as const).map(
            (tone) => (
              <Badge key={tone} tone={tone}>
                {tone === "success" ? item.options.label : tone}
              </Badge>
            ),
          )}
        </>
      );
    case "Alert":
      return (
        <Alert title={item.options.title}>{item.options.description}</Alert>
      );
    case "Dialog":
      return (
        <>
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>
            Mở Dialog
          </Button>
          <Dialog
            open={dialogOpen}
            title={item.options.title}
            confirmLabel={item.options.confirmLabel}
            onClose={() => setDialogOpen(false)}
            onConfirm={() => showToast("Dialog: onConfirm được gọi")}
          >
            {item.options.description}
          </Dialog>
        </>
      );
    case "Toast":
      return (
        <Button
          variant="secondary"
          onClick={() => showToast(item.options.message)}
        >
          Hiển thị Toast
        </Button>
      );
    case "StatCard":
      return <StatCard {...item.options} />;
    case "ProgressBar":
      return <ProgressBar {...item.options} />;
    case "DataTable":
      return (
        <>
          <DataTable {...item.options} rows={empty ? [] : item.options.rows} />
          {toggleData}
        </>
      );
    case "LineChart":
      return (
        <>
          <LineChart {...item.options} data={empty ? [] : item.options.data} />
          {toggleData}
        </>
      );
    case "BarChart":
      return (
        <>
          <BarChart {...item.options} data={empty ? [] : item.options.data} />
          {toggleData}
        </>
      );
    case "DonutChart":
      return (
        <>
          <DonutChart {...item.options} data={empty ? [] : item.options.data} />
          {toggleData}
        </>
      );
    case "FlowDiagram":
      return (
        <FlowDiagram
          {...item.options}
          selectedId={selectedNode}
          onSelect={setSelectedNode}
        />
      );
  }
}
