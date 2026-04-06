from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .._parsing import compact_dict
from .events import WebhookEventType


@dataclass(frozen=True, slots=True)
class CreateWebhookRequest:
    url: str
    events: list[WebhookEventType]
    description: str | None = None

    def to_payload(self) -> dict[str, Any]:
        return compact_dict(
            {
                "url": self.url,
                "events": self.events,
                "description": self.description,
            }
        )


@dataclass(frozen=True, slots=True)
class UpdateWebhookRequest:
    url: str | None = None
    events: list[WebhookEventType] | None = None
    description: str | None = None
    is_active: bool | None = None

    def to_payload(self) -> dict[str, Any]:
        return compact_dict(
            {
                "url": self.url,
                "events": self.events,
                "description": self.description,
                "is_active": self.is_active,
            }
        )


__all__ = ["CreateWebhookRequest", "UpdateWebhookRequest"]
