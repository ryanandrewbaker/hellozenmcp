# HelloZen Read-Only MCP

An unofficial, self-hosted, strictly read-only MCP connector designed for inspecting HelloZen configuration.

Use this connector with ChatGPT (via OpenAI Secure MCP Tunnel) or MCP Inspector to review custom fields, pipelines, calendars, and workflows when planning integrations for a photography studio on HelloZen — without exposing contact data or write access.

> **Disclaimer:** This project is unofficial and is not affiliated with, endorsed by, or supported by HelloZen unless explicitly approved by the HelloZen owner. Do not use HelloZen logos or imply official partnership.

> This connector cannot create, update or delete HelloZen data. Its credential contains no write scopes, and its application transport rejects every method except GET.

## What it does

Exposes exactly four MCP tools:

| Tool | Purpose |
|------|---------|
| `list_custom_fields` | Custom contact and opportunity field definitions |
| `list_pipelines` | Pipeline and stage configuration |
| `list_calendars` | Calendar configuration (e.g. portrait planning call setup) |
| `list_workflows` | Workflow IDs, names, and status |

It does **not** access contacts, conversations, appointments, opportunity records, emails, form submissions, calendar events, or workflow enrolments.

## Read-only security model

### Application boundary

- Only `GET` requests to four fixed LeadConnector endpoints
- Hard-coded upstream origin: `https://services.leadconnectorhq.com`
- No arbitrary URLs, methods, or query strings
- Response size capped while streaming (~2 MB)
- Tokens and raw upstream payloads never appear in logs, errors, or tool output

### Credential boundary

Create a **dedicated** HelloZen Private Integration for this connector. Required scopes:

```
locations/customFields.readonly
opportunities.readonly
calendars.readonly
workflows.readonly
```

**Do not grant:**

- Any `.write` permission
- Contacts permissions
- Calendar Events permissions
- Conversations permissions
- Edit, Create, Manage, or Delete permissions

**Never use** `HELLOZEN_PRIVATE_INTEGRATION_TOKEN` or reuse write-capable credentials from other projects.

### Residual risk

The `opportunities.readonly` scope is relatively broad in HighLevel because it covers both pipeline configuration and opportunity reads. This connector only calls the pipelines list endpoint, but a compromised token could still be misused outside this connector if broader API access was granted. Use the narrowest scopes possible.

## Requirements

- Node.js 22+
- A HelloZen sub-account location ID
- A read-only Private Integration token

## Local development

```bash
git clone <your-repo-url> hellozenmcp
cd hellozenmcp
npm install
cp .env.example .env
# Edit .env with your read-only token and location ID
npm run dev
```

Health check:

```bash
curl http://127.0.0.1:8790/healthz
```

### MCP Inspector

Point MCP Inspector at:

```
http://127.0.0.1:8790/mcp
```

## Verify HelloZen connectivity

Run manually after configuring `.env` (not during container startup):

```bash
npm run verify:hellozen
```

Example output:

```
Custom fields: accessible, 12
Pipelines: accessible, 3
Calendars: accessible, 2
Workflows: accessible, 8
```

This command prints counts only — no credentials, raw responses, or customer information.

## Docker

```bash
cp .env.example .env
# Edit .env
docker compose up -d --build
```

The default compose file binds to loopback only:

```
127.0.0.1:8790:8790
```

For operator-specific deployment paths, copy `DEPLOYMENT.local.md.example` to `DEPLOYMENT.local.md` (gitignored).

Generic example:

```bash
sudo mkdir -p /opt/hellozenmcp
# clone repository to /opt/hellozenmcp
cd /opt/hellozenmcp
docker compose up -d --build
```

## OpenAI Secure MCP Tunnel (next stage)

Do not expose this service on a public port. After review, connect via OpenAI Secure MCP Tunnel.

### Option A — tunnel client on the host

Keep the connector bound to `127.0.0.1:8790`. Configure the tunnel to target:

```
http://127.0.0.1:8790/mcp
```

### Option B — tunnel client in Docker

Place `hellozen-mcp` and the tunnel client on a **private internal Docker network**. Do not publish the MCP port to the host. Configure the tunnel to target:

```
http://hellozen-mcp:8790/mcp
```

**Warning:** Never bind the MCP server to a publicly accessible interface without an approved authentication and authorization layer.

Tunnel setup commands and credentials are configured separately when you deploy the tunnel.

## Environment variables

| Variable | Description |
|----------|-------------|
| `HELLOZEN_MCP_READONLY_TOKEN` | Read-only Private Integration token |
| `HELLOZEN_MCP_LOCATION_ID` | HelloZen location ID |
| `HELLOZEN_MCP_PORT` | HTTP port (default `8790`) |
| `HELLOZEN_MCP_BIND_HOST` | Bind address (default `0.0.0.0` in container) |
| `HELLOZEN_MCP_REQUEST_TIMEOUT_MS` | Upstream timeout (default `10000`) |
| `HELLOZEN_MCP_CACHE_TTL_SECONDS` | Configuration cache TTL (default `60`) |

## Credential rotation and incident response

1. Revoke the compromised Private Integration in HelloZen immediately
2. Create a new integration with the same read-only scopes
3. Update `.env` on the deployment host
4. Restart the container: `docker compose up -d`
5. Run `npm run verify:hellozen` to confirm access
6. Review container logs for unusual tool activity (logs contain event metadata only, not payloads)

## Development commands

```bash
npm test
npm run typecheck
npm run build
npm audit
```

## License

MIT — see [LICENSE](LICENSE).

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting.
