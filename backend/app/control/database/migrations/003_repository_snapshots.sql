-- Scoped append-only application API. No source paths, tokens or default profiles are seeded.
ALTER TABLE control.artifact_blobs
    ADD CONSTRAINT artifact_blob_digest_size UNIQUE (digest, byte_size);

CREATE TABLE control.repository_source_profiles (
    tenant_id uuid NOT NULL,
    repo_id uuid NOT NULL,
    profile_digest text NOT NULL CHECK (
        length(profile_digest) = 71 AND profile_digest ~ '^sha256:[0-9a-f]{64}$'
    ),
    PRIMARY KEY (tenant_id, repo_id),
    FOREIGN KEY (tenant_id, repo_id) REFERENCES control.scope_authorities (tenant_id, repo_id)
);

CREATE TABLE control.snapshots (
    tenant_id uuid NOT NULL,
    repo_id uuid NOT NULL,
    snapshot_id uuid NOT NULL,
    repository_identity text NOT NULL,
    created_by uuid NOT NULL,
    authority_epoch bigint NOT NULL CHECK (authority_epoch >= 1),
    profile_digest text NOT NULL,
    profile_size bigint NOT NULL CHECK (profile_size BETWEEN 0 AND 65536),
    manifest_digest text NOT NULL,
    manifest_size bigint NOT NULL CHECK (manifest_size BETWEEN 0 AND 65536),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, repo_id, snapshot_id),
    FOREIGN KEY (tenant_id, repo_id) REFERENCES control.repositories (tenant_id, repo_id),
    FOREIGN KEY (tenant_id, repo_id, created_by)
        REFERENCES control.principals (tenant_id, repo_id, principal_id),
    FOREIGN KEY (profile_digest, profile_size) REFERENCES control.artifact_blobs (digest, byte_size),
    FOREIGN KEY (manifest_digest, manifest_size) REFERENCES control.artifact_blobs (digest, byte_size)
);

CREATE TABLE control.snapshot_files (
    tenant_id uuid NOT NULL,
    repo_id uuid NOT NULL,
    snapshot_id uuid NOT NULL,
    file_id uuid NOT NULL,
    path text NOT NULL CHECK (path ~ '^[A-Za-z0-9_][A-Za-z0-9_./-]*$'),
    path_key text NOT NULL CHECK (path_key = lower(path COLLATE "C")),
    blob_digest text NOT NULL,
    byte_size bigint NOT NULL CHECK (byte_size BETWEEN 0 AND 1048576),
    PRIMARY KEY (tenant_id, repo_id, snapshot_id, file_id),
    UNIQUE (tenant_id, repo_id, snapshot_id, path_key),
    FOREIGN KEY (tenant_id, repo_id, snapshot_id)
        REFERENCES control.snapshots (tenant_id, repo_id, snapshot_id),
    FOREIGN KEY (blob_digest, byte_size) REFERENCES control.artifact_blobs (digest, byte_size)
);

REVOKE ALL ON TABLE control.repository_source_profiles, control.snapshots,
    control.snapshot_files FROM PUBLIC;
