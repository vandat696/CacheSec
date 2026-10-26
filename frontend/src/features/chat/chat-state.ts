export type Message = { id: string; role: "user" | "assistant"; text: string };
export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  draft: string;
};
export type ChatState = {
  conversations: Conversation[];
  activeId: string;
  pendingId: string | null;
  error: string | null;
};
export type ChatAction =
  | { type: "create"; id: string }
  | { type: "select"; id: string }
  | { type: "draft"; text: string }
  | { type: "send"; conversationId: string; message: Message }
  | { type: "reply"; conversationId: string; message: Message }
  | { type: "error"; conversationId: string; error: string };

function emptyConversation(id: string): Conversation {
  return { id, title: "Cuộc trò chuyện mới", messages: [], draft: "" };
}

export function initialChatState(): ChatState {
  return {
    conversations: [emptyConversation("initial")],
    activeId: "initial",
    pendingId: null,
    error: null,
  };
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "create":
      if (
        state.pendingId ||
        state.conversations.some((item) => item.id === action.id)
      )
        return state;
      return {
        ...state,
        conversations: [emptyConversation(action.id), ...state.conversations],
        activeId: action.id,
        error: null,
      };
    case "select":
      return state.conversations.some((item) => item.id === action.id)
        ? { ...state, activeId: action.id, error: null }
        : state;
    case "draft":
      return {
        ...state,
        error: null,
        conversations: state.conversations.map((item) =>
          item.id === state.activeId ? { ...item, draft: action.text } : item,
        ),
      };
    case "send": {
      const conversation = state.conversations.find(
        (item) => item.id === action.conversationId,
      );
      if (state.pendingId || !conversation || !action.message.text.trim())
        return state;
      return {
        ...state,
        pendingId: action.conversationId,
        error: null,
        conversations: state.conversations.map((item) =>
          item.id !== action.conversationId
            ? item
            : {
                ...item,
                draft: "",
                title: item.messages.length
                  ? item.title
                  : action.message.text.length > 36
                    ? `${action.message.text.slice(0, 33)}…`
                    : action.message.text,
                messages: [...item.messages, action.message],
              },
        ),
      };
    }
    case "reply":
      if (state.pendingId !== action.conversationId) return state;
      return {
        ...state,
        pendingId: null,
        conversations: state.conversations.map((item) =>
          item.id === action.conversationId
            ? { ...item, messages: [...item.messages, action.message] }
            : item,
        ),
      };
    case "error":
      return state.pendingId === action.conversationId
        ? { ...state, pendingId: null, error: action.error }
        : state;
  }
}
