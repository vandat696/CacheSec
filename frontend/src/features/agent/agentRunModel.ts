export const terminalRunStatuses = ["passed", "needs_input", "exhausted", "cancelled", "timed_out", "error"] as const;
const statuses = ["queued", "generating", "saving", "testing", ...terminalRunStatuses];
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const uuid = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const digest = (v: unknown) => typeof v === "string" && /^sha256:[a-f0-9]{64}$/.test(v);
const validUsage = (v: unknown) => v === undefined || v === null || (object(v)
  && ["input_tokens", "output_tokens", "total_tokens"].every(key => Number.isSafeInteger(v[key]) && (v[key] as number) >= 0));
export type AgentAutomation = { can_start: boolean; max_turns: 3; deadline_seconds: 600;
  persistence: "process"; active_run_id: string | null };
export type AgentRunEvent = { sequence: number; at: string; turn: number; tool: string; state: string;
  model?: string; usage?: { input_tokens: number; output_tokens: number; total_tokens: number } | null };
export type AgentRun = { run_id: string; snapshot_id: string; tenant_id: string; repo_id: string;
  status: string; turn: number; max_turns: 3; deadline_seconds: 600; model: string; created_at: string;
  answer: string; error_code: string | null; proposal_id: string | null; revision: number | null;
  artifact_digest: string | null; test_job_id: string | null; test_status: string | null;
  test_may_continue: boolean; events: AgentRunEvent[] };
export const pendingAgentRun = (run: AgentRun) => !terminalRunStatuses.some(status => status === run.status);
export function isAgentAutomation(value: unknown): value is AgentAutomation {
  return object(value) && typeof value.can_start === "boolean" && value.max_turns === 3
    && value.deadline_seconds === 600 && value.persistence === "process"
    && (value.active_run_id === null || uuid(value.active_run_id));
}
export function isAgentRun(value: unknown): value is AgentRun {
  if (!object(value) || !uuid(value.run_id) || !uuid(value.snapshot_id) || !uuid(value.tenant_id) || !uuid(value.repo_id)
    || !statuses.includes(value.status as string) || !Number.isSafeInteger(value.turn) || (value.turn as number) < 0 || (value.turn as number) > 3
    || value.max_turns !== 3 || value.deadline_seconds !== 600 || typeof value.model !== "string"
    || typeof value.created_at !== "string" || typeof value.answer !== "string" || value.answer.length > 16000
    || !(value.error_code === null || (typeof value.error_code === "string" && /^[A-Z_]{1,80}$/.test(value.error_code)))
    || !(value.proposal_id === null || uuid(value.proposal_id))
    || !(value.revision === null || (Number.isSafeInteger(value.revision) && (value.revision as number) > 0))
    || !(value.artifact_digest === null || digest(value.artifact_digest))
    || (value.proposal_id === null) !== (value.revision === null) || (value.revision === null) !== (value.artifact_digest === null)
    || !(value.test_job_id === null || uuid(value.test_job_id))
    || !(value.test_status === null || ["queued", "preparing", "running", "passed", "failed", "error", "timed_out", "blocked", "unknown"].includes(value.test_status as string))
    || (value.test_job_id === null) !== (value.test_status === null)
    || typeof value.test_may_continue !== "boolean" || !Array.isArray(value.events) || value.events.length > 64) return false;
  if (value.status === "passed" && (value.proposal_id === null || value.test_job_id === null || value.test_status !== "passed")) return false;
  if (value.status === "passed" && !value.events.some(event => object(event) && event.tool === "test"
    && event.state === "passed" && event.job_id === value.test_job_id && digest(event.evidence_digest))) return false;
  return value.events.every((event, index) => object(event) && event.sequence === index + 1
    && typeof event.at === "string" && Number.isSafeInteger(event.turn) && (event.turn as number) >= 0 && (event.turn as number) <= 3
    && ["run", "read_source", "generate", "save_revision", "test", "storage"].includes(event.tool as string)
    && typeof event.state === "string" && /^[a-z_]{1,40}$/.test(event.state) && validUsage(event.usage));
}
