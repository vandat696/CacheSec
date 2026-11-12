"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { writeViewReference } from "../workbench/viewReferences";
import { PageHeading } from "@/components/layout/PageHeading";
import { Button } from "@/components/ui/Button";
import { QuotationConnection } from "./QuotationConnection";
import { QuotationForm } from "./QuotationForm";
import { QuotationList } from "./QuotationList";
import { QuotationDetails } from "./QuotationDetails";
import { useQuotations } from "./useQuotations";

export function QuotationWorkspace() {
  const quotation = useQuotations();
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === "/quotations" && quotation.connected && quotation.selected) writeViewReference("quotation", quotation.selected.id);
  }, [pathname, quotation.connected, quotation.selected]);
  const busy = quotation.busy !== null;
  return (
    <div className="content-page quotation-workspace" data-connected={quotation.connected}>
      <PageHeading title="Báo giá" action={quotation.connected
        ? <Button id="quotation-disconnect" variant="tertiary" onClick={quotation.disconnect}>Ngắt kết nối</Button>
        : <span className="quotation-note">Identity fixture · PoC</span>} />
      {quotation.error && <div className="quotation-error" role="alert">
        <p>{quotation.error}</p>
        {quotation.requestId && <small>Mã yêu cầu: {quotation.requestId}</small>}
      </div>}
      {!quotation.connected ? <QuotationConnection busy={busy} onConnect={quotation.connect} /> : (
        <div className="quotation-layout">
          <QuotationForm busy={busy} onCreate={quotation.create} />
          <div className="quotation-records">
            {quotation.busy === "detail" && <p role="status">Đang tải chi tiết…</p>}
            {quotation.selected && <QuotationDetails record={quotation.selected} validation={quotation.validation}
              busy={busy} validating={quotation.busy === "validate"} onValidate={quotation.validate} />}
            <QuotationList items={quotation.items} busy={busy} hasMore={quotation.cursor !== null}
              unavailable={quotation.listUnavailable}
              selectedId={quotation.selected?.id} onSelect={quotation.select}
              onMore={() => quotation.load(true)} onRefresh={() => quotation.load()} />
          </div>
        </div>
      )}
    </div>
  );
}
