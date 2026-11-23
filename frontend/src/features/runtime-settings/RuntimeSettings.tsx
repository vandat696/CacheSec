"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeading } from "@/components/layout/PageHeading";
import { Button } from "@/components/ui/Button";
import { initializeLocalWorkspace, localSessionEnded } from "../local-workspace/localWorkspaceClient";
import { readRuntimeSettings } from "./runtimeSettingsClient";

export function RuntimeSettings() {
  const [data, setData] = useState<Awaited<ReturnType<typeof readRuntimeSettings>> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const ended = () => { controller.abort(); setData(null); setBusy(false); setError("Phiên local đã kết thúc."); };
    window.addEventListener(localSessionEnded, ended);
    async function load() {
      setData(null); setError(""); setBusy(true);
      try {
        if (!await initializeLocalWorkspace()) throw new Error("NO_SESSION");
        const result = await readRuntimeSettings(controller.signal);
        if (!controller.signal.aborted) setData(result);
      } catch { if (!controller.signal.aborted) { controller.abort(); setData(null); setBusy(false); setError("Chưa đọc được cấu hình. Mở phiên Workspace và kiểm tra quyền truy cập."); } }
      finally { if (!controller.signal.aborted) setBusy(false); }
    }
    void load();
    return () => { controller.abort(); window.removeEventListener(localSessionEnded, ended); };
  }, [revision]);
  return <div className="content-page runtime-settings">
    <PageHeading title="Thiết lập" action={<Button variant="secondary" disabled={busy} onClick={() => setRevision(value => value + 1)}>Tải lại</Button>} />
    <p className="runtime-settings-note">Cấu hình đang dùng · chỉ đọc</p>
    {busy && <p role="status">Đang đọc cấu hình…</p>}
    {error && <p role="alert">{error} <Link href="/workspace">Mở Workspace</Link></p>}
    {data && <div data-runtime-settings="loaded" className="runtime-settings-grid">
      <section><h2>Repository</h2><dl>
        <dt>Định danh</dt><dd>{data.repository.repository_identity}</dd>
        <dt>File được sửa</dt><dd><code>{data.workflow.editable_path}</code></dd>
        <dt>Quyền đề xuất / test</dt><dd>{data.workflow.can_propose ? "Có" : "Không"} / {data.workflow.can_test ? "Có" : "Không"}</dd>
      </dl><Link href="/documents">Xem nguồn được cấp quyền</Link></section>
      <section><h2>Agent</h2><dl>
        <dt>Model mặc định</dt><dd>{data.agent.model}</dd>
        <dt>API key</dt><dd>{data.agent.configured ? "Đã cấu hình" : "Chưa cấu hình"}</dd>
        <dt>Model được bật</dt><dd>{(data.agent.models ?? [data.agent.model]).join(", ")}</dd>
        {data.agent.automation && <><dt>Giới hạn tự động</dt><dd>{data.agent.automation.max_turns} lượt / {data.agent.automation.deadline_seconds / 60} phút</dd></>}
      </dl><Link href="/workspace">Chọn model trong Workspace</Link></section>
      <section><h2>Triển khai Báo giá</h2><dl>
        <dt>Trạng thái đăng ký</dt><dd>{!data.target.configured ? "Chưa cấu hình" : data.target.pending_id ? "Đang xử lý / cần đối soát" : "Không có thao tác chờ"}</dd>
        <dt>Phiên bản</dt><dd>{data.target.target_version ?? "—"}</dd>
        <dt>Quyền duyệt / chạy</dt><dd>{data.target.can_review ? "Có" : "Không"} / {data.target.can_activate ? "Có" : "Không"}</dd>
        <dt>Artifact</dt><dd><code>{data.target.active_artifact ?? "—"}</code></dd>
      </dl><Link href="/quotations">Mở Báo giá</Link></section>
    </div>}
    <details className="runtime-settings-reference"><summary>Bản nháp thử nghiệm</summary>
      <p>Chưa áp dụng vào runtime hoặc chạy benchmark/training.</p><Link href="/setup?view=preview">Mở giao diện tham khảo</Link>
    </details>
  </div>;
}
