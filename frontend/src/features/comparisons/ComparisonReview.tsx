import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { ContextMode } from "../context-cache/contextCacheModel";
import { branchPending, revisionTest, testLabel, type Branch } from "./comparisonModel";
import { ComparisonBranch } from "./ComparisonBranch";
import { RevisionDiff } from "./RevisionDiff";
import type { useComparison } from "./useComparison";

function ReviewBranch({ mode, branch, busy, onOpen, onCancel }: {
  mode: ContextMode; branch?: Branch; busy: boolean; onOpen: (id: string) => void; onCancel: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const revisions = branch?.revisions ?? [];
  const latest = revisions.at(-1);
  const revision = revisions.find(item => item.revision === selected) ?? latest;
  const test = revision && revisionTest(revision);
  return <ComparisonBranch mode={mode} branch={branch} busy={busy} onCancel={onCancel}>
    {revision ? <>
      <div className="comparison-editor-tabs">
        <div className="comparison-editor-file" title={revision.path}>
          <Icon name="code" /><code>{revision.path.split("/").at(-1)}</code>
        </div>
        <div className="comparison-editor-meta">
          {revisions.length > 1
            ? <label>Bản <select value={revision.revision} onChange={event => setSelected(Number(event.target.value))}>
              {revisions.map(item => <option key={item.revision} value={item.revision}>{item.revision}</option>)}
            </select></label>
            : <span>Bản {revision.revision}</span>}
          {revision !== latest && <span className="comparison-test-state" data-status={test?.status}>{testLabel(test?.status)}</span>}
        </div>
      </div>
      <RevisionDiff key={revision.revision} revision={revision} />
      {branch && revision === latest && <Button variant="secondary" disabled={busy || branchPending(branch)} onClick={() => onOpen(revision.proposal_id)}>Mở đề xuất trong editor</Button>}
    </> : <p className="comparison-no-revision">Chưa có bản sửa</p>}
  </ComparisonBranch>;
}

export function ComparisonReview({ comparison, onOpen }: {
  comparison: ReturnType<typeof useComparison>; onOpen: (id: string) => void;
}) {
  const title = useId();
  const { pair, busy, error, notice, cancel } = comparison;
  const none = pair?.branches.none.revisions?.at(-1);
  const local = pair?.branches.local.revisions?.at(-1);
  const path = none?.path ?? local?.path;
  return <section id="workspace-comparison" className="comparison-review" aria-labelledby={title}>
    <header className="comparison-review-heading">
      <h2 id={title}>Kết quả hai nhánh</h2>
      {pair && <code className="comparison-review-model" aria-label="Model của hai nhánh">{pair.model}</code>}
      {path && <><span className="comparison-addition">+ Dòng thêm</span>
        <span className="comparison-deletion">− Dòng xóa</span></>}
    </header>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {path && <p className="comparison-file"><code>{path}</code></p>}
    {none && local && none.content === local.content && <p>Hai bản mới nhất có nội dung giống nhau.</p>}
    <div className="comparison-review-grid">
      {(["none", "local"] as const).map(mode => <ReviewBranch key={mode} mode={mode} branch={pair?.branches[mode]}
        busy={busy} onOpen={onOpen} onCancel={() => { void cancel(mode); }} />)}
    </div>
  </section>;
}
