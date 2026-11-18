import { isAgentRun, terminalRunStatuses, type AgentRun } from "../agent/agentRunModel.ts";
import { revision, type Revision } from "../code-changes/changeWorkflowApi.ts";
import { isContextRequest, object, type ContextRequest, type ContextMode } from "../context-cache/contextCacheModel.ts";

export type ComparisonSummary = { pair_id: string; session_id?: string; snapshot_id: string; prompt: string; created_at: string; cache_state: "cold" | "warm" | "preload"; status: string };
type TurnReply = { status: string; answer: string };
export type ComparisonTurn = { pair_id: string; prompt: string; branches: { none: TurnReply; local: TurnReply } };
export type ComparisonConversation = { session_id: string; turns: ComparisonTurn[] };
export type Branch = {
  mode: ContextMode; status: string; run: AgentRun | null; context_request?: ContextRequest;
  server_workflow_ms?: number;
  client_cache_io?: { report_id: string; entry_id: string; state: string; elapsed_ms: number }[];
  context?: { outcome: string; resolution_ms: number; embedding_ms: number; embedding_calls: number; decisions: { entry_id: string; kind: string; reason: string | null; score?: number | null }[];
    client_report?: { state: "cold" | "warm" | null; lookup_ms: number | null } };
  revisions?: Revision[]; error_code?: string;
  assessments?: { assessment_id: string; criteria_version: string; turn: number; technical_test_status: string;
    artifact_digest: string; evidence_digest: string | null; usage: AgentRun["events"][number]["usage"]; generation_ms: number | null;
    correctness: { value: null; reason: string }; approval_gate: { value: null; reason: string } }[];
};
export type ComparisonPair = ComparisonSummary & { model: string; branches: { none: Branch; local: Branch } };
const id = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const finiteTime = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
const statuses = [...terminalRunStatuses, "ready", "preparing", "starting", "queued", "generating", "saving", "testing", "incomplete"];
function context(value: unknown) {
  return object(value) && ["hit", "miss", "rejected", "not_applicable", "client_storage_error"].includes(value.outcome as string)
    && finiteTime(value.resolution_ms) && finiteTime(value.embedding_ms) && [0, 1].includes(value.embedding_calls as number)
    && Array.isArray(value.decisions) && value.decisions.length <= 3 && value.decisions.every(d => object(d)
      && id(d.entry_id) && ["exact", "semantic"].includes(d.kind as string) && (d.reason === null || typeof d.reason === "string")
      && (d.score === undefined || d.score === null || (typeof d.score === "number" && Number.isFinite(d.score) && d.score >= -1 && d.score <= 1)))
    && (value.client_report === undefined || (object(value.client_report)
      && [null, "cold", "warm"].includes(value.client_report.state as "cold")
      && (value.client_report.lookup_ms === null || finiteTime(value.client_report.lookup_ms))));
}
export function isComparisonSummary(v: unknown): v is ComparisonSummary {
  return object(v) && id(v.pair_id) && id(v.snapshot_id) && typeof v.prompt === "string" && v.prompt.length <= 4000
    && (v.session_id === undefined || id(v.session_id))
    && typeof v.created_at === "string" && Number.isFinite(Date.parse(v.created_at))
    && ["cold", "warm", "preload"].includes(v.cache_state as string) && typeof v.status === "string";
}
export function isComparisonConversation(value: unknown): value is ComparisonConversation {
  if (!object(value) || !id(value.session_id) || !Array.isArray(value.turns)) return false;
  const seen = new Set<string>();
  return value.turns.every(turn => {
    if (!object(turn) || !id(turn.pair_id) || seen.has(turn.pair_id) || typeof turn.prompt !== "string"
      || turn.prompt.length > 4000 || !object(turn.branches)) return false;
    const { none, local } = turn.branches;
    seen.add(turn.pair_id);
    return [none, local].every(reply => object(reply) && typeof reply.status === "string"
      && typeof reply.answer === "string" && reply.answer.length <= 16000);
  }) && value.turns[0]?.pair_id === value.session_id;
}
export const comparisonSessionId = (pair: ComparisonSummary) => pair.session_id ?? pair.pair_id;
export function mergeComparisonTurn(turns: ComparisonTurn[], pair: ComparisonPair): ComparisonTurn[] {
  const reply = (branch: Branch) => ({ status: branch.status, answer: branch.run?.answer ?? "" });
  const turn = { pair_id: pair.pair_id, prompt: pair.prompt, branches: {
    none: reply(pair.branches.none), local: reply(pair.branches.local),
  } };
  return turns.some(item => item.pair_id === turn.pair_id)
    ? turns.map(item => item.pair_id === turn.pair_id ? turn : item)
    : [...turns, turn];
}
export function isComparisonPair(v: unknown): v is ComparisonPair {
  if (!object(v) || typeof v.model !== "string" || !object(v.branches)) return false;
  const { branches, model } = v;
  if (!isComparisonSummary(v)) return false;
  return (["none", "local"] as const).every(mode => {
    const b = branches[mode];
    return object(b) && b.mode === mode && statuses.includes(b.status as typeof terminalRunStatuses[number]) && (b.run === null || (isAgentRun(b.run)
      && b.run.snapshot_id === v.snapshot_id && b.run.model === model))
      && (b.context_request === undefined || (isContextRequest(b.context_request) && b.context_request.mode === mode
        && b.context_request.snapshot_id === v.snapshot_id && b.context_request.prompt === v.prompt
        && (b.context_request.model === undefined || b.context_request.model === model)))
      && (b.revisions === undefined || (Array.isArray(b.revisions) && b.revisions.length <= 3 && b.revisions.every(r => revision(r)
        && r.base_snapshot_id === v.snapshot_id && (!object(b.run) || r.proposal_id === b.run.proposal_id))))
      && (b.context === undefined || context(b.context))
      && (b.server_workflow_ms === undefined || finiteTime(b.server_workflow_ms))
      && (b.error_code === undefined || (typeof b.error_code === "string" && /^[A-Z_]{1,80}$/.test(b.error_code)))
      && (b.client_cache_io === undefined || (Array.isArray(b.client_cache_io) && b.client_cache_io.length <= 10 && b.client_cache_io.every(r => object(r)
        && id(r.report_id) && id(r.entry_id) && ["written", "session_changed", "storage_error"].includes(r.state as string) && finiteTime(r.elapsed_ms))))
      && (b.assessments === undefined || (Array.isArray(b.assessments) && b.assessments.every(a => object(a)
        && id(a.assessment_id) && a.criteria_version === "technical-trace-v1" && Number.isSafeInteger(a.turn)
        && typeof a.technical_test_status === "string" && typeof a.artifact_digest === "string"
        && object(a.correctness) && a.correctness.value === null && object(a.approval_gate) && a.approval_gate.value === null)));
  });
}
export const branchPending = (branch: Pick<Branch, "status">) => ![...terminalRunStatuses, "incomplete", "ready", "preparing"].includes(branch.status as typeof terminalRunStatuses[number]);
export const branchLabel = (mode: ContextMode) => mode === "none" ? "Không cache" : "Có Context Cache";
export const revisionTest = (item: Revision) => item.tests.find(job => job.artifact_digest === item.artifact_digest
  && job.revision === item.revision && job.proposal_id === item.proposal_id);
