"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { RepositoryPanel } from "@/features/repositories/RepositoryPanel";
import { useRepository } from "@/features/repositories/useRepository";
import { AgentPanel } from "@/features/agent/AgentPanel";
import type { RepositoryWorkspaceHandle } from "@/features/repositories/RepositoryWorkspace";

export function DeveloperWorkspace() {
  const repo = useRepository();
  const [agentOpen, setAgentOpen] = useState(true);
  const workspace = useRef<RepositoryWorkspaceHandle>(null);
  return <div className="developer-workspace" data-preview-only="false" data-agent-open={agentOpen}>
    <header className="dev-ide-toolbar">
      <h1>Workspace</h1>
      <div className="dev-toolbar-actions">
        <Link href="/quotations" className="dev-quotation-link"><Icon name="file" />Báo giá</Link>
        <Button variant="tertiary" id="workspace-agent-toggle" aria-pressed={agentOpen}
          onClick={() => setAgentOpen(value => !value)}><Icon name="spark" />Agent</Button>
      </div>
    </header>
    <div className="dev-workbench">
      <section className="dev-editor" aria-label="Mã nguồn repository"><RepositoryPanel repo={repo} ref={workspace} /></section>
      <AgentPanel key={repo.snapshot?.snapshot_id ?? "disconnected"} repo={repo} hidden={!agentOpen}
        guardAction={action => workspace.current?.requestLeave(action)}
        onOpenProposal={id => workspace.current?.openProposal(id)} />
    </div>
  </div>;
}
