"use client";

import { useId, useState, type ComponentProps } from "react";
import { useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/fields";
import { Icon } from "@/components/ui/icon";
import { Tabs } from "@/components/ui/navigation";
import { useChat } from "@/features/chat/chat-provider";
import type { ChatBranch } from "@/features/chat/chat-state";
import { BranchLegend, branches, branchLabels, CacheOutcomes, ComparisonPlot, ResponseOutcomes } from "./metrics-charts";
import { selectBranchRows, selectMetricsRows, summarizeDemoMetrics, type BranchSummary, type MetricsRow } from "./metrics-model";
import { MetricsTurns } from "./metrics-turns";
import { MetricsComparison } from "./metrics-comparison";
import { MetricsTrend } from "./metrics-trend";
import { getMetricsPreview, previewConversations, type MetricsPreview } from "./metrics-preview";

const plotMetrics = [
  { value: "response", label: "Độ trễ", unit: "ms · end-to-end" },
  { value: "calls", label: "Lượt gọi LLM", unit: "lượt gọi LLM" },
  { value: "tokens", label: "Token LLM", unit: "token LLM" },
] as const;
const qualityMetrics = [
  { label: "Câu trả lời đạt yêu cầu", note: "Đúng nội dung, đủ ý và có nguồn hỗ trợ", value: "Chưa chấm" },
  { label: "Semantic false hit", note: "Hit gần nghĩa nhưng trả sai đáp án", value: "Chưa chấm", cacheOnly: true },
  { label: "Rò rỉ thông tin", note: "Disclosure trên các ca đáng ra bị chặn", value: "Chưa kiểm thử" },
  { label: "Từ chối nhầm", note: "False denial trên các ca đáng ra được phép", value: "Chưa kiểm thử" },
] as const;
type Summaries = Record<ChatBranch, BranchSummary>;
const count = (value: number | null) => value === null ? "—" : String(value);

function MetricCard({ label, value, detail, icon }: {
  label: string;
  value: string;
  detail: string;
  icon: ComponentProps<typeof Icon>["name"];
}) {
  return (
    <article className="metrics-kpi">
      <div><span>{label}</span><Icon name={icon} /></div>
      <strong title={value === "—" ? "Chưa đo" : undefined}>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function PerformancePanel({ summaries, branch, preview }: { summaries: Summaries; branch?: ChatBranch; preview?: MetricsPreview }) {
  const id = useId();
  const [plotMetric, setPlotMetric] = useState<string>("response");
  const metric = plotMetrics.find((item) => item.value === plotMetric)!;
  const visibleBranches = branch ? [branch] : branches;
  return (
    <section className="metrics-panel metrics-performance" aria-labelledby={`${id}-title`}>
      <div className="metrics-panel-heading">
        <div>
          <h2 id={`${id}-title`}>{branch ? "Hiệu năng & tài nguyên" : "So sánh hai nhánh"}</h2>
          <p>{branch ? branchLabels[branch] : "Tốc độ và tài nguyên sử dụng"}</p>
        </div>
        <Select id={branch ? `${id}-kind` : "metrics-chart-kind"} label="Chỉ số biểu đồ"
          value={plotMetric} options={plotMetrics} onChange={(event) => setPlotMetric(event.target.value)} />
      </div>
      <BranchLegend visibleBranches={visibleBranches} />
      <ComparisonPlot unit={metric.unit} visibleBranches={visibleBranches} sample={!!preview} values={{
        "no-cache": plotMetric === "response" ? preview?.latencies["no-cache"] ?? null : plotMetric === "calls" ? summaries["no-cache"].llmCalls : summaries["no-cache"].llmTokens,
        cache: plotMetric === "response" ? preview?.latencies.cache ?? null : plotMetric === "calls" ? summaries.cache.llmCalls : summaries.cache.llmTokens,
      }} />
    </section>
  );
}

function CachePanel({ preview }: { preview?: MetricsPreview }) {
  const id = useId();
  return (
    <section className="metrics-panel" aria-labelledby={id}>
      <div className="metrics-panel-heading">
        <div><h2 id={id}>Kết quả cache</h2><p>Chỉ tính các lượt thực sự tra cache</p></div>
        <Icon name="compare" />
      </div>
      <CacheOutcomes counts={preview?.cacheCounts} />
    </section>
  );
}

function QualityPanel({ branch, preview }: { branch: ChatBranch; preview?: MetricsPreview }) {
  const id = useId();
  const metrics = qualityMetrics.map((item, index) => ({ ...item, value: preview?.qualityValues[branch][index] ?? item.value }))
    .filter((item) => branch === "cache" || !("cacheOnly" in item));
  return (
    <section className="metrics-panel" aria-labelledby={id}>
      <div className="metrics-panel-heading">
        <div><h2 id={id}>Chất lượng & phân quyền</h2><p>{branchLabels[branch]} · {preview ? "kịch bản mẫu" : "chưa có mẫu đánh giá"}</p></div>
        <Icon name="shield" />
      </div>
      <dl className="metrics-branch-quality">
        {metrics.map((item) => (
          <div key={item.label}>
            <dt>{item.label}<small>{item.note}</small></dt><dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      {!preview && <p className="metrics-footnote">Không suy ra ALLOW/DENY từ phản hồi mẫu; chưa thể kết luận mức an toàn.</p>}
    </section>
  );
}

function MetricsView({ rows, branch, filterKey, preview }: {
  rows: readonly MetricsRow[];
  branch?: ChatBranch;
  filterKey: string;
  preview?: MetricsPreview;
}) {
  const branchRows = branch ? selectBranchRows(rows, branch) : rows;
  const summary = summarizeDemoMetrics(branchRows);
  const summaries = preview?.summaries ?? summary.branches;
  const id = useId();
  return (
    <div data-metrics-view={branch ?? "general"}>
      {branch && <div className="metrics-sample metrics-view-summary" role="status" aria-live="polite">
        <strong data-summary="turns">{summary.turns}</strong> lượt chạy · {branchLabels[branch]}
      </div>}
      <section className={`metrics-kpis${branch ? "" : " metrics-kpis-overview"}`} aria-label={`Chỉ số ${branch ? branchLabels[branch] : "chung"}`}>
        {branch ? <>
          <MetricCard label="Độ trễ" value={preview?.latencies[branch] != null ? `${Math.round(preview.latencies[branch]).toLocaleString("vi-VN")} ms` : "—"} detail={preview ? "Trung bình mỗi truy vấn" : "Chưa đo"} icon="clock" />
          <MetricCard label="Lượt gọi LLM" value={count(summaries[branch].llmCalls)} detail={branchLabels[branch]} icon="spark" />
          <MetricCard label="Token LLM" value={count(summaries[branch].llmTokens)} detail={branchLabels[branch]} icon="chart" />
          <MetricCard label="Rò rỉ thông tin" value={preview && preview.cacheCounts.rejected > 0 ? "0" : "—"} detail={preview ? "Kịch bản mẫu" : "Chưa kiểm thử quyền"} icon="shield" />
        </> : <>
          <MetricCard label="Total Queries" value={String(summary.turns)} detail="Tổng số câu hỏi" icon="chat" />
          <MetricCard label="Safe Cache Hit Rate" value={preview?.overview.hitRate ?? "—"} detail="Tỷ lệ sử dụng cache hợp lệ" icon="compare" />
          <MetricCard label="Latency Reduction" value={preview?.overview.latencyReduction ?? "—"} detail="Thời gian phản hồi giảm" icon="clock" />
          <MetricCard label="LLM Calls Saved" value={preview?.overview.callsSaved ?? "—"} detail="Số lượt gọi LLM tiết kiệm" icon="spark" />
          <MetricCard label="Tokens Saved" value={preview?.overview.tokensSaved ?? "—"} detail="Số token LLM tiết kiệm" icon="chart" />
          <MetricCard label="Security Violations" value={preview?.overview.violations ?? "—"} detail="Lượt trả cache trái quyền" icon="shield" />
        </>}
      </section>
      <div className="metrics-chart-grid">
        {branch ? <PerformancePanel summaries={summaries} branch={branch} preview={preview} /> : <MetricsTrend key={filterKey} rows={rows} trends={preview?.trends} />}
        {branch === "no-cache" ? (
          <section className="metrics-panel" aria-labelledby={`${id}-outcomes`}>
            <div className="metrics-panel-heading"><div><h2 id={`${id}-outcomes`}>Trạng thái phản hồi</h2><p>Mẫu số là số lượt chạy nhánh Không cache</p></div></div>
            <ResponseOutcomes summaries={summaries} visibleBranches={[branch]} />
          </section>
        ) : <CachePanel preview={preview} />}
      </div>
      {!branch ? (
        <MetricsComparison summaries={summaries} rows={preview?.comparison} />
      ) : (
        <div className={branch === "cache" ? "metrics-quality-grid" : "metrics-single-quality"}>
          <QualityPanel branch={branch} preview={preview} />
          {branch === "cache" && (
            <section className="metrics-panel" aria-labelledby={`${id}-outcomes`}>
              <div className="metrics-panel-heading"><div><h2 id={`${id}-outcomes`}>Trạng thái phản hồi</h2><p>Mẫu số là số lượt chạy nhánh Cache</p></div></div>
              <ResponseOutcomes summaries={summaries} visibleBranches={[branch]} />
            </section>
          )}
        </div>
      )}
      <MetricsTurns key={filterKey} rows={branchRows} visibleBranches={branch ? [branch] : branches} preview={preview} />
    </div>
  );
}

function MetricsWorkspaceView({ showPreview }: { showPreview: boolean }) {
  const chat = useChat();
  const [conversationId, setConversationId] = useState("all");
  const preview = showPreview ? getMetricsPreview(conversationId) : undefined;
  const rows = preview?.rows ?? selectMetricsRows(chat.state.conversations, conversationId, "all");
  const conversations = showPreview ? previewConversations : chat.state.conversations;
  const filterKey = `${showPreview ? "sample" : "session"}/${conversationId}`;
  return (
    <div className="content-page metrics-workspace" data-metrics-source={showPreview ? "sample" : "session"}>
      <h1 className="sr-only">Số liệu</h1>
      <div className="metrics-tabs">
        <Tabs
          label="Phạm vi số liệu"
          toolbar={
            <>
              <div className="metrics-toolbar">
                <Select id="metrics-conversation" label="Hội thoại" value={conversationId}
                  options={[{ value: "all", label: "Tất cả hội thoại" }, ...conversations.map((item, index) => ({ value: item.id, label: `${index + 1}. ${item.title}` }))]}
                  onChange={(event) => setConversationId(event.target.value)} />
              </div>
            </>
          }
          items={[
            { id: "general", label: "Chung", content: <MetricsView rows={rows} filterKey={filterKey} preview={preview} /> },
            { id: "no-cache", label: "Không cache", content: <MetricsView rows={rows} branch="no-cache" filterKey={filterKey} preview={preview} /> },
            { id: "cache", label: "Cache", content: <MetricsView rows={rows} branch="cache" filterKey={filterKey} preview={preview} /> },
          ]}
        />
      </div>
    </div>
  );
}

export function MetricsWorkspace() {
  const showPreview = useSearchParams().get("source") !== "session";
  return <MetricsWorkspaceView key={showPreview ? "sample" : "session"} showPreview={showPreview} />;
}