export const testLabel = (status?: string) => ({
  passed: "Test đạt", failed: "Test chưa đạt", queued: "Đang chờ test", preparing: "Đang chuẩn bị test",
  running: "Đang chạy test", blocked: "Test bị chặn", timed_out: "Test hết thời gian",
  error: "Lỗi chạy test", unknown: "Chưa rõ kết quả test",
} as Record<string, string>)[status ?? ""] ?? "Chưa có test";
export function branchMetrics(branch: Branch) {
  const generation = branch.run?.events.filter(event => event.tool === "generate") ?? [];
  const generationAttempts = generation.filter(event => event.state === "started").length;
  const retry = generation.some(event => event.state === "retry_wait");
  const lastProviderFailure = generation.findLast(event => event.state === "error" && event.provider_http_status !== undefined);
  const events = generation.filter(event => event.state === "completed");
  const usage = events.length && events.every(event => event.usage != null)
    ? events.reduce((sum, event) => ({ input_tokens: sum.input_tokens + event.usage!.input_tokens,
      output_tokens: sum.output_tokens + event.usage!.output_tokens, total_tokens: sum.total_tokens + event.usage!.total_tokens }),
    { input_tokens: 0, output_tokens: 0, total_tokens: 0 }) : null;
  const generationMs = events.length && events.every(event => typeof event.generation_ms === "number" && Number.isFinite(event.generation_ms))
    ? events.reduce((sum, event) => sum + event.generation_ms!, 0) : null;
  const final = branch.run?.events.at(-1);
  const workflowMs = branch.run && final && !branchPending(branch) ? Date.parse(final.at) - Date.parse(branch.run.created_at) : null;
  return { usage, generationMs, generationCalls: events.length, generationAttempts, workflowMs, retry, lastProviderFailure };
}
