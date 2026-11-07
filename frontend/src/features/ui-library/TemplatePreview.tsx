"use client";
import type { CatalogItem } from "./catalog";
import { ButtonPreview } from "./previews/ButtonPreview";
import { TextInputPreview } from "./previews/TextInputPreview";
import { TextareaPreview } from "./previews/TextareaPreview";
import { SelectPreview } from "./previews/SelectPreview";
import { NumberInputPreview } from "./previews/NumberInputPreview";
import { SliderPreview } from "./previews/SliderPreview";
import { CheckboxPreview } from "./previews/CheckboxPreview";
import { SwitchPreview } from "./previews/SwitchPreview";
import { TabsPreview } from "./previews/TabsPreview";
import { DropdownPreview } from "./previews/DropdownPreview";
import { BadgePreview } from "./previews/BadgePreview";
import { AlertPreview } from "./previews/AlertPreview";
import { DialogPreview } from "./previews/DialogPreview";
import { ToastPreview } from "./previews/ToastPreview";
import { StatCardPreview } from "./previews/StatCardPreview";
import { ProgressBarPreview } from "./previews/ProgressBarPreview";
import { DataTablePreview } from "./previews/DataTablePreview";
import { LineChartPreview } from "./previews/LineChartPreview";
import { BarChartPreview } from "./previews/BarChartPreview";
import { DonutChartPreview } from "./previews/DonutChartPreview";
import { FlowDiagramPreview } from "./previews/FlowDiagramPreview";
export function TemplatePreview({ item }: { item: CatalogItem }) {
  switch (item.name) {
    case "Button":
      return <ButtonPreview item={item} />;
    case "TextInput":
      return <TextInputPreview item={item} />;
    case "Textarea":
      return <TextareaPreview item={item} />;
    case "Select":
      return <SelectPreview item={item} />;
    case "NumberInput":
      return <NumberInputPreview item={item} />;
    case "Slider":
      return <SliderPreview item={item} />;
    case "Checkbox":
      return <CheckboxPreview item={item} />;
    case "Switch":
      return <SwitchPreview item={item} />;
    case "Tabs":
      return <TabsPreview item={item} />;
    case "Dropdown":
      return <DropdownPreview item={item} />;
    case "Badge":
      return <BadgePreview item={item} />;
    case "Alert":
      return <AlertPreview item={item} />;
    case "Dialog":
      return <DialogPreview item={item} />;
    case "Toast":
      return <ToastPreview item={item} />;
    case "StatCard":
      return <StatCardPreview item={item} />;
    case "ProgressBar":
      return <ProgressBarPreview item={item} />;
    case "DataTable":
      return <DataTablePreview item={item} />;
    case "LineChart":
      return <LineChartPreview item={item} />;
    case "BarChart":
      return <BarChartPreview item={item} />;
    case "DonutChart":
      return <DonutChartPreview item={item} />;
    case "FlowDiagram":
      return <FlowDiagramPreview item={item} />;
  }
}
