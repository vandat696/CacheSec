"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useChat as useChatController } from "./use-chat";

const ChatContext = createContext<ReturnType<typeof useChatController> | null>(
  null,
);

export function ChatProvider({ children }: { children: ReactNode }) {
  const chat = useChatController();
  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const chat = useContext(ChatContext);
  if (!chat) throw new Error("useChat cần ChatProvider.");
  return chat;
}
