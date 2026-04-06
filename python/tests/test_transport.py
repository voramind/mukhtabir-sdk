from __future__ import annotations

import asyncio
from typing import Any

import httpx
import pytest

from mukhtabir import __version__
from mukhtabir._transport import AsyncTransport, SyncTransport
from mukhtabir.errors import ServerError, UnexpectedResponseError, ValidationError


def _identity(payload: Any) -> Any:
    return payload


def test_sync_transport_injects_headers_and_request_id_fallback() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer mk_test_key"
        assert request.headers["Accept"] == "application/json"
        assert request.headers["User-Agent"] == f"mukhtabir-python/{__version__}"
        assert request.url.params.get("page") == "1"
        assert request.url.params.get("unused") is None
        return httpx.Response(
            200,
            headers={"X-Request-Id": "req_header"},
            json={"success": True, "data": {"ok": True}, "meta": {}},
        )

    transport = SyncTransport(
        api_key="mk_test_key",
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    response = transport.request(
        "GET",
        "/health",
        parser=_identity,
        params={"page": 1, "unused": None},
    )

    assert response.success is True
    assert response.data == {"ok": True}
    assert response.request_id == "req_header"


def test_sync_transport_retries_idempotent_request_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            raise httpx.ConnectError("temporary failure", request=request)
        return httpx.Response(
            200,
            json={
                "success": True,
                "data": {"attempts": attempts},
                "meta": {"request_id": "req_retry", "timestamp": "2026-03-14T09:05:00Z"},
            },
        )

    monkeypatch.setattr("mukhtabir._transport.time.sleep", lambda _: None)
    transport = SyncTransport(
        api_key="mk_test_key",
        max_retries=2,
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    response = transport.request("GET", "/health", parser=_identity)

    assert response.success is True
    assert response.data == {"attempts": 3}
    assert attempts == 3


def test_sync_transport_maps_api_error_responses() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            400,
            json={
                "success": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid request body",
                    "details": [{"field": "email", "issue": "required"}],
                },
                "meta": {"request_id": "req_bad", "timestamp": "2026-03-14T09:10:00Z"},
            },
        )

    transport = SyncTransport(
        api_key="mk_test_key",
        max_retries=0,
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    with pytest.raises(ValidationError) as exc_info:
        transport.request("GET", "/candidates", parser=_identity)

    assert exc_info.value.request_id == "req_bad"
    assert exc_info.value.details[0].field == "email"
    assert exc_info.value.details[0].issue == "required"


def test_sync_transport_caps_retry_after_delay(monkeypatch: pytest.MonkeyPatch) -> None:
    attempts = 0
    delays: list[float] = []

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(503, headers={"Retry-After": "600"})
        return httpx.Response(200, json={"success": True, "data": {"ok": True}, "meta": {}})

    monkeypatch.setattr("mukhtabir._transport.time.sleep", delays.append)
    transport = SyncTransport(
        api_key="mk_test_key",
        max_retries=1,
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    response = transport.request("GET", "/health", parser=_identity)

    assert response.success is True
    assert delays == [60.0]


def test_sync_transport_raises_on_invalid_json() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"X-Request-Id": "req_invalid_json"},
            text="this is not json",
        )

    transport = SyncTransport(
        api_key="mk_test_key",
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    with pytest.raises(UnexpectedResponseError) as exc_info:
        transport.request("GET", "/health", parser=_identity)

    assert exc_info.value.request_id == "req_invalid_json"
    assert exc_info.value.status_code == 200


def test_sync_transport_maps_non_json_server_errors() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            502,
            headers={"X-Request-Id": "req_proxy"},
            text="Bad gateway",
        )

    transport = SyncTransport(
        api_key="mk_test_key",
        max_retries=0,
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    with pytest.raises(ServerError) as exc_info:
        transport.request("GET", "/health", parser=_identity)

    assert exc_info.value.status_code == 502
    assert exc_info.value.request_id == "req_proxy"
    assert exc_info.value.message == "Bad gateway"


def test_async_transport_injects_headers_and_request_id_fallback() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer mk_test_key"
        assert request.headers["Accept"] == "application/json"
        assert request.headers["User-Agent"] == f"mukhtabir-python/{__version__}"
        assert request.url.params.get("page") == "1"
        assert request.url.params.get("unused") is None
        return httpx.Response(
            200,
            headers={"X-Request-Id": "req_header"},
            json={"success": True, "data": {"ok": True}, "meta": {}},
        )

    async def run() -> None:
        transport = AsyncTransport(
            api_key="mk_test_key",
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        )
        response = await transport.request(
            "GET",
            "/health",
            parser=_identity,
            params={"page": 1, "unused": None},
        )
        await transport.aclose()

        assert response.success is True
        assert response.data == {"ok": True}
        assert response.request_id == "req_header"

    asyncio.run(run())


def test_async_transport_retries_idempotent_request_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    attempts = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            raise httpx.ConnectError("temporary failure", request=request)
        return httpx.Response(
            200,
            json={
                "success": True,
                "data": {"attempts": attempts},
                "meta": {"request_id": "req_retry", "timestamp": "2026-03-14T09:05:00Z"},
            },
        )

    async def fake_sleep(_: float) -> None:
        return None

    async def run() -> None:
        transport = AsyncTransport(
            api_key="mk_test_key",
            max_retries=2,
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        )
        response = await transport.request("GET", "/health", parser=_identity)
        await transport.aclose()

        assert response.success is True
        assert response.data == {"attempts": 3}

    monkeypatch.setattr("mukhtabir._transport.asyncio.sleep", fake_sleep)
    asyncio.run(run())

    assert attempts == 3


def test_async_transport_maps_api_error_responses() -> None:
    async def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            400,
            json={
                "success": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid request body",
                    "details": [{"field": "email", "issue": "required"}],
                },
                "meta": {"request_id": "req_bad", "timestamp": "2026-03-14T09:10:00Z"},
            },
        )

    async def run() -> None:
        transport = AsyncTransport(
            api_key="mk_test_key",
            max_retries=0,
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        )

        with pytest.raises(ValidationError) as exc_info:
            await transport.request("GET", "/candidates", parser=_identity)

        await transport.aclose()

        assert exc_info.value.request_id == "req_bad"
        assert exc_info.value.details[0].field == "email"
        assert exc_info.value.details[0].issue == "required"

    asyncio.run(run())


