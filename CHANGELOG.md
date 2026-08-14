# Changelog

All notable changes to HelloZen Read-Only MCP are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - Unreleased

### Added

- OAuth 2.1 protected MCP resource server (`/mcp` requires bearer tokens)
- Fixed `hellozen.read` scope enforcement for all four tools (single shared constant; not configurable)
- JWT access-token validation via authorization-server JWKS (`jose`)
- RFC 9728 protected-resource metadata and `WWW-Authenticate` challenges
- SDK integration: `requireBearerAuth`, `mcpAuthMetadataRouter`, `OAuthTokenVerifier`
- Fail-closed OAuth configuration validation at startup (no runtime auth-disable environment variables)
- Tool OAuth metadata via `_meta.securitySchemes`
- Cloudflare Tunnel optional Compose profile (`compose.cloudflare.yml`, `cloudflared:2026.7.3`)
- Pre-auth and post-authentication HTTP rate limiting (socket peer pre-auth; post-auth keyed by OAuth `clientId`)
- Comprehensive automated OAuth/security test coverage
- [docs/oauth-and-deployment.md](docs/oauth-and-deployment.md) — architecture, Cursor/ChatGPT setup, troubleshooting

### Changed

- Cursor canonical endpoint is HTTPS via Cloudflare Tunnel (not unauthenticated LAN)
- ChatGPT path unchanged (OpenAI Secure MCP Tunnel) but now requires OAuth at MCP layer
- Docker Compose adds private `hellozen-mcp-net` network for `cloudflared` origin routing
- Loopback binding `127.0.0.1:8790:8790` preserved for OpenAI tunnel compatibility

### Security

- No auth bypass by network path (LAN, Cloudflare, or OpenAI tunnel)
- No Cloudflare Access — single OAuth authorization model
- `HELLOZEN_MCP_READONLY_TOKEN` remains server-side only
- No runtime OAuth disable via environment variables
- Canonical issuer from discovery metadata used exactly for JWT `iss` validation
- Authorization Server capabilities are not fabricated in metadata responses
- Path-aware RFC 8414 / OIDC discovery (OAuth AS Metadata before OIDC Discovery)
- Malformed JWT bearer tokens return 401 (not 500)
- Cloudflare ingress documented as whole-hostname publish (preserves `/.well-known/oauth-protected-resource/*`)

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

[1.0.0]: https://github.com/ryanandrewbaker/hellozenmcp/releases/tag/v1.0.0
