import { AgentHttpClient } from "../agent/agentApi.ts";
import { ChangeWorkflowClient } from "../code-changes/changeWorkflowApi.ts";
import { RepositoryHttpClient } from "../repositories/repositoryApi.ts";

export async function readRuntimeSettings(signal: AbortSignal) {
  const changes = new ChangeWorkflowClient("/api/local-control", null);
  const [repository, agent, workflow, target] = await Promise.all([
    new RepositoryHttpClient("/api/local-control", null).describe(signal),
    new AgentHttpClient("/api/local-control", null).config(signal),
    changes.config(signal), changes.workspaceConfig(signal),
  ]);
  if (workflow.repository_identity !== repository.repository_identity) throw new Error("REPOSITORY_MISMATCH");
  return { repository, agent, workflow, target };
}
