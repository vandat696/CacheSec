import type { ChatBranch, ChatTurn, Conversation } from "../chat/chat-state";

export type TurnSelection = "all" | "compare";
export type MetricsRow = {
  conversationId: string;
  conversationTitle: string;
  ordinal: number;
  turn: ChatTurn;
};
export type BranchSummary = {
  total: number;
  complete: number;
  pending: number;
  error: number;
  llmCalls: number | null;
  llmTokens: number | null;
};

export function selectBranchRows(rows: readonly MetricsRow[], branch: ChatBranch): MetricsRow[] {
  return rows.filter(({ turn }) => turn.branches[branch] !== undefined);
}

// Session/demo facts only. Completion is not a cache hit, an authorization
// decision, or a quality label. No simulated timing enters these summaries.
export function selectMetricsRows(
  conversations: readonly Conversation[],
  conversationId: string,
  selection: TurnSelection,
): MetricsRow[] {
  return conversations
    .filter((conversation) => conversationId === "all" || conversation.id === conversationId)
    .flatMap((conversation) => conversation.turns.map((turn, index) => ({
      conversationId: conversation.id,
      conversationTitle: conversation.title,
      ordinal: index + 1,
      turn,
    })))
    .filter(({ turn }) => selection === "all" || turn.mode === "compare");
}

export function summarizeDemoMetrics(rows: readonly MetricsRow[]) {
  function summarize(branch: ChatBranch): BranchSummary {
    const results = rows.flatMap(({ turn }) => turn.branches[branch] ? [turn.branches[branch]] : []);
    return {
      total: results.length,
      complete: results.filter((result) => result.status === "complete").length,
      pending: results.filter((result) => result.status === "pending").length,
      error: results.filter((result) => result.status === "error").length,
      // A branch that did not run has no usage; a demo branch calls no model.
      llmCalls: results.length ? 0 : null,
      llmTokens: results.length ? 0 : null,
    };
  }
  return {
    turns: rows.length,
    paired: rows.filter(({ turn }) => !!turn.branches["no-cache"] && !!turn.branches.cache).length,
    branches: { "no-cache": summarize("no-cache"), cache: summarize("cache") },
  };
}
