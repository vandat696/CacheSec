import { catalogItems, type TemplateName } from "./catalog";
export const catalogExamples = Object.fromEntries(
  catalogItems.map((item) => [item.name, item.example]),
) as Record<TemplateName, string>;
