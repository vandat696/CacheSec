import { Tabs } from "@/components/ui/navigation/Tabs";
import { Fragment, useEffect, useRef } from "react";
import { branchLabel, branchPending, type ComparisonTurn } from "./comparisonModel";
import type { ContextMode } from "../context-cache/contextCacheModel";

function replyStatus(status: string) {
  switch (status) {
    case "error": return "Nhánh gặp lỗi trước khi trả lời.";
    case "timed_out": return "Nhánh hết thời gian chờ phản hồi.";
    case "cancelled": return "Đã dừng nhánh.";
    case "incomplete": return "Nhánh chưa hoàn tất.";
    case "preparing":
    case "ready": return "Đang chờ phản hồi…";
    default: return branchPending({ status }) ? "Đang chờ phản hồi…" : "Chưa có phản hồi.";
  }
}

function BranchLog({ mode, turns }: { mode: ContextMode; turns: ComparisonTurn[] }) {
  const log = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  useEffect(() => {
    const element = log.current;
    if (!element) return;
    const revealLatest = () => {
      if (followLatest.current && element.clientHeight) element.scrollTop = element.scrollHeight;
    };
    revealLatest();
    const observer = new ResizeObserver(revealLatest);
    observer.observe(element);
    return () => observer.disconnect();
  }, [turns]);
  return <div ref={log} role="log" aria-label={`Hội thoại · ${branchLabel(mode)}`} className="dev-messages" aria-live="polite"
    onScroll={event => {
      const { clientHeight, scrollHeight, scrollTop } = event.currentTarget;
      if (clientHeight) followLatest.current = scrollHeight - scrollTop - clientHeight < 48;
    }}>
    {turns.map(turn => {
      const { status, answer } = turn.branches[mode];
      return <Fragment key={turn.pair_id}>
        <article className="dev-message developer"><p>{turn.prompt}</p></article>
        {answer.trim() ? <article className="dev-message assistant"><p>{answer}</p></article>
          : <p className="comparison-chat-status" role="status">{replyStatus(status)}</p>}
      </Fragment>;
    })}
  </div>;
}

export function ComparisonChat({ turns }: { turns: ComparisonTurn[] }) {
  return <div className="comparison-chat-tabs">
    <Tabs label="Phản hồi hai nhánh" items={(["none", "local"] as const).map(mode => ({
      id: mode, label: branchLabel(mode), content: <BranchLog mode={mode} turns={turns} />,
    }))} />
  </div>;
}
