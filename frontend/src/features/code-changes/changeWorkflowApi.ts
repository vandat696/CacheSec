export const editablePath = "backend/app/quotation_demo/business/quotation_validation.py";
export type ChangeConfig = { editable_path: string; profile_digest: string; purpose: "technical-smoke";
  repository_identity: string; can_propose: boolean; can_test: boolean };
export type TestJob = { job_id: string; proposal_id: string; revision: number; artifact_digest: string;
  profile_digest: string; status: string; evidence_digest: string | null;
  result: { outcome: string; reason: string; elapsed_ms: number;
    checks: { name: string; passed: boolean }[] } | null };
export type Revision = { proposal_id: string; revision: number; base_snapshot_id: string;
  candidate_snapshot_id: string; artifact_digest: string; patch_digest: string; profile_digest: string;
  created_at: string; path: string; base_text: string; content: string; diff: string; tests: TestJob[] };
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const hash = (v: unknown): v is string => typeof v === "string" && /^sha256:[0-9a-f]{64}$/.test(v);
const positive = (v: unknown) => Number.isSafeInteger(v) && (v as number) > 0;
const statuses = ["queued", "preparing", "running", "passed", "failed", "error", "timed_out", "blocked", "unknown"];
const checkNames = ["identity_required", "record_round_trip", "reader_write_denied", "idempotent_retry", "validation_contract"];
export const pendingTest = (job: TestJob) => ["queued", "preparing", "running"].includes(job.status);

export class ChangeApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;
  constructor(status: number, code?: string, requestId?: string) {
    super(({ STALE_SNAPSHOT: "Source đã đổi. Hãy tạo snapshot mới.",
      STALE_REVISION: "Revision đã đổi. Hãy mở lại bản sửa.", NO_CHANGE: "Bản sửa chưa có thay đổi.",
      IDEMPOTENCY_CONFLICT: "Yêu cầu thử lại không khớp lần trước.",
      TEST_PROFILE_CHANGED: "Profile test đã đổi. Hãy tạo bản sửa mới.",
      WORKFLOW_NOT_CONFIGURED: "Backend chưa cấu hình luồng sửa và test.",
    } as Record<string, string>)[code ?? ""] ?? ({
      401: "Phiên đã hết hiệu lực.", 403: "Bạn không có quyền thực hiện thao tác này.",
      404: "Không tìm thấy bản sửa trong repository này.",
      413: "Nội dung vượt giới hạn 64 KiB.", 503: "Chưa xác minh được cấu hình hoặc dữ liệu test.",
    } as Record<number, string>)[status] ?? "Không hoàn tất được yêu cầu. Có thể thử lại.");
    this.status = status; this.code = code; this.requestId = requestId;
  }
}

function config(v: unknown): v is ChangeConfig {
  return object(v) && v.editable_path === editablePath && hash(v.profile_digest)
    && v.purpose === "technical-smoke" && typeof v.repository_identity === "string"
    && typeof v.can_propose === "boolean" && typeof v.can_test === "boolean";
}
function job(v: unknown): v is TestJob {
  if (!object(v) || !id(v.job_id) || !id(v.proposal_id) || !positive(v.revision)
    || !hash(v.artifact_digest) || !hash(v.profile_digest) || !statuses.includes(v.status as string)
    || !(v.evidence_digest === null || hash(v.evidence_digest))) return false;
  if (v.result === null) return ["queued", "preparing", "running"].includes(v.status as string);
  const r = v.result;
  return !["queued", "preparing", "running"].includes(v.status as string)
    && object(r) && r.outcome === v.status && typeof r.reason === "string"
    && Number.isSafeInteger(r.elapsed_ms) && (r.elapsed_ms as number) >= 0
    && Array.isArray(r.checks) && r.checks.length <= 5
    && r.checks.every(c => object(c) && checkNames.includes(c.name as string) && typeof c.passed === "boolean")
    && new Set(r.checks.map(c => c.name)).size === r.checks.length
    && (v.status !== "passed" || (hash(v.evidence_digest) && r.reason === "COMPLETED"
      && JSON.stringify(r.checks.map(c => c.name)) === JSON.stringify(checkNames)
      && r.checks.every(c => c.passed)));
}
function revision(v: unknown): v is Revision {
  return object(v) && id(v.proposal_id) && positive(v.revision) && id(v.base_snapshot_id)
    && id(v.candidate_snapshot_id) && hash(v.artifact_digest) && hash(v.patch_digest)
    && hash(v.profile_digest) && typeof v.created_at === "string" && v.path === editablePath
    && typeof v.base_text === "string" && typeof v.content === "string" && typeof v.diff === "string"
    && Array.isArray(v.tests) && v.tests.every(j => job(j) && j.proposal_id === v.proposal_id);
}

