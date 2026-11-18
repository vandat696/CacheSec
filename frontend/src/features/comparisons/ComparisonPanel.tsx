"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { AgentHttpClient } from "../agent/agentApi";
import { ComparisonBranch } from "./ComparisonBranch";
import { ComparisonReview } from "./ComparisonReview";
import { useComparison } from "./useComparison";

export function ComparisonPanel({ api, snapshotId, enabled, onDenied, onOpen }: {
  api: AgentHttpClient | null; snapshotId: string | null; enabled: boolean; onDenied: () => void; onOpen: (id: string) => void;
}) {
  const comparison = useComparison(api, onDenied);
  const [prompt, setPrompt] = useState("");
  const [state, setState] = useState<"cold" | "warm" | "preload">("warm");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const pair = comparison.pair;
  const hasRevisions = pair && Object.values(pair.branches).some(branch => branch.revisions?.length);
  const blocked = comparison.busy || comparison.pending;
  function download() {
    if (!comparison.pair) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(comparison.pair, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `cachesec-${comparison.pair.pair_id}.json`; link.click(); URL.revokeObjectURL(url);
  }
  return <div className="comparison-panel">
    <form className="comparison-composer" onSubmit={event => { event.preventDefault(); if (snapshotId) void comparison.start(snapshotId, prompt.trim(), state); }}>
      <textarea aria-label="Yêu cầu chung cho hai nhánh" placeholder="Yêu cầu sửa mã cho cả hai nhánh…" maxLength={4000} rows={3} value={prompt} disabled={!enabled || blocked} onChange={event => setPrompt(event.target.value)} />
      <div><label>Cache <select aria-label="Điều kiện cache" value={state} disabled={blocked} onChange={event => setState(event.target.value as typeof state)}>
        <option value="cold">Cold · xóa cache trước chạy</option><option value="warm">Warm · dùng cache hiện có</option><option value="preload">Preload · đã chuẩn bị riêng</option>
      </select></label><Button type="submit" disabled={!enabled || !snapshotId || !prompt.trim() || blocked}>Chạy hai nhánh</Button></div>
      <details><summary>Dữ liệu gửi model</summary><p>Generation nhận ba file source và kết quả test. Gemini embedding chỉ nhận câu yêu cầu. Mỗi nhánh tối đa 3 lượt / 10 phút. Warm/preload là điều kiện khai báo; kết quả lookup được ghi riêng.</p></details>
    </form>
    {comparison.error && <p role="alert">{comparison.error}</p>}{comparison.notice && <p role="status">{comparison.notice}</p>}
    <div className="comparison-history"><label>Lịch sử <select aria-label="Lịch sử so sánh" value={comparison.pair?.pair_id ?? ""} disabled={comparison.busy} onChange={event => { if (event.target.value) void comparison.open(event.target.value); }}>
      <option value="">Chọn phiên</option>{comparison.history.map(item => <option key={item.pair_id} value={item.pair_id}>{new Date(item.created_at).toLocaleString("vi-VN")} · {item.prompt.slice(0, 60)}</option>)}</select></label>
      {comparison.pair && <><Button variant="tertiary" disabled={comparison.busy} onClick={() => { void comparison.open(comparison.pair!.pair_id); }}>Tải lại</Button><Button variant="tertiary" onClick={download}>Xuất JSON</Button></>}
    </div>
    {pair && <>
      <div className="comparison-result-heading">
        <h3>Kết quả hai nhánh</h3>
        {hasRevisions && <Button id="comparison-review-open" onClick={() => setReviewId(pair.pair_id)}>Xem hai bản sửa</Button>}
      </div>
      <details><summary>Yêu cầu đã chạy</summary><p className="comparison-prompt">{pair.prompt}</p></details>
      <div className="comparison-branches">
        {(["none", "local"] as const).map(mode => <ComparisonBranch key={mode} branch={pair.branches[mode]} busy={comparison.busy}
          onCancel={() => { void comparison.cancel(mode); }} />)}
      </div>
      {reviewId === pair.pair_id && <ComparisonReview key={pair.pair_id} pair={pair} busy={comparison.busy}
        onClose={() => setReviewId(null)} onOpen={onOpen} />}
    </>}
  </div>;
}
