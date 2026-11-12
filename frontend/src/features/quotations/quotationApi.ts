import {
  decimalPattern, isJsonValue,
  type QuotationCreate, type QuotationPage, type QuotationRecord, type QuotationValidation,
} from "./quotationModel.ts";

type ApiMeta = { contract_version: "v0.2"; request_id: string; identity_mode: "fixture" };
type Envelope<T> = { data: T; meta: ApiMeta };
type Fetch = typeof globalThis.fetch;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class QuotationApiError extends Error {
  readonly status: number;
  readonly requestId?: string;
  constructor(status: number, requestId?: string) {
    super(({
      400: "Dữ liệu gửi không đúng định dạng.",
      401: "Token không hợp lệ hoặc đã bị thu hồi.",
      403: "Danh tính này không có quyền thực hiện thao tác.",
      404: "Không tìm thấy báo giá.",
      409: "Lần gửi này đã dùng cho dữ liệu khác.",
      413: "Nội dung vượt giới hạn của API.",
      503: "API chưa truy cập được dữ liệu hoặc dịch vụ quyền.",
    } as Record<number, string>)[status] ?? "Chưa nhận được kết quả hợp lệ từ API.");
    this.status = status;
    this.requestId = requestId;
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function record(value: unknown): value is QuotationRecord {
  return object(value) && typeof value.id === "string" && uuid.test(value.id)
    && typeof value.supplier_name === "string" && typeof value.description === "string"
    && typeof value.total_amount === "string" && decimalPattern.test(value.total_amount)
    && typeof value.currency === "string"
    && (!Object.hasOwn(value, "expires_on") || isJsonValue(value.expires_on));
}
function page(value: unknown): value is QuotationPage {
  return object(value) && Array.isArray(value.items) && value.items.every(record)
    && (value.next_cursor === null || (typeof value.next_cursor === "string" && uuid.test(value.next_cursor)));
}
function validation(value: unknown): value is QuotationValidation {
  return object(value) && typeof value.quotation_id === "string" && uuid.test(value.quotation_id)
    && Array.isArray(value.flags) && value.flags.every((flag) => object(flag)
      && typeof flag.code === "string" && typeof flag.field === "string" && typeof flag.message === "string")
    && Array.isArray(value.evaluated_rules) && value.evaluated_rules.every((rule) => typeof rule === "string")
    && typeof value.validation_config_ref === "string" && value.validation_config_ref.length > 0
    && value.reference_date === null && value.active_artifact === null;
}

export class QuotationHttpClient {
  private readonly baseUrl: string;
  private readonly token: string | null;
  private readonly fetcher: Fetch;
  constructor(
    baseUrl: string,
    token: string | null,
    fetcher: Fetch = globalThis.fetch,
  ) {
    if (token === null && baseUrl !== "/api/local-control") throw new Error("INVALID_LOCAL_TRANSPORT");
    this.baseUrl = baseUrl;
    this.token = token;
    // Keep native window.fetch's receiver from becoming this client instance.
    this.fetcher = (input, init) => fetcher(input, init);
  }

  private async request<T>(
    path: string, decode: (data: unknown) => data is T, signal: AbortSignal,
    post?: { data: QuotationCreate; key: string } | true,
  ): Promise<Envelope<T>> {
    const response = await this.fetcher(`${this.baseUrl.replace(/\/$/, "")}/api/v1/quotations${path}`, {
      method: post ? "POST" : "GET", signal, cache: "no-store", credentials: this.token === null ? "same-origin" : "omit", redirect: "error",
      headers: { ...(this.token === null ? { "X-CacheSec-Workspace": "1" } : { Authorization: `Bearer ${this.token}` }), ...(post && post !== true ? { "Content-Type": "application/json", "Idempotency-Key": post.key } : {}) },
      ...(post && post !== true ? { body: JSON.stringify(post.data) } : {}),
    });
    const body: unknown = await response.json().catch(() => null);
    const requestId = object(body) && object(body.meta) && typeof body.meta.request_id === "string"
      && uuid.test(body.meta.request_id) ? body.meta.request_id : undefined;
    if (!response.ok) throw new QuotationApiError(response.status, requestId);
    if (!object(body) || !object(body.meta) || body.meta.contract_version !== "v0.2"
      || body.meta.identity_mode !== "fixture" || !requestId || !decode(body.data)) {
      throw new QuotationApiError(502, requestId);
    }
    return body as Envelope<T>;
  }

  list(signal: AbortSignal, after?: string) {
    return this.request(after ? `?after=${encodeURIComponent(after)}` : "", page, signal);
  }
  get(id: string, signal: AbortSignal) {
    return this.request(`/${encodeURIComponent(id)}`, record, signal);
  }
  create(data: QuotationCreate, key: string, signal: AbortSignal) {
    return this.request("", record, signal, { data, key });
  }
  async validate(id: string, signal: AbortSignal) {
    const response = await this.request(`/${encodeURIComponent(id)}/validate`, validation, signal, true);
    if (response.data.quotation_id.toLowerCase() !== id.toLowerCase()) {
      throw new QuotationApiError(502, response.meta.request_id);
    }
    return response;
  }
}

export function quotationError(error: unknown): string {
  return error instanceof QuotationApiError ? error.message : "Không kết nối được API báo giá. Kiểm tra backend và cấu hình kết nối.";
}
