export const chatModes = [
  { value: "no-cache", label: "Không cache" },
  { value: "cache", label: "Cache" },
  { value: "compare", label: "Cả hai" },
] as const;

export type ChatMode = (typeof chatModes)[number]["value"];
export type ChatBranch = Exclude<ChatMode, "compare">;
export type Message = { id: string; role: "user" | "assistant"; text: string };
export type ChatTurn = {
  id: string;
  sequence: number;
  prompt: string;
  mode: ChatMode;
  branches: Partial<Record<
    ChatBranch,
    { status: "pending" | "complete" | "error"; error?: string }
  >>;
};
export type Conversation = {
  id: string;
  title: string;
  mode: ChatMode;
  messages: Record<ChatBranch, Message[]>;
  turns: ChatTurn[];
  errors: Partial<Record<ChatBranch, string>>;
  draft: string;
};
export type ChatState = {
  conversations: Conversation[];
  activeId: string;
  pending: {
    requestId: string;
    conversationId: string;
    branches: ChatBranch[];
  } | null;
};
export type ChatAction =
  | { type: "create"; id: string }
  | { type: "select"; id: string }
  | { type: "mode"; mode: ChatMode }
  | { type: "draft"; text: string }
  | { type: "send"; conversationId: string; requestId: string; message: Message }
  | {
      type: "reply";
      conversationId: string;
      requestId: string;
      branch: ChatBranch;
      message: Message;
    }
  | {
      type: "error";
      conversationId: string;
      requestId: string;
      branch: ChatBranch;
      error: string;
    };

export function branchesForMode(mode: ChatMode): ChatBranch[] {
  return mode === "compare" ? ["no-cache", "cache"] : [mode];
}

function emptyConversation(id: string, mode: ChatMode): Conversation {
  return {
    id,
    title: "Cuộc trò chuyện mới",
    mode,
    messages: { "no-cache": [], cache: [] },
    turns: [],
    errors: {},
    draft: "",
  };
}

export function initialChatState(): ChatState {
  return {
    conversations: [emptyConversation("initial", "compare")],
    activeId: "initial",
    pending: null,
  };
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "create": {
      if (
        state.pending ||
        state.conversations.some((item) => item.id === action.id)
      )
        return state;
      const mode = state.conversations.find(
        (item) => item.id === state.activeId,
      )!.mode;
      return {
        ...state,
        conversations: [emptyConversation(action.id, mode), ...state.conversations],
        activeId: action.id,
      };
    }
    case "select":
      return state.conversations.some((item) => item.id === action.id)
        ? { ...state, activeId: action.id }
        : state;
    case "mode":
      if (state.pending || !chatModes.some((mode) => mode.value === action.mode))
        return state;
      return {
        ...state,
        conversations: state.conversations.map((item) =>
          item.id === state.activeId ? { ...item, mode: action.mode } : item,
        ),
      };
    case "draft":
      return {
        ...state,
        conversations: state.conversations.map((item) =>
          item.id === state.activeId ? { ...item, draft: action.text } : item,
        ),
      };
    case "send": {
      const conversation = state.conversations.find(
        (item) => item.id === action.conversationId,
      );
      if (
        state.pending || !conversation || !action.message.text.trim() ||
        conversation.turns.some((turn) => turn.id === action.requestId)
      )
        return state;
      const branches = branchesForMode(conversation.mode);
      const messages = { ...conversation.messages };
      const errors = { ...conversation.errors };
      const turn: ChatTurn = {
        id: action.requestId,
        sequence: state.conversations.reduce((total, item) => total + item.turns.length, 0) + 1,
        prompt: action.message.text,
        mode: conversation.mode,
        branches: {},
      };
      for (const branch of branches) {
        messages[branch] = [...messages[branch], action.message];
        turn.branches[branch] = { status: "pending" };
        delete errors[branch];
      }
      const hasMessages = Object.values(conversation.messages).some(
        (items) => items.length > 0,
      );
      return {
        ...state,
        pending: {
          conversationId: action.conversationId,
          requestId: action.requestId,
          branches,
        },
        conversations: state.conversations.map((item) =>
          item.id !== action.conversationId
            ? item
            : {
                ...item,
                draft: "",
                title: hasMessages
                  ? item.title
                  : action.message.text.length > 36
                    ? `${action.message.text.slice(0, 33)}…`
                    : action.message.text,
                messages,
                turns: [...item.turns, turn],
                errors,
              },
        ),
      };
    }
    case "reply":
    case "error": {
      if (
        state.pending?.conversationId !== action.conversationId ||
        state.pending.requestId !== action.requestId ||
        !state.pending.branches.includes(action.branch)
      )
        return state;
      const remaining = state.pending.branches.filter(
        (branch) => branch !== action.branch,
      );
      return {
        ...state,
        pending: remaining.length
          ? { ...state.pending, branches: remaining }
          : null,
        conversations: state.conversations.map((item) => {
          if (item.id !== action.conversationId) return item;
          const turns = item.turns.map((turn) =>
            turn.id !== action.requestId
              ? turn
              : {
                  ...turn,
                  branches: {
                    ...turn.branches,
                    [action.branch]: action.type === "reply"
                      ? { status: "complete" as const }
                      : { status: "error" as const, error: action.error },
                  },
                },
          );
          return action.type === "reply"
            ? {
                ...item,
                turns,
                messages: {
                  ...item.messages,
                  [action.branch]: [...item.messages[action.branch], action.message],
                },
              }
            : {
                ...item,
                turns,
                errors: { ...item.errors, [action.branch]: action.error },
              };
        }),
      };
    }
  }
}
