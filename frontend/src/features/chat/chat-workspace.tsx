"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Alert, Badge } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { useChat } from "./use-chat";

export function ChatWorkspace() {
  const { state, conversation, send, setDraft, select, create } = useChat();
  const [invalid, setInvalid] = useState(false);
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
      setInvalid(true);
      prompt.current?.focus();
      return;
    }
    setInvalid(false);
    void send(conversation.draft);
    prompt.current?.focus();
  }

  return (
    <section className="chat-layout" aria-label="Không gian trò chuyện">
      <aside className="history" aria-label="Lịch sử hội thoại">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            create();
            setInvalid(false);
            prompt.current?.focus();
          }}
        >
          <Icon name="plus" />
          Cuộc trò chuyện mới
        </Button>
        <div className="eyebrow history-label">Hội thoại</div>
        <div className="history-list">
          {state.conversations.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`history-item${item.id === conversation.id ? " active" : ""}`}
              aria-current={item.id === conversation.id ? "true" : undefined}
              onClick={() => {
                select(item.id);
                setInvalid(false);
              }}
            >
              {item.title}
            </button>
          ))}
        </div>
      </aside>
      <div className="chat-main">
        <div className="chat-heading">
          <div>
            <h1>Trợ lý Nói</h1>
            <p className="small muted">Một nơi để nghĩ cùng nhau.</p>
          </div>
          <Badge tone="neutral">Chế độ mô phỏng</Badge>
        </div>
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
              <div className="brandmark">
                <Icon name="spark" />
              </div>
              <div className="eyebrow">Không gian của bạn</div>
              <h2>Bắt đầu từ một ý tưởng.</h2>
              <p>
                Viết, tìm hướng giải quyết hoặc sắp xếp suy nghĩ.
                <br />
                Hôm nay bạn muốn bắt đầu với điều gì?
              </p>
              <div className="suggestions">
                {[
                  "Lên dàn ý cho một bài viết",
                  "Sắp xếp công việc trong ngày",
                ].map((text) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => {
                      setDraft(text);
                      prompt.current?.focus();
                    }}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            conversation.messages.map((message) => (
              <article className={`message ${message.role}`} key={message.id}>
                <div className="avatar" aria-hidden="true">
                  {message.role === "user" ? "B" : "N"}
                </div>
                <div className="message-body">
                  <strong>
                    {message.role === "user"
                      ? "Bạn"
                      : "Nói · Phản hồi mô phỏng"}
                  </strong>
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
              Đang chuẩn bị phản hồi mô phỏng…
            </p>
          )}
        </div>
        {state.error && (
          <Alert title="Chưa gửi được phản hồi" tone="danger">
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
            <label htmlFor="prompt">Tin nhắn của bạn</label>
            <textarea
              ref={prompt}
              id="prompt"
              placeholder="Bạn đang nghĩ về điều gì?"
              maxLength={4000}
              value={conversation.draft}
              aria-invalid={invalid}
              aria-describedby="chat-error composer-help"
              onChange={(event) => {
                setDraft(event.target.value);
                setInvalid(false);
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
              Hãy nhập nội dung tin nhắn trước khi gửi.
            </p>
            <div className="composer-bottom">
              <span className="small muted" id="composer-help">
                Enter để gửi · Shift + Enter xuống dòng
              </span>
              <Button
                type="submit"
                className="icon-button"
                disabled={busy}
                aria-label="Gửi tin nhắn"
              >
                <Icon name="send" />
              </Button>
            </div>
          </div>
          <p className="composer-note">
            Phản hồi minh họa giao diện, không phải kết quả từ AI. Hội thoại mất
            khi tải lại trang.
          </p>
        </form>
      </div>
    </section>
  );
}
