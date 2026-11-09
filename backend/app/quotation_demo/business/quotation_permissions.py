from dataclasses import dataclass
from enum import StrEnum
from typing import Protocol


class QuotationCapability(StrEnum):
    READ = "quotation.read"
    CREATE = "quotation.create"


class QuotationAccessDenied(PermissionError):
    pass


class QuotationAuthorityUnavailable(RuntimeError):
    pass


class QuotationIdentityRequired(PermissionError):
    pass


@dataclass(frozen=True)
class QuotationCaller:
    principal_id: str
    scope_id: str


class QuotationAccess(Protocol):
    """Trusted authority adapter; request data or repository contents cannot grant access."""

    def require(self, capability: QuotationCapability) -> None:
        """Raise on denial or unavailable authority; never infer permission from cache."""
        ...

    @property
    def caller(self) -> QuotationCaller: ...
