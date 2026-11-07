"use client";
import { type ReactNode } from "react";
export function Alert({
  title,
  children,
  tone,
}: {
  title: string;
  children: ReactNode;
  tone?: "danger";
}) {
  return (
    <div
      className="nui nui-theme nui-alert"
      role={tone === "danger" ? "alert" : "status"}
    >
      <strong>{title}</strong>
      <p className="nui-help">{children}</p>
    </div>
  );
}
