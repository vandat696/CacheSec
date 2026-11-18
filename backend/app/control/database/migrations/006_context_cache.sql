-- Browser payloads remain local. This registry stores trusted digests/provenance only.
CREATE TABLE control.context_requests (
    tenant_id uuid NOT NULL,
    repo_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    request_id uuid NOT NULL,
    record jsonb NOT NULL CHECK (jsonb_typeof(record)='object'),
    resolution jsonb CHECK (resolution IS NULL OR jsonb_typeof(resolution)='object'),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id,repo_id,owner_id,request_id),
    FOREIGN KEY (tenant_id,repo_id,owner_id) REFERENCES control.principals(tenant_id,repo_id,principal_id)
);
CREATE TABLE control.context_entries (
    tenant_id uuid NOT NULL,
    repo_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    entry_id uuid NOT NULL,
    record jsonb NOT NULL CHECK (jsonb_typeof(record)='object' AND NOT record ? 'payload'),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id,repo_id,owner_id,entry_id),
    FOREIGN KEY (tenant_id,repo_id,owner_id) REFERENCES control.principals(tenant_id,repo_id,principal_id)
);
REVOKE ALL ON control.context_requests,control.context_entries FROM PUBLIC;
