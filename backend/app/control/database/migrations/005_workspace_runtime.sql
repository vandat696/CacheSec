-- No principals, grants, targets, or approval decisions are seeded by migrations.
ALTER TABLE control.principal_grants DROP CONSTRAINT principal_grants_capability_check;
ALTER TABLE control.principal_grants ADD CONSTRAINT principal_grants_capability_check
CHECK (capability IN (
 'repository.read','repository.write','workflow.run','workflow.read','proposal.create',
 'test.run','deployment.read','change.review','deployment.activate'
));
CREATE TABLE control.workspace_operations (
 tenant_id uuid NOT NULL,
 repo_id uuid NOT NULL,
 operation_id uuid NOT NULL,
 kind text NOT NULL CHECK (kind IN ('write','approval','activation','target')),
 status text NOT NULL,
 document jsonb NOT NULL,
 PRIMARY KEY (tenant_id,repo_id,operation_id),
 FOREIGN KEY (tenant_id,repo_id) REFERENCES control.repositories(tenant_id,repo_id),
 CHECK (document->>'id'=operation_id::text AND document->>'kind'=kind
        AND document->>'status'=status)
);
CREATE UNIQUE INDEX workspace_single_activation
 ON control.workspace_operations(tenant_id,repo_id)
 WHERE kind='activation' AND status IN ('queued','preparing','running','unknown');
REVOKE ALL ON control.workspace_operations FROM PUBLIC;
