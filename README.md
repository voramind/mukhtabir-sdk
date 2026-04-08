# Mukhtabir SDK Monorepo

Official developer tooling for the Mukhtabir API, maintained in a single repository.

This repo currently includes:

- a typed Python SDK
- an official TypeScript SDK
- a TypeScript MCP server for exposing Mukhtabir through MCP tools, resources, and prompts

Detailed usage, API examples, and package-specific configuration live in the README for each subproject.

## Packages

| Path | Package | Description |
| --- | --- | --- |
| [`python/`](./python) | [`mukhtabir`](./python/README.md) | Typed sync and async Python clients for the Mukhtabir API |
| [`typescript/`](./typescript) | [`@voramind/mukhtabir-sdk`](./typescript/README.md) | Official TypeScript SDK for Node.js and compatible runtimes |
| [`mcp/`](./mcp) | [`@voramind/mukhtabir-mcp`](./mcp/README.md) | MCP server with Mukhtabir tools, resources, and prompts |

## Which One Should I Use?

- Use [`python/`](./python/README.md) if you are building Python applications or backend services.
- Use [`typescript/`](./typescript/README.md) if you are building with Node.js or TypeScript.
- Use [`mcp/`](./mcp/README.md) if you want Mukhtabir available through an MCP-compatible client or operator-managed self-hosted HTTP deployment.

## Requirements

- Python SDK: Python `3.10+`
- TypeScript SDK: Node.js `18+`
- MCP server: Node.js `18+`
- API access: a Mukhtabir API key, typically provided as `MUKHTABIR_API_KEY`

By default, the SDKs target `https://mukhtabir.hbku.edu.qa/api/v1`.

The MCP server is documented for local use and operator-managed self-hosted HTTP deployments. This repository ships the HTTP transport and tenant-resolution hooks, but not the control plane, secret-manager integration, external abuse detection, or production audit backend required for shared internet-facing hosting.

## Install

### TypeScript SDK

Install the published SDK from npm:

```bash
npm install @voramind/mukhtabir-sdk
```

```bash
yarn add @voramind/mukhtabir-sdk
```

```bash
pnpm add @voramind/mukhtabir-sdk
```

### MCP Server

Install the published MCP server package globally:

```bash
npm install -g @voramind/mukhtabir-mcp
```

```bash
pnpm add -g @voramind/mukhtabir-mcp
```

Run it without a global install:

```bash
npx @voramind/mukhtabir-mcp
```

```bash
yarn dlx @voramind/mukhtabir-mcp
```

```bash
pnpm dlx @voramind/mukhtabir-mcp
```

## Development

There is no single root build step. Work inside the package you want to develop.

### Python SDK

Install a published release from PyPI with `pip install mukhtabir`.

For a local checkout:

```bash
pip install ./python
```

For development:

```bash
cd python
pip install -e ".[dev]"
pytest
./scripts/run-live-integration.sh
```

`./scripts/run-live-integration.sh` is the intentional live API gate for the Python SDK. It requires
`MUKHTABIR_API_KEY` and sets `MUKHTABIR_INTEGRATION=1` automatically.

See [`python/README.md`](./python/README.md) for client usage, examples, and the optional seeded
fixture environment variables that enable the expanded results, feedback, and webhook-delivery
coverage.

Tagged releases are published to PyPI by `.github/workflows/python-sdk-release.yml`. Bump
`python/src/mukhtabir/_version.py`, merge to `main`, then push a `python-sdk-vX.Y.Z` tag after the
PyPI project is configured to trust that workflow. If the Python live-integration secrets and vars
are configured, the release workflow runs that gate before publishing; otherwise it skips it.

### TypeScript SDK

Install the published package with:

```bash
npm install @voramind/mukhtabir-sdk
```

For local development:

```bash
cd typescript
npm install
npm test
```

See [`typescript/README.md`](./typescript/README.md) for client usage, exported types, examples, and webhook handling.

### MCP Server

Install the published package with:

```bash
npm install -g @voramind/mukhtabir-mcp
```

Or run it directly with:

```bash
npx @voramind/mukhtabir-mcp
```

For local development:

```bash
cd mcp
npm install
npm test
```

See [`mcp/README.md`](./mcp/README.md) for transports, auth, scopes, and the exposed MCP surface.

## Additional Docs

- [`doc/python-sdk-audit.md`](./doc/python-sdk-audit.md)
- [`doc/mcp-server-validation.md`](./doc/mcp-server-validation.md)
- [`doc/mcp-server-remote-security.md`](./doc/mcp-server-remote-security.md)

## License

[MIT](./LICENSE)
