"use client";

import { useState, type FormEvent, type Ref } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { AgentModelId } from "../agent/agentApi";
import type { ComparisonSummary } from "./comparisonModel";
import type { useComparison } from "./useComparison";

export function ComparisonPanel({ comparison, snapshotId, enabled, unavailable, cacheState, hidden, composerRef, model }: {
  comparison: ReturnType<typeof useComparison>;
  snapshotId: string | null;
  enabled: boolean;
  unavailable?: string;
  cacheState: ComparisonSummary["cache_state"];
  hidden: boolean;
  composerRef: Ref<HTMLTextAreaElement>;
  model?: AgentModelId;
}) {
  const [prompt, setPrompt] = useState("");
  const blocked = comparison.busy || comparison.pending;
  async function send(event: FormEvent) {
    event.preventDefault();
    if (enabled && snapshotId && prompt.trim() && !blocked && await comparison.start(snapshotId, prompt.trim(), cacheState, model)) {
      setPrompt("");
    }
  }
  return <div className="comparison-conversation" hidden={hidden}>
    <div role="log" aria-label="Hội thoại với Agent" className="dev-messages" aria-live="polite">
      {comparison.pair && <article className="dev-message developer"><p>{comparison.pair.prompt}</p></article>}
    </div>
    <form className="dev-composer comparison-composer" onSubmit={event => { void send(event); }}>
      <div>
        <textarea ref={composerRef} aria-label="Yêu cầu chung cho hai nhánh" placeholder={unavailable || "Bạn muốn Agent sửa gì?"}
          maxLength={4000} rows={3} value={prompt} disabled={!enabled || blocked} onChange={event => setPrompt(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }} />
        <Button type="submit" aria-label="Gửi yêu cầu" title="Gửi cho cả hai"
          loading={blocked} loadingLabel="Đang chạy…" disabled={!enabled || !snapshotId || !prompt.trim() || blocked}>
          <Icon name="send" />
        </Button>
      </div>
    </form>
  </div>;
}
