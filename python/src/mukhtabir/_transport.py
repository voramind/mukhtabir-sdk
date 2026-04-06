from __future__ import annotations

import asyncio
import time
from collections.abc import Callable, Mapping
from email.utils import parsedate_to_datetime
from typing import Any, NoReturn, TypeVar
from urllib.parse import urljoin

import httpx

from ._exceptions import TransportError, UnexpectedResponseError, map_api_error
from ._parsing import expect_mapping, get_bool, get_int, get_str
from ._version import __version__
from .models.common import ApiResponse, ErrorDetail, PaginatedResponse, PaginationInfo, ResponseMeta

T = TypeVar("T")

DEFAULT_BASE_URL = "https://mukhtabir.hbku.edu.qa/api/v1"
DEFAULT_TIMEOUT = 10.0
DEFAULT_MAX_RETRY_DELAY = 60.0
IDEMPOTENT_METHODS = {"DELETE", "GET", "HEAD", "OPTIONS"}
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}


def _build_url(base_url: str, path: str) -> str:
    if path.startswith("http://") or path.startswith("https://"):
        return path
    return urljoin(f"{base_url.rstrip('/')}/", path.lstrip("/"))


def _parse_retry_after(value: str | None) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        try:
            retry_at = parsedate_to_datetime(value)
        except (TypeError, ValueError):
            return None
        delta = int(retry_at.timestamp() - time.time())
        return max(delta, 0)


def _get_retry_delay(attempt: int, retry_after: str | None) -> float:
    server_delay = _parse_retry_after(retry_after)
    if server_delay is not None:
        return min(float(server_delay), DEFAULT_MAX_RETRY_DELAY)
    backoff_delay = 0.25 * float(2**attempt)
    return min(backoff_delay, DEFAULT_MAX_RETRY_DELAY)


def _parse_error_details(payload: Mapping[str, Any]) -> list[ErrorDetail]:
    details = payload.get("details", [])
    if not isinstance(details, list):
        return []
    parsed: list[ErrorDetail] = []
    for detail in details:
        if isinstance(detail, Mapping):
            parsed.append(
                ErrorDetail(
                    field=str(detail.get("field", "")),
                    issue=str(detail.get("issue", "")),
                )
            )
    return parsed


def _parse_meta(envelope: Mapping[str, Any], response: httpx.Response) -> ResponseMeta:
    raw_meta = envelope.get("meta", {})
    meta = expect_mapping(raw_meta, context="response.meta") if raw_meta else {}
    request_id = get_str(meta, "request_id", "requestId") or response.headers.get("X-Request-Id")
    timestamp = get_str(meta, "timestamp")
    return ResponseMeta(request_id=request_id, timestamp=timestamp)


