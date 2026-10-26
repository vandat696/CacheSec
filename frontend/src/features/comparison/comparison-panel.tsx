"use client";

import { useId } from "react";
import { Select } from "@/components/ui/fields";
import { CopyButton } from "@/components/ui/copy-button";
import {
  cacheLabels,
  type ComparisonPreview,
  type ProfileDraft,
} from "@/features/workspace/workspace-model";

export function ComparisonPanel({
  slot,
  selectedId,
  profiles,
  onSelect,
  preview,
}: {
  slot: "A" | "B";
  selectedId: string;
  profiles: ProfileDraft[];
  onSelect: (id: string) => void;
  preview: ComparisonPreview | null;
}) {
  const id = useId();
  const profile =
    preview?.profiles[slot === "A" ? 0 : 1] ??
    profiles.find((item) => item.id === selectedId)!;
  return (
    <article
      className={`comparison-panel panel-${slot.toLowerCase()}`}
      aria-labelledby={`${id}-title`}
    >
      <div className="comparison-panel-head">
        <h2 className="slot-label" id={`${id}-title`}>
          {slot}
        </h2>
        <Select
          label={`Profile khung ${slot}`}
          value={selectedId}
          options={profiles.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
          onChange={(event) => onSelect(event.target.value)}
        />
      </div>
      <div className="comparison-answer" aria-live="polite">
        {!preview ? (
          <p className="answer-empty">Chưa có phản hồi</p>
        ) : (
          <div className="answer-content">
            <p>{preview.answer ?? "Câu hỏi này chưa có nội dung mẫu."}</p>
            {preview.source && (
              <div className="answer-source">
                <strong>{preview.source.title}</strong>
                <span>{preview.source.section}</span>
              </div>
            )}
            {preview.answer && (
              <div className="answer-footer">
                <CopyButton text={preview.answer} />
              </div>
            )}
          </div>
        )}
      </div>
      <dl className="comparison-metrics">
        {["Thời gian", "Token", "Chi phí ước tính"].map((label) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd aria-label="Chưa đo">—</dd>
          </div>
        ))}
      </dl>
      <details className="processing-details">
        <summary>Chi tiết</summary>
        <dl>
          <div>
            <dt>Profile</dt>
            <dd>
              {profile.name} · v{profile.revision}
            </dd>
          </div>
          <div>
            <dt>Cache</dt>
            <dd>{cacheLabels[profile.cacheLocation]}</dd>
          </div>
          <div>
            <dt>Số đo</dt>
            <dd>Chưa đo</dd>
          </div>
          <div>
            <dt>Quyền</dt>
            <dd>Chưa xác minh</dd>
          </div>
          <div>
            <dt>Phạm vi dự kiến</dt>
            <dd>Riêng người dùng</dd>
          </div>
        </dl>
      </details>
    </article>
  );
}
