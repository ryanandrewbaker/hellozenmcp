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

## Documentation

| Document | Description |
|----------|-------------|
| [docs/connecting-to-chatgpt.md](docs/connecting-to-chatgpt.md) | Field guide: private MCP → Secure MCP Tunnel → ChatGPT (full setup and operations) |
| [docs/BACKLOG.md](docs/BACKLOG.md) | Planned improvements |
| [SECURITY.md](SECURITY.md) | Security policy and on-demand availability rationale |
| [DEPLOYMENT.local.md.example](DEPLOYMENT.local.md.example) | Operator-specific deployment notes template (copy to gitignored `DEPLOYMENT.local.md`) |

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

The connector is **on-demand**. It is not designed to run continuously. See [On-demand operation](#on-demand-operation) below.

Initial build and container creation (generic example):

```bash
cp .env.example .env
# Edit .env on the deployment host only — never commit credentials
docker build --pull -t hellozenmcp-hellozen-mcp .
docker compose up -d --no-build hellozen-mcp
```

On hosts where `docker compose build` works (Buildx >= 0.17.0), you may use `docker compose up -d --build` instead of the two-step build above.

The default compose file binds to loopback only:

```
127.0.0.1:8790:8790
```

Docker is configured with `restart: "no"`, so a host or Docker daemon reboot does **not** automatically start the connector.

For operator-specific deployment paths, copy `DEPLOYMENT.local.md.example` to `DEPLOYMENT.local.md` (gitignored).

## On-demand operation

The MCP connector is intentionally **not** a continuously running service. Its normal resting state is **STOPPED**. Starting it requires an explicit operator action. This is a deliberate security control — see [SECURITY.md](SECURITY.md).

Expected lifecycle:

```text
build/create
    ↓
STOPPED normally
    ↓
operator starts MCP
    ↓
health check
    ↓
Secure MCP Tunnel / ChatGPT session
    ↓
operator stops MCP
    ↓
STOPPED
```

### Check current state

```bash
cd /mnt/user/devconcepts/hellozenmcp
docker compose ps
```

### Start an existing container

```bash
docker compose start hellozen-mcp
```

### If the container has not yet been created

```bash
docker compose up -d --no-build hellozen-mcp
```

### Confirm healthy

```bash
docker compose ps
curl -fsS http://127.0.0.1:8790/healthz && echo
```

### Stop after the ChatGPT/HelloZen session

```bash
docker compose stop hellozen-mcp
```

Use `docker compose stop` for normal shutdown. You do **not** need `docker compose down` for routine sessions — `stop` preserves the container so the next session can use `docker compose start`.

After a Vision or Docker daemon reboot, the connector remains stopped until you explicitly start it again.

## OpenAI Secure MCP Tunnel

Do not expose this service on a public port. Connect via OpenAI Secure MCP Tunnel after local verification.

**Full setup guide:** [docs/connecting-to-chatgpt.md](docs/connecting-to-chatgpt.md) — repository preparation, Docker hardening, on-demand MCP, tunnel-client installation, `doctor` checks, ChatGPT app configuration, and operating procedures.

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
4. Start the container when needed: `docker compose start hellozen-mcp`
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
