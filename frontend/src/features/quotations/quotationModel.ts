export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type QuotationCreate = {
  supplier_name: string;
  description: string;
  total_amount: string;
  currency: string;
  expires_on?: JsonValue;
};

export type QuotationRecord = QuotationCreate & { id: string };
export type QuotationPage = { items: QuotationRecord[]; next_cursor: string | null };
export type QuotationFlag = { code: string; field: string; message: string };
export type QuotationValidation = {
  quotation_id: string;
  flags: QuotationFlag[];
  evaluated_rules: string[];
  validation_config_ref: string;
  reference_date: null;
  active_artifact: null;
};
export type ExpirationMode = "text" | "missing" | "null" | "json";
export type QuotationDraft = {
  supplier: string;
  description: string;
  amount: string;
  currency: string;
  expiration: string;
  expirationMode: ExpirationMode;
};

export const decimalPattern = /^[+-]?[0-9]+(\.[0-9]+)?$/;
export const emptyQuotationDraft = (): QuotationDraft => ({
  supplier: "", description: "", amount: "", currency: "VND",
  expiration: "", expirationMode: "missing",
});

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return typeof value === "object" && Object.values(value).every(isJsonValue);
}

export function quotationFromDraft(draft: QuotationDraft): QuotationCreate {
  if (!decimalPattern.test(draft.amount)) throw new Error("Tổng tiền phải là chuỗi thập phân, ví dụ 1000000.00.");
  const data: QuotationCreate = {
    supplier_name: draft.supplier, description: draft.description,
    total_amount: draft.amount, currency: draft.currency,
  };
  if (draft.expirationMode === "text") data.expires_on = draft.expiration;
  if (draft.expirationMode === "null") data.expires_on = null;
  if (draft.expirationMode === "json") {
    let raw: unknown;
    try { raw = JSON.parse(draft.expiration); }
    catch { throw new Error("Giá trị ngày phải là JSON hợp lệ."); }
    if (!isJsonValue(raw)) throw new Error("JSON phải chứa giá trị hữu hạn.");
    data.expires_on = raw;
  }
  if (new TextEncoder().encode(JSON.stringify(data)).length > 65536) {
    throw new Error("Nội dung vượt giới hạn 64 KiB.");
  }
  return data;
}

export function expirationLabel(record: QuotationRecord): string {
  if (!Object.hasOwn(record, "expires_on")) return "Không có trường";
  return JSON.stringify(record.expires_on);
}
