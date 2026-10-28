import { branches } from "./metrics-charts";
import { formatComparisonValue, getBetterBranch, getDemoComparisonRows, isValidComparisonValue, type ComparisonRow } from "./metrics-comparison-model";
import type { BranchSummary } from "./metrics-model";

export function MetricsComparisonTable({ rows }: {
  rows: readonly ComparisonRow[];
}) {
  return (
    <table className="metrics-comparison-table">
      <caption className="sr-only">Không cache bên trái, tiêu chí ở giữa, Cache bên phải. Hai bên dùng cùng đơn vị trong mỗi hàng. Giá trị tốt hơn in đậm, màu xanh dương cho Không cache và nâu cam cho Cache; bằng nhau hoặc chưa đủ dữ liệu giữ trung tính.</caption>
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
                <strong>{formatComparisonValue(row, row.values[branch])}<span className="sr-only"> · Tốt hơn</span></strong>
              ) : <span>{formatComparisonValue(row, row.values[branch])}</span>}
              {row.values[branch].samples && isValidComparisonValue(row.unit, row.values[branch]) && <small className="metrics-comparison-samples">{row.values[branch].samples.count}/{row.values[branch].samples.total} ca</small>}
            </td>
          );
          return (
            <tr key={row.key} data-comparison-metric={row.key} data-unit={row.unit}>
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
    </section>
  );
}
