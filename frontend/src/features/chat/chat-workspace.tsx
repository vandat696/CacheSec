"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Alert } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { useChat } from "./chat-provider";

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

export function ChatWorkspace() {
  const { state, conversation, send, setDraft } = useChat();
  const [invalidId, setInvalidId] = useState<string | null>(null);
  const invalid = invalidId === conversation.id;
  const prompt = useRef<HTMLTextAreaElement>(null);
  const messages = useRef<HTMLDivElement>(null);
  const busy = state.pendingId !== null;
  const pendingHere = state.pendingId === conversation.id;

  useEffect(() => {
    messages.current?.scrollTo({ top: messages.current.scrollHeight });
  }, [conversation.messages.length, conversation.id, pendingHere]);

  function submit() {
    if (busy) return;
    if (!conversation.draft.trim()) {
      setInvalidId(conversation.id);
      prompt.current?.focus();
      return;
    }
    setInvalidId(null);
    void send(conversation.draft);
    prompt.current?.focus();
  }

  return (
    <section className="chat-layout" aria-label="Chat nội bộ">
      <div className="chat-main">
        <header className="chat-heading">
          <h1>Chat nội bộ</h1>
        </header>
        <div
          className="messages"
          ref={messages}
          role="log"
          aria-label="Nội dung hội thoại"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {conversation.messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-icon">
                <Icon name="chat" />
              </div>
              <h2>Bạn cần tìm thông tin gì?</h2>
              <div className="suggestions">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.label}
                    type="button"
                    onClick={() => {
                      setDraft(suggestion.question);
                      setInvalidId(null);
                      prompt.current?.focus();
                    }}
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
              <Link href="/documents" className="chat-documents-link">
                Thêm tài liệu
              </Link>
            </div>
          ) : (
            conversation.messages.map((message) => (
              <article className={`message ${message.role}`} key={message.id}>
                <div className="avatar" aria-hidden="true">
                  {message.role === "user" ? "B" : "C"}
                </div>
                <div className="message-body">
                  <strong>{message.role === "user" ? "Bạn" : "Trợ lý"}</strong>
                  <p>{message.text}</p>
                  {message.role === "assistant" && (
                    <CopyButton text={message.text} />
                  )}
                </div>
              </article>
            ))
          )}
          {pendingHere && (
            <p className="small muted" role="status">
              Đang chuẩn bị phản hồi mẫu…
            </p>
          )}
        </div>
        {state.error && (
          <Alert title="Chưa có phản hồi" tone="danger">
            {state.error}
          </Alert>
        )}
        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="composer-box">
            <label className="sr-only" htmlFor="prompt">
              Tin nhắn
            </label>
            <textarea
              ref={prompt}
              id="prompt"
              placeholder="Hỏi về tài liệu công ty…"
              maxLength={4000}
              value={conversation.draft}
              aria-invalid={invalid}
              aria-describedby="chat-error composer-help"
              onChange={(event) => {
                setDraft(event.target.value);
                setInvalidId(null);
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  submit();
                }
              }}
            />
            <p
              className="chat-error"
              id="chat-error"
              role="alert"
              hidden={!invalid}
            >
              Nhập tin nhắn để tiếp tục.
            </p>
            <div className="composer-bottom">
              <span className="small muted" id="composer-help">
                Enter để gửi
              </span>
              <Button type="submit" disabled={busy} aria-label="Gửi tin nhắn">
                <Icon name="send" />
                Gửi
              </Button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
