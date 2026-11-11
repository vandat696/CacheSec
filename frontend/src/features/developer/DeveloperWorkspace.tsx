"use client";

import { useReducer, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { RepositoryPanel } from "@/features/repositories/RepositoryPanel";
import { DeveloperReviewDialog, DiffPanel } from "./DeveloperPanels";
import { previewAnswer } from "./developerPreviewData";
import { developerPreviewReducer, initialDeveloperPreview } from "./developerPreviewModel";

type Message = { id: number; role: "developer" | "assistant"; text: string };

export function DeveloperWorkspace() {
  const [mode, setMode] = useState<"repository" | "preview">("repository");
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
    <div className="developer-workspace" data-preview-only={mode === "preview"} data-preview-revision={state.revision} data-preview-approval={state.approval}>
      <header className="dev-ide-toolbar">
        <h1>Workspace</h1>
        <div className="dev-source-mode" aria-label="Chế độ Workspace">
          <button type="button" aria-pressed={mode === "repository"} onClick={() => { setReview(null); setMode("repository"); }}>Repository</button>
          <button type="button" id="workspace-preview" aria-pressed={mode === "preview"} onClick={() => setMode("preview")}>Mô phỏng workflow</button>
        </div>
        <span className="dev-demo-label">{mode === "preview" ? "Mô phỏng" : "Agent chưa kết nối"}</span>
        <div className="dev-toolbar-actions">
          <Link href="/quotations" className="dev-quotation-link"><Icon name="file" />Báo giá</Link>
          <Button variant="tertiary" id="preview-open-tests" disabled={mode !== "preview"} aria-haspopup="dialog" aria-controls="developer-review-dialog" aria-expanded={review === "tests"} onClick={() => setReview("tests")} title={testsShown ? "Đã xem kết quả mẫu" : "Xem kiểm thử mẫu"}><Icon name="terminal" />Kiểm thử</Button>
          <Button variant="tertiary" id="preview-open-approval" disabled={mode !== "preview"} aria-haspopup="dialog" aria-controls="developer-review-dialog" aria-expanded={review === "approval"} onClick={() => setReview("approval")}><Icon name={approved ? "check" : "shield"} />Phê duyệt</Button>
          <Button variant="tertiary" onClick={reset} id="preview-reset" disabled={mode !== "preview"} aria-label="Bắt đầu lại" title="Bắt đầu lại"><Icon name="refresh" /></Button>
        </div>
      </header>

      <div className="dev-workbench">
        <section className="dev-editor" aria-label={mode === "repository" ? "Snapshot repository" : "Mã nguồn minh họa"}>
          {mode === "repository" ? <RepositoryPanel /> : <DiffPanel state={state} dispatch={dispatch} />}
        </section>
        <section className="dev-assistant" aria-labelledby="dev-agent-title">
          <div className="dev-agent-heading"><Icon name="spark" /><h2 id="dev-agent-title">Agent</h2></div>
          <div className="dev-messages" role="log" aria-label="Hội thoại mẫu" aria-live="polite" ref={chatLog}>{(mode === "preview" ? messages : []).map((message) => (
            <article className={`dev-message ${message.role}`} key={message.id} aria-label={message.role === "developer" ? "Bạn" : "Trợ lý mẫu"}><p>{message.text}</p></article>
          ))}</div>
          <form className="dev-composer" onSubmit={submit}><label className="sr-only" htmlFor="developer-prompt">Yêu cầu cho trợ lý mẫu</label><div><textarea disabled={mode !== "preview"} id="developer-prompt" value={draft} maxLength={2000} rows={3} placeholder={mode === "preview" ? "Nhập yêu cầu…" : "Agent chưa kết nối"} onChange={(event) => { setDraft(event.target.value); setInputError(""); }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} aria-describedby="developer-prompt-error" aria-invalid={!!inputError} /><Button type="submit" disabled={mode !== "preview"} aria-label="Gửi yêu cầu mẫu"><Icon name="send" /></Button></div><p id="developer-prompt-error" className="dev-input-error" role="status">{inputError}</p></form>
        </section>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{state.notice}</p>
      <DeveloperReviewDialog panel={review} onClose={() => setReview(null)} state={state} dispatch={dispatch} />
    </div>
  );
}
