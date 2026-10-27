import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chatReducer,
  initialChatState,
} from "../src/features/chat/chat-state.ts";
import { createDemoReply } from "../src/features/chat/demo-reply.ts";
import { getDemoMetricValues, chatMetricDefinitions } from "../src/features/chat/chat-metrics-model.ts";

const user = { id: "question", role: "user", text: "Một câu hỏi mẫu" };
const reply = { id: "answer", role: "assistant", text: "Phản hồi mô phỏng" };
const send = (state) =>
  chatReducer(state, {
    type: "send",
    conversationId: state.activeId,
    requestId: state.conversations.find((item) => item.id === state.activeId).turns.length
      ? `request-${state.conversations.find((item) => item.id === state.activeId).turns.length + 1}`
      : "request",
    message: user,
  });

test("Không gửi rỗng hoặc gửi trùng trong khi đang chờ", () => {
  const initial = initialChatState();
  assert.equal(
    chatReducer(initial, {
      type: "send",
      conversationId: initial.activeId,
      requestId: "request",
      message: { ...user, text: "  " },
    }),
    initial,
  );
  const pending = send(initial);
  assert.equal(send(pending), pending);
  assert.equal(pending.conversations[0].messages["no-cache"].length, 1);
});

test("Phản hồi thuộc hội thoại gốc dù đã chuyển sang hội thoại khác", () => {
  let state = chatReducer(initialChatState(), { type: "create", id: "second" });
  state = send(state);
  state = chatReducer(state, { type: "select", id: "initial" });
  state = chatReducer(state, {
    type: "reply",
    conversationId: "second",
    requestId: "request",
    branch: "no-cache",
    message: reply,
  });
  assert.equal(state.activeId, "initial");
  assert.equal(
    state.conversations.find((item) => item.id === "initial").messages["no-cache"].length,
    0,
  );
  assert.deepEqual(
    state.conversations.find((item) => item.id === "second").messages["no-cache"],
    [user, reply],
  );
  assert.equal(state.pending, null);
});

test("Giữ bản nháp riêng cho từng hội thoại và không sửa state cũ", () => {
  const initial = initialChatState();
  let state = chatReducer(initial, {
    type: "draft",
    text: "Bản nháp thứ nhất",
  });
  state = chatReducer(state, { type: "create", id: "second" });
  state = chatReducer(state, { type: "draft", text: "Bản nháp thứ hai" });
  assert.equal(initial.conversations[0].draft, "");
  assert.equal(
    state.conversations.find((item) => item.id === "initial").draft,
    "Bản nháp thứ nhất",
  );
  assert.equal(state.conversations[0].draft, "Bản nháp thứ hai");
  assert.equal(chatReducer(state, { type: "select", id: "missing" }), state);
});

test("Bỏ qua phản hồi sai hội thoại hoặc đến trễ", () => {
  const pending = send(initialChatState());
  assert.equal(
    chatReducer(pending, {
      type: "reply",
      conversationId: "unknown",
      requestId: "request",
      branch: "no-cache",
      message: reply,
    }),
    pending,
  );
  const finished = chatReducer(pending, {
    type: "reply",
    conversationId: pending.activeId,
    requestId: "request",
    branch: "no-cache",
    message: reply,
  });
  assert.equal(
    chatReducer(finished, {
      type: "reply",
      conversationId: pending.activeId,
      requestId: "request",
      branch: "no-cache",
      message: reply,
    }),
    finished,
  );
});

test("Lỗi dừng loading và cho phép gửi tiếp", () => {
  const state = send(initialChatState());
  const failed = chatReducer(state, {
    type: "error",
    conversationId: state.activeId,
    requestId: "request",
    branch: "no-cache",
    error: "Lỗi mô phỏng",
  });
  assert.equal(failed.pending, null);
  assert.equal(failed.conversations[0].errors["no-cache"], "Lỗi mô phỏng");
  assert.equal(send(failed).pending.conversationId, state.activeId);
});

test("Giữ câu hỏi nguyên văn để React hiển thị dạng văn bản an toàn", () => {
  const text = '<img src=x onerror="alert(1)">';
  const state = chatReducer(initialChatState(), {
    type: "send",
    conversationId: "initial",
    requestId: "request",
    message: { ...user, text },
  });
  assert.equal(state.conversations[0].messages["no-cache"][0].text, text);
});

