"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/fields";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/feedback";
import type { ChatBranch, Conversation } from "./chat-state";
import { chatMetricDefinitions, getDemoMetricValues } from "./chat-metrics-model";

const metricIcons = {
  cacheStatus: "grid",
  responseTime: "clock",
  llmCalls: "chat",
  llmTokens: "file",
  permission: "lock",
} as const;

export function ChatMetrics({ conversation }: { conversation: Conversation }) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const turn = conversation.turns.find((item) => item.id === selectedId);

  useEffect(() => {
    if (!open || !dialog.current) return;
    const element = dialog.current;
    const button = trigger.current;
    element.showModal();
    element.querySelector<HTMLSelectElement>("select:not(:disabled)")?.focus();
    return () => {
      element.close();
      if (button?.isConnected) button.focus();
    };
  }, [open]);

  return (
    <>
      <Button
        ref={trigger}
        variant="tertiary"
        className="chat-metrics-trigger"
        aria-label="Thông số"
        title="Thông số"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setSelectedId(conversation.turns.at(-1)?.id ?? "");
          setOpen(true);
        }}
      >
        <Icon name="chart" />
        <span className="chat-metrics-button-label">Thông số</span>
      </Button>
      <dialog
        ref={dialog}
        id={id}
        className="nui nui-theme nui-dialog chat-metrics-dialog"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
      >
        <div className="chat-metrics-heading">
          <div className="chat-metrics-heading-title">
            <span className="chat-metrics-heading-icon"><Icon name="chart" /></span>
            <h2 id={`${id}-title`}>Thông số</h2>
            <Badge tone="neutral">Mô phỏng</Badge>
          </div>
          <Button
            variant="tertiary"
            className="icon-button"
            aria-label="Đóng thông số"
            onClick={() => setOpen(false)}
          >
            <Icon name="close" />
          </Button>
        </div>
        <p className="chat-metrics-note" id={`${id}-description`}>
          Chưa đo AI/cache. LLM chưa được gọi.
        </p>
        <div className="chat-metrics-query">
          <Select
            label="Câu hỏi đã gửi"
            value={selectedId}
            disabled={conversation.turns.length === 0}
            options={conversation.turns.length
              ? conversation.turns.map((item, index) => ({
                  value: item.id,
                  label: `${index + 1}. ${item.prompt.replace(/\s+/g, " ").slice(0, 100)}${item.prompt.length > 100 ? "…" : ""}`,
                })).reverse()
              : [{ value: "", label: "Chưa có câu hỏi đã gửi" }]}
            onChange={(event) => setSelectedId(event.target.value)}
          />
          {turn && <p className="chat-metrics-prompt">{turn.prompt}</p>}
        </div>
        <div className="chat-metrics-columns">
          {(["no-cache", "cache"] as const).map((branch: ChatBranch) => {
            const result = turn?.branches[branch];
            const values = getDemoMetricValues(turn, branch);
            const status = !turn ? "Chưa có lượt gửi"
              : !result ? "Không chạy ở lượt này"
                : result.status === "pending" ? "Đang chờ phản hồi"
                  : result.status === "error" ? "Lỗi phản hồi" : "Phản hồi mẫu";
            return (
              <section
                className="chat-metrics-column"
                key={branch}
                data-metrics-branch={branch}
                data-state={result?.status ?? (turn ? "not-run" : "empty")}
                aria-labelledby={`${id}-${branch}`}
              >
                <div className="chat-metrics-column-heading">
                  <span className="chat-metrics-branch-icon">
                    <Icon name={branch === "cache" ? "grid" : "chat"} />
                  </span>
                  <div>
                    <h3 id={`${id}-${branch}`}>{branch === "cache" ? "Có cache" : "Không cache"}</h3>
                    <p className="chat-metrics-state" role="status"><Badge tone="neutral">{status}</Badge></p>
                  </div>
                </div>
                <dl>
                  {chatMetricDefinitions.map((metric) => (
                    <div key={metric.key} data-metric={metric.key}>
                      <dt title={"hint" in metric ? metric.hint : undefined}>
                        <span className="chat-metric-icon"><Icon name={metricIcons[metric.key]} /></span>
                        <span>{metric.label}</span>
                      </dt>
                      <dd
                        className={values[metric.key] === "0" ? "chat-metric-number" : "chat-metric-placeholder"}
                        data-unverified={values[metric.key] === "Chưa xác minh" || undefined}
                      >
                        <span>{values[metric.key]}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
                {result?.error && (
                  <p className="chat-metrics-error" role="alert">{result.error}</p>
                )}
              </section>
            );
          })}
        </div>
      </dialog>
    </>
  );
}
