from __future__ import annotations

import warnings
from importlib import import_module

from . import errors, models, webhooks
from ._version import __version__
from .async_client import AsyncMukhtabirClient
from .client import MukhtabirClient

__all__ = [
    "__version__",
    "AsyncMukhtabirClient",
    "MukhtabirClient",
    "errors",
    "models",
    "webhooks",
]

_COMPAT_EXPORTS = (
    {name: ("mukhtabir.errors", name) for name in errors.__all__}
    | {name: ("mukhtabir.models", name) for name in models.__all__}
    | {name: ("mukhtabir.webhooks", name) for name in webhooks.__all__}
)


def __getattr__(name: str) -> object:
    target = _COMPAT_EXPORTS.get(name)
    if target is None:
        raise AttributeError(f"module 'mukhtabir' has no attribute {name!r}")

    module_name, attribute = target
    warnings.warn(
        f"Importing {name} from 'mukhtabir' is deprecated; import it from {module_name!r} instead.",
        DeprecationWarning,
        stacklevel=2,
    )
    return getattr(import_module(module_name), attribute)
