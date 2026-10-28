import { useId, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { chatMetricDefinitions, getDemoMetricValues } from "../chat/chat-metrics-model";
import { chatModes, type ChatBranch } from "../chat/chat-state";
import { branchLabels, branches } from "./metrics-charts";
import type { MetricsRow } from "./metrics-model";
import type { MetricsPreview } from "./metrics-preview";

const PAGE_SIZE = 8;
const statusLabels = { pending: "Đang chờ", complete: "Phản hồi mẫu", error: "Lỗi" } as const;

export function MetricsTurns({ rows, visibleBranches = branches, preview }: {
  rows: readonly MetricsRow[];
  visibleBranches?: readonly ChatBranch[];
  preview?: MetricsPreview;
}) {
  const id = useId();
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const expanded = rows.find(({ conversationId, turn }) => `${conversationId}/${turn.id}` === expandedId);

  return (
    <section className="metrics-panel metrics-turns" aria-labelledby={`${id}-title`}>
      <div className="metrics-panel-heading">
        <div>
          <h2 id={`${id}-title`}>Chi tiết từng phiên, lượt chat</h2>
        </div>
        <span className="metrics-session-label">{rows.length} lượt</span>
      </div>
      {rows.length === 0 ? (
        <div className="metrics-empty">
          <Icon name="chart" />
          <strong>Chưa có lượt gửi trong bộ lọc này</strong>
          <p>Gửi câu hỏi trong Chat để theo dõi tại đây.</p>
        </div>
      ) : (
        <>
          <div className="metrics-table-scroll" role="region" aria-label="Bảng các lượt gửi" tabIndex={0}>
            <table className={`metrics-turns-table${visibleBranches.length === 1 ? " single-branch" : ""}`}>
              <caption className="sr-only">Các lượt gửi trong phiên, giữ riêng từng lượt dù trùng câu hỏi</caption>
              <thead>
                <tr>
                  <th scope="col">Câu hỏi / Hội thoại</th>
                  <th scope="col">Chế độ</th>
                  {visibleBranches.map((branch) => <th scope="col" key={branch}>{branchLabels[branch]}</th>)}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(({ turn, conversationId, conversationTitle, ordinal }) => {
                  const rowId = `${conversationId}/${turn.id}`;
                  return (
                    <tr key={rowId} data-selected={expandedId === rowId || undefined}>
                      <th scope="row">
                        <button type="button" className="metrics-turn-button"
                          aria-expanded={expandedId === rowId} aria-controls={`${id}-detail`}
                          onClick={() => setExpandedId(expandedId === rowId ? null : rowId)}>
                          <span>{ordinal}. {turn.prompt}</span>
                          <small>{conversationTitle}</small>
                        </button>
                      </th>
                      <td>{chatModes.find((mode) => mode.value === turn.mode)?.label}</td>
                      {visibleBranches.map((branch) => (
                        <td key={branch}>
                          <span className={`metrics-response-state ${turn.branches[branch]?.status ?? "not-run"}`}>
                            {turn.branches[branch] ? preview && turn.branches[branch].status === "complete" ? "Hoàn tất (mẫu)" : statusLabels[turn.branches[branch].status] : "Không chạy"}
                          </span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pageCount > 1 && (
            <div className="metrics-pagination">
              <span>Trang {currentPage + 1} / {pageCount}</span>
              <button className="btn" disabled={currentPage === 0}
                onClick={() => { setPage(currentPage - 1); setExpandedId(null); }}>Trước</button>
              <button className="btn" disabled={currentPage === pageCount - 1}
                onClick={() => { setPage(currentPage + 1); setExpandedId(null); }}>Tiếp</button>
            </div>
          )}
        </>
      )}
      <div id={`${id}-detail`} className="metrics-turn-detail-region" hidden={!expanded}>
        {expanded && (
          <div className="metrics-turn-detail">
            <h3>Lượt {expanded.ordinal}: {expanded.turn.prompt}</h3>
            <div className={`metrics-detail-columns${visibleBranches.length === 1 ? " single-branch" : ""}`}>
              {visibleBranches.map((branch) => {
                const values = preview?.details[expanded.turn.id]?.[branch] ?? getDemoMetricValues(expanded.turn, branch);
                return (
                  <section key={branch} aria-label={`Thông số ${branchLabels[branch]}`}>
                    <h4>{branchLabels[branch]}</h4>
                    <dl>
                      {chatMetricDefinitions.map((definition) => (
                        <div key={definition.key}><dt>{definition.label}</dt><dd>{values[definition.key]}</dd></div>
                      ))}
                    </dl>
                    {expanded.turn.branches[branch]?.error && (
                      <p className="metrics-detail-error">{expanded.turn.branches[branch].error}</p>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
