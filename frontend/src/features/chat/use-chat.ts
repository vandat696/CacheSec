"use client";

import { useEffect, useReducer, useRef } from "react";
import {
  branchesForMode,
  chatReducer,
  initialChatState,
  type ChatMode,
} from "./chat-state";
import { createDemoReply } from "./demo-reply";

export function useChat() {
  const [state, dispatch] = useReducer(
    chatReducer,
    undefined,
    initialChatState,
  );
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const conversation = state.conversations.find(
    (item) => item.id === state.activeId,
  )!;

  async function send(text: string) {
    const prompt = text.trim();
    if (!prompt || state.pending || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const conversationId = state.activeId;
    const requestId = crypto.randomUUID();
    const branches = branchesForMode(conversation.mode);
    dispatch({
      type: "send",
      conversationId,
      requestId,
      message: { id: crypto.randomUUID(), role: "user", text: prompt },
    });
    try {
      await Promise.all(
        branches.map(async (branch) => {
          try {
            const reply = await createDemoReply(prompt, controller.signal, branch);
            if (!controller.signal.aborted)
              dispatch({
                type: "reply",
                conversationId,
                requestId,
                branch,
                message: { id: crypto.randomUUID(), role: "assistant", text: reply },
              });
          } catch {
            if (!controller.signal.aborted)
              dispatch({
                type: "error",
                conversationId,
                requestId,
                branch,
                error: "Không thể tạo phản hồi mô phỏng. Bạn có thể thử gửi lại.",
              });
          }
        }),
      );
    } finally {
      if (request.current === controller) request.current = null;
    }
  }

  return {
    state,
    conversation,
    send,
    setMode: (mode: ChatMode) => dispatch({ type: "mode", mode }),
    setDraft: (text: string) => dispatch({ type: "draft", text }),
    select: (id: string) => dispatch({ type: "select", id }),
    create: () => dispatch({ type: "create", id: crypto.randomUUID() }),
  };
}
