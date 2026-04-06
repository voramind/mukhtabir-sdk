from __future__ import annotations

from .._transport import AsyncTransport
from ..models.common import ApiResponse
from ..models.feedback import FeedbackDetails, RecordingUrl, Transcript
from ._request_specs import (
    execute_async,
    feedback_get_spec,
    feedback_recording_url_spec,
    feedback_transcript_spec,
)


class AsyncFeedbackResource:
    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def get(self, feedback_id: str) -> ApiResponse[FeedbackDetails]:
        return await execute_async(self._transport, feedback_get_spec(feedback_id))

    async def get_transcript(self, feedback_id: str) -> ApiResponse[Transcript]:
        return await execute_async(self._transport, feedback_transcript_spec(feedback_id))

    async def get_recording_url(self, feedback_id: str) -> ApiResponse[RecordingUrl]:
        return await execute_async(self._transport, feedback_recording_url_spec(feedback_id))


__all__ = ["AsyncFeedbackResource"]
