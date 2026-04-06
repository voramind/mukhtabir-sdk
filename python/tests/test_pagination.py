from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Callable, Iterator
from typing import Any

import httpx

from mukhtabir import AsyncMukhtabirClient, MukhtabirClient


def _run_sync_auto_paging_case(
    *,
    path: str,
    payloads: dict[int, dict[str, Any]],
    iterator_factory: Callable[[MukhtabirClient], Iterator[Any]],
    value_getter: Callable[[Any], str],
) -> tuple[list[str], int]:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        assert request.url.path == path
        page = int(request.url.params.get("page", "1"))
        return httpx.Response(200, json=payloads[page])

    client = MukhtabirClient(
        api_key="mk_test_key",
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    values = [value_getter(item) for item in iterator_factory(client)]
    return values, calls


async def _run_async_auto_paging_case(
    *,
    path: str,
    payloads: dict[int, dict[str, Any]],
    iterator_factory: Callable[[AsyncMukhtabirClient], AsyncIterator[Any]],
    value_getter: Callable[[Any], str],
) -> tuple[list[str], int]:
    calls = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        assert request.url.path == path
        page = int(request.url.params.get("page", "1"))
        return httpx.Response(200, json=payloads[page])

    async with AsyncMukhtabirClient(
        api_key="mk_test_key",
        http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    ) as client:
        values = [value_getter(item) async for item in iterator_factory(client)]

    return values, calls


def test_iter_all_candidates_pages_until_complete() -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        page = int(request.url.params.get("page", "1"))
        payloads = {
            1: {
                "success": True,
                "data": [
                    {
                        "email": "a@example.com",
                        "name": "A",
                        "total_tokens": 1,
                        "completed_interviews": 0,
                    }
                ],
                "pagination": {
                    "page": 1,
                    "page_size": 1,
                    "total": 2,
                    "total_pages": 2,
                    "has_more": True,
                },
                "meta": {"request_id": "req_1", "timestamp": "2026-03-11T10:00:00Z"},
            },
            2: {
                "success": True,
                "data": [
                    {
                        "email": "b@example.com",
                        "name": "B",
                        "total_tokens": 1,
                        "completed_interviews": 1,
                    }
                ],
                "pagination": {
                    "page": 2,
                    "page_size": 1,
                    "total": 2,
                    "total_pages": 2,
                    "has_more": False,
                },
                "meta": {"request_id": "req_2", "timestamp": "2026-03-11T10:01:00Z"},
            },
        }
        return httpx.Response(200, json=payloads[page])

    client = MukhtabirClient(
        api_key="mk_test_key",
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    page = client.candidates.list(page=1, page_size=1)
    calls = 0
    emails = [candidate.email for candidate in client.candidates.iter_all(page_size=1)]

    assert page.success is True
    assert emails == ["a@example.com", "b@example.com"]
    assert calls == 2


def test_async_iter_all_candidates_pages_until_complete() -> None:
    calls = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        page = int(request.url.params.get("page", "1"))
        payloads = {
            1: {
                "success": True,
                "data": [
                    {
                        "email": "a@example.com",
                        "name": "A",
                        "total_tokens": 1,
                        "completed_interviews": 0,
                    }
                ],
                "pagination": {
                    "page": 1,
                    "page_size": 1,
                    "total": 2,
                    "total_pages": 2,
                    "has_more": True,
                },
                "meta": {"request_id": "req_1", "timestamp": "2026-03-11T10:00:00Z"},
            },
            2: {
                "success": True,
                "data": [
                    {
                        "email": "b@example.com",
                        "name": "B",
                        "total_tokens": 1,
                        "completed_interviews": 1,
                    }
                ],
                "pagination": {
                    "page": 2,
                    "page_size": 1,
                    "total": 2,
                    "total_pages": 2,
                    "has_more": False,
                },
                "meta": {"request_id": "req_2", "timestamp": "2026-03-11T10:01:00Z"},
            },
        }
        return httpx.Response(200, json=payloads[page])

    async def run() -> None:
        nonlocal calls
        async with AsyncMukhtabirClient(
            api_key="mk_test_key",
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        ) as client:
            page = await client.candidates.list(page=1, page_size=1)
            calls = 0
            emails = [
                candidate.email async for candidate in client.candidates.iter_all(page_size=1)
            ]

        assert page.success is True
        assert emails == ["a@example.com", "b@example.com"]

    asyncio.run(run())

    assert calls == 2


def test_iter_all_interviews_pages_until_complete() -> None:
    payloads = {
        1: {
            "success": True,
            "data": [
                {
                    "id": "int_1",
                    "role": "Platform Engineer",
                    "type": "technical",
                    "level": "mid",
                    "duration": 30,
                }
            ],
            "pagination": {
                "page": 1,
                "page_size": 1,
                "total": 2,
                "total_pages": 2,
                "has_more": True,
            },
            "meta": {"request_id": "req_1", "timestamp": "2026-03-11T10:00:00Z"},
        },
        2: {
            "success": True,
            "data": [
                {
                    "id": "int_2",
                    "role": "Reliability Engineer",
                    "type": "technical",
                    "level": "senior",
                    "duration": 45,
                }
            ],
            "pagination": {
                "page": 2,
                "page_size": 1,
                "total": 2,
                "total_pages": 2,
                "has_more": False,
            },
            "meta": {"request_id": "req_2", "timestamp": "2026-03-11T10:01:00Z"},
        },
    }

    ids, calls = _run_sync_auto_paging_case(
        path="/api/v1/interviews",
        payloads=payloads,
        iterator_factory=lambda client: client.interviews.iter_all(page_size=1),
        value_getter=lambda item: item.id,
    )

    assert ids == ["int_1", "int_2"]
    assert calls == 2


def test_iter_all_interview_results_pages_until_complete() -> None:
    payloads = {
        1: {
            "success": True,
            "data": [
                {
                    "id": "fb_1",
                    "interview_id": "int_123",
                    "interviewee_email": "a@example.com",
                    "interviewee_name": "A",
                }
            ],
            "pagination": {
                "page": 1,
                "page_size": 1,
                "total": 2,
                "total_pages": 2,
                "has_more": True,
            },
            "meta": {"request_id": "req_1", "timestamp": "2026-03-11T10:00:00Z"},
        },
        2: {
            "success": True,
            "data": [
                {
                    "id": "fb_2",
                    "interview_id": "int_123",
                    "interviewee_email": "b@example.com",
                    "interviewee_name": "B",
                }
            ],
            "pagination": {
                "page": 2,
                "page_size": 1,
                "total": 2,
                "total_pages": 2,
                "has_more": False,
            },
            "meta": {"request_id": "req_2", "timestamp": "2026-03-11T10:01:00Z"},
        },
    }

    ids, calls = _run_sync_auto_paging_case(
        path="/api/v1/interviews/int_123/results",
        payloads=payloads,
        iterator_factory=lambda client: client.interviews.iter_all_results(
            "int_123", page_size=1
        ),
        value_getter=lambda item: item.id,
    )

    assert ids == ["fb_1", "fb_2"]
    assert calls == 2


def test_iter_all_webhooks_pages_until_complete() -> None:
    payloads = {
        1: {
            "success": True,
            "data": [
                {
                    "id": "wh_1",
                    "url": "https://example.test/one",
                    "events": ["interview.completed"],
                    "is_active": True,
                }
            ],
            "pagination": {
                "page": 1,
                "page_size": 1,
                "total": 2,
                "total_pages": 2,
                "has_more": True,
            },
            "meta": {"request_id": "req_1", "timestamp": "2026-03-11T10:00:00Z"},
        },
        2: {
            "success": True,
            "data": [
                {
                    "id": "wh_2",
                    "url": "https://example.test/two",
                    "events": ["candidate.invited"],
                    "is_active": False,
                }
            ],
            "pagination": {
                "page": 2,
                "page_size": 1,
                "total": 2,
                "total_pages": 2,
                "has_more": False,
            },
            "meta": {"request_id": "req_2", "timestamp": "2026-03-11T10:01:00Z"},
        },
    }

    ids, calls = _run_sync_auto_paging_case(
        path="/api/v1/webhooks",
        payloads=payloads,
        iterator_factory=lambda client: client.webhooks.iter_all(page_size=1),
        value_getter=lambda item: item.id,
    )

    assert ids == ["wh_1", "wh_2"]
    assert calls == 2


def test_iter_all_webhook_deliveries_pages_until_complete() -> None:
    payloads = {
        1: {
            "success": True,
            "data": [
                {
                    "id": "wd_1",
                    "event_type": "interview.completed",
                    "status": "delivered",
                }
            ],
            "pagination": {
                "page": 1,
                "page_size": 1,
                "total": 2,
                "total_pages": 2,
                "has_more": True,
            },
            "meta": {"request_id": "req_1", "timestamp": "2026-03-11T10:00:00Z"},
        },
        2: {
            "success": True,
            "data": [
                {
                    "id": "wd_2",
                    "event_type": "candidate.invited",
                    "status": "pending",
                }
            ],
            "pagination": {
                "page": 2,
                "page_size": 1,
                "total": 2,
                "total_pages": 2,
                "has_more": False,
            },
            "meta": {"request_id": "req_2", "timestamp": "2026-03-11T10:01:00Z"},
        },
    }

    ids, calls = _run_sync_auto_paging_case(
        path="/api/v1/webhooks/wh_123/deliveries",
        payloads=payloads,
        iterator_factory=lambda client: client.webhooks.iter_all_deliveries(
            "wh_123", page_size=1
        ),
        value_getter=lambda item: item.id,
    )

    assert ids == ["wd_1", "wd_2"]
    assert calls == 2


def test_async_iter_all_interviews_pages_until_complete() -> None:
    payloads = {
        1: {
            "success": True,
            "data": [
                {
                    "id": "int_1",
                    "role": "Platform Engineer",
                    "type": "technical",
                    "level": "mid",
                    "duration": 30,
                }
            ],
            "pagination": {
                "page": 1,
                "page_size": 1,
                "total": 2,
                "total_pages": 2,
                "has_more": True,
            },
            "meta": {"request_id": "req_1", "timestamp": "2026-03-11T10:00:00Z"},
        },
        2: {
            "success": True,
            "data": [
                {
                    "id": "int_2",
                    "role": "Reliability Engineer",
                    "type": "technical",
                    "level": "senior",
                    "duration": 45,
                }
            ],
            "pagination": {
                "page": 2,
                "page_size": 1,
                "total": 2,
                "total_pages": 2,
                "has_more": False,
            },
            "meta": {"request_id": "req_2", "timestamp": "2026-03-11T10:01:00Z"},
        },
    }

    async def run() -> None:
        ids, calls = await _run_async_auto_paging_case(
            path="/api/v1/interviews",
            payloads=payloads,
            iterator_factory=lambda client: client.interviews.iter_all(page_size=1),
            value_getter=lambda item: item.id,
        )

        assert ids == ["int_1", "int_2"]
        assert calls == 2

    asyncio.run(run())


def test_async_iter_all_interview_results_pages_until_complete() -> None:
    payloads = {
        1: {
            "success": True,
            "data": [
                {
                    "id": "fb_1",
                    "interview_id": "int_123",
                    "interviewee_email": "a@example.com",
                    "interviewee_name": "A",
                }
            ],
            "pagination": {
                "page": 1,
                "page_size": 1,
                "total": 2,
                "total_pages": 2,
                "has_more": True,
            },
            "meta": {"request_id": "req_1", "timestamp": "2026-03-11T10:00:00Z"},
        },
        2: {
            "success": True,
            "data": [
                {
                    "id": "fb_2",
                    "interview_id": "int_123",
                    "interviewee_email": "b@example.com",
                    "interviewee_name": "B",
                }
            ],
            "pagination": {
                "page": 2,
                "page_size": 1,
                "total": 2,
                "total_pages": 2,
                "has_more": False,
            },
            "meta": {"request_id": "req_2", "timestamp": "2026-03-11T10:01:00Z"},
        },
    }

    async def run() -> None:
        ids, calls = await _run_async_auto_paging_case(
            path="/api/v1/interviews/int_123/results",
            payloads=payloads,
            iterator_factory=lambda client: client.interviews.iter_all_results(
                "int_123", page_size=1
            ),
            value_getter=lambda item: item.id,
        )

        assert ids == ["fb_1", "fb_2"]
        assert calls == 2

    asyncio.run(run())


def test_async_iter_all_webhooks_pages_until_complete() -> None:
    payloads = {
        1: {
            "success": True,
            "data": [
                {
                    "id": "wh_1",
                    "url": "https://example.test/one",
                    "events": ["interview.completed"],
                    "is_active": True,
                }
            ],
            "pagination": {
                "page": 1,
                "page_size": 1,
                "total": 2,
                "total_pages": 2,
                "has_more": True,
            },
            "meta": {"request_id": "req_1", "timestamp": "2026-03-11T10:00:00Z"},
        },
        2: {
            "success": True,
            "data": [
                {
                    "id": "wh_2",
                    "url": "https://example.test/two",
                    "events": ["candidate.invited"],
                    "is_active": False,
                }
            ],
            "pagination": {
                "page": 2,
                "page_size": 1,
                "total": 2,
                "total_pages": 2,
                "has_more": False,
            },
            "meta": {"request_id": "req_2", "timestamp": "2026-03-11T10:01:00Z"},
        },
    }

    async def run() -> None:
        ids, calls = await _run_async_auto_paging_case(
            path="/api/v1/webhooks",
            payloads=payloads,
            iterator_factory=lambda client: client.webhooks.iter_all(page_size=1),
            value_getter=lambda item: item.id,
        )

        assert ids == ["wh_1", "wh_2"]
        assert calls == 2

    asyncio.run(run())


def test_async_iter_all_webhook_deliveries_pages_until_complete() -> None:
    payloads = {
        1: {
            "success": True,
            "data": [
                {
                    "id": "wd_1",
                    "event_type": "interview.completed",
                    "status": "delivered",
                }
            ],
            "pagination": {
                "page": 1,
                "page_size": 1,
                "total": 2,
                "total_pages": 2,
                "has_more": True,
            },
            "meta": {"request_id": "req_1", "timestamp": "2026-03-11T10:00:00Z"},
        },
        2: {
            "success": True,
            "data": [
                {
                    "id": "wd_2",
                    "event_type": "candidate.invited",
                    "status": "pending",
                }
            ],
            "pagination": {
                "page": 2,
                "page_size": 1,
                "total": 2,
                "total_pages": 2,
                "has_more": False,
            },
            "meta": {"request_id": "req_2", "timestamp": "2026-03-11T10:01:00Z"},
        },
    }

    async def run() -> None:
        ids, calls = await _run_async_auto_paging_case(
            path="/api/v1/webhooks/wh_123/deliveries",
            payloads=payloads,
            iterator_factory=lambda client: client.webhooks.iter_all_deliveries(
                "wh_123", page_size=1
            ),
            value_getter=lambda item: item.id,
        )

        assert ids == ["wd_1", "wd_2"]
        assert calls == 2

    asyncio.run(run())
