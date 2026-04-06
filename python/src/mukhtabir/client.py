from __future__ import annotations

import httpx

from ._transport import DEFAULT_BASE_URL, DEFAULT_TIMEOUT, SyncTransport
from .resources import (
    SyncCandidatesResource,
    SyncFeedbackResource,
    SyncInterviewsResource,
    SyncWebhooksResource,
)


class MukhtabirClient:
    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float | httpx.Timeout | None = DEFAULT_TIMEOUT,
        max_retries: int = 2,
        http_client: httpx.Client | None = None,
    ) -> None:
        self._transport = SyncTransport(
            api_key=api_key,
            base_url=base_url,
            timeout=timeout,
            max_retries=max_retries,
            http_client=http_client,
        )
        self.interviews = SyncInterviewsResource(self._transport)
        self.candidates = SyncCandidatesResource(self._transport)
        self.feedback = SyncFeedbackResource(self._transport)
        self.webhooks = SyncWebhooksResource(self._transport)

    def close(self) -> None:
        self._transport.close()

    def __enter__(self) -> MukhtabirClient:
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        self.close()
