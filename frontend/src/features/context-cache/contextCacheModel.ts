export type ContextMode = "none" | "local";
export type ContextPayload = { kind: "full-source-context-v1"; files: { path: string; content: string }[] };
export type ContextRequest = {
  request_id: string; snapshot_id: string; prompt: string; mode: ContextMode; purpose: "inspect" | "change";
  intent: "full-authorized-source"; namespace: string; partition: string; manifest_digest: string;
  query_fingerprint: string; vector: number[] | null; created_at: number; expires_at: number;
  embedding_calls: number; embedding_ms: number;
  model?: string;
  preparation_ms?: number;
  policy: { version: string; dimensions: number; threshold: number; top_k: number; ttl_seconds: number; capacity: number };
};
export type ContextEntry = Pick<ContextRequest, "namespace" | "partition" | "purpose" | "intent" | "manifest_digest" | "query_fingerprint" | "vector" | "created_at" | "expires_at"> & {
  entry_id: string; payload_digest: string; payload: ContextPayload;
};
export type LookupReport = ({ kind: "not_applicable" | "no_candidate" | "client_storage_error" }
  | { kind: "candidate"; candidates: { entry_id: string; kind: "exact" | "semantic"; payload: ContextPayload }[] })
  & { client_state?: "cold" | "warm"; lookup_ms?: number };
export type ContextResolution = {
  request_id: string; outcome: "not_applicable" | "miss" | "hit" | "rejected" | "client_storage_error";
  decisions: { entry_id: string; kind: string; reason: string | null }[];
  resolution_ms: number; embedding_calls: number; embedding_ms: number; admission: ContextEntry | null;
};
export const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const hash = (v: unknown): v is string => typeof v === "string" && /^sha256:[a-f0-9]{64}$/.test(v);
const uuid = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const vector = (v: unknown): v is number[] => Array.isArray(v) && v.length === 768
  && v.every(n => typeof n === "number" && Number.isFinite(n))
  && Math.abs(Math.hypot(...v) - 1) < 0.00001;
function binding(v: Record<string, unknown>) {
  return hash(v.namespace) && hash(v.partition) && hash(v.manifest_digest) && hash(v.query_fingerprint)
    && v.intent === "full-authorized-source" && ["inspect", "change"].includes(v.purpose as string)
    && finite(v.created_at) && finite(v.expires_at) && v.expires_at > v.created_at;
}
export function isContextRequest(v: unknown): v is ContextRequest {
  return object(v) && binding(v) && uuid(v.request_id) && uuid(v.snapshot_id)
    && (v.model === undefined || typeof v.model === "string")
    && typeof v.prompt === "string" && v.prompt.length > 0 && v.prompt.length <= 4000
    && (v.mode === "none" ? v.vector === null && v.embedding_calls === 0 : v.mode === "local" && vector(v.vector) && v.embedding_calls === 1)
    && finite(v.embedding_ms) && object(v.policy) && v.policy.version === "full-source-context-v1"
    && v.policy.dimensions === 768 && v.policy.threshold === 0.85 && v.policy.top_k === 3
    && v.policy.ttl_seconds === 1800 && v.policy.capacity === 100;
}
export function isContextEntry(v: unknown): v is ContextEntry {
  return object(v) && binding(v) && uuid(v.entry_id) && hash(v.payload_digest) && vector(v.vector)
    && object(v.payload) && v.payload.kind === "full-source-context-v1" && Array.isArray(v.payload.files)
    && v.payload.files.length > 0 && v.payload.files.length <= 256
    && v.payload.files.every(f => object(f) && typeof f.path === "string" && typeof f.content === "string")
    && v.payload.files.reduce((size, f) => size + new TextEncoder().encode(f.content as string).length, 0) <= 131072;
}
export function isContextResolution(v: unknown): v is ContextResolution {
  return object(v) && uuid(v.request_id)
    && ["not_applicable", "miss", "hit", "rejected", "client_storage_error"].includes(v.outcome as string)
    && finite(v.resolution_ms) && finite(v.embedding_ms) && [0, 1].includes(v.embedding_calls as number)
    && Array.isArray(v.decisions) && v.decisions.length <= 3 && v.decisions.every(d => object(d)
      && uuid(d.entry_id) && ["exact", "semantic"].includes(d.kind as string) && (d.reason === null || typeof d.reason === "string"))
    && (v.admission === null || isContextEntry(v.admission));
}

export function matchContextEntries(request: ContextRequest, entries: ContextEntry[], now = Date.now() / 1000): LookupReport {
  if (request.mode === "none") return { kind: "not_applicable" };
  const valid = entries.filter(entry => isContextEntry(entry) && entry.namespace === request.namespace
    && entry.partition === request.partition && entry.expires_at > now);
  const exact = valid.filter(entry => entry.query_fingerprint === request.query_fingerprint);
  const scored = valid.filter(entry => entry.query_fingerprint !== request.query_fingerprint)
    .map(entry => ({ entry, score: entry.vector!.reduce((sum, n, i) => sum + n * request.vector![i], 0) }))
    .filter(item => item.score >= request.policy.threshold).sort((a, b) => b.score - a.score);
  const candidates = [...exact.map(entry => ({ entry_id: entry.entry_id, kind: "exact" as const, payload: entry.payload })),
    ...scored.map(({ entry }) => ({ entry_id: entry.entry_id, kind: "semantic" as const, payload: entry.payload }))].slice(0, request.policy.top_k);
  return candidates.length ? { kind: "candidate", candidates } : { kind: "no_candidate" };
}
