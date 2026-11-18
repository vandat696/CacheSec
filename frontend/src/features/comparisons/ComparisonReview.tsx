import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { branchLabel, branchPending, revisionTest, testLabel, type Branch, type ComparisonPair } from "./comparisonModel";
import { RevisionDiff } from "./RevisionDiff";

function ReviewBranch({ branch, busy, onOpen }: { branch: Branch; busy: boolean; onOpen: (id: string) => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const revisions = branch.revisions ?? [];
  const latest = revisions.at(-1);
  const revision = revisions.find(item => item.revision === selected) ?? latest;
  const test = revision && revisionTest(revision);
  return <section className="comparison-review-branch" aria-label={branchLabel(branch.mode)}>
    <header className="comparison-review-branch-heading">
      <h3>{branchLabel(branch.mode)}</h3>
      {revision && <label>Bản sửa <select value={revision.revision} onChange={event => setSelected(Number(event.target.value))}>
        {revisions.map(item => <option key={item.revision} value={item.revision}>{item.revision}</option>)}
      </select></label>}
      {revision && <span className="comparison-test-state" data-status={test?.status}>{testLabel(test?.status)}</span>}
    </header>
    {revision ? <>
      <RevisionDiff key={revision.revision} revision={revision} />
      {revision === latest && <Button variant="secondary" disabled={busy || branchPending(branch)} onClick={() => onOpen(revision.proposal_id)}>Mở đề xuất trong editor</Button>}
    </> : <p>Nhánh này chưa có bản sửa.</p>}
  </section>;
}

export function ComparisonReview({ pair, busy, onClose, onOpen }: {
  pair: ComparisonPair; busy: boolean; onClose: () => void; onOpen: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  useEffect(() => {
    const element = dialog.current!;
    const trigger = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);
  const none = pair.branches.none.revisions?.at(-1);
  const local = pair.branches.local.revisions?.at(-1);
  const path = none?.path ?? local?.path;
  return <dialog ref={dialog} className="nui nui-theme nui-dialog comparison-review" aria-labelledby={title}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="comparison-review-heading">
      <h2 id={title}>Hai bản sửa so với mã gốc</h2>
      <Button variant="secondary" onClick={onClose}>Đóng</Button>
    </header>
    {path && <p className="comparison-file"><code>{path}</code></p>}
    {none && local && none.content === local.content && <p>Hai bản mới nhất có nội dung giống nhau.</p>}
    <div className="comparison-review-grid">
      {([pair.branches.none, pair.branches.local]).map(branch => <ReviewBranch key={branch.mode} branch={branch}
        busy={busy} onOpen={id => { onClose(); onOpen(id); }} />)}
    </div>
  </dialog>;
}
