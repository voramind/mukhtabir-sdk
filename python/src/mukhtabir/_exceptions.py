from __future__ import annotations

from collections.abc import Sequence
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .models.common import ErrorDetail


class MukhtabirError(Exception):
    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        code: str | None = None,
        details: Sequence[ErrorDetail] | None = None,
        request_id: str | None = None,
        retry_after: int | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code
        self.details: tuple[ErrorDetail, ...] = tuple(details or ())
        self.request_id = request_id
        self.retry_after = retry_after

    def __str__(self) -> str:
        if self.code:
            return f"{self.code}: {self.message}"
        return self.message


class TransportError(MukhtabirError):
    pass


class UnexpectedResponseError(MukhtabirError):
    pass


class APIError(MukhtabirError):
    pass


class AuthenticationError(APIError):
    pass


class PermissionError(APIError):
    pass


class ValidationError(APIError):
    pass


class NotFoundError(APIError):
    pass


class ConflictError(APIError):
    pass


class RateLimitError(APIError):
    pass


class ServerError(APIError):
    pass


def map_api_error(
    *,
    message: str,
    status_code: int | None,
    code: str | None,
    details: Sequence[ErrorDetail] | None,
    request_id: str | None,
    retry_after: int | None,
) -> MukhtabirError:
    exception_type: type[MukhtabirError] = APIError

    if status_code == 400 or code == "VALIDATION_ERROR":
        exception_type = ValidationError
    elif status_code == 401 or code in {
        "AUTHENTICATION_REQUIRED",
        "INVALID_API_KEY",
        "API_KEY_EXPIRED",
        "API_KEY_REVOKED",
    }:
        exception_type = AuthenticationError
    elif status_code == 403 or code in {"INSUFFICIENT_SCOPE", "ORGANIZATION_INACTIVE", "FORBIDDEN"}:
        exception_type = PermissionError
    elif status_code == 404 or code == "RESOURCE_NOT_FOUND":
        exception_type = NotFoundError
    elif status_code == 409 or code == "CONFLICT":
        exception_type = ConflictError
    elif status_code == 429 or code == "RATE_LIMIT_EXCEEDED":
        exception_type = RateLimitError
    elif status_code is not None and status_code >= 500:
        exception_type = ServerError

    return exception_type(
        message,
        status_code=status_code,
        code=code,
        details=details,
        request_id=request_id,
        retry_after=retry_after,
    )
