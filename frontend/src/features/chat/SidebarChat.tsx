"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useChat } from "./ChatProvider";

const PAGE_SIZE = 5;

export function SidebarChat({
  active,
  onNavigate,
  collapsed = false,
}: {
  active: boolean;
  onNavigate: () => void;
  collapsed?: boolean;
}) {
  const chat = useChat();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const historyExpanded = expanded && !collapsed;

  function toggleHistory() {
    if (!expanded) setVisibleCount(PAGE_SIZE);
    setExpanded(!expanded);
  }

  return (
    <div className="sidebar-chat">
      <div className="sidebar-chat-heading">
        <Link
          href="/"
          className={`nav${active ? " active" : ""}`}
          aria-current={active ? "page" : undefined}
          aria-label="Chat mô phỏng"
          title="Chat mô phỏng"
          aria-controls="chat-history"
          aria-expanded={historyExpanded}
          onClick={() => {
            if (collapsed) { onNavigate(); return; }
            if (active) toggleHistory();
            else {
              setVisibleCount(PAGE_SIZE);
              setExpanded(true);
            }
          }}
        >
          <Icon name="chat" />
          <span>Chat mô phỏng</span>
        </Link>
        <button
          type="button"
          className="history-toggle"
          hidden={collapsed}
          aria-label="Lịch sử chat"
          aria-controls="chat-history"
          aria-expanded={historyExpanded}
          onClick={toggleHistory}
        >
          <Icon name="chevron" />
        </button>
      </div>
      <div
        id="chat-history"
        className={`history-collapse${historyExpanded ? " expanded" : ""}`}
        inert={!historyExpanded}
        aria-hidden={!historyExpanded}
      >
        <div className="history-collapse-inner">
          <div className="sidebar-chat-section">
            <Button
              className="new-conversation"
              variant="secondary"
              disabled={chat.state.pending !== null}
              onClick={() => {
                chat.create();
                router.push("/");
                onNavigate();
              }}
            >
              <Icon name="plus" />
              Chat mới
            </Button>
            <div className="history-list" aria-label="Lịch sử hội thoại">
              {chat.state.conversations.slice(0, visibleCount).map((conversation) => (
                <Link
                  key={conversation.id}
                  href="/"
                  className={`history-item${conversation.id === chat.state.activeId ? " active" : ""}`}
                  aria-current={
                    conversation.id === chat.state.activeId ? "true" : undefined
                  }
                  title={conversation.title}
                  onClick={() => {
                    chat.select(conversation.id);
                    onNavigate();
                  }}
                >
                  {conversation.title}
                </Link>
              ))}
            </div>
            {visibleCount < chat.state.conversations.length && (
              <button
                type="button"
                className="history-more"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              >
                Hiển thị thêm
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
