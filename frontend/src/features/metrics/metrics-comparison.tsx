import { branches, branchLabels, ResponseOutcomes } from "./metrics-charts";
import { getBetterBranch, getDemoComparisonRows, type ComparisonRow } from "./metrics-comparison-model";
import type { BranchSummary } from "./metrics-model";

export function MetricsComparisonTable({ rows }: {
  rows: readonly ComparisonRow[];
}) {
  return (
    <table className="metrics-comparison-table">
      <caption className="sr-only">Không cache bên trái, tiêu chí ở giữa, Cache bên phải. Giá trị tốt hơn được in đậm và tô màu khi có phép đo tương đương; bằng nhau hoặc chưa đủ dữ liệu giữ trung tính.</caption>
      <colgroup><col /><col /><col /></colgroup>
      <thead>
        <tr>
          <th scope="col" data-comparison-branch="no-cache">Không cache</th>
          <th scope="col">Tiêu chí</th>
          <th scope="col" data-comparison-branch="cache">Cache</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const better = getBetterBranch(row);
          const valueCell = (branch: (typeof branches)[number]) => (
            <td data-comparison-value={branch} data-better={better === branch || undefined}>
              {better === branch ? (
                <strong>{row.values[branch].text}<span className="sr-only"> · Tốt hơn</span></strong>
              ) : <span>{row.values[branch].text}</span>}
            </td>
          );
          return (
            <tr key={row.key} data-comparison-metric={row.key}>
              {valueCell("no-cache")}
              <th scope="row">{row.label}</th>
              {valueCell("cache")}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function MetricsComparison({ summaries, rows }: { summaries: Record<(typeof branches)[number], BranchSummary>; rows?: readonly ComparisonRow[] }) {
  return (
    <section className="metrics-panel metrics-comparison" aria-label="So sánh Không cache và Cache">
      <MetricsComparisonTable rows={rows ?? getDemoComparisonRows(summaries)} />
      <div className="metrics-comparison-outcomes" aria-label={`Trạng thái phản hồi ${branchLabels["no-cache"]} và ${branchLabels.cache}`}>
        <ResponseOutcomes summaries={summaries} />
      </div>
    </section>
  );
}