def test_async_transport_raises_on_invalid_json() -> None:
    async def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"X-Request-Id": "req_invalid_json"},
            text="this is not json",
        )

    async def run() -> None:
        transport = AsyncTransport(
            api_key="mk_test_key",
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        )

        with pytest.raises(UnexpectedResponseError) as exc_info:
            await transport.request("GET", "/health", parser=_identity)

        await transport.aclose()

        assert exc_info.value.request_id == "req_invalid_json"
        assert exc_info.value.status_code == 200

    asyncio.run(run())


def test_async_transport_maps_non_json_server_errors() -> None:
    async def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            502,
            headers={"X-Request-Id": "req_proxy"},
            text="Bad gateway",
        )

    async def run() -> None:
        transport = AsyncTransport(
            api_key="mk_test_key",
            max_retries=0,
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        )

        with pytest.raises(ServerError) as exc_info:
            await transport.request("GET", "/health", parser=_identity)

        await transport.aclose()

        assert exc_info.value.status_code == 502
        assert exc_info.value.request_id == "req_proxy"
        assert exc_info.value.message == "Bad gateway"

    asyncio.run(run())


def test_async_transport_caps_retry_after_delay(monkeypatch: pytest.MonkeyPatch) -> None:
    attempts = 0
    delays: list[float] = []

    async def handler(_: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(503, headers={"Retry-After": "600"})
        return httpx.Response(200, json={"success": True, "data": {"ok": True}, "meta": {}})

    async def fake_sleep(delay: float) -> None:
        delays.append(delay)

    async def run() -> None:
        transport = AsyncTransport(
            api_key="mk_test_key",
            max_retries=1,
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        )
        response = await transport.request("GET", "/health", parser=_identity)
        await transport.aclose()
        assert response.success is True

    monkeypatch.setattr("mukhtabir._transport.asyncio.sleep", fake_sleep)
    asyncio.run(run())

    assert delays == [60.0]
