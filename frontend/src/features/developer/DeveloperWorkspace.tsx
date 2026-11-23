"use client";

import { useRef, useState, type CSSProperties } from "react";
import { PaneResizeHandle } from "@/components/layout/PaneResizeHandle";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { RepositoryPanel } from "@/features/repositories/RepositoryPanel";
import { useRepository } from "@/features/repositories/useRepository";
import { AgentPanel } from "@/features/agent/AgentPanel";
import { ComparisonReview } from "@/features/comparisons/ComparisonReview";
import type { ComparisonSummary } from "@/features/comparisons/comparisonModel";
import { useComparison } from "@/features/comparisons/useComparison";
import type { RepositoryWorkspaceHandle } from "@/features/repositories/RepositoryWorkspace";

export function DeveloperWorkspace() {
  const repo = useRepository();
  const [agentOpen, setAgentOpen] = useState(true);
  const [agentWidth, setAgentWidth] = useState(360);
  const [editorOpen, setEditorOpen] = useState(true);
  const [comparison, setComparison] = useState(true);
  const [cacheState, setCacheState] = useState<ComparisonSummary["cache_state"]>("warm");
  const workspace = useRef<RepositoryWorkspaceHandle>(null);
  const workbench = useRef<HTMLDivElement>(null);
  const run = useComparison(comparison ? repo.agent : null, repo.disconnect);
  function openProposal(id: string) {
    setEditorOpen(true);
    workbench.current?.scrollIntoView({ block: "start", behavior: "instant" });
    workspace.current?.openProposal(id);
  }
  return <>
    <div className="developer-workspace" data-preview-only="false" data-agent-open={agentOpen} data-editor-open={editorOpen}>
      <header className="dev-ide-toolbar">
        <h1>Workspace</h1>
        <div className="dev-toolbar-actions">
          <Link href="/quotations" className="dev-quotation-link"><Icon name="file" />Báo giá</Link>
          <Button variant="tertiary" id="workspace-editor-toggle" aria-pressed={editorOpen} aria-controls="workspace-editor"
            onClick={() => { setEditorOpen(value => !value); setAgentOpen(true); }}>Mã nguồn</Button>
          {editorOpen && <Button variant="tertiary" id="workspace-agent-toggle" aria-pressed={agentOpen}
            onClick={() => setAgentOpen(value => !value)}><Icon name="spark" />Agent</Button>}
        </div>
      </header>
      <div ref={workbench} className="dev-workbench" style={{ "--agent-width": `${agentWidth}px` } as CSSProperties}>
        <section id="workspace-editor" className="dev-editor" aria-label="Mã nguồn repository" hidden={!editorOpen && !!repo.repository}>
          <RepositoryPanel repo={repo} ref={workspace} />
        </section>
        <PaneResizeHandle key={`resize-${repo.snapshot?.snapshot_id ?? "disconnected"}`} label="Độ rộng Agent" controls="workspace-agent" orientation="vertical"
          defaultSize={360} min={260} max={600} maxRatio={.5} resizePane="after"
          onChange={setAgentWidth} hidden={!agentOpen || !editorOpen} />
        <AgentPanel key={repo.snapshot?.snapshot_id ?? "disconnected"} repo={repo} hidden={!agentOpen}
          comparison={comparison} onToggleComparison={() => setComparison(value => !value)}
          comparisonRun={run} cacheState={cacheState} onCacheState={setCacheState}
          guardAction={action => workspace.current?.requestLeave(action)}
          onOpenProposal={openProposal} />
      </div>
    </div>
    {comparison && <div className="workspace-comparison-results">
      <ComparisonReview key={run.pair?.pair_id} comparison={run} onOpen={openProposal} api={repo.changes} />
    </div>}
  </>;
}
