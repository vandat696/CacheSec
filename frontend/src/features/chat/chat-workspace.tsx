"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useChat } from "./chat-provider";
import { branchesForMode } from "./chat-state";
import { ChatPanel } from "./chat-panel";

export function ChatWorkspace() {
  const { state, conversation, send, setDraft } = useChat();
  const [invalidId, setInvalidId] = useState<string | null>(null);
  const invalid = invalidId === conversation.id;
  const prompt = useRef<HTMLTextAreaElement>(null);
  const busy = state.pending !== null;
  const split = conversation.mode === "compare";

  useLayoutEffect(() => {
    const textarea = prompt.current;
    if (!textarea) return;
    const resize = () => {
      textarea.style.height = "0px";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [conversation.draft, conversation.id]);

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
    <section className="chat-layout" aria-label="Chat">
      <h1 className="sr-only">Chat</h1>
      <div className={`chat-main${split ? " chat-comparison" : ""}`}>
        <div className="chat-panels">
          {branchesForMode(conversation.mode).map((branch) => (
            <ChatPanel
              key={`${conversation.id}-${branch}`}
              branch={branch}
              messages={conversation.messages[branch]}
              pending={
                state.pending?.conversationId === conversation.id &&
                state.pending.branches.includes(branch)
              }
              error={conversation.errors[branch]}
              split={split}
              onSuggest={(question) => {
                setDraft(question);
                setInvalidId(null);
                prompt.current?.focus();
              }}
            />
          ))}
        </div>
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
              rows={1}
              placeholder="Nhập tin nhắn…"
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
            <Button type="submit" disabled={busy} aria-label="Gửi tin nhắn">
              <Icon name="send" />
              Gửi
            </Button>
          </div>
          <p
            className="chat-error"
            id="chat-error"
            role="alert"
            hidden={!invalid}
          >
            Nhập tin nhắn để tiếp tục.
          </p>
          <span className="sr-only" id="composer-help">
            Enter để gửi{split ? " cho cả hai bên" : ""}, Shift+Enter để xuống dòng.
          </span>
        </form>
      </div>
    </section>
  );
}
