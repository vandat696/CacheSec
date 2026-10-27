"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "../ui/button";
import { ToastProvider } from "../ui/feedback";
import { Icon } from "../ui/icon";
import { useChat } from "@/features/chat/chat-provider";
import { ChatSettings } from "@/features/chat/chat-settings";
import { ChatMetrics } from "@/features/chat/chat-metrics";

const navigation = [
  { href: "/", label: "Chat", icon: "chat" },
  { href: "/documents", label: "Tài liệu", icon: "book" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const chat = useChat();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    const toggleButton = toggle.current;
    document.body.style.overflow = "hidden";
    sidebar.current?.querySelector<HTMLElement>("a, button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawerOpen(false);
      }
      if (event.key !== "Tab") return;
      const controls = [
        ...(sidebar.current?.querySelectorAll<HTMLElement>(
          "a[href], button:not(:disabled)",
        ) ?? []),
      ].filter((control) => control.getClientRects().length > 0);
      if (!controls.length) return;
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const desktop = window.matchMedia("(min-width: 768px)");
    const resize = () => {
      if (desktop.matches) setDrawerOpen(false);
    };
    document.addEventListener("keydown", keydown);
    desktop.addEventListener("change", resize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keydown);
      desktop.removeEventListener("change", resize);
      toggleButton?.focus();
    };
  }, [drawerOpen]);

  return (
    <ToastProvider>
      <a href="#main-content" className="skip-link">
        Đến nội dung chính
      </a>
      <div className="app">
        {drawerOpen && (
          <button
            type="button"
            className="scrim"
            aria-label="Đóng điều hướng"
            tabIndex={-1}
            onClick={() => setDrawerOpen(false)}
          />
        )}
        <aside
          className={`sidebar${drawerOpen ? " open" : ""}`}
          id="sidebar"
          ref={sidebar}
          aria-label="Điều hướng chính"
        >
          <div className="brand">
            <span className="brandmark">
              <Icon name="chat" />
            </span>
            <div className="brand-word">CacheSec</div>
            <button
              className="drawer-close"
              type="button"
              aria-label="Đóng điều hướng"
              onClick={() => setDrawerOpen(false)}
            >
              <Icon name="close" />
            </button>
          </div>
          <nav aria-label="Khu làm việc">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav${pathname === item.href ? " active" : ""}`}
                aria-current={pathname === item.href ? "page" : undefined}
                onClick={() => setDrawerOpen(false)}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
          {pathname === "/" && (
            <div className="sidebar-chat-section">
              <Button
                className="new-conversation"
                variant="secondary"
                disabled={chat.state.pending !== null}
                onClick={() => {
                  chat.create();
                  setDrawerOpen(false);
                }}
              >
                <Icon name="plus" />
                Chat mới
              </Button>
              <div className="history-list" aria-label="Lịch sử hội thoại">
                {chat.state.conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    className={`history-item${conversation.id === chat.state.activeId ? " active" : ""}`}
                    aria-current={
                      conversation.id === chat.state.activeId
                        ? "true"
                        : undefined
                    }
                    onClick={() => {
                      chat.select(conversation.id);
                      setDrawerOpen(false);
                    }}
                  >
                    {conversation.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
        <div
          className={`workspace${pathname === "/" ? " chat-workspace-shell" : ""}`}
          inert={drawerOpen}
        >
          <header className={`topbar${pathname === "/" ? " chat-topbar" : ""}`}>
            <div className="row">
              <Button
                className="mobile-toggle icon-button"
                ref={toggle}
                variant="secondary"
                aria-label="Mở điều hướng"
                aria-controls="sidebar"
                aria-expanded={drawerOpen}
                onClick={() => setDrawerOpen(true)}
              >
                <Icon name="menu" />
              </Button>
              <span className="workspace-brand">CacheSec</span>
            </div>
            <details className="environment">
              <summary>Mô phỏng</summary>
              <p>
                Chat chưa nối AI. Tệp được chọn chỉ nằm trong phiên, chưa tải
                lên hoặc nạp vào chatbot.
              </p>
            </details>
            {pathname === "/" && (
              <>
                <ChatMetrics
                  key={`metrics-${chat.conversation.id}`}
                  conversation={chat.conversation}
                />
                <ChatSettings
                  key={chat.conversation.id}
                  mode={chat.conversation.mode}
                  disabled={chat.state.pending !== null}
                  onChange={chat.setMode}
                />
              </>
            )}
          </header>
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
