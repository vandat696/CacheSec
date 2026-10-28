"use client";

import { useEffect, useRef } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { Alert } from "@/components/ui/feedback";
import type { ChatBranch, Message } from "./chat-state";

const suggestions = [
  {
    label: "Chính sách nghỉ phép",
    question: "Chính sách nghỉ phép của công ty như thế nào?",
  },
  {
    label: "Cấp thiết bị",
    question: "Làm thế nào để đề nghị cấp thiết bị làm việc?",
  },
];

export function ChatPanel({
  branch,
  messages,
  pending,
  error,
  split,
  onSuggest,
}: {
  branch: ChatBranch;
  messages: Message[];
  pending: boolean;
  error?: string;
  split: boolean;
  onSuggest: (question: string) => void;
}) {
  const log = useRef<HTMLDivElement>(null);
  const label = branch === "cache" ? "Cache" : "Không cache";
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages, pending, error, split]);

  return (
    <section className="chat-panel" data-branch={branch} aria-label={label}>
      {split && (
        <header className="chat-panel-heading">
          <h2>{label}</h2>
        </header>
      )}
      <div
        className="messages"
        ref={log}
        role="log"
        aria-label={`Nội dung hội thoại · ${label}`}
        aria-live="polite"
        aria-relevant="additions text"
      >
        {messages.length === 0 && !split && (
          <div className="welcome">
            <h2>Bạn cần tìm thông tin gì?</h2>
            <div className="suggestions">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.label}
                  type="button"
                  onClick={() => onSuggest(suggestion.question)}
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message) => (
            <article
              className={`message ${message.role}`}
              key={message.id}
              aria-label={message.role === "user" ? "Bạn" : "Trợ lý"}
            >
              <div className="avatar" aria-hidden="true">
                {message.role === "user" ? "B" : "C"}
              </div>
              <div className="message-body">
                <p>{message.text}</p>
                {message.role === "assistant" && <CopyButton text={message.text} />}
              </div>
            </article>
        ))}
        {pending && (
          <p className="small muted" role="status">Đang chuẩn bị phản hồi mẫu…</p>
        )}
        {error && (
          <Alert title="Chưa có phản hồi" tone="danger">{error}</Alert>
        )}
      </div>
    </section>
  );
}
