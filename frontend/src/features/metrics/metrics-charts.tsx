import { useId } from "react";
import type { ChatBranch } from "../chat/chat-state";
import type { BranchSummary } from "./metrics-model";
import type { CacheCounts } from "./metrics-preview";

export const branchLabels = { "no-cache": "Không cache", cache: "Cache" } as const;
export const branches = ["no-cache", "cache"] as const;

export function BranchLegend({ visibleBranches = branches }: { visibleBranches?: readonly ChatBranch[] }) {
  return (
    <div className="metrics-legend" aria-label="Chú giải hai nhánh">
      {visibleBranches.map((branch) => (
        <span key={branch}><i className={`metrics-key ${branch}`} />{branchLabels[branch]}</span>
      ))}
    </div>
  );
}

export function ComparisonPlot({
  values,
  unit,
  visibleBranches = branches,
  sample = false,
}: {
  values: Record<(typeof branches)[number], number | null>;
  unit: string;
  visibleBranches?: readonly ChatBranch[];
  sample?: boolean;
}) {
  const id = useId();
  const known = visibleBranches.filter((branch) => values[branch] !== null);
  const maximum = Math.max(0, ...known.map((branch) => values[branch]!));
  const title = `${unit} · ${visibleBranches.map((branch) => branchLabels[branch]).join(" / ")}`;
  return (
    <figure className="metrics-comparison-plot">
      <svg viewBox="0 0 640 230" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>{title}</title>
        <desc id={`${id}-desc`}>
          {`${visibleBranches.map((branch) => `${branchLabels[branch]}: ${values[branch] ?? "chưa có dữ liệu"}`).join(". ")}. ${sample ? "Dữ liệu giả để xem giao diện." : "Giá trị 0 là demo không gọi LLM, không thể hiện mức tiết kiệm."}`}
        </desc>
        {[48, 180, 312, 444, 576].map((x) => (
          <line key={x} x1={x} x2={x} y1="24" y2="185" className="metrics-gridline" />
        ))}
        {visibleBranches.map((branch, index) => (
          <g key={branch} className={`metrics-series ${branch}`}>
            <text x="48" y={43 + index * 76} className="metrics-series-label">{branchLabels[branch]}</text>
            <rect x="48" y={54 + index * 76} width="528" height="26" rx="4" className="metrics-empty-track" />
            {values[branch] !== null && values[branch]! > 0 && <rect x="48" y={54 + index * 76} width={values[branch]! / maximum * 528} height="26" rx="4" fill="currentColor" />}
            {values[branch] === 0 && <circle cx="48" cy={67 + index * 76} r="5" fill="currentColor" />}
            <text x="576" y={43 + index * 76} textAnchor="end">{values[branch] === null ? "—" : Math.round(values[branch]!).toLocaleString("vi-VN")}</text>
          </g>
        ))}
        <text x="48" y="212" className="metrics-axis-label">{known.length ? "0" : "Chưa có phép đo"}</text>
        <text x="576" y="212" textAnchor="end" className="metrics-axis-label">{maximum > 0 ? `${maximum} ` : ""}{unit}</text>
      </svg>
      <figcaption>
        {sample ? "Dữ liệu mẫu" : known.length ? "Demo không gọi LLM." : "Chưa đo thời gian thực; không dùng độ trễ của phản hồi mẫu."}
      </figcaption>
    </figure>
  );
}

export function ResponseOutcomes({ summaries, visibleBranches = branches }: {
  summaries: Record<ChatBranch, BranchSummary>;
  visibleBranches?: readonly ChatBranch[];
}) {
  const outcomes = [
    { key: "complete", label: "Hoàn tất", className: "complete" },
    { key: "pending", label: "Đang chờ", className: "pending" },
    { key: "error", label: "Lỗi", className: "error" },
  ] as const;
  return (
    <>
      <div className="metrics-outcomes">
        {visibleBranches.map((branch) => {
          const summary = summaries[branch];
          return (
            <div className="metrics-outcome-row" key={branch}>
              <div><span>{branchLabels[branch]}</span><strong>{summary.total} phản hồi</strong></div>
              <div className="metrics-stacked-bar" role="img" aria-label={`${branchLabels[branch]}: ${summary.complete} hoàn tất, ${summary.pending} đang chờ, ${summary.error} lỗi`}>
                {outcomes.map(({ key, className }) => summary[key] > 0 && (
                  <span key={key} className={className} style={{ width: `${summary[key] / summary.total * 100}%` }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function CacheOutcomes({ counts }: { counts?: CacheCounts }) {
  const total = counts ? counts.hit + counts.miss + counts.rejected : 0;
  const hitPercent = counts && total ? counts.hit / total * 100 : 0;
  const missEnd = counts && total ? (counts.hit + counts.miss) / total * 100 : 0;
  return (
    <div className="metrics-cache-outcomes">
      <div className={`metrics-empty-ring${counts ? " metrics-sample-ring" : ""}`} role="img"
        style={counts ? { background: `conic-gradient(var(--metrics-hit) 0% ${hitPercent}%, var(--metrics-miss) ${hitPercent}% ${missEnd}%, var(--metrics-rejected) ${missEnd}% 100%)` } : undefined}
        aria-label={counts ? `Dữ liệu mẫu: ${counts.hit} Hit, ${counts.miss} Miss, ${counts.rejected} Rejected trên ${total} lượt tra cache` : "Tỷ lệ cache chưa đo; chưa có kết quả Hit, Miss hoặc Rejected"}>
        <strong>{counts && total ? `${hitPercent.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%` : "—"}</strong><span>Hit hợp lệ</span>
      </div>
      <dl>
        <div><dt><i className="metrics-cache-key hit" />Hit</dt><dd>{counts?.hit ?? "—"}</dd></div>
        <div><dt><i className="metrics-cache-key miss" />Miss</dt><dd>{counts?.miss ?? "—"}</dd></div>
        <div><dt><i className="metrics-cache-key rejected" />Rejected</dt><dd>{counts?.rejected ?? "—"}</dd></div>
      </dl>
      <p className="metrics-footnote">{counts ? "Rejected: bỏ cache không hợp lệ và sinh lại câu trả lời trong kịch bản mẫu." : "Chưa có lượt được xác minh cache. Chỉ tính hit sau khi kiểm tra quyền và tính hợp lệ."}</p>
    </div>
  );
}
