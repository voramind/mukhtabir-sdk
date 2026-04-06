from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import pytest

from mukhtabir import AsyncMukhtabirClient, MukhtabirClient

REPO_ROOT = Path(__file__).resolve().parents[3]
DOTENV_PATH = REPO_ROOT / ".env"


@dataclass(frozen=True, slots=True)
class IntegrationConfig:
    api_key: str
    base_url: str | None
    interview_id: str | None
    feedback_id: str | None
    external_feedback_id: str | None
    external_recording_url: str | None
    candidate_email: str | None
    webhook_id: str | None
    limited_api_key: str | None


def load_integration_config() -> IntegrationConfig:
    _load_repo_dotenv()

    if os.getenv("MUKHTABIR_INTEGRATION") != "1":
        pytest.skip("Set MUKHTABIR_INTEGRATION=1 to run live integration tests.")

    api_key = os.getenv("MUKHTABIR_API_KEY")
    if not api_key:
        pytest.skip("Set MUKHTABIR_API_KEY to run live integration tests.")

    return IntegrationConfig(
        api_key=api_key,
        base_url=os.getenv("MUKHTABIR_BASE_URL"),
        interview_id=_read_optional_env("MUKHTABIR_INTEGRATION_INTERVIEW_ID"),
        feedback_id=_read_optional_env("MUKHTABIR_INTEGRATION_FEEDBACK_ID"),
        external_feedback_id=_read_optional_env("MUKHTABIR_INTEGRATION_EXTERNAL_FEEDBACK_ID"),
        external_recording_url=_read_optional_env(
            "MUKHTABIR_INTEGRATION_EXTERNAL_RECORDING_URL"
        ),
        candidate_email=_read_optional_env("MUKHTABIR_INTEGRATION_CANDIDATE_EMAIL"),
        webhook_id=_read_optional_env("MUKHTABIR_INTEGRATION_WEBHOOK_ID"),
        limited_api_key=_read_optional_env("MUKHTABIR_INTEGRATION_LIMITED_API_KEY"),
    )


def make_sync_client(config: IntegrationConfig) -> MukhtabirClient:
    if config.base_url is None:
        return MukhtabirClient(api_key=config.api_key)
    return MukhtabirClient(api_key=config.api_key, base_url=config.base_url)


def make_async_client(config: IntegrationConfig) -> AsyncMukhtabirClient:
    if config.base_url is None:
        return AsyncMukhtabirClient(api_key=config.api_key)
    return AsyncMukhtabirClient(api_key=config.api_key, base_url=config.base_url)


def _load_repo_dotenv() -> None:
    if not DOTENV_PATH.is_file():
        return

    for raw_line in DOTENV_PATH.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        if line.startswith("export "):
            line = line[7:].lstrip()

        if "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        if not key or key in os.environ:
            continue

        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]

        os.environ[key] = value


def _read_optional_env(name: str) -> str | None:
    value = os.getenv(name)
    if value is None:
        return None

    stripped = value.strip()
    return stripped or None
