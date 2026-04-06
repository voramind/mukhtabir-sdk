#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
package_dir="$(cd -- "${script_dir}/.." && pwd)"
repo_dir="$(cd -- "${package_dir}/.." && pwd)"

if [[ -f "${repo_dir}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${repo_dir}/.env"
  set +a
fi

dist_cli="${package_dir}/dist/cli.js"
if [[ ! -f "${dist_cli}" ]]; then
  echo "Missing ${dist_cli}. Run 'cd ${package_dir} && npm install && npm run build' first." >&2
  exit 1
fi

: "${MUKHTABIR_API_KEY:?Missing MUKHTABIR_API_KEY. Set it in the environment or repo root .env.}"
: "${MUKHTABIR_MCP_HTTP_BEARER_TOKEN:?Missing MUKHTABIR_MCP_HTTP_BEARER_TOKEN. Set it in the environment or repo root .env.}"

host="${MUKHTABIR_MCP_HTTP_HOST:-127.0.0.1}"
port="${MUKHTABIR_MCP_HTTP_PORT:-3000}"
path="${MUKHTABIR_MCP_HTTP_PATH:-/mcp}"
if [[ "${path}" != /* ]]; then
  path="/${path}"
fi
upstream_base_url="${MUKHTABIR_BASE_URL:-https://mukhtabir.hbku.edu.qa/api/v1}"

existing_pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN -n -P || true)"
if [[ -n "${existing_pids}" ]]; then
  echo "Refusing to start Mukhtabir MCP HTTP server on ${host}:${port} because the port is already in use." >&2
  while IFS= read -r pid; do
    [[ -z "${pid}" ]] && continue
    ps -p "${pid}" -o pid=,lstart=,command= >&2 || true
  done <<< "${existing_pids}"
  echo "Stop the existing listener or choose a different MUKHTABIR_MCP_HTTP_PORT before retrying." >&2
  exit 1
fi

export MUKHTABIR_BASE_URL="${upstream_base_url}"
export MUKHTABIR_MCP_TRANSPORT="http"
export MUKHTABIR_MCP_HTTP_HOST="${host}"
export MUKHTABIR_MCP_HTTP_PORT="${port}"
export MUKHTABIR_MCP_HTTP_PATH="${path}"

echo "Starting Mukhtabir MCP HTTP server on http://${host}:${port}${path}" >&2
echo "Resolved upstream Mukhtabir base URL: ${MUKHTABIR_BASE_URL}" >&2

cd "${repo_dir}"
exec node ./mcp/dist/cli.js
