"use client";

import { useState, type ReactNode } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { Checkbox, NumberInput, Select, Switch, Textarea, TextInput } from "@/components/ui/fields";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import {
  accessPolicies, createSetupPlan, documentSets, evictionPolicies, experimentModes,
  initialSetup, workloads, type SetupDraft, type SetupPlan,
} from "@/features/workspace/workspace-model";

function SetupRow({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section className="setup-row" aria-labelledby={`${id}-title`}>
      <div className="setup-row-heading">
        <h2 id={`${id}-title`}>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="setup-row-controls">{children}</div>
    </section>
  );
}

function exportDraft(plan: SetupPlan) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `cachesec-setup-v${plan.revision}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SetupWorkspace() {
  const { setupPlan, saveSetupPlan } = useWorkspace();
  const [draft, setDraft] = useState<SetupDraft>(() => setupPlan?.configuration ?? initialSetup);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(!!setupPlan);
  const hasCache = draft.modes.some((mode) => mode !== "none");
  const documentSet = documentSets.find((item) => item.id === draft.documentSetId)!;

  function update<Key extends keyof SetupDraft>(key: Key, value: SetupDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setError("");
  }
  function toggle<Value extends string>(values: Value[], value: Value) {
    return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  }

  return (
    <div className="content-page setup-workspace">
      <PageHeading title="Thiết lập thí nghiệm" />
      <p className="setup-intro">Chọn dữ liệu và cấu hình để so sánh hiệu suất, chất lượng và kiểm soát truy cập.</p>
      <form onSubmit={(event) => {
        event.preventDefault();
        try {
          saveSetupPlan(createSetupPlan(draft, crypto.randomUUID(), new Date().toISOString(), (setupPlan?.revision ?? 0) + 1));
          setError("");
          setSaved(true);
        } catch (cause) {
          setSaved(false);
          setError(cause instanceof Error ? cause.message : "Không lưu được thiết lập.");
        }
      }}>
        <div className="setup-name">
          <TextInput id="setup-name" label="Tên thí nghiệm" required maxLength={80} value={draft.name} onChange={(event) => update("name", event.target.value)} />
        </div>
        <div className="setup-table-heading" aria-hidden="true"><span>Thông số</span><span>Chức năng</span></div>

        <SetupRow id="setup-mode" title="Experiment Mode" description="Chọn một hoặc nhiều chế độ để đối chiếu.">
          <fieldset className="setup-options">
            <legend className="sr-only">Chế độ thí nghiệm</legend>
            {experimentModes.map((mode) => <Checkbox key={mode.value} label={mode.label} value={mode.value}
              checked={draft.modes.includes(mode.value)} onChange={() => update("modes", toggle(draft.modes, mode.value))} />)}
          </fieldset>
          <p className="setup-note">Phạm vi cache dự kiến: riêng người dùng. Mọi chế độ đều cần xác minh quyền tại backend.</p>
          {hasCache && <div className="setup-fields setup-subfields">
            <NumberInput id="setup-ttl" label="TTL (giây)" required min={60} max={86400} step={1} value={Number.isNaN(draft.ttlSeconds) ? "" : draft.ttlSeconds} onChange={(event) => update("ttlSeconds", event.target.valueAsNumber)} />
            <NumberInput id="setup-capacity" label="Dung lượng cache (mục)" required min={1} max={100000} step={1} value={Number.isNaN(draft.capacity) ? "" : draft.capacity} onChange={(event) => update("capacity", event.target.valueAsNumber)} />
          </div>}
        </SetupRow>

        <SetupRow id="setup-dataset" title="Dataset" description="Chọn bộ câu hỏi và tài liệu thử nghiệm.">
          <div className="setup-fields">
            <Select id="setup-workload" label="Bộ câu hỏi" value={draft.workloadId} onChange={(event) => update("workloadId", event.target.value)}
              options={workloads.map((item) => ({ value: item.id, label: `${item.name} · ${item.caseIds.length} câu` }))} />
            <Select id="setup-documents" label="Bộ tài liệu" value={draft.documentSetId} onChange={(event) => update("documentSetId", event.target.value)}
              options={documentSets.map((item) => ({ value: item.id, label: `${item.name} · v${item.revision}` }))} />
          </div>
          <p className="setup-note">{documentSet.documents.join(" · ")}. Dữ liệu giả lập; chưa nạp hoặc lập chỉ mục tài liệu.</p>
        </SetupRow>

        <SetupRow id="setup-embedding" title="Embedding Benchmark" description="So sánh nhiều embedding model trên cùng dữ liệu.">
          <Textarea id="setup-embeddings" label="ID/alias embedding model · mỗi dòng một model" required rows={3} maxLength={1287}
            value={draft.embeddingModels} onChange={(event) => update("embeddingModels", event.target.value)}
            help="Tối đa 8 model. embedding-a/b là alias nháp; chưa gắn provider. Khi chạy thật cần cố định model/revision và tách namespace vector." />
        </SetupRow>

        <SetupRow id="setup-threshold" title="Threshold Benchmark" description="Thử nhiều ngưỡng tương đồng cho semantic cache.">
          <TextInput id="setup-thresholds" label="Danh sách threshold" required={hasCache} disabled={!hasCache} maxLength={300}
            value={draft.thresholds} onChange={(event) => update("thresholds", event.target.value)}
            help={hasCache ? "Từ 0 đến 1, phân tách bằng dấu phẩy. Ví dụ: 0.80, 0.85, 0.90. Đây là ngưỡng nháp, chưa hiệu chỉnh." : "Không áp dụng khi chỉ chọn No Cache."} />
        </SetupRow>

        <SetupRow id="setup-eviction" title="Eviction Benchmark" description="So sánh chính sách thay thế khi cache đầy.">
          <fieldset className="setup-options" disabled={!hasCache}>
            <legend className="sr-only">Chính sách eviction</legend>
            {evictionPolicies.map((policy) => <Checkbox key={policy} label={policy} value={policy} checked={draft.evictionPolicies.includes(policy)}
              onChange={() => update("evictionPolicies", toggle(draft.evictionPolicies, policy))} />)}
          </fieldset>
          <p className="setup-note">{hasCache ? "FIFO: vào trước ra trước · LRU: ít dùng gần đây · LFU: ít được dùng nhất." : "Không áp dụng khi chỉ chọn No Cache."}</p>
        </SetupRow>

        <SetupRow id="setup-access" title="Access Control Benchmark" description="So sánh các mô hình kiểm soát truy cập.">
          <fieldset className="setup-options">
            <legend className="sr-only">Mô hình kiểm soát truy cập</legend>
            {accessPolicies.map((policy) => <Checkbox key={policy} label={policy} value={policy} checked={draft.accessPolicies.includes(policy)}
              onChange={() => update("accessPolicies", toggle(draft.accessPolicies, policy))} />)}
          </fieldset>
          <p className="setup-note">Chỉ chọn mô hình thử nghiệm, không cấp quyền. Policy và nhãn kỳ vọng cần đặc tả trước khi chạy.</p>
        </SetupRow>

        <SetupRow id="setup-training" title="Local Training" description="Chọn phương án huấn luyện để khảo sát.">
          <Select id="setup-local-training" label="Chế độ huấn luyện" value={draft.localTraining} onChange={(event) => update("localTraining", event.target.value as SetupDraft["localTraining"])}
            options={[{ value: "off", label: "Tắt" }, { value: "fine-tuning", label: "Fine-tuning cục bộ" }, { value: "fl-simulation", label: "FL mô phỏng" }]} />
          <p className="setup-note">{draft.localTraining === "off" ? "Không yêu cầu huấn luyện trong kế hoạch." : "Chỉ lưu lựa chọn; chưa có pipeline huấn luyện. Model đích, dữ liệu train/test và tài nguyên chưa chốt."}</p>
        </SetupRow>

        <SetupRow id="setup-logging" title="Request Logging" description="Ghi thời gian, token, cache status và authorization decision.">
          <Switch label="Ghi thông số từng request" checked={draft.requestLogging} onChange={(checked) => update("requestLogging", checked)} />
          <ul className="setup-log-fields" aria-label="Trường log dự kiến">
            <li>Thời gian phản hồi</li><li>Token LLM</li><li>Cache status</li><li>Authorization decision</li>
          </ul>
          <p className="setup-note">Chưa ghi log thật. Chỉ metadata; không log nội dung nhạy cảm. Quyết định quyền phải đến từ backend.</p>
        </SetupRow>

        <SetupRow id="setup-export" title="Export Results" description="Xuất số liệu thực nghiệm sau khi chạy.">
          <div className="setup-export-controls">
            <Select id="setup-export-format" label="Định dạng kết quả" value={draft.exportFormat} onChange={(event) => update("exportFormat", event.target.value as SetupDraft["exportFormat"])}
              options={[{ value: "json", label: "JSON" }, { value: "csv", label: "CSV" }]} />
            <Button variant="secondary" disabled aria-describedby="setup-export-help">Xuất kết quả</Button>
          </div>
          <p className="setup-note" id="setup-export-help">Chưa có kết quả thực nghiệm để xuất. Có thể tải bản cấu hình đã lưu ở cuối trang.</p>
        </SetupRow>

        <section className="setup-run" aria-labelledby="setup-run-title">
          <h2 id="setup-run-title">Điều kiện chạy</h2>
          <div className="setup-fields">
            <NumberInput id="setup-repeats" label="Số lần lặp" required min={1} max={100} step={1} value={Number.isNaN(draft.repeats) ? "" : draft.repeats} onChange={(event) => update("repeats", event.target.valueAsNumber)} />
            <Select id="setup-phase" label="Trạng thái cache ban đầu" disabled={!hasCache} value={draft.phase} onChange={(event) => update("phase", event.target.value as SetupDraft["phase"])}
              options={[{ value: "cold", label: "Cold · cache rỗng" }, { value: "warm", label: "Warm · cache được nạp trước" }]} />
            <NumberInput id="setup-seed" label="Seed tái lập" required min={0} max={4294967295} step={1} value={Number.isNaN(draft.seed) ? "" : draft.seed} onChange={(event) => update("seed", event.target.valueAsNumber)} />
          </div>
          <p className="setup-note">Các lựa chọn tạo ma trận tổ hợp cấu hình; No Cache không nhân theo threshold/eviction. Cold/warm và seed hiện chỉ ghi ý định.</p>
        </section>
        <div className="setup-footer">
          <p>Bản nháp trong phiên, tải lại sẽ mất. Chưa chạy benchmark hoặc áp dụng vào Chat.</p>
          <div className="setup-actions">
            <Button variant="secondary" disabled={!saved || !setupPlan} onClick={() => setupPlan && exportDraft(setupPlan)}>Xuất cấu hình JSON</Button>
            <Button type="submit">Lưu thiết lập</Button>
          </div>
        </div>
        {error && <p className="nui-error setup-error" role="alert">{error}</p>}
        {saved && setupPlan && <p className="setup-saved" role="status">Đã lưu bản v{setupPlan.revision} · {setupPlan.plannedVariants} cấu hình · {setupPlan.plannedQueries} lượt dự kiến. Chưa chạy.</p>}
      </form>
    </div>
  );
}