test("Hủy mô phỏng khi component unmount", async () => {
  const controller = new AbortController();
  const pending = createDemoReply("Câu hỏi mẫu", controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  await assert.rejects(createDemoReply("Đã hủy", controller.signal), {
    name: "AbortError",
  });
});

test("Chỉ gửi đến nhánh đã chọn; đổi chế độ giữ lịch sử và bản nháp", () => {
  const initial = initialChatState();
  let state = send(initial);
  state = chatReducer(state, {
    type: "reply", conversationId: "initial", requestId: "request",
    branch: "no-cache", message: reply,
  });
  state = chatReducer(state, { type: "draft", text: "Bản nháp chung" });
  state = chatReducer(state, { type: "mode", mode: "cache" });
  assert.deepEqual(state.conversations[0].messages["no-cache"], [user, reply]);
  assert.deepEqual(state.conversations[0].messages.cache, []);
  assert.equal(state.conversations[0].draft, "Bản nháp chung");
  const pending = send(state);
  assert.deepEqual(pending.pending.branches, ["cache"]);
  assert.deepEqual(pending.conversations[0].messages.cache, [user]);
  assert.deepEqual(initial.conversations[0].messages, { "no-cache": [], cache: [] });
});

test("Chia đôi gửi cùng prompt đến hai nhánh và chờ đủ phản hồi", () => {
  const initial = chatReducer(initialChatState(), { type: "mode", mode: "compare" });
  let state = send(initial);
  assert.deepEqual(state.pending.branches, ["no-cache", "cache"]);
  assert.deepEqual(state.conversations[0].messages, { "no-cache": [user], cache: [user] });
  state = chatReducer(state, {
    type: "reply", conversationId: "initial", requestId: "request",
    branch: "cache", message: reply,
  });
  assert.deepEqual(state.pending.branches, ["no-cache"]);
  assert.deepEqual(state.conversations[0].messages.cache, [user, reply]);
  assert.deepEqual(state.conversations[0].messages["no-cache"], [user]);
  assert.equal(send(state), state);
  state = chatReducer(state, {
    type: "reply", conversationId: "initial", requestId: "request",
    branch: "no-cache", message: { ...reply, text: "Nhánh không cache" },
  });
  assert.equal(state.pending, null);
  assert.equal(state.conversations[0].messages["no-cache"][1].text, "Nhánh không cache");
});

test("Lỗi một nhánh không hủy hoặc ghi đè kết quả nhánh kia", () => {
  let state = send(chatReducer(initialChatState(), { type: "mode", mode: "compare" }));
  state = chatReducer(state, {
    type: "error", conversationId: "initial", requestId: "request",
    branch: "cache", error: "Cache lỗi",
  });
  assert.deepEqual(state.pending.branches, ["no-cache"]);
  state = chatReducer(state, {
    type: "reply", conversationId: "initial", requestId: "request",
    branch: "no-cache", message: reply,
  });
  assert.equal(state.pending, null);
  assert.equal(state.conversations[0].errors.cache, "Cache lỗi");
  assert.deepEqual(state.conversations[0].messages["no-cache"], [user, reply]);
  state = send(state);
  assert.deepEqual(state.conversations[0].errors, {});
});

test("Bỏ qua nhánh không được gửi, phản hồi trùng và phản hồi của lượt cũ", () => {
  let state = send(initialChatState());
  const action = { type: "reply", conversationId: "initial", requestId: "request", branch: "no-cache", message: reply };
  assert.equal(chatReducer(state, { ...action, branch: "cache" }), state);
  assert.equal(chatReducer(state, { ...action, requestId: "old-request" }), state);
  state = chatReducer(state, action);
  const next = chatReducer(state, { type: "send", conversationId: "initial", requestId: "next-request", message: user });
  assert.equal(chatReducer(next, action), next);
  let comparison = send(chatReducer(initialChatState(), { type: "mode", mode: "compare" }));
  comparison = chatReducer(comparison, action);
  assert.equal(chatReducer(comparison, action), comparison);
});

test("Chế độ thuộc từng hội thoại; chat mới kế thừa chế độ nhưng có lịch sử rỗng", () => {
  let state = chatReducer(initialChatState(), { type: "mode", mode: "compare" });
  state = chatReducer(state, { type: "create", id: "second" });
  assert.equal(state.conversations[0].mode, "compare");
  assert.deepEqual(state.conversations[0].messages, { "no-cache": [], cache: [] });
  state = chatReducer(state, { type: "mode", mode: "cache" });
  state = chatReducer(state, { type: "select", id: "initial" });
  assert.equal(state.conversations.find((item) => item.id === state.activeId).mode, "compare");
  const pending = send(state);
  assert.equal(chatReducer(pending, { type: "mode", mode: "cache" }), pending);
  assert.equal(chatReducer(pending, { type: "create", id: "blocked" }), pending);
  assert.equal(chatReducer(state, { type: "mode", mode: "invalid" }), state);
});

test("Phản hồi chia đôi vẫn thuộc đúng hội thoại sau khi chuyển lịch sử", () => {
  let state = chatReducer(initialChatState(), { type: "create", id: "second" });
  state = send(chatReducer(state, { type: "mode", mode: "compare" }));
  state = chatReducer(state, { type: "select", id: "initial" });
  for (const branch of ["cache", "no-cache"]) {
    state = chatReducer(state, { type: "reply", conversationId: "second", requestId: "request", branch, message: reply });
  }
  assert.equal(state.activeId, "initial");
  assert.deepEqual(state.conversations.find((item) => item.id === "initial").messages, { "no-cache": [], cache: [] });
  assert.deepEqual(state.conversations.find((item) => item.id === "second").messages, { "no-cache": [user, reply], cache: [user, reply] });
});

test("Hai chế độ chỉ trả lời mẫu và nói rõ cache chưa triển khai", async () => {
  const controller = new AbortController();
  const [baseline, cached] = await Promise.all([
    createDemoReply("Cùng câu hỏi", controller.signal, "no-cache"),
    createDemoReply("Cùng câu hỏi", controller.signal, "cache"),
  ]);
  assert.match(baseline, /không cache/);
  assert.match(cached, /Cache chưa được triển khai/);
  for (const text of [baseline, cached]) assert.match(text, /chưa kết nối AI/);
});

test("Mỗi lượt chia đôi chỉ ghi một prompt; câu trùng vẫn thành hai lượt riêng", () => {
  const initial = chatReducer(initialChatState(), { type: "mode", mode: "compare" });
  let state = send(initial);
  assert.equal(state.conversations[0].turns.length, 1);
  assert.deepEqual(state.conversations[0].turns[0], {
    id: "request", prompt: user.text, mode: "compare",
    branches: { "no-cache": { status: "pending" }, cache: { status: "pending" } },
  });
  for (const branch of ["cache", "no-cache"]) {
    state = chatReducer(state, { type: "reply", conversationId: "initial", requestId: "request", branch, message: reply });
  }
  const previousTurn = state.conversations[0].turns[0];
  const duplicate = { type: "send", conversationId: "initial", requestId: "request", message: user };
  assert.equal(chatReducer(state, duplicate), state);
  state = send(state);
  assert.equal(state.conversations[0].turns.length, 2);
  assert.notEqual(state.conversations[0].turns[0].id, state.conversations[0].turns[1].id);
  assert.equal(state.conversations[0].turns[0], previousTurn);
  assert.deepEqual(initial.conversations[0].turns, []);
});

test("Lưu trạng thái từng nhánh đúng lượt, giữ snapshot chế độ và lỗi", () => {
  let state = send(chatReducer(initialChatState(), { type: "mode", mode: "compare" }));
  const pendingTurn = state.conversations[0].turns[0];
  state = chatReducer(state, { type: "error", conversationId: "initial", requestId: "request", branch: "cache", error: "Lỗi mẫu" });
  assert.deepEqual(state.conversations[0].turns[0].branches.cache, { status: "error", error: "Lỗi mẫu" });
  assert.equal(state.conversations[0].turns[0].branches["no-cache"].status, "pending");
  assert.equal(pendingTurn.branches.cache.status, "pending");
  state = chatReducer(state, { type: "reply", conversationId: "initial", requestId: "request", branch: "no-cache", message: reply });
  state = chatReducer(state, { type: "mode", mode: "cache" });
  assert.equal(state.conversations[0].turns[0].mode, "compare");
  assert.equal(state.conversations[0].turns[0].branches["no-cache"].status, "complete");
  const previous = state.conversations[0].turns[0];
  state = send(state);
  assert.equal(state.conversations[0].turns[0], previous);
  assert.deepEqual(Object.keys(state.conversations[0].turns[1].branches), ["cache"]);
  assert.equal(chatReducer(state, { type: "reply", conversationId: "initial", requestId: "request", branch: "no-cache", message: reply }), state);
});

test("Lượt gửi tách theo hội thoại và không ghi bản nháp hay câu rỗng", () => {
  let state = chatReducer(initialChatState(), { type: "draft", text: "Bản nháp" });
  assert.equal(state.conversations[0].turns.length, 0);
  const empty = chatReducer(state, { type: "send", conversationId: "initial", requestId: "empty", message: { ...user, text: " " } });
  assert.equal(empty, state);
  state = chatReducer(state, { type: "create", id: "second" });
  state = send(state);
  state = chatReducer(state, { type: "select", id: "initial" });
  state = chatReducer(state, { type: "reply", conversationId: "second", requestId: "request", branch: "no-cache", message: reply });
  assert.equal(state.conversations.find((item) => item.id === "initial").turns.length, 0);
  assert.equal(state.conversations.find((item) => item.id === "second").turns[0].branches["no-cache"].status, "complete");
});

test("Thông số demo không bịa hit/miss, quyền hoặc thời gian; nhánh không chạy không có số 0 giả", () => {
  const state = send(initialChatState());
  const turn = state.conversations[0].turns[0];
  assert.equal(chatMetricDefinitions.length, 5);
  assert.deepEqual(getDemoMetricValues(turn, "no-cache"), {
    cacheStatus: "Không áp dụng", responseTime: "Chưa đo", llmCalls: "0", llmTokens: "0", permission: "Chưa xác minh",
  });
  assert.ok(Object.values(getDemoMetricValues(turn, "cache")).every((value) => value === "Không chạy"));
  assert.ok(Object.values(getDemoMetricValues(undefined, "cache")).every((value) => value === "—"));
  const compared = send(chatReducer(initialChatState(), { type: "mode", mode: "compare" }));
  assert.equal(getDemoMetricValues(compared.conversations[0].turns[0], "cache").cacheStatus, "Chưa xác định");
});
