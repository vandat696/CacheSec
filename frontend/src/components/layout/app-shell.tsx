"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "../ui/button";
import { Badge, ToastProvider } from "../ui/feedback";
import { Icon } from "../ui/icon";

const navigation = [
  { href: "/", label: "Không gian trò chuyện", icon: "chat" },
  { href: "/ui", label: "Thư viện UI", icon: "grid" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const title =
    navigation.find((item) => item.href === pathname)?.label ?? "CacheSec";

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
      const controls = sidebar.current?.querySelectorAll<HTMLElement>(
        "a[href], button:not(:disabled)",
      );
      if (!controls?.length) return;
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
            Nói<Badge tone="neutral">CacheSec</Badge>
            <button
              className="drawer-close"
              type="button"
              aria-label="Đóng điều hướng"
              onClick={() => setDrawerOpen(false)}
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="stack">
            <div className="eyebrow">Không gian làm việc</div>
            <nav>
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav${pathname === item.href ? " active" : ""}`}
                  aria-current={pathname === item.href ? "page" : undefined}
                  onClick={() => setDrawerOpen(false)}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="stack">
            <div className="eyebrow">Nghĩ cùng nhau</div>
            <p className="small muted">
              Một nền tảng gọn gàng.
              <br />
              Nhiều cách để phát triển.
            </p>
          </div>
          <div className="sidebar-note stack">
            <div className="profile">
              <div className="avatar" aria-hidden="true">
                B
              </div>
              <div>
                <strong className="small">Không gian của bạn</strong>
                <p className="small muted">Dữ liệu trong phiên hiện tại</p>
              </div>
            </div>
          </div>
        </aside>
        <div className="workspace" inert={drawerOpen}>
          <header className="topbar">
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
              <div className="crumb">
                <span>CacheSec</span>
                <span aria-hidden="true">/</span>
                <strong>{title}</strong>
              </div>
            </div>
            <Badge tone="neutral">
              {pathname === "/ui" ? "21 component" : "Chế độ mô phỏng"}
            </Badge>
          </header>
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