def _parse_pagination(payload: Mapping[str, Any]) -> PaginationInfo:
    page = get_int(payload, "page", default=1) or 1
    page_size = get_int(payload, "page_size", "pageSize", default=20) or 20
    total = get_int(payload, "total", default=0) or 0
    total_pages = get_int(payload, "total_pages", "totalPages")
    if total_pages is None:
        total_pages = max((total + page_size - 1) // page_size, 1 if total > 0 else 0)
    has_more = get_bool(payload, "has_more", "hasMore")
    if has_more is None:
        has_more = page < total_pages
    return PaginationInfo(
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
        has_more=has_more,
    )


def _raise_for_api_error(response: httpx.Response, payload: Mapping[str, Any] | None) -> NoReturn:
    request_id = response.headers.get("X-Request-Id")
    code: str | None = None
    message = f"HTTP {response.status_code}"
    details: list[ErrorDetail] = []

    if payload:
        meta = _parse_meta(payload, response)
        request_id = meta.request_id
        raw_error = payload.get("error", {})
        if isinstance(raw_error, Mapping):
            code = get_str(raw_error, "code")
            message = get_str(raw_error, "message") or message
            details = _parse_error_details(raw_error)
    elif response.text:
        message = response.text

    raise map_api_error(
        message=message,
        status_code=response.status_code,
        code=code,
        details=details,
        request_id=request_id,
        retry_after=_parse_retry_after(response.headers.get("Retry-After")),
    )


def _decode_envelope(response: httpx.Response) -> Mapping[str, Any]:
    try:
        decoded = response.json()
    except ValueError as exc:
        raise UnexpectedResponseError(
            "Response body was not valid JSON.",
            status_code=response.status_code,
            request_id=response.headers.get("X-Request-Id"),
        ) from exc
    return expect_mapping(decoded, context="response")


def _parse_envelope(
    response: httpx.Response,
    parser: Callable[[Any], T],
    *,
    paginated: bool,
) -> ApiResponse[T] | PaginatedResponse[T]:
    if response.status_code >= 400:
        try:
            envelope = _decode_envelope(response)
        except UnexpectedResponseError:
            _raise_for_api_error(response, None)
        _raise_for_api_error(response, envelope)

    envelope = _decode_envelope(response)
    success = get_bool(envelope, "success")
    if success is not True:
        _raise_for_api_error(response, envelope)

    meta = _parse_meta(envelope, response)
    if paginated:
        items = envelope.get("data", [])
        if not isinstance(items, list):
            raise UnexpectedResponseError(
                "Expected paginated data to be a list.",
                status_code=response.status_code,
                request_id=meta.request_id,
            )
        raw_pagination = envelope.get("pagination", {})
        pagination = _parse_pagination(
            expect_mapping(raw_pagination, context="response.pagination") if raw_pagination else {}
        )
        return PaginatedResponse(
            success=True,
            data=[parser(item) for item in items],
            pagination=pagination,
            meta=meta,
        )

    return ApiResponse(success=True, data=parser(envelope.get("data")), meta=meta)


class SyncTransport:
    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float | httpx.Timeout | None = DEFAULT_TIMEOUT,
        max_retries: int = 2,
        http_client: httpx.Client | None = None,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url
        self._timeout = timeout
        self._max_retries = max_retries
        self._client = http_client or httpx.Client(timeout=timeout)
        self._owns_client = http_client is None

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def request(
        self,
        method: str,
        path: str,
        *,
        parser: Callable[[Any], T],
        params: Mapping[str, Any] | None = None,
        json_body: Mapping[str, Any] | None = None,
    ) -> ApiResponse[T]:
        response = self._send(method, path, params=params, json_body=json_body)
        parsed = _parse_envelope(response, parser, paginated=False)
        if isinstance(parsed, PaginatedResponse):
            raise UnexpectedResponseError("Expected a non-paginated response.")
        return parsed

    def request_paginated(
        self,
        method: str,
        path: str,
        *,
        parser: Callable[[Any], T],
        params: Mapping[str, Any] | None = None,
        json_body: Mapping[str, Any] | None = None,
    ) -> PaginatedResponse[T]:
        response = self._send(method, path, params=params, json_body=json_body)
        parsed = _parse_envelope(response, parser, paginated=True)
        if isinstance(parsed, ApiResponse):
            raise UnexpectedResponseError("Expected a paginated response.")
        return parsed

    def _send(
        self,
        method: str,
        path: str,
        *,
        params: Mapping[str, Any] | None,
        json_body: Mapping[str, Any] | None,
    ) -> httpx.Response:
        url = _build_url(self._base_url, path)
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self._api_key}",
            "User-Agent": f"mukhtabir-python/{__version__}",
        }
        if json_body is not None:
            headers["Content-Type"] = "application/json"

        for attempt in range(self._max_retries + 1):
            try:
                response = self._client.request(
                    method,
                    url,
                    params={k: v for k, v in (params or {}).items() if v is not None},
                    json=json_body,
                    headers=headers,
                    timeout=self._timeout,
                )
            except httpx.RequestError as exc:
                if method.upper() in IDEMPOTENT_METHODS and attempt < self._max_retries:
                    time.sleep(_get_retry_delay(attempt, None))
                    continue
                raise TransportError(str(exc)) from exc

            if (
                method.upper() in IDEMPOTENT_METHODS
                and response.status_code in RETRYABLE_STATUS_CODES
            ):
                if attempt < self._max_retries:
                    time.sleep(_get_retry_delay(attempt, response.headers.get("Retry-After")))
                    continue
            return response

        raise TransportError("Request retries exhausted.")


class AsyncTransport:
    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float | httpx.Timeout | None = DEFAULT_TIMEOUT,
        max_retries: int = 2,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url
        self._timeout = timeout
        self._max_retries = max_retries
        self._client = http_client or httpx.AsyncClient(timeout=timeout)
        self._owns_client = http_client is None

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def request(
        self,
        method: str,
        path: str,
        *,
        parser: Callable[[Any], T],
        params: Mapping[str, Any] | None = None,
        json_body: Mapping[str, Any] | None = None,
    ) -> ApiResponse[T]:
        response = await self._send(method, path, params=params, json_body=json_body)
        parsed = _parse_envelope(response, parser, paginated=False)
        if isinstance(parsed, PaginatedResponse):
            raise UnexpectedResponseError("Expected a non-paginated response.")
        return parsed

    async def request_paginated(
        self,
        method: str,
        path: str,
        *,
        parser: Callable[[Any], T],
        params: Mapping[str, Any] | None = None,
        json_body: Mapping[str, Any] | None = None,
    ) -> PaginatedResponse[T]:
        response = await self._send(method, path, params=params, json_body=json_body)
        parsed = _parse_envelope(response, parser, paginated=True)
        if isinstance(parsed, ApiResponse):
            raise UnexpectedResponseError("Expected a paginated response.")
        return parsed

    async def _send(
        self,
        method: str,
        path: str,
        *,
        params: Mapping[str, Any] | None,
        json_body: Mapping[str, Any] | None,
    ) -> httpx.Response:
        url = _build_url(self._base_url, path)
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self._api_key}",
            "User-Agent": f"mukhtabir-python/{__version__}",
        }
        if json_body is not None:
            headers["Content-Type"] = "application/json"

        for attempt in range(self._max_retries + 1):
            try:
                response = await self._client.request(
                    method,
                    url,
                    params={k: v for k, v in (params or {}).items() if v is not None},
                    json=json_body,
                    headers=headers,
                    timeout=self._timeout,
                )
            except httpx.RequestError as exc:
                if method.upper() in IDEMPOTENT_METHODS and attempt < self._max_retries:
                    await asyncio.sleep(_get_retry_delay(attempt, None))
                    continue
                raise TransportError(str(exc)) from exc

            if (
                method.upper() in IDEMPOTENT_METHODS
                and response.status_code in RETRYABLE_STATUS_CODES
            ):
                if attempt < self._max_retries:
                    await asyncio.sleep(
                        _get_retry_delay(attempt, response.headers.get("Retry-After"))
                    )
                    continue
            return response

        raise TransportError("Request retries exhausted.")
