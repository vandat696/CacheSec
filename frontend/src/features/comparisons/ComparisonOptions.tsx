"use client";

import { Button } from "@/components/ui/Button";
import type { ComparisonSummary } from "./comparisonModel";
import type { useComparison } from "./useComparison";

export function ComparisonOptions({ comparison, cacheState, onCacheState }: {
  comparison: ReturnType<typeof useComparison>;
  cacheState: ComparisonSummary["cache_state"];
  onCacheState: (state: ComparisonSummary["cache_state"]) => void;
}) {
  const { pair, busy, pending, open } = comparison;
  function download() {
    if (!pair) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(pair, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `cachesec-${pair.pair_id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return <>
    <label>Cache<select aria-label="Điều kiện cache" value={cacheState} disabled={busy || pending}
      onChange={event => onCacheState(event.target.value as ComparisonSummary["cache_state"])}>
      <option value="cold">Cold · xóa cache trước chạy</option>
      <option value="warm">Warm · dùng cache hiện có</option>
      <option value="preload">Preload · đã chuẩn bị riêng</option>
    </select></label>
    <p>Model nhận 3 file nguồn, lịch sử gần đây của phiên, diff và kết quả test khi có. Embedding chỉ nhận prompt mới.</p>
    {pair && <div>
      <Button variant="tertiary" disabled={busy} onClick={() => { void open(pair.pair_id); }}>Tải lại</Button>
      <Button variant="tertiary" onClick={download}>Xuất JSON</Button>
    </div>}
  </>;
}
