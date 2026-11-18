"""Build the shared, bounded context for a comparison follow-up."""

import json

from app.agent_assistance.run_models import TERMINAL_RUNS

RECENT_TURNS = 6
HISTORY_BYTES = 24000
DRAFT_DIFF_BYTES = 8192
BRANCH_LABELS = {"none": "Không cache", "local": "Có Context Cache"}


def _shorten(text: str, limit: int) -> str:
    raw = text.encode("utf-8")
    if len(raw) <= limit:
        return text
    return raw[: limit - 3].decode("utf-8", errors="ignore") + "…"


def conversation_history(pairs: list[dict]) -> tuple[list[str], list[dict]]:
    selected, size = [], 0
    for pair in reversed(pairs):
        branches = pair["branches"]
        if any(
            branch["status"] not in TERMINAL_RUNS | {"incomplete"} for branch in branches.values()
        ):
            continue
        messages = [{"role": "user", "content": pair["prompt"]}]
        replies = {
            BRANCH_LABELS[mode]: _shorten(answer, 2500)
            for mode, branch in branches.items()
            if (answer := (branch.get("run") or {}).get("answer", "")).strip()
        }
        if replies:
            answers = list(replies.values())
            text = answers[0] if len(set(answers)) == 1 else json.dumps(replies, ensure_ascii=False)
            messages.append({"role": "assistant", "content": text})
        size += sum(len(message["content"].encode("utf-8")) for message in messages)
        if size > HISTORY_BYTES:
            break
        selected.append((pair["pair_id"], messages))
    selected.reverse()
    return [pair_id for pair_id, _ in selected], [
        msg for _, messages in selected for msg in messages
    ]


def draft_references(pairs: list[dict], snapshot_id: str) -> list[dict]:
    for pair in reversed(pairs):
        if pair["snapshot_id"] != snapshot_id:
            continue
        drafts = [
            {
                "branch": BRANCH_LABELS[mode],
                "proposal_id": run["proposal_id"],
                "revision": run["revision"],
                "artifact_digest": run["artifact_digest"],
            }
            for mode, branch in pair["branches"].items()
            if branch["status"] == "passed"
            and (run := branch.get("run"))
            and run.get("artifact_digest")
        ]
        if drafts:
            return drafts
    return []
