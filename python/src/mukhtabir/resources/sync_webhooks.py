from __future__ import annotations

from collections.abc import Iterator

from .._pagination import iter_auto_paging
from .._transport import SyncTransport
from ..models.common import ApiResponse, DeleteResult, PaginatedResponse
from ..webhooks import (
    CreateWebhookRequest,
    UpdateWebhookRequest,
    WebhookCreateResult,
    WebhookDelivery,
    WebhookDetails,
    WebhookTestResult,
)
from ._request_specs import (
    execute_sync,
    webhook_create_spec,
    webhook_delete_spec,
    webhook_deliveries_spec,
    webhook_get_spec,
    webhook_list_spec,
    webhook_test_spec,
    webhook_update_spec,
)


class SyncWebhooksResource:
    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def create(self, request: CreateWebhookRequest) -> ApiResponse[WebhookCreateResult]:
        return execute_sync(self._transport, webhook_create_spec(request))

    def list(self, *, page: int = 1, page_size: int = 20) -> PaginatedResponse[WebhookDetails]:
        return execute_sync(
            self._transport,
            webhook_list_spec(page=page, page_size=page_size),
        )

    def iter_all(self, *, page_size: int = 20, start_page: int = 1) -> Iterator[WebhookDetails]:
        return iter_auto_paging(
            lambda page, size: self.list(page=page, page_size=size),
            page_size=page_size,
            start_page=start_page,
        )

    def get(self, webhook_id: str) -> ApiResponse[WebhookDetails]:
        return execute_sync(self._transport, webhook_get_spec(webhook_id))

    def update(
        self,
        webhook_id: str,
        request: UpdateWebhookRequest,
    ) -> ApiResponse[WebhookDetails]:
        return execute_sync(self._transport, webhook_update_spec(webhook_id, request))

    def delete(self, webhook_id: str) -> ApiResponse[DeleteResult]:
        return execute_sync(self._transport, webhook_delete_spec(webhook_id))

    def test(self, webhook_id: str) -> ApiResponse[WebhookTestResult]:
        return execute_sync(self._transport, webhook_test_spec(webhook_id))

    def list_deliveries(
        self,
        webhook_id: str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> PaginatedResponse[WebhookDelivery]:
        return execute_sync(
            self._transport,
            webhook_deliveries_spec(webhook_id, page=page, page_size=page_size),
        )

    def iter_all_deliveries(
        self,
        webhook_id: str,
        *,
        page_size: int = 20,
        start_page: int = 1,
    ) -> Iterator[WebhookDelivery]:
        return iter_auto_paging(
            lambda page, size: self.list_deliveries(webhook_id, page=page, page_size=size),
            page_size=page_size,
            start_page=start_page,
        )


__all__ = ["SyncWebhooksResource"]
