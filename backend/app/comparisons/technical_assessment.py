"""Recorded technical evidence is distinct from the still-open research acceptance."""

from uuid import NAMESPACE_URL, uuid5


def technical_assessments(pair_id, mode, run):
    revisions = {
        event["turn"]: event
        for event in run["events"]
        if event["tool"] == "save_revision" and event["state"] == "completed"
    }
    generated = {
        event["turn"]: event
        for event in run["events"]
        if event["tool"] == "generate" and event["state"] == "completed"
    }
    for event in run["events"]:
        if event["tool"] != "test" or event["state"] not in (
            "passed",
            "failed",
            "error",
            "timed_out",
            "blocked",
            "unknown",
        ):
            continue
        revision = revisions.get(event["turn"])
        if revision is None:
            continue
        generation = generated.get(event["turn"], {})
        yield {
            "assessment_id": str(
                uuid5(
                    NAMESPACE_URL,
                    f"cachesec:{pair_id}:{mode}:{event['turn']}:{event.get('evidence_digest')}:technical-trace-v1",
                )
            ),
            "criteria_version": "technical-trace-v1",
            "turn": event["turn"],
            "artifact_digest": revision["artifact_digest"],
            "evidence_digest": event.get("evidence_digest"),
            "job_id": event.get("job_id"),
            "technical_test_status": event["state"],
            "usage": generation.get("usage"),
            "usage_missing_reason": None
            if generation.get("usage") is not None
            else "PROVIDER_USAGE_UNAVAILABLE",
            "generation_ms": generation.get("generation_ms"),
            "correctness": {"value": None, "reason": "RESEARCH_FIXTURE_NOT_FROZEN"},
            "approval_gate": {"value": None, "reason": "NOT_EXERCISED_BY_AGENT"},
            "reproducibility": {"value": None, "reason": "PROTOCOL_NOT_FROZEN"},
            "trace_completeness": {"value": None, "reason": "RESEARCH_CRITERIA_NOT_FROZEN"},
        }
