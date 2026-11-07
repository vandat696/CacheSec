import { buttonTemplate } from "./button";
import { textInputTemplate } from "./textInput";
import { textareaTemplate } from "./textarea";
import { selectTemplate } from "./select";
import { numberInputTemplate } from "./numberInput";
import { sliderTemplate } from "./slider";
import { checkboxTemplate } from "./checkbox";
import { switchTemplate } from "./switch";
import { tabsTemplate } from "./tabs";
import { dropdownTemplate } from "./dropdown";
import { badgeTemplate } from "./badge";
import { alertTemplate } from "./alert";
import { dialogTemplate } from "./dialog";
import { toastTemplate } from "./toast";
import { statCardTemplate } from "./statCard";
import { progressBarTemplate } from "./progressBar";
import { dataTableTemplate } from "./dataTable";
import { lineChartTemplate } from "./lineChart";
import { barChartTemplate } from "./barChart";
import { donutChartTemplate } from "./donutChart";
import { flowDiagramTemplate } from "./flowDiagram";
export const catalogItems = [
  buttonTemplate,
  textInputTemplate,
  textareaTemplate,
  selectTemplate,
  numberInputTemplate,
  sliderTemplate,
  checkboxTemplate,
  switchTemplate,
  tabsTemplate,
  dropdownTemplate,
  badgeTemplate,
  alertTemplate,
  dialogTemplate,
  toastTemplate,
  statCardTemplate,
  progressBarTemplate,
  dataTableTemplate,
  lineChartTemplate,
  barChartTemplate,
  donutChartTemplate,
  flowDiagramTemplate,
] as const;
export type CatalogItem = (typeof catalogItems)[number];
export type TemplateName = CatalogItem["name"];
