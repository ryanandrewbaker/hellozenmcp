# HelloZen Read-Only MCP

**HelloZen MCP 1.1** — OAuth-protected MCP with Cloudflare Tunnel support. See [CHANGELOG.md](CHANGELOG.md). The **v1.0.0** baseline remains available as a rollback tag.

An unofficial, self-hosted, strictly read-only MCP connector designed for inspecting HelloZen configuration.

Use this connector with **Cursor** (HTTPS via Cloudflare Tunnel + OAuth), **ChatGPT** (via OpenAI Secure MCP Tunnel + OAuth), or MCP Inspector to review custom fields, pipelines, calendars, and workflows when planning integrations for a photography studio on HelloZen — without exposing contact data or write access.

> **Disclaimer:** This project is unofficial and is not affiliated with, endorsed by, or supported by HelloZen unless explicitly approved by the HelloZen owner. Do not use HelloZen logos or imply official partnership.

> This connector cannot create, update or delete HelloZen data. Its credential contains no write scopes, and its application transport rejects every method except GET.

## What it does

A small read-only Model Context Protocol server that exposes selected HelloZen / LeadConnector **configuration** data to trusted AI clients. The HelloZen Private Integration token remains on the server; MCP clients never receive it.

Exposes exactly four MCP tools:

| Tool | Returns |
|------|---------|
| `list_custom_fields` | Field definitions (`id`, `name`, `fieldKey`, `model`, `dataType`, `picklistOptions`) for contact and/or opportunity models — not field values stored on records |
| `list_pipelines` | Pipeline names and stage configuration (`id`, `name`, `position`) — not opportunity records |
| `list_calendars` | Calendar configuration metadata (`id`, `name`, `description`, `duration`, `status`, `timezone`, `groupId`) — not appointments or availability |
| `list_workflows` | Workflow IDs, names, and status — not enrolments, execution history, or step content |

It does **not** access contacts, conversations, appointments, opportunity records, emails, form submissions, calendar events, or workflow enrolments.

## Architecture

```text
                    OAuth Authorization Server
                           ▲           ▲
                           │           │
                     Cursor login   ChatGPT login
                           │           │
                           ▼           ▼

Cursor ──HTTPS──► Cloudflare       OpenAI ◄── ChatGPT
                  Tunnel            Tunnel
                     │                │
                     └───────┬────────┘
                             ▼
                      OAuth-protected
                       HelloZen MCP (/mcp)
                             │
                    server-side token
                             ▼
                       HelloZen API
```

### v1.1 client paths

**Cursor / external MCP clients — Cloudflare Tunnel + OAuth**

```text
Cursor
   ↓ HTTPS
Cloudflare Tunnel (transport only)
   ↓
OAuth bearer token validation
   ↓
hellozen-mcp (/mcp)
```

**ChatGPT — OpenAI Secure MCP Tunnel + OAuth**

```text
ChatGPT
   ↓
OpenAI Secure MCP Tunnel
   ↓
tunnel-client (on private host)
   ↓
OAuth bearer token validation
   ↓
hellozen-mcp (/mcp)
```

v1.1 does **not** use Cloudflare Access in front of MCP. OAuth is the single application authorization layer.

For full OAuth, Cloudflare, Cursor, and ChatGPT setup: **[docs/oauth-and-deployment.md](docs/oauth-and-deployment.md)**

### v1.0 rollback (`v1.0.0` tag)

Version 1.0 supported unauthenticated LAN Cursor access and no-auth ChatGPT tunnel access. That baseline is preserved at git tag `v1.0.0` for rollback.
## Security model (v1.1)

- HelloZen API access is **read-only** (four fixed `GET` endpoints only)
- MCP `/mcp` requires OAuth bearer tokens with `hellozen.read` on **all** network paths (LAN, Cloudflare, OpenAI tunnel)
- The HelloZen Private Integration token is **server-side only** — never supply it to MCP clients, ChatGPT, or Cursor
- Secrets live in `.env` on the deployment host; `.env` is gitignored and must never be committed
- Responses are normalized and data-minimized; logs are sanitized (no bearer tokens or Authorization headers)
- Rate limits, concurrency limits, and response size caps are enforced
- There are **no HelloZen write tools**
- OAuth is fail-closed: missing/invalid OAuth configuration prevents startup
- No runtime environment flag to disable OAuth on `/mcp`
- Cloudflare Tunnel provides transport only — not application authentication
- No LAN auth bypass, no Cloudflare Access double-auth

## Documentation

| Document | Description |
|----------|-------------|
| [CHANGELOG.md](CHANGELOG.md) | Release history |
| [docs/oauth-and-deployment.md](docs/oauth-and-deployment.md) | **v1.1:** OAuth, Cloudflare Tunnel, Cursor/ChatGPT setup, troubleshooting |
| [docs/connecting-to-chatgpt.md](docs/connecting-to-chatgpt.md) | Field guide: private MCP → Secure MCP Tunnel → ChatGPT |
| [docs/BACKLOG.md](docs/BACKLOG.md) | Planned improvements |
| [SECURITY.md](SECURITY.md) | Security policy and on-demand availability rationale |
| [DEPLOYMENT.local.md.example](DEPLOYMENT.local.md.example) | Operator-specific deployment notes template |

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

