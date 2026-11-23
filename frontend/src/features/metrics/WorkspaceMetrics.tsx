"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/forms/Select";
import { AgentHttpClient } from "../agent/agentApi";
import type { ComparisonPair, ComparisonSummary } from "../comparisons/comparisonModel";
import { initializeLocalWorkspace, localSessionEnded } from "../local-workspace/localWorkspaceClient";
import { workspaceMetricLabels, workspaceMetricValues } from "./workspaceMetricsModel";

export function WorkspaceMetrics() {
  const [sessions, setSessions] = useState<ComparisonSummary[]>([]);
  const [selected, setSelected] = useState("");
  const [pair, setPair] = useState<ComparisonPair | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    function ended() {
      controller.abort(); setSessions([]); setPair(null); setBusy(false);
      setError("Phiên local đã kết thúc. Mở lại Workspace để kết nối.");
    }
    window.addEventListener(localSessionEnded, ended);
    async function load() {
      setBusy(true); setError(""); setPair(null); setSessions([]);
      try {
        if (!await initializeLocalWorkspace()) throw new Error("NO_LOCAL_SESSION");
        const api = new AgentHttpClient("/api/local-control", null);
        const items = await api.listComparisons(controller.signal);
        if (controller.signal.aborted) return;
        setSessions(items);
        const id = items.some(item => item.pair_id === selected) ? selected : items[0]?.pair_id;
        if (id) {
          const result = await api.comparison(id, controller.signal);
          if (!controller.signal.aborted) setPair(result);
        }
      } catch {
        if (!controller.signal.aborted) {
          setSessions([]); setPair(null);
          setError("Chưa tải được số liệu. Kiểm tra phiên Workspace và quyền đọc lịch sử.");
        }
      } finally { if (!controller.signal.aborted) setBusy(false); }
    }
    void load();
    return () => { controller.abort(); window.removeEventListener(localSessionEnded, ended); };
  }, [selected, refresh]);
  const none = pair ? workspaceMetricValues(pair.branches.none) : [];
  const local = pair ? workspaceMetricValues(pair.branches.local) : [];
  return <div className="content-page metrics-workspace" data-metrics-source="workspace">
    <div className="metrics-panel-heading">
      <h1>Số liệu Workspace</h1>
      <Button variant="secondary" disabled={busy} onClick={() => setRefresh(value => value + 1)}>Tải lại</Button>
    </div>
    <p className="metrics-footnote">Lượt gần nhất của mỗi phiên · dữ liệu đã lưu · chưa phải benchmark.</p>
    {error && <p role="alert">{error} <Link href="/workspace">Mở Workspace</Link></p>}
    {busy && <p role="status">Đang tải số liệu…</p>}
    {!busy && !error && !sessions.length && <p>Chưa có lượt so sánh. <Link href="/workspace">Mở Workspace</Link></p>}
    {!!sessions.length && <Select id="metrics-workspace-session" label="Phiên" disabled={busy}
      value={pair?.pair_id ?? selected} options={sessions.map(item => ({ value: item.pair_id, label: item.prompt }))}
      onChange={event => setSelected(event.target.value)} />}
    {pair && <section className="metrics-panel" aria-label="Số liệu hai nhánh" data-pair-id={pair.pair_id}>
      <div className="metrics-panel-heading"><p>{pair.model} · {pair.cache_state}</p>
        <Link href={`/workspace?comparison=${pair.pair_id}`}>Xem bản sửa và test</Link></div>
      <div className="metrics-table-scroll" tabIndex={0} role="region" aria-label="Bảng số liệu Workspace">
        <table className="metrics-turns-table">
          <caption className="sr-only">Số đo của đúng lượt đã lưu; ô thiếu dữ liệu hiển thị dấu gạch ngang</caption>
          <thead><tr><th scope="col">Chỉ số</th><th scope="col">Không cache</th><th scope="col">Có Context Cache</th></tr></thead>
          <tbody>{workspaceMetricLabels.map((label, index) => <tr key={label}>
            <th scope="row">{label}</th><td>{none[index]}</td><td>{local[index]}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="metrics-footnote">Workflow không gồm hàng đợi. Token thiếu không tính thành 0; Cache Hit không đồng nghĩa tiết kiệm token.</p>
    </section>}
    <details><summary>Nguồn khác</summary><Link href="/metrics?source=sample">Dữ liệu mẫu</Link>{" · "}
      <Link href="/metrics?source=session">Phiên Chat mô phỏng</Link></details>
  </div>;
}
