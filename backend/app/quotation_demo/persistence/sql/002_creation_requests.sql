CREATE TABLE quotation_demo.creation_requests (
    principal_id text NOT NULL,
    scope_id text NOT NULL,
    key_hash text NOT NULL,
    payload_hash text NOT NULL,
    quotation_id uuid NOT NULL REFERENCES quotation_demo.quotations(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (principal_id, scope_id, key_hash)
);
