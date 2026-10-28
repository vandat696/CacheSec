import assert from "node:assert/strict";
import { test } from "node:test";
import { initialChatState, chatReducer } from "../src/features/chat/chat-state.ts";
import { selectBranchRows, selectMetricsRows, summarizeDemoMetrics } from "../src/features/metrics/metrics-model.ts";
import { formatComparisonValue, getBetterBranch, getDemoComparisonRows } from "../src/features/metrics/metrics-comparison-model.ts";
import { getDemoQueryTrend, getTrendSegments } from "../src/features/metrics/metrics-trend-model.ts";
import { getMetricsPreview, previewQueries, summarizePreview } from "../src/features/metrics/metrics-preview.ts";

test("Dữ liệu xem trước nhất quán giữa thẻ, biểu đồ, đối chiếu và chi tiết", () => {
  const preview = getMetricsPreview("all");
  assert.equal(preview.rows.length, 24);
  assert.deepEqual(preview.cacheCounts, { hit: 15, miss: 7, rejected: 2 });
  assert.equal(preview.overview.hitRate, "62,5%");
  assert.equal(preview.overview.callsSaved, "15");
  assert.equal(preview.summaries["no-cache"].llmCalls, 24);
  assert.equal(preview.summaries.cache.llmCalls, 9);
  for (const branch of ["no-cache", "cache"]) {
    assert.equal(preview.summaries[branch].llmTokens, preview.trends.tokens.reduce((sum, point) => sum + point.values[branch], 0));
    const average = preview.trends.response.reduce((sum, point) => sum + point.values[branch], 0) / 24;
    assert.equal(preview.latencies[branch], average);
  }
  assert.deepEqual(preview.comparison.filter(row => getBetterBranch(row)).map(row => row.key), ["latency", "llmCalls", "llmTokens"]);
  for (const row of previewQueries) {
    const hit = row.cacheOutcome === "Hit";
    assert.equal(row.sample.cache.calls, hit ? 0 : 1);
    assert.equal(row.sample.cache.tokens, hit ? 0 : row.sample["no-cache"].tokens);
    assert.equal(preview.details[row.turn.id].cache.cacheStatus, row.cacheOutcome);
    if (row.cacheOutcome === "Rejected") assert.equal(preview.details[row.turn.id].cache.permission, "Chặn cache · sinh lại");
  }
});

