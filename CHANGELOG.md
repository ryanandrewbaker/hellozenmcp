# Changelog

All notable changes to HelloZen Read-Only MCP are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-14

### HelloZen MCP 1.0 — baseline release

First stable baseline of the read-only HelloZen configuration inspector.

#### Added

- Read-only HelloZen MCP server with Streamable HTTP transport
- Four configuration inspection tools:
  - `list_custom_fields` — custom contact and opportunity field definitions
  - `list_pipelines` — pipeline and stage configuration
  - `list_calendars` — calendar configuration metadata
  - `list_workflows` — workflow IDs, names, and status
- Purpose-built `ReadOnlyHelloZenClient` with GET-only upstream transport
- Fixed LeadConnector origin and endpoint builders
- Normalized, data-minimized MCP responses
- Server-side HelloZen Private Integration credential handling
- Tool-level and HTTP rate limiting, upstream concurrency limits, response size bounds
- In-memory configuration caching
- Sanitized structured logging
- Hardened Docker deployment (non-root, read-only filesystem, dropped capabilities)
- On-demand service model (`restart: "no"`)
- Health endpoint (`GET /healthz`)
- `npm run verify:hellozen` upstream connectivity verifier
- Automated test, typecheck, and build coverage
- Documentation for Cursor LAN access and ChatGPT via OpenAI Secure MCP Tunnel

#### Supported v1.0 access patterns

- **Cursor** — direct Streamable HTTP over trusted LAN
- **ChatGPT** — OpenAI Secure MCP Tunnel to the private MCP endpoint

#### Known limitations

- No OAuth authentication for arbitrary external MCP clients
- No general authenticated public MCP endpoint
- Cursor direct access assumes trusted LAN connectivity
- No HelloZen mutation or write tools
- ChatGPT private access relies on the OpenAI Secure MCP Tunnel
- External access beyond the LAN is planned for a future release (see [docs/BACKLOG.md](docs/BACKLOG.md))

[1.0.0]: https://github.com/ryanandrewbaker/hellozenmcp/releases/tag/v1.0.0
