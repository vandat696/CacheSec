"use client";

import { Button } from "@/components/ui/Button";
import type { QuotationValidation } from "./quotationModel";

export function QuotationValidationPanel({ result, busy, validating, onValidate }: {
  result: QuotationValidation | null;
  busy: boolean;
  validating: boolean;
  onValidate: () => void;
}) {
  return (
    <div className="quotation-validation">
      <Button id="quotation-validate" variant="secondary" disabled={busy} loading={validating}
        loadingLabel="Đang kiểm tra…" onClick={onValidate}>Kiểm tra báo giá</Button>
      {result && <div role="status" data-quotation-validation={result.quotation_id}>
        <p className="quotation-note">{result.evaluated_rules.length === 0
          ? "Chưa áp dụng quy tắc nghiệp vụ."
          : `Đã chạy ${result.evaluated_rules.length} quy tắc.`}</p>
        {result.flags.length > 0 && <ul>{result.flags.map((flag, index) => (
          <li key={`${flag.code}-${flag.field}-${index}`}>{flag.message}</li>
        ))}</ul>}
        {result.evaluated_rules.length > 0 && result.flags.length === 0 && <p>Không phát sinh cờ từ các quy tắc đã chạy.</p>}
      </div>}
    </div>
  );
}