test("Lọc dữ liệu mẫu tính lại mẫu số, đánh số đường và không thay đổi phiên Chat", () => {
  const state = initialChatState();
  const before = structuredClone(state);
  const first = getMetricsPreview("sample-performance");
  const second = getMetricsPreview("sample-permissions");
  assert.equal(first.rows.length, 16);
  assert.equal(second.rows.length, 8);
  assert.equal(first.summaries.cache.llmCalls + second.summaries.cache.llmCalls, getMetricsPreview("all").summaries.cache.llmCalls);
  assert.deepEqual(second.trends.response.map(point => point.query), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(state, before);
  assert.equal(selectMetricsRows(state.conversations, "all", "all").length, 0);
  const empty = summarizePreview([]);
  assert.equal(empty.overview.hitRate, "—");
  assert.equal(empty.overview.latencyReduction, "—");
  assert.ok(empty.comparison.every(row => getBetterBranch(row) === null));
});

function send(state, id) {
  return chatReducer(state, {
    type: "send", conversationId: state.activeId, requestId: id,
    message: { id: `prompt-${id}`, role: "user", text: "Cùng câu hỏi" },
  });
}
function finish(state, id, branch, error = false) {
  return chatReducer(state, {
    type: error ? "error" : "reply", conversationId: state.activeId,
    requestId: id, branch, error: "Lỗi mẫu",
    message: { id: `reply-${id}-${branch}`, role: "assistant", text: "Phản hồi mẫu" },
  });
}

const comparisonRow = (left, right, preference = "lower", comparable = true) => ({
  key: "fixture", label: "Tiêu chí giả lập", unit: "ms", preference, comparable,
  values: {
    "no-cache": { text: String(left), value: left },
    cache: { text: String(right), value: right },
  },
});

test("Biểu đồ giữ thứ tự gửi xuyên hội thoại, mỗi lượt Cả hai chỉ có một vị trí", () => {
  let state = send(initialChatState(), "one");
  state = finish(finish(state, "one", "no-cache"), "one", "cache");
  const beforeDuplicate = state;
  state = send(state, "one");
  assert.equal(state, beforeDuplicate);
  state = chatReducer(state, { type: "create", id: "second" });
  state = chatReducer(state, { type: "mode", mode: "cache" });
  state = finish(send(state, "two"), "two", "cache");
  state = chatReducer(state, { type: "select", id: "initial" });
  state = chatReducer(state, { type: "mode", mode: "no-cache" });
  state = finish(send(state, "three"), "three", "no-cache", true);
  state = send(state, "four");
  const rows = selectMetricsRows(state.conversations, "all", "all");
  const previousOrder = rows.map(({ turn }) => turn.id);
  const points = getDemoQueryTrend(rows, "calls");
  assert.deepEqual(points.map(({ turnId, query }) => [turnId, query]), [["one", 1], ["two", 2], ["three", 3], ["four", 4]]);
  assert.deepEqual(rows.map(({ turn }) => turn.id), previousOrder);
  assert.equal(points[0].values.cache, 0);
  assert.equal(points[1].values["no-cache"], null);
  assert.equal(points[2].branches["no-cache"].status, "error");
  assert.equal(points[3].branches["no-cache"].status, "pending");
  assert.deepEqual(getDemoQueryTrend(selectMetricsRows(state.conversations, "initial", "all"), "calls").map(({ turnId, query }) => [turnId, query]), [["one", 1], ["three", 2], ["four", 3]]);
});

test("Đường độ trễ không dùng thời gian mô phỏng; nhánh không chạy không thành usage 0", () => {
  const state = send(chatReducer(initialChatState(), { type: "mode", mode: "cache" }), "one");
  const rows = selectMetricsRows(state.conversations, "all", "all");
  const latency = getDemoQueryTrend(rows, "response");
  assert.deepEqual(latency[0].values, { "no-cache": null, cache: null });
  assert.deepEqual(getTrendSegments(latency, "cache"), []);
  assert.deepEqual(getDemoQueryTrend(rows, "tokens")[0].values, { "no-cache": null, cache: 0 });
  assert.deepEqual(getDemoQueryTrend([], "calls"), []);
});

test("Đường không nối qua khoảng thiếu/lỗi dữ liệu, giữ giá trị zero hợp lệ", () => {
  const values = [10, null, 0, 4, NaN, Infinity, -1, 3];
  const points = values.map((value, index) => ({ query: index + 1, turnId: String(index), branches: {}, values: { "no-cache": value, cache: null } }));
  assert.deepEqual(getTrendSegments(points, "no-cache"), [
    [{ query: 1, value: 10 }], [{ query: 3, value: 0 }, { query: 4, value: 4 }], [{ query: 8, value: 3 }],
  ]);
  assert.deepEqual(getTrendSegments(points, "cache"), []);
});

test("Đánh dấu tốt hơn theo chiều chỉ số, không mặc định cache luôn thắng", () => {
  assert.equal(getBetterBranch(comparisonRow(120, 40)), "cache");
  assert.equal(getBetterBranch(comparisonRow(30, 80)), "no-cache");
  assert.equal(getBetterBranch(comparisonRow(0.8, 0.9, "higher")), "cache");
  assert.equal(getBetterBranch(comparisonRow(0.9, 0.8, "higher")), "no-cache");
  assert.equal(getBetterBranch(comparisonRow(0, 1)), "no-cache");
});

test("Bằng nhau, thiếu dữ liệu, giá trị lỗi hoặc phép đo không tương đương không có bên tốt hơn", () => {
  for (const [left, right] of [[0, 0], [5, 5], [null, 5], [5, null], [NaN, 5], [5, Infinity], [-1, 5]]) {
    assert.equal(getBetterBranch(comparisonRow(left, right)), null);
    assert.equal(getBetterBranch(comparisonRow(right, left)), null);
  }
  assert.equal(getBetterBranch(comparisonRow(100, 10, "lower", false)), null);
  assert.equal(getBetterBranch(comparisonRow(1, 0, null)), null);
});

test("Bảng đối chiếu demo không suy ra bên thắng từ usage 0, số mẫu khác nhau hay trạng thái quyền", () => {
  const state = send(chatReducer(initialChatState(), { type: "mode", mode: "no-cache" }), "single");
  const summary = summarizeDemoMetrics(selectMetricsRows(state.conversations, "all", "all"));
  const rows = getDemoComparisonRows(summary.branches);
  assert.equal(rows.length, 6);
  assert.ok(rows.every((row) => getBetterBranch(row) === null));
  assert.equal(rows.find((row) => row.key === "llmCalls").values["no-cache"].text, "0");
  assert.equal(rows.find((row) => row.key === "llmCalls").values.cache.text, "—");
  assert.ok(rows.every(row => !["permission", "cacheStatus", "falseHit"].includes(row.key)));
  assert.equal(rows.find((row) => row.key === "quality").preference, "higher");
  assert.equal(rows.find((row) => row.key === "latency").values.cache.value, null);
});

test("Bảng chỉ giữ tiêu chí so được trực tiếp, hai bên dùng một đơn vị chung và tỷ lệ có mẫu số", () => {
  const preview = getMetricsPreview("all");
  const live = getDemoComparisonRows(summarizeDemoMetrics([]).branches);
  const expected = [["latency", "ms"], ["llmCalls", "lượt"], ["llmTokens", "token"], ["quality", "%"], ["disclosure", "%"], ["falseDenial", "%"]];
  assert.deepEqual(preview.comparison.map(row => [row.key, row.unit]), expected);
  assert.deepEqual(live.map(row => [row.key, row.unit]), expected);
  for (const row of preview.comparison) {
    for (const branch of ["no-cache", "cache"]) {
      assert.ok(formatComparisonValue(row, row.values[branch]).endsWith(row.unit));
    }
    if (row.unit === "%") assert.equal(row.values["no-cache"].samples.total, row.values.cache.samples.total);
  }
  assert.equal(formatComparisonValue(preview.comparison[1], preview.comparison[1].values.cache), "9 lượt");
  assert.equal(formatComparisonValue(live[0], live[0].values.cache), "Chưa đo");
  const withoutBlockedCases = summarizePreview(previewQueries.slice(0, 4)).comparison.find(row => row.key === "disclosure");
  assert.equal(withoutBlockedCases.values.cache.value, null);
  assert.equal(formatComparisonValue(withoutBlockedCases, withoutBlockedCases.values.cache), "—");
});

test("Tỷ lệ chỉ tô bên tốt hơn khi hai bên có cùng mẫu số hợp lệ", () => {
  const row = { ...comparisonRow(80, 90, "higher"), unit: "%", values: {
    "no-cache": { text: "80", value: 80, samples: { count: 8, total: 10 } },
    cache: { text: "90", value: 90, samples: { count: 9, total: 10 } },
  }};
  assert.equal(getBetterBranch(row), "cache");
  row.preference = "lower";
  assert.equal(getBetterBranch(row), "no-cache");
  for (const samples of [undefined, { count: 18, total: 20 }, { count: 0, total: 0 }, { count: 9, total: Infinity }, { count: 11, total: 10 }]) {
    assert.equal(getBetterBranch({ ...row, values: { ...row.values, cache: { ...row.values.cache, samples } } }), null);
  }
});

test("Dashboard rỗng không biến nhánh không chạy thành usage 0", () => {
  const state = initialChatState();
  const rows = selectMetricsRows(state.conversations, "all", "all");
  const summary = summarizeDemoMetrics(rows);
  assert.equal(summary.turns, 0);
  assert.equal(summary.paired, 0);
  assert.equal(summary.branches.cache.llmCalls, null);
  assert.equal(summary.branches["no-cache"].llmTokens, null);
});

test("Hai giá trị hiển thị bằng nhau sau làm tròn không tô bên tốt hơn", () => {
  const row = comparisonRow(1000.1, 1000.4);
  row.values["no-cache"].text = "1.000";
  row.values.cache.text = "1.000";
  assert.equal(getBetterBranch(row), null);
});

test("Tỷ lệ ngoài giới hạn hoặc không khớp số ca không được hiển thị như số đo hợp lệ", () => {
  for (const invalid of [120, 80]) {
    const row = { ...comparisonRow(70, invalid, "higher"), unit: "%", values: {
      "no-cache": { text: "70", value: 70, samples: { count: 7, total: 10 } },
      cache: { text: String(invalid), value: invalid, samples: { count: 9, total: 10 } },
    }};
    assert.equal(getBetterBranch(row), null);
    assert.equal(formatComparisonValue(row, row.values.cache), "—");
  }
});

test("Giá trị lỗi không hiện NaN, Infinity hoặc số âm trong bảng", () => {
  for (const invalid of [NaN, Infinity, -1]) {
    const row = comparisonRow(10, invalid);
    assert.equal(formatComparisonValue(row, row.values.cache), "—");
  }
});

test("Mẫu rỗng và tập không có ca đánh giá không suy ra kết quả zero hay 0/0", () => {
  const empty = summarizePreview([]);
  assert.deepEqual(empty.qualityValues, ["—", "—", "—", "—"]);
  assert.equal(empty.summaries.cache.llmCalls, null);
  assert.equal(empty.summaries["no-cache"].llmTokens, null);
  assert.equal(empty.overview.callsSaved, "—");
  assert.equal(empty.overview.tokensSaved, "—");
  assert.equal(empty.overview.violations, "—");
  const coldOnly = summarizePreview(previewQueries.slice(0, 4));
  assert.equal(coldOnly.qualityValues[1], "—");
  assert.equal(coldOnly.qualityValues[2], "—");
});

test("Một lượt chia đôi có một mẫu, giữ nhánh lỗi/chờ riêng và không làm mất mẫu lỗi", () => {
  let state = chatReducer(initialChatState(), { type: "mode", mode: "compare" });
  state = send(state, "one");
  state = finish(state, "one", "no-cache", true);
  let summary = summarizeDemoMetrics(selectMetricsRows(state.conversations, "all", "all"));
  assert.equal(summary.turns, 1);
  assert.equal(summary.paired, 1);
  assert.equal(summary.branches["no-cache"].error, 1);
  assert.equal(summary.branches.cache.pending, 1);
  state = finish(state, "one", "cache");
  summary = summarizeDemoMetrics(selectMetricsRows(state.conversations, "all", "all"));
  assert.equal(summary.branches.cache.complete, 1);
  assert.equal(summary.branches["no-cache"].error, 1);
  assert.equal(summary.branches.cache.llmCalls, 0);
  assert.equal(summary.branches.cache.llmTokens, 0);
  assert.equal("hitRate" in summary, false);
  assert.equal("permission" in summary, false);
  assert.equal("latency" in summary, false);
});

test("Lọc hội thoại và lượt so sánh theo snapshot, không gộp prompt trùng hay bỏ nhánh không chạy", () => {
  let state = send(chatReducer(initialChatState(), { type: "mode", mode: "no-cache" }), "one");
  state = finish(state, "one", "no-cache");
  state = chatReducer(state, { type: "mode", mode: "compare" });
  state = send(state, "two");
  state = finish(state, "two", "no-cache");
  state = finish(state, "two", "cache");
  state = chatReducer(state, { type: "create", id: "second" });
  state = chatReducer(state, { type: "mode", mode: "cache" });
  state = send(state, "three");
  const all = selectMetricsRows(state.conversations, "all", "all");
  assert.equal(all.length, 3);
  assert.equal(selectMetricsRows(state.conversations, "all", "compare").length, 1);
  const first = selectMetricsRows(state.conversations, "initial", "all");
  assert.deepEqual(first.map((row) => row.ordinal), [1, 2]);
  assert.equal(summarizeDemoMetrics(first).branches["no-cache"].total, 2);
  assert.equal(summarizeDemoMetrics(first).branches.cache.total, 1);
  const cacheRows = selectBranchRows(all, "cache");
  const baselineRows = selectBranchRows(all, "no-cache");
  assert.deepEqual(cacheRows.map(({ turn }) => turn.id), ["three", "two"]);
  assert.deepEqual(baselineRows.map(({ turn }) => turn.id), ["one", "two"]);
  assert.equal(summarizeDemoMetrics(cacheRows).branches.cache.total, 2);
  assert.equal(summarizeDemoMetrics(baselineRows).branches["no-cache"].total, 2);
  assert.equal(selectBranchRows(first, "cache")[0].ordinal, 2);
  assert.equal(selectBranchRows([], "no-cache").length, 0);
  const second = selectMetricsRows(state.conversations, "second", "all");
  assert.equal(summarizeDemoMetrics(second).branches["no-cache"].llmCalls, null);
  assert.equal(summarizeDemoMetrics(second).branches.cache.pending, 1);
  assert.equal(selectMetricsRows(state.conversations, "missing", "all").length, 0);
  assert.equal(summarizeDemoMetrics(selectMetricsRows(initialChatState().conversations, "all", "all")).turns, 0);
});
