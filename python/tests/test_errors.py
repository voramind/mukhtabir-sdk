from __future__ import annotations

import pytest

from mukhtabir._exceptions import map_api_error
from mukhtabir.errors import (
    APIError,
    AuthenticationError,
    ConflictError,
    NotFoundError,
    PermissionError,
    RateLimitError,
    ServerError,
    ValidationError,
)
from mukhtabir.models import ErrorDetail


@pytest.mark.parametrize(
    ("status_code", "code", "expected_type"),
    [
        (400, None, ValidationError),
        (401, None, AuthenticationError),
        (403, None, PermissionError),
        (404, None, NotFoundError),
        (409, None, ConflictError),
        (429, None, RateLimitError),
        (500, None, ServerError),
        (418, None, APIError),
        (200, "INVALID_API_KEY", AuthenticationError),
        (200, "VALIDATION_ERROR", ValidationError),
    ],
)
def test_map_api_error_returns_expected_type(
    status_code: int,
    code: str | None,
    expected_type: type[APIError],
) -> None:
    detail = ErrorDetail(field="email", issue="required")

    error = map_api_error(
        message="Request failed",
        status_code=status_code,
        code=code,
        details=[detail],
        request_id="req_123",
        retry_after=7,
    )

    assert isinstance(error, expected_type)
    assert error.status_code == status_code
    assert error.code == code
    assert error.details == (detail,)
    assert error.request_id == "req_123"
    assert error.retry_after == 7


def test_error_string_includes_code_when_present() -> None:
    error = ValidationError("Invalid payload", code="VALIDATION_ERROR")

    assert str(error) == "VALIDATION_ERROR: Invalid payload"
