"""Private key loading and bounded provider HTTP transport; no redirects or retries."""

import json
import urllib.error
import urllib.request
from pathlib import Path

from dotenv import dotenv_values

from app.agent_assistance.generation import AgentError


def private_key(config: Path | None, variable: str) -> str | None:
    try:
        if config is None or not config.is_file():
            return None
        key = dotenv_values(config, encoding="utf-8-sig").get(variable)
        if not key:
            return None
        if not key.isascii() or not 20 <= len(key) <= 512 or any(c.isspace() for c in key):
            raise AgentError("MODEL_CONFIGURATION_INVALID")
        return key
    except (OSError, UnicodeError):
        raise AgentError("MODEL_CONFIGURATION_INVALID") from None


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def post_generation_json(endpoint: str, headers: dict, body: dict) -> dict:
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={**headers, "Content-Type": "application/json"},
    )
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    try:
        with opener.open(request, timeout=75) as response:
            raw = response.read(524289)
        if len(raw) > 524288:
            raise AgentError("MODEL_INVALID_RESPONSE", 502)
        try:
            value = json.loads(raw)
            if type(value) is not dict:
                raise ValueError()
            return value
        except (ValueError, UnicodeError):
            raise AgentError("MODEL_INVALID_RESPONSE", 502) from None
    except urllib.error.HTTPError as error:
        code = {
            400: "MODEL_REQUEST_REJECTED",
            401: "MODEL_KEY_REJECTED",
            403: "MODEL_ACCESS_DENIED",
            404: "MODEL_NOT_AVAILABLE",
            429: "MODEL_RATE_LIMIT",
        }.get(error.code, "MODEL_UNAVAILABLE")
        if error.code == 400:
            # Gemini reports invalid API keys through a bounded 400 ErrorInfo payload.
            try:
                payload = json.loads(error.read(16384))
                if any(
                    detail.get("reason") == "API_KEY_INVALID"
                    for detail in payload.get("error", {}).get("details", [])
                    if isinstance(detail, dict)
                ):
                    code = "MODEL_KEY_REJECTED"
            except (OSError, ValueError, AttributeError, TypeError):
                pass
        error.close()
        raise AgentError(code) from None
    except OSError:
        raise AgentError("MODEL_UNAVAILABLE") from None
