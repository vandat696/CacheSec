import hashlib
import re
from dataclasses import dataclass

MAX_BLOB_BYTES = 1048576
_DIGEST = re.compile(r"sha256:[0-9a-f]{64}", re.ASCII)


class InvalidBlobDigest(ValueError):
    pass


class BlobTooLarge(ValueError):
    pass


class BlobIntegrityError(RuntimeError):
    pass


class BlobBytesUnavailable(RuntimeError):
    pass


class BlobMetadataUnavailable(RuntimeError):
    pass


class BlobNotRegistered(LookupError):
    pass


class BlobStorageNotConfigured(RuntimeError):
    pass


def require_blob_digest(value: str) -> str:
    if not isinstance(value, str) or _DIGEST.fullmatch(value) is None:
        raise InvalidBlobDigest("A lowercase SHA-256 blob digest is required.")
    return value


def content_digest(content: bytes) -> str:
    return "sha256:" + hashlib.sha256(content).hexdigest()


@dataclass(frozen=True)
class BlobReference:
    digest: str
    byte_size: int

    def __post_init__(self) -> None:
        require_blob_digest(self.digest)
        if type(self.byte_size) is not int or not 0 <= self.byte_size <= MAX_BLOB_BYTES:
            raise ValueError("Invalid blob byte size.")
