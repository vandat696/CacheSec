"""Trusted local read-only fixture provisioning; never called by a worker or browser."""

import argparse
import getpass
import warnings
from pathlib import Path
from uuid import UUID

import psycopg

from app.control.control_settings import Settings
from app.control.repository_configuration import (
    RepositoryConfigurationError,
    load_repository_binding,
)
from app.identity.control_authority import (
    AuthorityConflict,
    ControlCapability,
    ControlPrincipal,
    ControlResourceUnavailable,
    control_token_digest,
)
from app.identity.postgres_authority_administration import PostgresAuthorityAdministration
from app.identity.postgres_control_authority import PostgresControlAuthorityRepository
from app.repositories.filesystem_repository_source import RepositorySourceBinding
from app.repositories.postgres_source_profiles import PostgresSourceProfileAdministration
from app.shared.postgres_connection import DatabaseNotConfigured, PostgresDatabase


def configure_read_only_repository(
    database: PostgresDatabase,
    binding: RepositorySourceBinding,
    principal_id: UUID,
    token: str,
    *,
    credential_version: int,
    expected_epoch: int,
) -> int:
    """All changes commit together; expected_epoch=0 permits only a new repository."""
    if type(expected_epoch) is not int or expected_epoch < 0:
        raise ValueError("Expected epoch must be a nonnegative integer.")
    profile = binding.profile
    principal = ControlPrincipal(
        profile.scope,
        principal_id,
        credential_version,
        control_token_digest(token),
    )
    with database.connection() as connection:
        authority = PostgresControlAuthorityRepository(connection)
        # Serialize new-scope initialization as well as later CAS changes.
        connection.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))",
            (f"repository-config:{profile.scope.tenant_id}:{profile.scope.repo_id}",),
        )
        current = authority.lock_scope(profile.scope)
        if expected_epoch == 0 and current is not None:
            raise AuthorityConflict("Repository already exists.")
        if expected_epoch != 0 and (current is None or current.authority_epoch != expected_epoch):
            raise AuthorityConflict("Authority has changed.")
        if expected_epoch == 0:
            # A concurrent administrator not using this CLI's advisory lock must not turn
            # creation into an update. A unique conflict rolls the whole transaction back.
            connection.execute(
                "INSERT INTO control.repositories (tenant_id, repo_id, identity) VALUES (%s,%s,%s)",
                (profile.scope.tenant_id, profile.scope.repo_id, profile.repository_identity),
            )
        admin = PostgresAuthorityAdministration(connection)
        repository = admin.register_repository(profile.scope, profile.repository_identity)
        epoch = admin.configure_principal(
            principal,
            frozenset({ControlCapability.REPOSITORY_READ}),
            expected_epoch=repository.authority_epoch,
        )
        epoch = PostgresSourceProfileAdministration(connection).set_profile(
            profile,
            expected_epoch=epoch,
        )
    return epoch


def read_control_token() -> str:
    # getpass otherwise falls back to echoed input when no secure terminal is available.
    with warnings.catch_warnings():
        warnings.simplefilter("error", getpass.GetPassWarning)
        return getpass.getpass("Control token (independent random secret, not echoed): ")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check or explicitly provision a read-only source."
    )
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--principal-id", type=UUID)
    parser.add_argument("--credential-version", type=int)
    parser.add_argument("--expected-epoch", type=int)
    args = parser.parse_args()
    try:
        binding = load_repository_binding(args.config)
        if args.apply:
            if (
                args.principal_id is None
                or args.credential_version is None
                or (args.expected_epoch is None or args.expected_epoch < 0)
            ):
                parser.error(
                    "--apply requires principal ID, credential version and expected epoch."
                )
            settings = Settings()
            database = PostgresDatabase(
                settings.database_url,
                connect_timeout_seconds=settings.database_connect_timeout_seconds,
                statement_timeout_ms=settings.database_statement_timeout_ms,
            )
            token = read_control_token()
            epoch = configure_read_only_repository(
                database,
                binding,
                args.principal_id,
                token,
                credential_version=args.credential_version,
                expected_epoch=args.expected_epoch,
            )
            print(f"Read-only repository configured; authority epoch={epoch}.")
        else:
            print("Configuration valid; no database, source or authority changes.")
        print(f"Source profile: {binding.profile.digest}; files={len(binding.profile.paths)}")
        return 0
    except AuthorityConflict:
        print("Configuration conflict; inspect current authority before applying again.")
    except (
        RepositoryConfigurationError,
        ControlResourceUnavailable,
        DatabaseNotConfigured,
        psycopg.Error,
        ValueError,
        EOFError,
        getpass.GetPassWarning,
    ):
        print("Repository configuration failed; no credentials or paths are printed.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
