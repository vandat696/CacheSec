import type { ReactNode } from "react";
import { LocalWorkbench } from "@/features/workbench/LocalWorkbench";

export default function WorkbenchLayout({ children }: { children: ReactNode }) {
  return <LocalWorkbench>{children}</LocalWorkbench>;
}
