from __future__ import annotations

import httpx

from ._transport import DEFAULT_BASE_URL, DEFAULT_TIMEOUT, AsyncTransport
from .resources import (
    AsyncCandidatesResource,
    AsyncFeedbackResource,
    AsyncInterviewsResource,
    AsyncWebhooksResource,
)


class AsyncMukhtabirClient:
    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float | httpx.Timeout | None = DEFAULT_TIMEOUT,
        max_retries: int = 2,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._transport = AsyncTransport(
            api_key=api_key,
            base_url=base_url,
            timeout=timeout,
            max_retries=max_retries,
            http_client=http_client,
        )
        self.interviews = AsyncInterviewsResource(self._transport)
        self.candidates = AsyncCandidatesResource(self._transport)
        self.feedback = AsyncFeedbackResource(self._transport)
        self.webhooks = AsyncWebhooksResource(self._transport)

    async def aclose(self) -> None:
        await self._transport.aclose()

    async def __aenter__(self) -> AsyncMukhtabirClient:
        return self

    async def __aexit__(self, exc_type: object, exc: object, tb: object) -> None:
        await self.aclose()
