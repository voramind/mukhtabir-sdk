from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from typing import Any, TypeVar, cast

from ._exceptions import UnexpectedResponseError

T = TypeVar("T")
JSONMapping = Mapping[str, Any]

_MISSING = object()


def expect_mapping(value: Any, *, context: str) -> JSONMapping:
    if not isinstance(value, Mapping):
        raise UnexpectedResponseError(f"Expected an object for {context}.")
    return cast(JSONMapping, value)


def expect_list(value: Any, *, context: str) -> list[Any]:
    if isinstance(value, (str, bytes, bytearray)) or not isinstance(value, Sequence):
        raise UnexpectedResponseError(f"Expected an array for {context}.")
    return list(value)


def get_value(payload: JSONMapping, *keys: str, default: Any = _MISSING) -> Any:
    for key in keys:
        if key in payload:
            return payload[key]
    if default is not _MISSING:
        return default
    joined = ", ".join(keys)
    raise UnexpectedResponseError(f"Missing expected field: {joined}.")


def get_str(payload: JSONMapping, *keys: str, default: str | None = None) -> str | None:
    value = get_value(payload, *keys, default=default)
    if value is None:
        return None
    if not isinstance(value, str):
        raise UnexpectedResponseError(f"Expected a string for {keys[0]}.")
    return value


def require_str(payload: JSONMapping, *keys: str) -> str:
    value = get_value(payload, *keys)
    if not isinstance(value, str):
        raise UnexpectedResponseError(f"Expected a string for {keys[0]}.")
    return value


def get_bool(payload: JSONMapping, *keys: str, default: bool | None = None) -> bool | None:
    value = get_value(payload, *keys, default=default)
    if value is None:
        return None
    if not isinstance(value, bool):
        raise UnexpectedResponseError(f"Expected a boolean for {keys[0]}.")
    return value


def require_bool(payload: JSONMapping, *keys: str) -> bool:
    value = get_value(payload, *keys)
    if not isinstance(value, bool):
        raise UnexpectedResponseError(f"Expected a boolean for {keys[0]}.")
    return value


def get_int(payload: JSONMapping, *keys: str, default: int | None = None) -> int | None:
    value = get_value(payload, *keys, default=default)
    if value is None:
        return None
    if isinstance(value, bool):
        raise UnexpectedResponseError(f"Expected an integer for {keys[0]}.")
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str):
        try:
            return int(value)
        except ValueError as exc:
            raise UnexpectedResponseError(f"Expected an integer for {keys[0]}.") from exc
    raise UnexpectedResponseError(f"Expected an integer for {keys[0]}.")


def require_int(payload: JSONMapping, *keys: str) -> int:
    value = get_value(payload, *keys)
    if isinstance(value, bool):
        raise UnexpectedResponseError(f"Expected an integer for {keys[0]}.")
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str):
        try:
            return int(value)
        except ValueError as exc:
            raise UnexpectedResponseError(f"Expected an integer for {keys[0]}.") from exc
    raise UnexpectedResponseError(f"Expected an integer for {keys[0]}.")


def get_float(payload: JSONMapping, *keys: str, default: float | None = None) -> float | None:
    value = get_value(payload, *keys, default=default)
    if value is None:
        return None
    if isinstance(value, bool):
        raise UnexpectedResponseError(f"Expected a number for {keys[0]}.")
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError as exc:
            raise UnexpectedResponseError(f"Expected a number for {keys[0]}.") from exc
    raise UnexpectedResponseError(f"Expected a number for {keys[0]}.")


def parse_model_list(items: Any, parser: Callable[[Any], T], *, context: str) -> list[T]:
    return [parser(item) for item in expect_list(items, context=context)]


def parse_string_list(items: Any, *, context: str) -> list[str]:
    parsed: list[str] = []
    for index, item in enumerate(expect_list(items, context=context)):
        if not isinstance(item, str):
            raise UnexpectedResponseError(f"Expected a string for {context}[{index}].")
        parsed.append(item)
    return parsed


def compact_dict(values: Mapping[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in values.items() if value is not None}
