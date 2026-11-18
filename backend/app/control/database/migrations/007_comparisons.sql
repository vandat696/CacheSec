CREATE TABLE control.comparison_pairs (
    tenant_id uuid NOT NULL, repo_id uuid NOT NULL, owner_id uuid NOT NULL,
    pair_id uuid NOT NULL, key_digest text NOT NULL,
    record jsonb NOT NULL CHECK (jsonb_typeof(record)='object'),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id,repo_id,owner_id,pair_id),
    UNIQUE (tenant_id,repo_id,owner_id,key_digest),
    FOREIGN KEY (tenant_id,repo_id,owner_id) REFERENCES control.principals(tenant_id,repo_id,principal_id)
);
CREATE TABLE control.comparison_revisions (
    tenant_id uuid NOT NULL, repo_id uuid NOT NULL, owner_id uuid NOT NULL, pair_id uuid NOT NULL,
    mode text NOT NULL CHECK(mode IN ('none','local')), turn integer NOT NULL CHECK(turn BETWEEN 1 AND 3),
    proposal_id uuid NOT NULL, revision integer NOT NULL, artifact_digest text NOT NULL,
    PRIMARY KEY (tenant_id,repo_id,owner_id,pair_id,mode,turn),
    FOREIGN KEY (tenant_id,repo_id,owner_id,pair_id) REFERENCES control.comparison_pairs(tenant_id,repo_id,owner_id,pair_id),
    FOREIGN KEY (tenant_id,repo_id,proposal_id,revision) REFERENCES control.proposal_revisions(tenant_id,repo_id,proposal_id,revision)
);
CREATE TABLE control.comparison_assessments (
    tenant_id uuid NOT NULL, repo_id uuid NOT NULL, owner_id uuid NOT NULL, pair_id uuid NOT NULL,
    mode text NOT NULL CHECK(mode IN ('none','local')), turn integer NOT NULL,
    assessment_id uuid NOT NULL, criteria_version text NOT NULL,
    record jsonb NOT NULL CHECK(jsonb_typeof(record)='object'),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id,repo_id,owner_id,pair_id,assessment_id),
    FOREIGN KEY (tenant_id,repo_id,owner_id,pair_id,mode,turn) REFERENCES control.comparison_revisions(tenant_id,repo_id,owner_id,pair_id,mode,turn)
);
REVOKE ALL ON control.comparison_pairs,control.comparison_revisions,control.comparison_assessments FROM PUBLIC;
