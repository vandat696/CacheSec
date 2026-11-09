import hashlib
import hmac
from dataclasses import dataclass
from threading import RLock

from pydantic import SecretStr

from app.quotation_demo.business.quotation_permissions import (
    QuotationAccessDenied,
    QuotationCaller,
    QuotationCapability,
    QuotationIdentityRequired,
)


@dataclass(frozen=True)
class _FixturePrincipal:
    caller: QuotationCaller
    token_digest: bytes
    capabilities: frozenset[QuotationCapability]


class FixtureIdentityRegistry:
    """Trusted in-process authority for the single app dataset, with explicit revocation."""

    def __init__(self, reader_token: SecretStr, operator_token: SecretStr) -> None:
        reader, operator = reader_token.get_secret_value(), operator_token.get_secret_value()
        if min(len(reader), len(operator)) < 32 or reader == operator:
            raise ValueError("Fixture tokens must be distinct and at least 32 characters long.")
        self._lock = RLock()
        self._principals = (
            _FixturePrincipal(
                QuotationCaller("quotation-reader", "quotation_demo"),
                hashlib.sha256(reader.encode()).digest(),
                frozenset({QuotationCapability.READ}),
            ),
            _FixturePrincipal(
                QuotationCaller("quotation-operator", "quotation_demo"),
                hashlib.sha256(operator.encode()).digest(),
                frozenset(
                    {
                        QuotationCapability.READ,
                        QuotationCapability.CREATE,
                        QuotationCapability.VALIDATE,
                    }
                ),
            ),
        )
        self._revoked: set[str] = set()

    def authenticate(self, token: str | None) -> "FixtureQuotationAccess":
        if not token:
            raise QuotationIdentityRequired()
        digest = hashlib.sha256(token.encode()).digest()
        with self._lock:
            for principal in self._principals:
                if hmac.compare_digest(digest, principal.token_digest):
                    if principal.caller.principal_id in self._revoked:
                        break
                    return FixtureQuotationAccess(self, principal.caller, digest)
        raise QuotationIdentityRequired()

    def require(
        self, caller: QuotationCaller, digest: bytes, capability: QuotationCapability
    ) -> None:
        with self._lock:
            for principal in self._principals:
                if principal.caller == caller and hmac.compare_digest(
                    principal.token_digest, digest
                ):
                    if caller.principal_id in self._revoked:
                        raise QuotationIdentityRequired()
                    if capability not in principal.capabilities:
                        raise QuotationAccessDenied()
                    return
        raise QuotationIdentityRequired()

    def revoke(self, principal_id: str) -> None:
        """Backend-only operation. No HTTP endpoint grants or revokes fixture permissions."""
        with self._lock:
            if principal_id not in {entry.caller.principal_id for entry in self._principals}:
                raise KeyError("Unknown fixture principal.")
            self._revoked.add(principal_id)


class FixtureQuotationAccess:
    def __init__(self, registry: FixtureIdentityRegistry, caller: QuotationCaller, digest: bytes):
        self._registry, self._caller, self._digest = registry, caller, digest

    @property
    def caller(self) -> QuotationCaller:
        return self._caller

    def require(self, capability: QuotationCapability) -> None:
        self._registry.require(self._caller, self._digest, capability)
