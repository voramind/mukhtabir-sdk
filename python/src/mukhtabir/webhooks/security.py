from __future__ import annotations

import hashlib
import hmac
import time
from collections.abc import Mapping

from .events import WebhookPayload, parse_webhook_payload
from .responses import WebhookHeaders

HEADER_SIGNATURE = "X-Mukhtabir-Signature"
HEADER_EVENT = "X-Mukhtabir-Event"
HEADER_DELIVERY_ID = "X-Mukhtabir-Delivery-Id"
HEADER_TIMESTAMP = "X-Mukhtabir-Timestamp"
DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300


def _is_timestamp_fresh(
    timestamp: str | int,
    *,
    tolerance_seconds: int | None,
    now: int | float | None,
) -> bool:
    if tolerance_seconds is None:
        return True
    if tolerance_seconds < 0:
        raise ValueError("tolerance_seconds must be non-negative or None.")

    try:
        numeric_timestamp = int(timestamp)
    except (TypeError, ValueError):
        return False

    current_time = int(time.time() if now is None else now)
    return abs(current_time - numeric_timestamp) <= tolerance_seconds


def verify_webhook_signature(
    *,
    body: bytes | str,
    signature: str | None,
    timestamp: str | int,
    secret: str,
    tolerance_seconds: int | None = DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
    now: int | float | None = None,
) -> bool:
    if signature is None:
        return False
    if not _is_timestamp_fresh(
        timestamp,
        tolerance_seconds=tolerance_seconds,
        now=now,
    ):
        return False
    body_bytes = body if isinstance(body, bytes) else body.encode("utf-8")
    signed_payload = f"{timestamp}.".encode() + body_bytes
    expected = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature, expected)


def parse_webhook_headers(headers: Mapping[str, str]) -> WebhookHeaders:
    normalized = {key.lower(): value for key, value in headers.items()}
    return WebhookHeaders(
        signature=normalized.get(HEADER_SIGNATURE.lower()),
        event=normalized.get(HEADER_EVENT.lower()),
        delivery_id=normalized.get(HEADER_DELIVERY_ID.lower()),
        timestamp=normalized.get(HEADER_TIMESTAMP.lower()),
    )


__all__ = [
    "DEFAULT_WEBHOOK_TOLERANCE_SECONDS",
    "HEADER_DELIVERY_ID",
    "HEADER_EVENT",
    "HEADER_SIGNATURE",
    "HEADER_TIMESTAMP",
    "WebhookHeaders",
    "WebhookPayload",
    "parse_webhook_headers",
    "parse_webhook_payload",
    "verify_webhook_signature",
]
