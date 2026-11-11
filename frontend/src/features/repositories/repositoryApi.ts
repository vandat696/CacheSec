export type Repository = {
  tenant_id: string; repo_id: string; repository_identity: string; authority_epoch: number;
};
export type SnapshotFile = { file_id: string; path: string; digest: string; byte_size: number };
export type RepositorySnapshot = {
  snapshot_id: string; repository_identity: string; source_profile_digest: string;
  manifest_digest: string; files: SnapshotFile[];
};
type Fetch = typeof globalThis.fetch;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const digest = /^sha256:[0-9a-f]{64}$/;
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const id = (value: unknown): value is string => typeof value === "string" && uuid.test(value);
const hash = (value: unknown): value is string => typeof value === "string" && digest.test(value);

export class RepositoryApiError extends Error {
  readonly status: number;
  readonly requestId?: string;
  readonly code?: string;
  constructor(status: number, requestId?: string, code?: string) {
    super(code === "SOURCE_NOT_CONFIGURED" ? "Backend chưa cấu hình nguồn repository." : ({
      400: "Yêu cầu không đúng định dạng.", 401: "Token không hợp lệ hoặc đã bị thu hồi.",
      403: "Danh tính này không có quyền đọc repository.",
      404: "Snapshot hoặc nguồn không còn khả dụng trong phạm vi hiện tại.",
      409: "Source thay đổi khi chụp. Hãy tạo snapshot lại.",
      413: "Source vượt giới hạn cấu hình.",
      503: "Chưa xác minh được quyền, nguồn hoặc dữ liệu snapshot.",
    } as Record<number, string>)[status] ?? "API trả dữ liệu snapshot không hợp lệ.");
    this.status = status; this.requestId = requestId; this.code = code;
  }
}

function repository(value: unknown): value is Repository {
  return object(value) && id(value.tenant_id) && id(value.repo_id)
    && typeof value.repository_identity === "string" && value.repository_identity.length > 0
    && Number.isSafeInteger(value.authority_epoch) && (value.authority_epoch as number) > 0;
}
function snapshot(value: unknown): value is RepositorySnapshot {
  if (!object(value) || !id(value.snapshot_id) || typeof value.repository_identity !== "string"
    || !hash(value.source_profile_digest) || !hash(value.manifest_digest)
    || !Array.isArray(value.files) || !value.files.length || value.files.length > 256) return false;
  const paths = new Set<string>(), ids = new Set<string>();
  let total = 0;
  for (const file of value.files) {
    if (!object(file) || !id(file.file_id) || !hash(file.digest) || typeof file.path !== "string"
      || !file.path || file.path.startsWith("/") || file.path.split("/").some((part) =>
        !/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(part) || part === "..")
      || !Number.isSafeInteger(file.byte_size) || (file.byte_size as number) < 0
      || (file.byte_size as number) > 1048576
      || paths.has(file.path.toLowerCase()) || ids.has(file.file_id.toLowerCase())) return false;
    paths.add(file.path.toLowerCase()); ids.add(file.file_id.toLowerCase());
    total += file.byte_size as number;
  }
  return total <= 20971520;
}

export class RepositoryHttpClient {
  private readonly fetcher: Fetch;
  private readonly baseUrl: string;
  private readonly token: string;
  constructor(baseUrl: string, token: string,
    fetcher: Fetch = globalThis.fetch) {
    this.baseUrl = baseUrl; this.token = token;
    this.fetcher = (input, init) => fetcher(input, init);
  }

  private async request<T>(path: string, signal: AbortSignal,
    decode: (value: unknown) => value is T, post = false): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl.replace(/\/$/, "")}/api/v1/repository${path}`, {
      method: post ? "POST" : "GET", signal, credentials: "omit", cache: "no-store", redirect: "error",
      headers: { Authorization: `Bearer ${this.token}` },
    });
    const body: unknown = await response.json().catch(() => null);
    const requestId = object(body) && object(body.meta) && id(body.meta.request_id)
      ? body.meta.request_id : undefined;
    if (!response.ok) throw new RepositoryApiError(response.status, requestId,
      object(body) && object(body.error) && typeof body.error.code === "string" ? body.error.code : undefined);
    if (!object(body) || !object(body.meta) || body.meta.contract_version !== "v0.2"
      || body.meta.identity_mode !== "fixture" || !requestId || !decode(body.data)) {
      throw new RepositoryApiError(502, requestId);
    }
    return body.data;
  }

  describe(signal: AbortSignal) { return this.request("", signal, repository); }
  capture(signal: AbortSignal) { return this.request("/snapshots", signal, snapshot, true); }
  async get(snapshotId: string, signal: AbortSignal) {
    if (!id(snapshotId)) throw new RepositoryApiError(400);
    const result = await this.request(`/snapshots/${snapshotId}`, signal, snapshot);
    if (result.snapshot_id.toLowerCase() !== snapshotId.toLowerCase()) throw new RepositoryApiError(502);
    return result;
  }
  async readFile(snapshotId: string, file: SnapshotFile, signal: AbortSignal): Promise<Uint8Array> {
    if (!id(snapshotId) || !id(file.file_id)) throw new RepositoryApiError(400);
    const value = await this.request(`/snapshots/${snapshotId}/files/${file.file_id}`, signal,
      (data): data is { snapshot_id: string; file_id: string; encoding: "base64"; content: string } =>
        object(data) && data.snapshot_id === snapshotId && data.file_id === file.file_id
        && data.encoding === "base64" && typeof data.content === "string"
        && data.content.length <= 4 * Math.ceil(file.byte_size / 3)
        && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data.content));
    const bytes = Uint8Array.from(atob(value.content), (char) => char.charCodeAt(0));
    const actual = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    const actualDigest = "sha256:" + Array.from(actual, (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (bytes.byteLength !== file.byte_size || actualDigest !== file.digest) throw new RepositoryApiError(502);
    return bytes;
  }
}

export function sourceText(bytes: Uint8Array): string | null {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    // Normalize line breaks for display only; hashes and transport use the original bytes.
    return /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text) ? null : text.replace(/\r\n?/g, "\n");
  } catch { return null; }
}
