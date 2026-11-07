export const simple = (module: string, name: string, jsx: string) =>
  `import { ${name} } from "@/components/ui/${module}";\n\nexport function Example() {\n  return (${jsx});\n}`;
export const controlled = (
  module: string,
  name: string,
  state: string,
  jsx: string,
) =>
  `"use client";\n\nimport { useState } from "react";\nimport { ${name} } from "@/components/ui/${module}";\n\nexport function Example() {\n  ${state}\n  return (${jsx});\n}`;
