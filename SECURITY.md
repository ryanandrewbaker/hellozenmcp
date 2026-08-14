# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |

## Reporting a vulnerability

If you discover a security issue in HelloZen Read-Only MCP, please report it privately:

1. Open a **private** security advisory on the repository host (when published), or
2. Contact the repository maintainer through your usual secure channel.

Do not open public issues for undisclosed vulnerabilities.

Include:

- A description of the issue and its potential impact
- Steps to reproduce
- Any suggested fix (optional)

We aim to acknowledge reports within a few business days.

## Scope

HelloZen Read-Only MCP is a **read-only** connector. It:

- Permits only `GET` requests to four fixed HelloZen configuration endpoints
- Does not expose contact, conversation, appointment, or customer data
- Cannot create, update, or delete HelloZen records through its tool surface

### Credential handling

- Use a **dedicated** HelloZen Private Integration with read-only scopes only
- Never commit tokens, location IDs, or `.env` files
- Rotate credentials immediately if exposure is suspected
- Do not reuse write-capable integration tokens from other projects

### Residual risk

The HelloZen credential scope `opportunities.readonly` is relatively broad at the API level. This connector restricts itself to the pipelines configuration endpoint only, but a compromised token could still be used outside this connector if it has broader API access. Grant the narrowest scopes possible.

### Deployment

- Keep the MCP server private; access via OpenAI Secure MCP Tunnel or equivalent
- Do not expose the MCP HTTP port on a public network interface without an approved authentication layer
- Bind to loopback (`127.0.0.1`) for initial deployment unless using a private Docker network

### On-demand availability

Although this connector is read-only, uses narrowly scoped credentials, binds its MCP port to loopback only, and is intended for access through OpenAI Secure MCP Tunnel, it still has visibility into private business configuration (custom fields, pipelines, calendars, workflows).

**Minimise credential exposure time and service availability.** Run the connector only while an authorised operator is actively using ChatGPT to inspect HelloZen configuration. Stop it when the session ends.

Docker Compose is configured with `restart: "no"` so the service does not automatically start after a host reboot, Docker daemon restart, or container exit. The normal resting state is **STOPPED**.

### v1.0 access model

Version 1.0 supports:

- **Cursor** — direct Streamable HTTP over a trusted LAN
- **ChatGPT** — OpenAI Secure MCP Tunnel to a private MCP endpoint

Version 1.0 does **not** provide OAuth authentication or a general public HTTPS MCP endpoint. Future releases may add Cloudflare Tunnel and OAuth 2.1 (see [docs/BACKLOG.md](docs/BACKLOG.md)).

The LAN HTTP endpoint must not be treated as safe for untrusted networks or public Internet exposure.

This does not make compromise impossible. It is **defence in depth** that reduces:

- credential exposure window
- unnecessary long-lived API connectivity
- attack surface while the service is idle
- risk of accidental access when no operator is present

## Secret scanning

This repository uses Gitleaks in CI. Do not commit secrets. Use `.env` locally and keep it out of version control.
