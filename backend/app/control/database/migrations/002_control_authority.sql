-- Internal control realm. No default principals/grants or public mutation API.
CREATE TABLE control.repositories (
    tenant_id uuid NOT NULL,
    repo_id uuid NOT NULL,
    identity text NOT NULL CHECK (length(identity) BETWEEN 1 AND 128),
    PRIMARY KEY (tenant_id, repo_id),
    UNIQUE (tenant_id, identity)
);

CREATE TABLE control.scope_authorities (
    tenant_id uuid NOT NULL,
    repo_id uuid NOT NULL,
    epoch bigint NOT NULL DEFAULT 1 CHECK (epoch >= 1),
    PRIMARY KEY (tenant_id, repo_id),
    FOREIGN KEY (tenant_id, repo_id) REFERENCES control.repositories (tenant_id, repo_id)
);

CREATE TABLE control.principals (
    tenant_id uuid NOT NULL,
    repo_id uuid NOT NULL,
    principal_id uuid NOT NULL,
    credential_version bigint NOT NULL CHECK (credential_version >= 1),
    token_digest bytea NOT NULL UNIQUE CHECK (octet_length(token_digest) = 32),
    active boolean NOT NULL,
    PRIMARY KEY (tenant_id, repo_id, principal_id),
    FOREIGN KEY (tenant_id, repo_id) REFERENCES control.scope_authorities (tenant_id, repo_id)
);

CREATE TABLE control.principal_grants (
    tenant_id uuid NOT NULL,
    repo_id uuid NOT NULL,
    principal_id uuid NOT NULL,
    capability text NOT NULL CHECK (capability IN (
        'repository.read', 'workflow.run', 'workflow.read', 'proposal.create',
        'test.run', 'deployment.read', 'change.review', 'deployment.activate'
    )),
    PRIMARY KEY (tenant_id, repo_id, principal_id, capability),
    FOREIGN KEY (tenant_id, repo_id, principal_id)
        REFERENCES control.principals (tenant_id, repo_id, principal_id)
);

REVOKE ALL ON TABLE control.repositories, control.scope_authorities,
    control.principals, control.principal_grants FROM PUBLIC;
