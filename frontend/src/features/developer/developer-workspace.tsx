"use client";

import { useReducer, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ApprovalPanel, DiffPanel, TestsPanel, TracePanel, type DeveloperTab } from "./developer-panels";
import { exampleQuestions, previewAnswer, previewTask } from "./developer-preview-data";
import { developerPreviewReducer, initialDeveloperPreview, type CacheScenario } from "./developer-preview-model";

const tabs = [
  { id: "diff", label: "Thay đổi", icon: "code" },
  { id: "tests", label: "Kiểm thử", icon: "terminal" },
  { id: "approval", label: "Phê duyệt", icon: "shield" },
  { id: "trace", label: "Nhật ký", icon: "clock" },
] as const;

const scenarios = {
  hit: { label: "Hit · mẫu", description: "Candidate tương đương và vượt xác minh trong kịch bản mẫu.", outcome: "Tái sử dụng câu trả lời", source: "Khớp phiên bản nguồn", icon: "check" },
  miss: { label: "Miss · mẫu", description: "Không có candidate phù hợp trong kịch bản mẫu.", outcome: "Truy xuất nguồn được phép", source: "Cần truy xuất mới", icon: "book" },
  rejected: { label: "Rejected · mẫu", description: "Candidate gần nghĩa nhưng file nguồn đã đổi trong kịch bản mẫu.", outcome: "Bỏ candidate, truy xuất lại", source: "Không khớp phiên bản", icon: "close" },
} as const;

type Message = { id: number; role: "developer" | "assistant"; text: string };
const initialMessages: Message[] = [
  { id: 1, role: "developer", text: previewTask },
  { id: 2, role: "assistant", text: "Trong kịch bản mẫu, thay đổi nằm ở hàm validate_quotation(). Đề xuất bổ sung cờ expiration_review; các quy tắc validation còn lại được giữ nguyên. Bạn có thể xem diff bên cạnh trước khi kiểm thử và phê duyệt." },
];

