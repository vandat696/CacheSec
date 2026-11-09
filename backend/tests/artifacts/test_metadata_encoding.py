import pytest

from app.artifacts.metadata_encoding import (
    InvalidControlMetadata,
    encode_metadata,
    metadata_digest,
)


@pytest.mark.parametrize(
    "ids,digest",
    [
        ([], "c4711975fa2e10dbb0f3f03789b6b9d292aa6441fef0c653c3af9e483dddede8"),
        (["a", "b"], "f7f26fcfb7e7e7ec36c7b2aee9c79f08b106ed9b7bd5100446312f87bbbf9d2a"),
    ],
)
def test_encoding_matches_reviewed_document_vectors(ids, digest):
    value = {"schema_version": 1, "ids": ids, "kind": "encoder-check"}
    encoded = encode_metadata(value)
    assert not encoded.endswith(b"\n")
    assert encoded.startswith(b'{"ids":')
    assert metadata_digest(value) == "sha256:" + digest
    assert encode_metadata(dict(reversed(list(value.items())))) == encoded


@pytest.mark.parametrize(
    "value", [1.0, float("nan"), float("inf"), -1, 2**53, "ngày", (1,), {1: 1}]
)
def test_non_profile_metadata_is_rejected(value):
    with pytest.raises(InvalidControlMetadata):
        encode_metadata({"kind": "encoder-check", "schema_version": 1, "value": value})


@pytest.mark.parametrize(
    "value",
    [{}, {"kind": "x"}, {"kind": "", "schema_version": 1}, {"kind": "x", "schema_version": True}],
)
def test_root_requires_explicit_kind_and_encoding_version(value):
    with pytest.raises(InvalidControlMetadata):
        encode_metadata(value)


def test_array_order_and_raw_strings_are_not_silently_normalized():
    first = {"kind": "encoder-check", "schema_version": 1, "ids": ["a", "b"]}
    assert metadata_digest(first) != metadata_digest({**first, "ids": ["b", "a"]})
    assert b'"value":" a\\n"' in encode_metadata({**first, "value": " a\n"})


def test_cyclic_or_excessively_large_metadata_fails_with_a_bounded_error():
    value = {"kind": "encoder-check", "schema_version": 1}
    value["cycle"] = value
    with pytest.raises(InvalidControlMetadata):
        encode_metadata(value)
    with pytest.raises(InvalidControlMetadata):
        encode_metadata({"kind": "encoder-check", "schema_version": 1, "value": "x" * 65536})
