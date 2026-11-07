"use client";

import { useReducer, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { DeveloperReviewDialog, DiffPanel } from "./DeveloperPanels";
import { previewAnswer } from "./developerPreviewData";
import { developerPreviewReducer, initialDeveloperPreview } from "./developerPreviewModel";

type Message = { id: number; role: "developer" | "assistant"; text: string };

export function DeveloperWorkspace() {
  const [state, dispatch] = useReducer(developerPreviewReducer, undefined, initialDeveloperPreview);
  const [review, setReview] = useState<"tests" | "approval" | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [inputError, setInputError] = useState("");
  const chatLog = useRef<HTMLDivElement>(null);
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
  function reset() { dispatch({ type: "reset" }); setMessages([]); setDraft(""); setInputError(""); }

  return (
    <div className="developer-workspace" data-preview-only="true" data-preview-revision={state.revision} data-preview-approval={state.approval}>
      <header className="dev-ide-toolbar">
        <h1>Workspace</h1>
        <span className="dev-demo-label" title="Chưa kết nối Agent, repository hoặc backend">Mô phỏng</span>
        <div className="dev-toolbar-actions">
          <Button variant="tertiary" id="preview-open-tests" aria-haspopup="dialog" aria-controls="developer-review-dialog" aria-expanded={review === "tests"} onClick={() => setReview("tests")} title={testsShown ? "Đã xem kết quả mẫu" : "Xem kiểm thử mẫu"}><Icon name="terminal" />Kiểm thử</Button>
          <Button variant="tertiary" id="preview-open-approval" aria-haspopup="dialog" aria-controls="developer-review-dialog" aria-expanded={review === "approval"} onClick={() => setReview("approval")}><Icon name={approved ? "check" : "shield"} />Phê duyệt</Button>
          <Button variant="tertiary" onClick={reset} id="preview-reset" aria-label="Bắt đầu lại" title="Bắt đầu lại"><Icon name="refresh" /></Button>
        </div>
      </header>

      <div className="dev-workbench">
        <section className="dev-editor" aria-label="Mã nguồn minh họa">
          <DiffPanel state={state} dispatch={dispatch} />
        </section>
        <section className="dev-assistant" aria-labelledby="dev-agent-title">
          <div className="dev-agent-heading"><Icon name="spark" /><h2 id="dev-agent-title">Agent</h2></div>
          <div className="dev-messages" role="log" aria-label="Hội thoại mẫu" aria-live="polite" ref={chatLog}>{messages.map((message) => (
            <article className={`dev-message ${message.role}`} key={message.id} aria-label={message.role === "developer" ? "Bạn" : "Trợ lý mẫu"}><p>{message.text}</p></article>
          ))}</div>
          <form className="dev-composer" onSubmit={submit}><label className="sr-only" htmlFor="developer-prompt">Yêu cầu cho trợ lý mẫu</label><div><textarea id="developer-prompt" value={draft} maxLength={2000} rows={3} placeholder="Nhập yêu cầu…" onChange={(event) => { setDraft(event.target.value); setInputError(""); }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} aria-describedby="developer-prompt-error" aria-invalid={!!inputError} /><Button type="submit" aria-label="Gửi yêu cầu mẫu"><Icon name="send" /></Button></div><p id="developer-prompt-error" className="dev-input-error" role="status">{inputError}</p></form>
        </section>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{state.notice}</p>
      <DeveloperReviewDialog panel={review} onClose={() => setReview(null)} state={state} dispatch={dispatch} />
    </div>
  );
}
