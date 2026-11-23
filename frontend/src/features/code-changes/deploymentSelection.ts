import type { Revision, TestJob } from "./changeWorkflowApi.ts";

export function passedDeploymentTest(revision: Revision | null, jobs: TestJob[]) {
  return revision ? jobs.find(job => job.status === "passed" && !!job.evidence_digest
    && job.proposal_id === revision.proposal_id && job.revision === revision.revision
    && job.artifact_digest === revision.artifact_digest && job.profile_digest === revision.profile_digest) : undefined;
}

export function deploymentRevisionKey(revision: Revision) {
  return `${revision.proposal_id}/${revision.revision}/${revision.artifact_digest}`;
}
