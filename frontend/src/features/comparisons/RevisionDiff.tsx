import { Fragment, useId, useMemo, useRef, useState } from "react";
import { pythonLanguage } from "@codemirror/lang-python";
import { classHighlighter, highlightCode } from "@lezer/highlight";
import type { Revision } from "../code-changes/changeWorkflowApi";
import { comparisonDiff, completeComparisonDiff } from "./comparisonDiff";

type CodeToken = { text: string; style: string };

function pythonLines(source: string) {
  const code = source.replace(/\r\n?/g, "\n");
  const lines: CodeToken[][] = [[]];
  highlightCode(code, pythonLanguage.parser.parse(code), classHighlighter,
    (text, style) => lines.at(-1)!.push({ text, style }),
    () => { lines.push([]); });
  return lines;
}

function renderTokens(tokens: CodeToken[]) {
  return tokens.map(({ text, style }, index) => <span key={index} className={style || undefined}>{text}</span>);
}

export function RevisionDiff({ revision }: { revision: Revision }) {
  const id = useId();
  const [view, setView] = useState<"diff" | "base" | "candidate">("diff");
  const diffRegion = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => {
    const hunks = revision.base_text === revision.content ? [] : comparisonDiff(revision.diff);
    return hunks && (completeComparisonDiff(hunks, revision.base_text, revision.content) ?? hunks.flat());
  }, [revision.base_text, revision.content, revision.diff]);
  const before = useMemo(() => pythonLines(revision.base_text), [revision.base_text]);
  const after = useMemo(() => pythonLines(revision.content), [revision.content]);
  const added = lines?.filter(line => line.kind === "added").length;
  const removed = lines?.filter(line => line.kind === "removed").length;
  return <>
    <div className="comparison-diff-toolbar">
      <label htmlFor={id}>Nội dung</label>
      <select id={id} value={view} onChange={event => setView(event.target.value as typeof view)}>
        <option value="diff">Bản sửa có đánh dấu</option>
        <option value="base">Toàn bộ file gốc</option>
        <option value="candidate">Toàn bộ file sau sửa</option>
      </select>
      {lines && view === "diff" && <>
        <span className="comparison-addition">+{added} dòng thêm</span>
        <span className="comparison-deletion">−{removed} dòng xóa</span>
        {!!(added || removed) && <button type="button" className="comparison-first-change"
          onClick={() => {
            const region = diffRegion.current;
            const change = region?.querySelector<HTMLElement>('tr[data-kind="added"], tr[data-kind="removed"]');
            if (region && change) region.scrollTop += change.getBoundingClientRect().top - region.getBoundingClientRect().top - 48;
          }}>Đến dòng sửa</button>}
      </>}
    </div>
    {view !== "diff" ? <div className="comparison-code-scroll" role="region" aria-label="Toàn bộ nội dung file" tabIndex={0}>
      <pre><code>{(view === "base" ? before : after).map((tokens, index) =>
        <Fragment key={index}>{index > 0 && "\n"}{renderTokens(tokens)}</Fragment>)}</code></pre>
    </div> : lines ? (
      <div ref={diffRegion} className="comparison-code-scroll" role="region" aria-label="Toàn bộ file và các dòng thay đổi" tabIndex={0}>
        <table className="comparison-code">
          <colgroup><col className="comparison-code-number" /><col className="comparison-code-number" />
            <col className="comparison-code-marker" /><col /></colgroup>
          <thead><tr><th scope="col">Gốc</th><th scope="col">Sau</th><th scope="col" colSpan={2}>Mã nguồn</th></tr></thead>
          <tbody>
            {lines.map(line => {
              const tokens = line.after !== null ? after[line.after - 1] : before[line.before! - 1];
              return <tr key={`${line.before}:${line.after}`} data-kind={line.kind}>
                <td>{line.before}</td><td>{line.after}</td>
                <td className="comparison-code-sign">{line.kind === "added" ? "+" : line.kind === "removed" ? "−" : ""}</td>
                <td><code>{tokens?.map(token => token.text).join("") === line.text ? renderTokens(tokens) : line.text}</code></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    ) : <div className="comparison-code-scroll" role="region" aria-label="Diff gốc" tabIndex={0}>
      <pre><code>{revision.diff || "Xem toàn bộ file gốc và file sau sửa để đối chiếu."}</code></pre>
    </div>}
  </>;
}
