-- Internal raw-object index. A row does not attest provenance or authorize artifact use.
CREATE TABLE control.artifact_blobs (
    digest text PRIMARY KEY CHECK (length(digest) = 71 AND digest ~ '^sha256:[0-9a-f]{64}$'),
    byte_size bigint NOT NULL CHECK (byte_size BETWEEN 0 AND 1048576),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

REVOKE ALL ON SCHEMA control FROM PUBLIC;
REVOKE ALL ON TABLE control.artifact_blobs FROM PUBLIC;
REVOKE ALL ON TABLE control.schema_migrations FROM PUBLIC;
