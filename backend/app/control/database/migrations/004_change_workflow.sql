CREATE TABLE control.technical_test_profiles (
    tenant_id uuid NOT NULL,
    repo_id uuid NOT NULL,
    profile_digest text NOT NULL,
    profile_size bigint NOT NULL CHECK (profile_size BETWEEN 1 AND 65536),
    PRIMARY KEY (tenant_id,repo_id),
    FOREIGN KEY (tenant_id,repo_id) REFERENCES control.scope_authorities(tenant_id,repo_id),
    FOREIGN KEY (profile_digest,profile_size) REFERENCES control.artifact_blobs(digest,byte_size)
);
CREATE TABLE control.change_proposals (
    tenant_id uuid NOT NULL,
    repo_id uuid NOT NULL,
    proposal_id uuid NOT NULL,
    current_revision integer NOT NULL CHECK (current_revision > 0),
    PRIMARY KEY (tenant_id,repo_id,proposal_id),
    FOREIGN KEY (tenant_id,repo_id) REFERENCES control.repositories(tenant_id,repo_id)
);
CREATE TABLE control.proposal_revisions (
    tenant_id uuid NOT NULL,
    repo_id uuid NOT NULL,
    proposal_id uuid NOT NULL,
    revision integer NOT NULL CHECK (revision > 0),
    base_snapshot_id uuid NOT NULL,
    candidate_snapshot_id uuid NOT NULL,
    created_by uuid NOT NULL,
    patch_digest text NOT NULL,
    patch_size bigint NOT NULL CHECK (patch_size BETWEEN 1 AND 65536),
    artifact_digest text NOT NULL,
    artifact_size bigint NOT NULL CHECK (artifact_size BETWEEN 1 AND 65536),
    profile_digest text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id,repo_id,proposal_id,revision),
    FOREIGN KEY (tenant_id,repo_id,proposal_id) REFERENCES control.change_proposals(tenant_id,repo_id,proposal_id),
    FOREIGN KEY (tenant_id,repo_id,base_snapshot_id) REFERENCES control.snapshots(tenant_id,repo_id,snapshot_id),
    FOREIGN KEY (tenant_id,repo_id,candidate_snapshot_id) REFERENCES control.snapshots(tenant_id,repo_id,snapshot_id),
    FOREIGN KEY (tenant_id,repo_id,created_by) REFERENCES control.principals(tenant_id,repo_id,principal_id),
    FOREIGN KEY (patch_digest,patch_size) REFERENCES control.artifact_blobs(digest,byte_size),
    FOREIGN KEY (artifact_digest,artifact_size) REFERENCES control.artifact_blobs(digest,byte_size)
);
CREATE TABLE control.technical_test_jobs (
    tenant_id uuid NOT NULL,
    repo_id uuid NOT NULL,
    job_id uuid NOT NULL,
    proposal_id uuid NOT NULL,
    revision integer NOT NULL,
    actor_id uuid NOT NULL,
    credential_version bigint NOT NULL CHECK (credential_version > 0),
    credential_digest bytea NOT NULL CHECK (octet_length(credential_digest)=32),
    artifact_digest text NOT NULL,
    profile_digest text NOT NULL,
    status text NOT NULL CHECK (status IN ('queued','preparing','running','passed','failed','error','timed_out','blocked','unknown')),
    worker_id uuid,
    ticket uuid,
    result jsonb,
    evidence_digest text,
    evidence_size bigint,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id,repo_id,job_id),
    FOREIGN KEY (tenant_id,repo_id,proposal_id,revision) REFERENCES control.proposal_revisions(tenant_id,repo_id,proposal_id,revision),
    FOREIGN KEY (tenant_id,repo_id,actor_id) REFERENCES control.principals(tenant_id,repo_id,principal_id),
    FOREIGN KEY (evidence_digest,evidence_size) REFERENCES control.artifact_blobs(digest,byte_size),
    CHECK ((evidence_digest IS NULL)=(evidence_size IS NULL))
);
CREATE TABLE control.change_workflow_events (
    tenant_id uuid NOT NULL,
    repo_id uuid NOT NULL,
    event_id uuid NOT NULL,
    resource_id uuid NOT NULL,
    kind text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id,repo_id,event_id),
    FOREIGN KEY (tenant_id,repo_id) REFERENCES control.repositories(tenant_id,repo_id)
);
REVOKE ALL ON control.technical_test_profiles,control.change_proposals,control.proposal_revisions,
    control.technical_test_jobs,control.change_workflow_events FROM PUBLIC;
CREATE TABLE control.change_workflow_requests (
    tenant_id uuid NOT NULL,
    repo_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    key_digest text NOT NULL,
    payload_digest text NOT NULL,
    result jsonb NOT NULL,
    PRIMARY KEY (tenant_id,repo_id,actor_id,key_digest),
    FOREIGN KEY (tenant_id,repo_id,actor_id) REFERENCES control.principals(tenant_id,repo_id,principal_id)
);
REVOKE ALL ON control.change_workflow_requests FROM PUBLIC;
