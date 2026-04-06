from __future__ import annotations

from collections.abc import AsyncIterator, Awaitable, Callable, Iterator
from typing import TypeVar

from .models.common import PaginatedResponse

T = TypeVar("T")


def iter_auto_paging(
    fetch_page: Callable[[int, int], PaginatedResponse[T]],
    *,
    page_size: int = 20,
    start_page: int = 1,
) -> Iterator[T]:
    page = start_page
    while True:
        response = fetch_page(page, page_size)
        yield from response.data
        if not response.pagination.has_more or not response.data:
            break
        page += 1


async def aiter_auto_paging(
    fetch_page: Callable[[int, int], Awaitable[PaginatedResponse[T]]],
    *,
    page_size: int = 20,
    start_page: int = 1,
) -> AsyncIterator[T]:
    page = start_page
    while True:
        response = await fetch_page(page, page_size)
        for item in response.data:
            yield item
        if not response.pagination.has_more or not response.data:
            break
        page += 1
