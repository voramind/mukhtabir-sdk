from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .._parsing import (
    expect_mapping,
    get_int,
    get_str,
    get_value,
    parse_string_list,
    require_bool,
    require_str,
)


@dataclass(frozen=True, slots=True)
class WebhookCreateResult:
    id: str
    url: str
    events: list[str]
    description: str | None
    secret_preview: str | None
    secret: str | None = field(repr=False)
    is_active: bool
    created_at: str | None

    @classmethod
    def from_payload(cls, payload: Any) -> WebhookCreateResult:
        data = expect_mapping(payload, context="webhook_create")
        return cls(
            id=require_str(data, "id"),
            url=require_str(data, "url"),
            events=parse_string_list(
                get_value(data, "events"),
                context="webhook_create.events",
            ),
            description=get_str(data, "description"),
            secret_preview=get_str(data, "secret_preview", "secretPreview"),
            secret=get_str(data, "secret"),
            is_active=require_bool(data, "is_active", "isActive"),
            created_at=get_str(data, "created_at", "createdAt"),
        )


@dataclass(frozen=True, slots=True)
class WebhookDetails:
    id: str
    url: str
    events: list[str]
    description: str | None
    is_active: bool
    failure_count: int | None
    last_triggered_at: str | None
    created_at: str | None
    updated_at: str | None

    @classmethod
    def from_payload(cls, payload: Any) -> WebhookDetails:
        data = expect_mapping(payload, context="webhook_details")
        return cls(
            id=require_str(data, "id"),
            url=require_str(data, "url"),
            events=parse_string_list(
                get_value(data, "events"),
                context="webhook_details.events",
            ),
            description=get_str(data, "description"),
            is_active=require_bool(data, "is_active", "isActive"),
            failure_count=get_int(data, "failure_count", "failureCount"),
            last_triggered_at=get_str(data, "last_triggered_at", "lastTriggeredAt"),
            created_at=get_str(data, "created_at", "createdAt"),
            updated_at=get_str(data, "updated_at", "updatedAt"),
        )


@dataclass(frozen=True, slots=True)
class WebhookDelivery:
    id: str
    event_type: str
    status: str
    response_status: int | None
    attempt_number: int | None
    error_message: str | None
    delivered_at: str | None
    next_retry_at: str | None
    created_at: str | None

    @classmethod
    def from_payload(cls, payload: Any) -> WebhookDelivery:
        data = expect_mapping(payload, context="webhook_delivery")
        return cls(
            id=require_str(data, "id"),
            event_type=require_str(data, "event_type", "eventType"),
            status=require_str(data, "status"),
            response_status=get_int(data, "response_status", "responseStatus"),
            attempt_number=get_int(data, "attempt_number", "attemptNumber"),
            error_message=get_str(data, "error_message", "errorMessage"),
            delivered_at=get_str(data, "delivered_at", "deliveredAt"),
            next_retry_at=get_str(data, "next_retry_at", "nextRetryAt"),
            created_at=get_str(data, "created_at", "createdAt"),
        )


@dataclass(frozen=True, slots=True)
class WebhookTestResult:
    delivery_id: str
    status: str
    response_status: int | None
    error_message: str | None

    @classmethod
    def from_payload(cls, payload: Any) -> WebhookTestResult:
        data = expect_mapping(payload, context="webhook_test")
        return cls(
            delivery_id=require_str(data, "delivery_id", "deliveryId"),
            status=require_str(data, "status"),
            response_status=get_int(data, "response_status", "responseStatus"),
            error_message=get_str(data, "error_message", "errorMessage"),
        )


@dataclass(frozen=True, slots=True)
class WebhookHeaders:
    signature: str | None
    event: str | None
    delivery_id: str | None
    timestamp: str | None


__all__ = [
    "WebhookCreateResult",
    "WebhookDelivery",
    "WebhookDetails",
    "WebhookHeaders",
    "WebhookTestResult",
]
