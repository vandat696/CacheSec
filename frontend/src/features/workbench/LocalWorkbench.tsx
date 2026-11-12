"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DeveloperWorkspace } from "../developer/DeveloperWorkspace";
import { QuotationWorkspace } from "../quotations/QuotationWorkspace";
import { localSessionEnded } from "../local-workspace/localWorkspaceClient";
import { readViewReference, viewReferenceChanged, writeViewReference } from "./viewReferences";

/** One mounted session for the two development views; no credentials or source in browser storage. */
export function LocalWorkbench({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const references = useRef<{ proposal: string | null; quotation: string | null }>({ proposal: null, quotation: null });
  useEffect(() => {
    references.current = { proposal: readViewReference("proposal"), quotation: readViewReference("quotation") };
    const remember = (event: Event) => {
      const { view, value } = (event as CustomEvent<{ view?: unknown; value?: unknown }>).detail ?? {};
      if ((view === "proposal" || view === "quotation") && (value === null || typeof value === "string")) {
        references.current[view] = value;
      }
    };
    const clear = () => {
      references.current = { proposal: null, quotation: null };
      writeViewReference("proposal", null); writeViewReference("quotation", null);
    };
    window.addEventListener(viewReferenceChanged, remember); window.addEventListener(localSessionEnded, clear);
    return () => { window.removeEventListener(viewReferenceChanged, remember); window.removeEventListener(localSessionEnded, clear); };
  }, []);
  useEffect(() => {
    // Keep both authorized resource references in the URL so reloading either view can resume both.
    writeViewReference("proposal", references.current.proposal);
    writeViewReference("quotation", references.current.quotation);
  }, [pathname]);
  return <>
    <div hidden={pathname !== "/workspace"} data-workbench-view="workspace"><DeveloperWorkspace /></div>
    <div hidden={pathname !== "/quotations"} data-workbench-view="quotations"><QuotationWorkspace /></div>
    {children}
  </>;
}
