"use client";
import { type ReactNode } from "react";
export type BadgeTone = "primary" | "success" | "danger" | "neutral";
export function Badge({
  children,
  tone = "primary",
}: {
  children: ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <span className="nui nui-theme nui-badge" data-tone={tone}>
      {children}
    </span>
  );
}
