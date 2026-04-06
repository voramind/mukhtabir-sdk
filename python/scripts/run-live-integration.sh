#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python_root="$(cd "$script_dir/.." && pwd)"
python_bin="${MUKHTABIR_PYTHON_BIN:-python3}"

if [[ -z "${MUKHTABIR_API_KEY:-}" ]]; then
  echo "MUKHTABIR_API_KEY is required for live integration tests." >&2
  exit 1
fi

required_fixture_vars=(
  "MUKHTABIR_INTEGRATION_INTERVIEW_ID"
  "MUKHTABIR_INTEGRATION_FEEDBACK_ID"
  "MUKHTABIR_INTEGRATION_EXTERNAL_FEEDBACK_ID"
  "MUKHTABIR_INTEGRATION_EXTERNAL_RECORDING_URL"
  "MUKHTABIR_INTEGRATION_CANDIDATE_EMAIL"
  "MUKHTABIR_INTEGRATION_WEBHOOK_ID"
  "MUKHTABIR_INTEGRATION_LIMITED_API_KEY"
)

missing_fixture_vars=()
for var in "${required_fixture_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    missing_fixture_vars+=("$var")
  fi
done

if (( ${#missing_fixture_vars[@]} > 0 )); then
  echo "Missing required live-fixture env vars for the full live coverage: ${missing_fixture_vars[*]}" >&2
  echo "Set them before running the live suite, or invoke pytest directly if you intentionally only want a partial subset." >&2
  exit 1
fi

if ! command -v "$python_bin" >/dev/null 2>&1; then
  echo "missing Python interpreter: $python_bin" >&2
  exit 1
fi

export MUKHTABIR_INTEGRATION="${MUKHTABIR_INTEGRATION:-1}"

cd "$python_root"
exec "$python_bin" -m pytest -m integration tests/test_integration.py "$@"
