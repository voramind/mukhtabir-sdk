from __future__ import annotations

from .._transport import SyncTransport
from ..models.common import ApiResponse
from ..models.feedback import FeedbackDetails, RecordingUrl, Transcript
from ._request_specs import (
    execute_sync,
    feedback_get_spec,
    feedback_recording_url_spec,
    feedback_transcript_spec,
)


class SyncFeedbackResource:
    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def get(self, feedback_id: str) -> ApiResponse[FeedbackDetails]:
        return execute_sync(self._transport, feedback_get_spec(feedback_id))

    def get_transcript(self, feedback_id: str) -> ApiResponse[Transcript]:
        return execute_sync(self._transport, feedback_transcript_spec(feedback_id))

    def get_recording_url(self, feedback_id: str) -> ApiResponse[RecordingUrl]:
        return execute_sync(self._transport, feedback_recording_url_spec(feedback_id))


__all__ = ["SyncFeedbackResource"]
