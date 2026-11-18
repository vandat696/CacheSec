import { useId, useState } from "react";
import type { Revision } from "../code-changes/changeWorkflowApi";
import { comparisonDiff } from "./comparisonDiff";

export function RevisionDiff({ revision }: { revision: Revision }) {
  const id = useId();
  const [view, setView] = useState<"diff" | "base" | "candidate">("diff");
  const hunks = comparisonDiff(revision.diff);
  const added = hunks?.flat().filter(line => line.kind === "added").length;
  const removed = hunks?.flat().filter(line => line.kind === "removed").length;
  return <>
    <div className="comparison-diff-toolbar">
      <label htmlFor={id}>Nội dung</label>
      <select id={id} value={view} onChange={event => setView(event.target.value as typeof view)}>
        <option value="diff">Các dòng thay đổi</option>
        <option value="base">Toàn bộ file gốc</option>
        <option value="candidate">Toàn bộ file sau sửa</option>
      </select>
      {hunks && view === "diff" && <>
        <span className="comparison-addition">+{added} dòng thêm</span>
        <span className="comparison-deletion">−{removed} dòng xóa</span>
      </>}
    </div>
    {view !== "diff" ? <div className="comparison-code-scroll" role="region" aria-label="Toàn bộ nội dung file" tabIndex={0}>
      <pre><code>{view === "base" ? revision.base_text : revision.content}</code></pre>
    </div> : revision.base_text === revision.content ? <p>File giống hệt bản gốc.</p> : hunks ? (
      <div className="comparison-code-scroll" role="region" aria-label="Các dòng thay đổi" tabIndex={0}>
        <table className="comparison-code">
          <colgroup><col className="comparison-code-number" /><col className="comparison-code-number" />
            <col className="comparison-code-marker" /><col /></colgroup>
          <thead><tr><th scope="col">Gốc</th><th scope="col">Sau</th><th scope="col" colSpan={2}>Mã nguồn</th></tr></thead>
          {hunks.map((hunk, index) => <tbody key={index}>
            {index > 0 && <tr className="comparison-code-gap"><td colSpan={4}>⋯</td></tr>}
            {hunk.map(line => <tr key={`${line.before}:${line.after}`} data-kind={line.kind}>
              <td>{line.before}</td><td>{line.after}</td>
              <td className="comparison-code-sign">{line.kind === "added" ? "+" : line.kind === "removed" ? "−" : ""}</td>
              <td><code>{line.text}</code></td>
            </tr>)}
          </tbody>)}
        </table>
      </div>
    ) : <div className="comparison-code-scroll" role="region" aria-label="Diff gốc" tabIndex={0}>
      <pre><code>{revision.diff || "Xem toàn bộ file gốc và file sau sửa để đối chiếu."}</code></pre>
    </div>}
  </>;
}
