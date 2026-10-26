import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chatReducer,
  initialChatState,
} from "../src/features/chat/chat-state.ts";
import { createDemoReply } from "../src/features/chat/demo-reply.ts";

const user = { id: "question", role: "user", text: "Một câu hỏi mẫu" };
const reply = { id: "answer", role: "assistant", text: "Phản hồi mô phỏng" };
const send = (state) =>
  chatReducer(state, {
    type: "send",
    conversationId: state.activeId,
    message: user,
  });

test("Không gửi rỗng hoặc gửi trùng trong khi đang chờ", () => {
  const initial = initialChatState();
  assert.equal(
    chatReducer(initial, {
      type: "send",
      conversationId: initial.activeId,
      message: { ...user, text: "  " },
    }),
    initial,
  );
  const pending = send(initial);
  assert.equal(send(pending), pending);
  assert.equal(pending.conversations[0].messages.length, 1);
});

test("Phản hồi thuộc hội thoại gốc dù đã chuyển sang hội thoại khác", () => {
  let state = chatReducer(initialChatState(), { type: "create", id: "second" });
  state = send(state);
  state = chatReducer(state, { type: "select", id: "initial" });
  state = chatReducer(state, {
    type: "reply",
    conversationId: "second",
    message: reply,
  });
  assert.equal(state.activeId, "initial");
  assert.equal(
    state.conversations.find((item) => item.id === "initial").messages.length,
    0,
  );
  assert.deepEqual(
    state.conversations.find((item) => item.id === "second").messages,
    [user, reply],
  );
  assert.equal(state.pendingId, null);
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
      message: reply,
    }),
    pending,
  );
  const finished = chatReducer(pending, {
    type: "reply",
    conversationId: pending.activeId,
    message: reply,
  });
  assert.equal(
    chatReducer(finished, {
      type: "reply",
      conversationId: pending.activeId,
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
    error: "Lỗi mô phỏng",
  });
  assert.equal(failed.pendingId, null);
  assert.equal(failed.error, "Lỗi mô phỏng");
  assert.equal(send(failed).pendingId, state.activeId);
});

test("Giữ câu hỏi nguyên văn để React hiển thị dạng văn bản an toàn", () => {
  const text = '<img src=x onerror="alert(1)">';
  const state = chatReducer(initialChatState(), {
    type: "send",
    conversationId: "initial",
    message: { ...user, text },
  });
  assert.equal(state.conversations[0].messages[0].text, text);
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
