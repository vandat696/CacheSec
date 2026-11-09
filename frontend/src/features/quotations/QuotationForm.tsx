"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/forms/TextInput";
import { Textarea } from "@/components/ui/forms/Textarea";
import { Select } from "@/components/ui/forms/Select";
import { emptyQuotationDraft, quotationFromDraft, type QuotationCreate, type ExpirationMode } from "./quotationModel";
import type { CreationResult } from "./useQuotations";

export function QuotationForm({ busy, onCreate }: {
  busy: boolean;
  onCreate: (data: QuotationCreate, key: string) => Promise<CreationResult>;
}) {
  const [draft, setDraft] = useState(emptyQuotationDraft);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const pending = useRef<{ data: QuotationCreate; key: string } | null>(null);
  const sending = useRef(false);
  const blocked = busy || uncertain;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending.current) return;
    setError(""); setNotice("");
    if (!pending.current) {
      try { pending.current = { data: quotationFromDraft(draft), key: crypto.randomUUID() }; }
      catch (error) { setError(error instanceof Error ? error.message : "Không thể tạo dữ liệu gửi."); return; }
    }
    sending.current = true;
    try {
      const result = await onCreate(pending.current.data, pending.current.key);
      setUncertain(result.uncertain);
      if (result.saved) { setDraft(emptyQuotationDraft()); setNotice("Đã lưu báo giá."); }
      if (!result.uncertain) pending.current = null;
    } finally { sending.current = false; }
  }

  return (
    <form className="quotation-form" onSubmit={submit} aria-labelledby="quotation-create-title">
      <h2 id="quotation-create-title">Thêm báo giá</h2>
      <fieldset disabled={blocked}>
        <TextInput id="quotation-supplier" label="Nhà cung cấp" value={draft.supplier}
          onChange={(event) => setDraft({ ...draft, supplier: event.target.value })} />
        <Textarea id="quotation-description" label="Mô tả" rows={2} value={draft.description}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
        <div className="quotation-amount-row">
          <TextInput id="quotation-amount" label="Tổng tiền" inputMode="decimal" value={draft.amount} required
            onChange={(event) => setDraft({ ...draft, amount: event.target.value })} />
          <TextInput id="quotation-currency" label="Tiền tệ" value={draft.currency}
            onChange={(event) => setDraft({ ...draft, currency: event.target.value })} />
        </div>
        <Select id="quotation-expiration-mode" label="Ngày hết hạn" value={draft.expirationMode}
          options={[
            { value: "missing", label: "Không gửi trường" },
            { value: "text", label: "Nhập chuỗi ngày" },
            { value: "null", label: "null" },
            { value: "json", label: "JSON thô" },
          ]}
          onChange={(event) => setDraft({ ...draft, expirationMode: event.target.value as ExpirationMode, expiration: "" })} />
        {draft.expirationMode === "text" && <TextInput id="quotation-expiration" label="Giá trị ngày" placeholder="YYYY-MM-DD" value={draft.expiration}
          onChange={(event) => setDraft({ ...draft, expiration: event.target.value })} />}
        {draft.expirationMode === "json" && <Textarea id="quotation-expiration-json" label="Giá trị JSON" rows={2} value={draft.expiration}
          onChange={(event) => setDraft({ ...draft, expiration: event.target.value })} />}
      </fieldset>
      <p className="quotation-note">Chưa kiểm tra ngày hết hạn.</p>
      {error && <p className="quotation-error" role="alert">{error}</p>}
      {uncertain && <p className="quotation-error" role="alert">Chưa rõ kết quả. Thử lại cùng lần gửi trước khi tạo báo giá khác.</p>}
      <Button id="quotation-save" type="submit" disabled={busy} loading={busy} loadingLabel="Đang xử lý…">{uncertain ? "Thử lại lần gửi" : "Lưu báo giá"}</Button>
      <p className="quotation-notice" role="status">{notice}</p>
    </form>
  );
}
