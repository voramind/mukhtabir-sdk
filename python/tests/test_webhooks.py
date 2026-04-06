from __future__ import annotations

import hashlib
import hmac

from mukhtabir.webhooks import (
    HEADER_DELIVERY_ID,
    HEADER_EVENT,
    HEADER_SIGNATURE,
    HEADER_TIMESTAMP,
    EvaluationGeneratedWebhookPayload,
    parse_webhook_headers,
    parse_webhook_payload,
    verify_webhook_signature,
)


def test_verify_webhook_signature_and_parse_payload() -> None:
    secret = "whsec_test"
    body = (
        b'{"event":"evaluation.generated","timestamp":"2026-03-11T11:36:12Z",'
        b'"data":{"feedback_id":"fb_123","total_score":82.5,"category_scores":'
        b'[{"name":"Technical Knowledge","score":88}]}}'
    )
    timestamp = "1741692972"
    signature = hmac.new(
        secret.encode("utf-8"),
        f"{timestamp}.".encode() + body,
        hashlib.sha256,
    ).hexdigest()

    headers = parse_webhook_headers(
        {
            HEADER_SIGNATURE: signature,
            HEADER_EVENT: "evaluation.generated",
            HEADER_DELIVERY_ID: "del_123",
            HEADER_TIMESTAMP: timestamp,
        }
    )

    assert headers.delivery_id == "del_123"
    assert verify_webhook_signature(
        body=body,
        signature=signature,
        timestamp=timestamp,
        secret=secret,
        now=int(timestamp),
    )

    payload = parse_webhook_payload(body)
    assert isinstance(payload, EvaluationGeneratedWebhookPayload)
    assert payload.event == "evaluation.generated"
    assert payload.data.feedback_id == "fb_123"
    assert payload.data.category_scores[0].name == "Technical Knowledge"


def test_verify_webhook_signature_rejects_stale_timestamp() -> None:
    secret = "whsec_test"
    body = b'{"event":"candidate.invited","timestamp":"2026-03-11T11:36:12Z","data":{}}'
    timestamp = "1741692972"
    signature = hmac.new(
        secret.encode("utf-8"),
        f"{timestamp}.".encode() + body,
        hashlib.sha256,
    ).hexdigest()

    assert (
        verify_webhook_signature(
            body=body,
            signature=signature,
            timestamp=timestamp,
            secret=secret,
            tolerance_seconds=300,
            now=int(timestamp) + 301,
        )
        is False
    )


def test_verify_webhook_signature_rejects_invalid_timestamp_header() -> None:
    assert (
        verify_webhook_signature(
            body=b"{}",
            signature="deadbeef",
            timestamp="not-a-timestamp",
            secret="whsec_test",
        )
        is False
    )


def test_verify_webhook_signature_rejects_missing_signature_header() -> None:
    headers = parse_webhook_headers(
        {
            HEADER_EVENT: "candidate.invited",
            HEADER_DELIVERY_ID: "del_123",
            HEADER_TIMESTAMP: "1741692972",
        }
    )

    assert headers.signature is None
    assert (
        verify_webhook_signature(
            body=b'{"event":"candidate.invited","timestamp":"2026-03-11T11:36:12Z","data":{}}',
            signature=headers.signature,
            timestamp=headers.timestamp or "1741692972",
            secret="whsec_test",
            now=1741692972,
        )
        is False
    )