export class ChangeWorkflowClient {
  private readonly baseUrl: string;
  private readonly token: string | null;
  private readonly fetcher: typeof fetch;
  constructor(baseUrl: string, token: string | null,
    fetcher: typeof fetch = (input, init) => fetch(input, init)) {
    if (token === null && baseUrl !== "/api/local-control") throw new Error("INVALID_LOCAL_TRANSPORT");
    this.baseUrl = baseUrl; this.token = token; this.fetcher = fetcher;
  }
  private async request<T>(path: string, signal: AbortSignal, decode: (v: unknown) => v is T,
    body?: unknown, key?: string): Promise<T> {
    const response = await this.fetcher(this.baseUrl.replace(/\/$/, "") + "/api/v1/changes" + path, {
      method: body === undefined ? "GET" : "POST", signal, cache: "no-store", credentials: this.token === null ? "same-origin" : "omit",
      redirect: "error", headers: { ...(this.token === null ? { "X-CacheSec-Workspace": "1" } : { Authorization: `Bearer ${this.token}` }), "Content-Type": "application/json",
        ...(key ? { "Idempotency-Key": key } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const value: unknown = await response.json().catch(() => null);
    const requestId = object(value) && object(value.meta) && id(value.meta.request_id)
      ? value.meta.request_id : undefined;
    if (!response.ok) throw new ChangeApiError(response.status,
      object(value) && object(value.error) && typeof value.error.code === "string" ? value.error.code : undefined,
      requestId);
    if (!object(value) || !object(value.meta) || value.meta.contract_version !== "v0.2"
      || value.meta.identity_mode !== "fixture" || !requestId || !decode(value.data)) throw new ChangeApiError(502);
    return value.data;
  }
  config(signal: AbortSignal) { return this.request("/config", signal, config); }
  save(snapshotId: string, content: string, previous: Revision | null, key: string, signal: AbortSignal) {
    if (!id(snapshotId) || (previous && !id(previous.proposal_id))) throw new ChangeApiError(400);
    return this.request(previous ? `/proposals/${previous.proposal_id}/revisions` : "/proposals",
      signal, revision, previous ? { expected_revision: previous.revision, content }
        : { base_snapshot_id: snapshotId, content }, key);
  }
  async open(proposalId: string, signal: AbortSignal) {
    if (!id(proposalId)) throw new ChangeApiError(400);
    const value = await this.request(`/proposals/${proposalId}`, signal, revision);
    if (value.proposal_id !== proposalId) throw new ChangeApiError(502);
    return value;
  }
  async test(saved: Revision, key: string, signal: AbortSignal) {
    const value = await this.request(`/proposals/${saved.proposal_id}/tests`, signal, job,
      { revision: saved.revision }, key);
    if (value.proposal_id !== saved.proposal_id || value.revision !== saved.revision
      || value.artifact_digest !== saved.artifact_digest || value.profile_digest !== saved.profile_digest)
      throw new ChangeApiError(502);
    return value;
  }
  async job(expected: TestJob, signal: AbortSignal) {
    const value = await this.request(`/tests/${expected.job_id}`, signal, job);
    if (value.job_id !== expected.job_id || value.proposal_id !== expected.proposal_id
      || value.revision !== expected.revision || value.artifact_digest !== expected.artifact_digest
      || value.profile_digest !== expected.profile_digest) throw new ChangeApiError(502);
    return value;
  }
}

export function editorContent(draft: string, original: string): string {
  const normalized = draft.replace(/\r\n?/g, "\n");
  return original.includes("\r\n") && !original.replace(/\r\n/g, "").includes("\n")
    ? normalized.replace(/\n/g, "\r\n") : normalized;
}
