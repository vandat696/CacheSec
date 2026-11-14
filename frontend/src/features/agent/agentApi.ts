import { ChangeApiError, editablePath } from "../code-changes/changeWorkflowApi.ts";
import { isAgentAutomation, isAgentRun, type AgentAutomation, type AgentRun } from "./agentRunModel.ts";

export const agentModels = {
  "gemini-3.5-flash-lite": { label: "Gemini 3.5 Flash-Lite", keyVariable: "GEMINI_API_KEY", keyFile: "gemini.env" },
  "gpt-6.1-sol": { label: "GPT-6.1 Sol", keyVariable: "OPENAI_API_KEY", keyFile: "openai.env" },
} as const;
export type AgentConfig = { model: keyof typeof agentModels; configured: boolean; mode: "assisted"; automation?: AgentAutomation };
export type AgentReply = { snapshot_id: string; manifest_digest: string; repository_identity: string;
  editable_path: string; answer: string; content: string | null; model: string;
  usage: { input_tokens: number; output_tokens: number; total_tokens: number } | null };
export type AgentMessage = { role: "user" | "assistant"; content: string };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const supportedModelVersion = (value: string) => /^gemini-3\.5-flash-lite(?:-\d{3}|-\d{4}-\d{2}-\d{2})?$/.test(value)
  || /^gpt-6\.1-sol(?:-\d{4}-\d{2}-\d{2})?$/.test(value);
const errors: Record<string, string> = {
  MODEL_NOT_CONFIGURED: "Chưa cấu hình API key cho Agent.", MODEL_KEY_REJECTED: "API key không hợp lệ.",
  MODEL_CONFIGURATION_INVALID: "Cấu hình API key không hợp lệ. Hãy kiểm tra file cấu hình.",
  MODEL_ACCESS_DENIED: "API key chưa có quyền dùng model.", MODEL_RATE_LIMIT: "Nhà cung cấp đang giới hạn lượt gọi hoặc hạn mức tài khoản.",
  MODEL_NOT_AVAILABLE: "Model chưa khả dụng với project này.", MODEL_REQUEST_REJECTED: "Nhà cung cấp từ chối cấu hình yêu cầu.",
  MODEL_UNAVAILABLE: "Chưa kết nối được nhà cung cấp model. Bạn có thể thử lại.", MODEL_INCOMPLETE: "Model chưa trả lời đầy đủ. Hãy thử yêu cầu ngắn hơn.",
  MODEL_INVALID_RESPONSE: "Model trả kết quả không hợp lệ.", MODEL_REFUSED: "Model từ chối yêu cầu này.",
  STALE_SNAPSHOT: "Source đã đổi. Hãy mở lại mã nguồn trước khi hỏi Agent.",
  AGENT_BUSY: "Đang có một lượt Agent chạy. Hãy chờ hoặc dừng lượt hiện tại.",
  AGENT_RUN_LIMIT: "Đã đạt giới hạn lưu phiên Agent local. Cần khởi động lại control.",
};
export class AgentApiError extends ChangeApiError {
  constructor(status: number, code?: string) { super(status, code); this.message = errors[code ?? ""] ?? this.message; }
}
export class AgentHttpClient {
  private baseUrl: string;
  private token: string | null;
  private fetcher: typeof fetch;
  constructor(baseUrl: string, token: string | null,
    fetcher: typeof fetch = (input, init) => fetch(input, init)) {
    if (token === null && baseUrl !== "/api/local-control") throw new Error("INVALID_LOCAL_TRANSPORT");
    this.baseUrl = baseUrl; this.token = token; this.fetcher = fetcher;
  }
  private async request(path: string, signal: AbortSignal, body?: unknown, key?: string): Promise<unknown> {
    const response = await this.fetcher(this.baseUrl.replace(/\/$/, "") + "/api/v1/agent" + path, {
      method: body === undefined ? "GET" : "POST", signal, credentials: this.token === null ? "same-origin" : "omit",
      redirect: "error", cache: "no-store", headers: { "Content-Type": "application/json",
        ...(this.token === null ? { "X-CacheSec-Workspace": "1" } : { Authorization: `Bearer ${this.token}` }),
        ...(key ? { "Idempotency-Key": key } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new AgentApiError(response.status,
      object(value) && object(value.error) && typeof value.error.code === "string" ? value.error.code : undefined);
    if (!object(value) || !object(value.meta) || value.meta.contract_version !== "v0.2"
      || value.meta.identity_mode !== "fixture" || typeof value.meta.request_id !== "string"
      || !/^[a-f0-9-]{36}$/i.test(value.meta.request_id)) throw new AgentApiError(502);
    return value.data;
  }
  async config(signal: AbortSignal): Promise<AgentConfig> {
    const value = await this.request("/config", signal);
    if (!object(value) || typeof value.model !== "string" || !Object.hasOwn(agentModels, value.model)
      || typeof value.configured !== "boolean" || value.mode !== "assisted"
      || (value.automation !== undefined && !isAgentAutomation(value.automation))) throw new AgentApiError(502);
    return value as AgentConfig;
  }
  async ask(snapshotId: string, prompt: string, history: AgentMessage[], signal: AbortSignal): Promise<AgentReply> {
    const value = await this.request("/messages", signal, { snapshot_id: snapshotId, prompt, history });
    if (!object(value) || value.snapshot_id !== snapshotId || typeof value.answer !== "string" || !value.answer
      || value.answer.length > 16000 || !(value.content === null || (typeof value.content === "string"
        && new TextEncoder().encode(value.content).length <= 65536))
      || typeof value.manifest_digest !== "string" || !/^sha256:[a-f0-9]{64}$/.test(value.manifest_digest)
      || typeof value.repository_identity !== "string" || value.editable_path !== editablePath
      || typeof value.model !== "string" || !supportedModelVersion(value.model)
      || !(value.usage === null || (object(value.usage) && ["input_tokens", "output_tokens", "total_tokens"]
        .every(k => Number.isSafeInteger(value.usage && (value.usage as Record<string, unknown>)[k])
          && ((value.usage as Record<string, number>)[k] >= 0))))) throw new AgentApiError(502);
    return value as AgentReply;
  }
  async startRun(snapshotId: string, prompt: string, key: string, signal: AbortSignal): Promise<AgentRun> {
    const value = await this.request("/runs", signal, { snapshot_id: snapshotId, prompt, provider_consent: true }, key);
    if (!isAgentRun(value) || value.snapshot_id !== snapshotId || !supportedModelVersion(value.model)) throw new AgentApiError(502);
    return value;
  }
  async getRun(id: string, signal: AbortSignal): Promise<AgentRun> {
    const value = await this.request("/runs/" + id, signal);
    if (!isAgentRun(value) || value.run_id !== id || !supportedModelVersion(value.model)) throw new AgentApiError(502);
    return value;
  }
  async cancelRun(id: string, signal: AbortSignal): Promise<AgentRun> {
    const value = await this.request("/runs/" + id + "/cancel", signal, null);
    if (!isAgentRun(value) || value.run_id !== id || !supportedModelVersion(value.model)) throw new AgentApiError(502);
    return value;
  }
}
