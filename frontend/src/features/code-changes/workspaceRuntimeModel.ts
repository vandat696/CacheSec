export type WorkspaceConfig = { can_write: boolean; can_review: boolean; can_activate: boolean; can_read: boolean;
  configured: boolean; target_version: number | null; active_artifact: string | null; pending_id: string | null };
export type WorkspaceOperation = { id: string; kind: "write" | "approval" | "activation"; status: string;
  proposal_id: string; revision: number; artifact_digest: string; profile_digest: string;
  job_id: string | null; evidence_digest: string | null; reason: string | null; created_at: number;
  source_digest: string | null; container_name: string | null; target_version: number | null; approval_id: string | null };
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const hash = (v: unknown): v is string => typeof v === "string" && /^sha256:[0-9a-f]{64}$/.test(v);
export function workspaceConfig(v: unknown): v is WorkspaceConfig {
  return object(v) && ["can_write", "can_review", "can_activate", "can_read", "configured"].every(k => typeof v[k] === "boolean")
    && (v.target_version === null || (Number.isSafeInteger(v.target_version) && (v.target_version as number) >= 0))
    && (v.active_artifact === null || hash(v.active_artifact)) && (v.pending_id === null || uuid(v.pending_id));
}
export function workspaceOperation(v: unknown): v is WorkspaceOperation {
  return object(v) && uuid(v.id) && ["write", "approval", "activation"].includes(v.kind as string)
    && ["queued", "preparing", "running", "succeeded", "failed", "blocked", "unknown", "approved"].includes(v.status as string)
    && uuid(v.proposal_id) && Number.isSafeInteger(v.revision) && (v.revision as number) > 0
    && hash(v.artifact_digest) && hash(v.profile_digest) && typeof v.created_at === "number"
    && (v.reason === null || typeof v.reason === "string")
    && (v.job_id === null || uuid(v.job_id)) && (v.evidence_digest === null || hash(v.evidence_digest))
    && (v.source_digest === null || hash(v.source_digest))
    && (v.kind !== "write" || (hash(v.source_digest) && v.status !== "approved"))
    && (v.kind === "write" || (uuid(v.job_id) && hash(v.evidence_digest)))
    && (v.approval_id === null || uuid(v.approval_id))
    && (v.target_version === null || (Number.isSafeInteger(v.target_version) && (v.target_version as number) >= 0))
    && (v.container_name === null || /^cachesec-local-[0-9a-f]{32}$/.test(v.container_name as string));
}
export const operationPending = (v: WorkspaceOperation) => ["queued", "preparing", "running"].includes(v.status);