export function DeveloperWorkspace() {
  const [state, dispatch] = useReducer(developerPreviewReducer, undefined, initialDeveloperPreview);
  const [tab, setTab] = useState<DeveloperTab>("diff");
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [inputError, setInputError] = useState("");
  const chatLog = useRef<HTMLDivElement>(null);
  const tabButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const scenario = scenarios[state.cacheScenario];
  const testsShown = state.testRevision === state.revision;
  const approved = state.approval === "approved";

  function send(question: string) {
    const text = question.trim();
    if (!text) { setInputError("Nhập nội dung để xem phản hồi mẫu."); return; }
    setMessages((current) => [...current, { id: current.length + 1, role: "developer", text }, { id: current.length + 2, role: "assistant", text: previewAnswer(text) }]);
    setDraft("");
    setInputError("");
    requestAnimationFrame(() => chatLog.current?.scrollTo({ top: chatLog.current.scrollHeight, behavior: "instant" }));
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); send(draft); }
  function reset() { dispatch({ type: "reset" }); setMessages(initialMessages); setDraft(""); setInputError(""); setTab("diff"); }

  return (
    <div className="developer-workspace" data-preview-only="true" data-preview-revision={state.revision} data-preview-approval={state.approval}>
      <header className="dev-page-heading">
        <div><div className="dev-title-line"><span className="dev-workspace-mark"><Icon name="code" /></span><h1>Developer Workspace</h1></div><p>Một nơi để tìm hiểu code, xem thay đổi và kiểm soát việc phê duyệt.</p></div>
        <Button variant="secondary" onClick={reset} id="preview-reset"><Icon name="refresh" />Bắt đầu lại</Button>
      </header>

      <div className="dev-preview-banner"><span className="dev-preview-dot" /><strong>Bản xem trước</strong><span>Dữ liệu minh họa · chưa kết nối Agent, cache hoặc deployment thật.</span></div>

      <section className="dev-task-card" aria-labelledby="dev-task-title">
        <div className="dev-task-meta"><span><Icon name="book" />supplier-quotations <span className="dev-inline-muted">/ repository mẫu</span></span><span><Icon name="branch" /><code>demo/expiration-review</code></span></div>
        <div className="dev-task-title"><div><span className="dev-task-id">QV-001</span><h2 id="dev-task-title">Kiểm tra ngày hết hạn báo giá</h2></div><span className={`dev-status ${approved ? "success" : "warning"}`}>{approved ? "Đã duyệt · mẫu" : state.approval === "changes-requested" ? "Cần chỉnh sửa · mẫu" : "Đề xuất chờ xem xét"}</span></div>
        <p>{previewTask}</p>
        <ol className="dev-progress" aria-label="Các bước trong bản mẫu">
          <li className="complete"><span><Icon name="check" /></span>Đề xuất mẫu</li>
          <li className={testsShown ? "complete" : "current"}><span>{testsShown ? <Icon name="check" /> : "2"}</span>Kết quả kiểm thử</li>
          <li className={approved ? "complete" : testsShown ? "current" : ""}><span>{approved ? <Icon name="check" /> : "3"}</span>Phê duyệt</li>
          <li><span><Icon name="lock" /></span>Triển khai</li>
        </ol>
      </section>

      <div className="dev-workbench">
        <section className="dev-assistant" aria-labelledby="dev-assistant-title">
          <div className="dev-section-header"><div><Icon name="spark" /><h2 id="dev-assistant-title">Trợ lý phát triển</h2></div><span className="dev-live-label">Phản hồi mẫu</span></div>
          <div className="dev-context-strip"><Icon name="file" /><span>Ngữ cảnh: <strong>quotation_demo/service.py</strong></span></div>
          <div className="dev-messages" role="log" aria-label="Hội thoại mẫu" aria-live="polite" ref={chatLog}>{messages.map((message) => (
            <article className={`dev-message ${message.role}`} key={message.id}><span className="dev-message-avatar">{message.role === "developer" ? "D" : <Icon name="spark" />}</span><div><span className="dev-message-label">{message.role === "developer" ? "Developer" : "CacheSec"}{message.role === "assistant" && <span>Mẫu</span>}</span><p>{message.text}</p>{message.id === 2 && <button type="button" className="dev-source-link" onClick={() => setTab("diff")}><Icon name="file" />service.py · xem diff<Icon name="arrow" /></button>}</div></article>
          ))}</div>
          <details className={`dev-cache-card ${state.cacheScenario}`} open>
            <summary><span><Icon name="shield" /><strong>Local Semantic Cache</strong></span><span className="dev-cache-label">{scenario.label}</span><Icon name="chevron" /></summary>
            <div className="dev-cache-body"><label htmlFor="preview-cache">Kịch bản minh họa<select id="preview-cache" value={state.cacheScenario} onChange={(event) => dispatch({ type: "cache", scenario: event.target.value as CacheScenario })}><option value="hit">Reuse hợp lệ</option><option value="miss">Không tìm thấy candidate</option><option value="rejected">Nguồn đã thay đổi</option></select></label><p>{scenario.description}</p><div className="dev-cache-checks"><span><Icon name="shield" />Quyền: dữ liệu mẫu</span><span><Icon name={scenario.icon} />{scenario.source}</span></div><div className="dev-cache-outcome"><Icon name="arrow" />{scenario.outcome}</div></div>
          </details>
          <div className="dev-suggestions" aria-label="Câu hỏi gợi ý">{exampleQuestions.map((question) => <button key={question} type="button" onClick={() => send(question)}>{question}<Icon name="arrow" /></button>)}</div>
          <form className="dev-composer" onSubmit={submit}><label className="sr-only" htmlFor="developer-prompt">Yêu cầu cho trợ lý mẫu</label><div><textarea id="developer-prompt" value={draft} maxLength={2000} rows={2} placeholder="Hỏi về thay đổi hoặc nguồn tham chiếu…" onChange={(event) => { setDraft(event.target.value); setInputError(""); }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} aria-describedby="developer-prompt-help developer-prompt-error" aria-invalid={!!inputError} /><Button type="submit" aria-label="Gửi yêu cầu mẫu"><Icon name="send" /></Button></div><p id="developer-prompt-error" className="dev-input-error" role="status">{inputError}</p><p id="developer-prompt-help">Enter để gửi · Shift + Enter xuống dòng · chỉ lưu trong phiên</p></form>
        </section>

        <section className="dev-review" aria-label="Xem xét thay đổi">
          <div className="dev-review-tabs" role="tablist" aria-label="Chi tiết thay đổi">{tabs.map((item, index) => <button key={item.id} type="button" id={`dev-tab-${item.id}`} role="tab" aria-selected={tab === item.id} aria-controls={`dev-panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1} ref={(node) => { tabButtons.current[index] = node; }} onClick={() => setTab(item.id)} onKeyDown={(event) => { const target = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key]; if (target !== undefined) { event.preventDefault(); setTab(tabs[target].id); tabButtons.current[target]?.focus(); } }}><Icon name={item.icon} />{item.label}{item.id === "diff" && <span className="dev-tab-count">1</span>}{item.id === "approval" && approved && <span className="dev-tab-approved" aria-label="Đã duyệt mẫu" />}</button>)}</div>
          {tabs.map((item) => <div key={item.id} id={`dev-panel-${item.id}`} role="tabpanel" aria-labelledby={`dev-tab-${item.id}`} tabIndex={0} hidden={tab !== item.id}>{item.id === "diff" ? <DiffPanel state={state} dispatch={dispatch} /> : item.id === "tests" ? <TestsPanel state={state} dispatch={dispatch} /> : item.id === "approval" ? <ApprovalPanel state={state} dispatch={dispatch} /> : <TracePanel state={state} />}</div>)}
          <div className="dev-review-bottom"><Icon name="shield" /><span>Mọi thay đổi cần được duyệt chính xác trước khi triển khai.</span></div>
        </section>
      </div>
      <p className="dev-workspace-status" role="status" aria-live="polite">{state.notice}</p>
      <footer className="dev-workspace-footer"><span>CacheSec <span> / </span> Secure Local Semantic Cache</span><span>1 nhiệm vụ · 1 thay đổi validation · dữ liệu giả lập</span></footer>
    </div>
  );
}
