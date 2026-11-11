import type { ChangeWorkflowClient, Revision, TestJob } from "./changeWorkflowApi";

export type ChangeAttempts = {
  save: { payload: string; key: string } | null;
  test: { binding: string; key: string } | null;
};

export async function saveRevision(api: ChangeWorkflowClient, snapshotId: string, content: string,
  previous: Revision | null, attempts: ChangeAttempts, signal: AbortSignal): Promise<Revision | null> {
  const payload = JSON.stringify([snapshotId, previous?.proposal_id, previous?.revision, content]);
  if (attempts.save?.payload !== payload) attempts.save = { payload, key: crypto.randomUUID() };
  const saved = await api.save(snapshotId, content, previous, attempts.save.key, signal);
  if (signal.aborted) return null;
  attempts.save = null;
  return saved;
}

export async function submitCodeChange(api: ChangeWorkflowClient, snapshotId: string, content: string,
  previous: Revision | null, attempts: ChangeAttempts, signal: AbortSignal,
  onSaved: (revision: Revision) => void): Promise<TestJob | null> {
  let saved = previous;
  if (!saved || content !== saved.content) {
    saved = await saveRevision(api, snapshotId, content, saved, attempts, signal);
    if (!saved) return null;
    // Keep this committed revision visible even when requesting the test later fails.
    onSaved(saved);
  }
  const binding = JSON.stringify([saved.proposal_id, saved.revision, saved.artifact_digest]);
  if (attempts.test?.binding !== binding) attempts.test = { binding, key: crypto.randomUUID() };
  const job = await api.test(saved, attempts.test.key, signal);
  if (signal.aborted) return null;
  attempts.test = null;
  return job;
}