## Cursor setup (v1.1)

The canonical Cursor endpoint is your public HTTPS MCP URL:

```text
https://mcp.<your-domain>/mcp
```

Example `.cursor/mcp.json` (use environment variables for credentials — never commit secrets):

```json
{
  "mcpServers": {
    "hellozen": {
      "url": "https://mcp.example.com/mcp",
      "auth": {
        "CLIENT_ID": "${env:HELLOZEN_MCP_CURSOR_CLIENT_ID}",
        "CLIENT_SECRET": "${env:HELLOZEN_MCP_CURSOR_CLIENT_SECRET}",
        "scopes": ["hellozen.read"]
      }
    }
  }
}
```

Register redirect URIs on your authorization server per [Cursor's official MCP OAuth documentation](https://cursor.com/docs/mcp.md):

| Surface | Redirect URI |
|---------|--------------|
| Cursor Desktop | `http://localhost:8787/callback` |
| Cursor web / Cursor Agents | `https://www.cursor.com/agents/mcp/oauth/callback` |

Full setup: [docs/oauth-and-deployment.md](docs/oauth-and-deployment.md)

### v1.0 rollback (unauthenticated LAN)

Tag `v1.0.0` supported direct LAN HTTP without OAuth. That pattern is no longer the v1.1 default.

## ChatGPT setup (v1.1)

ChatGPT continues to use the **OpenAI Secure MCP Tunnel** with **OAuth** at the MCP layer. Do not point ChatGPT at the Cloudflare public hostname.

High-level operator sequence:

```text
1. Configure OAuth env vars and start hellozen-mcp
2. Verify MCP health (/healthz) and 401 on unauthenticated /mcp
3. Start the OpenAI tunnel-client on the Vision host
4. Point tunnel upstream at a reachable MCP address (127.0.0.1:8790 vs LAN IP mismatch causes 502)
5. Verify tunnel readiness (/readyz)
6. Configure ChatGPT custom MCP: Tunnel connection + OAuth client
7. Complete browser OAuth when prompted (scope: hellozen.read)
```

**Full guides:**

- [docs/connecting-to-chatgpt.md](docs/connecting-to-chatgpt.md) — tunnel operations
- [docs/oauth-and-deployment.md](docs/oauth-and-deployment.md) — OAuth + ChatGPT reconnection steps

Useful verification commands (replace addresses as appropriate):

```bash
docker compose ps
curl -fsS http://<reachable-mcp-address>:8790/healthz && echo
curl -fsS http://127.0.0.1:8791/readyz && echo
```

The tunnel upstream URL must match an address where the MCP is **actually listening**. A healthy Docker container does not guarantee ChatGPT connectivity if the tunnel points at the wrong interface — see [Troubleshooting](#troubleshooting).

## Docker networking (v1.0)

The committed `compose.yml` binds the MCP port to **loopback only**:

```yaml
ports:
  - "127.0.0.1:8790:8790"
```

This is appropriate when:

- only the host-local `tunnel-client` reaches the MCP at `http://127.0.0.1:8790/mcp`, and
- Cursor is not used from another machine on the LAN

For **Cursor LAN access**, the operator may change the binding to publish on the host LAN address, for example:

```yaml
ports:
  - "192.168.50.234:8790:8790"
```

When that is done, the OpenAI tunnel upstream must use an address that reaches **that** listener — for example `http://192.168.50.234:8790/mcp` — not `http://127.0.0.1:8790/mcp` unless the tunnel process shares the same network namespace as the listener.

| Binding | Cursor from LAN | Tunnel upstream `127.0.0.1:8790` |
|---------|-----------------|-----------------------------------|
| `127.0.0.1:8790:8790` | No | Yes (host tunnel-client) |
| `<LAN-IP>:8790:8790` | Yes | Use `<LAN-IP>:8790` instead |

Document binding overrides in gitignored `DEPLOYMENT.local.md`. Do not change `compose.yml` in this repository merely to match a single deployment unless that becomes the agreed default.

## Troubleshooting

### Symptom: ChatGPT returns `502`; tunnel `/readyz` returns `503`; Docker shows healthy

`docker compose ps` may report the MCP container as **healthy** while ChatGPT still cannot reach the service.

**Likely cause:** tunnel upstream points to a different host interface than Docker is listening on.

Example mismatch:

```text
Docker listening:  192.168.50.234:8790
Tunnel upstream:   http://127.0.0.1:8790/mcp
```

**Fix:** configure the tunnel upstream URL to an address where the MCP is actually reachable from the process running `tunnel-client`. Verify with:

```bash
curl -fsS http://<upstream-host>:8790/healthz && echo
```

from the same host that runs the tunnel.

Do not expose the MCP on the public Internet without authentication.

### Symptom: Cursor cannot connect

- Confirm the MCP is started (`docker compose ps`)
- Confirm port `8790` is published on an interface reachable from your workstation
- Confirm `curl` to `http://<host>:8790/healthz` succeeds from the Cursor machine

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
