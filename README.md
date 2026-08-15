# HelloZen Read-Only MCP

**HelloZen MCP 2.0** — configuration auditor release (`v2.0.0` on branch `feat/configuration-auditor`). See [CHANGELOG.md](CHANGELOG.md) and [docs/configuration-auditor.md](docs/configuration-auditor.md). Tag `v1.1.1` remains the prior stable baseline.

An unofficial, self-hosted, strictly read-only MCP connector designed for inspecting HelloZen configuration.

Use this connector with **Cursor** (trusted LAN), **ChatGPT** (via OpenAI Secure MCP Tunnel), or MCP Inspector to review custom fields, pipelines, calendars, and workflows when planning integrations for a photography studio on HelloZen — without exposing contact data or write access.

> **Disclaimer:** This project is unofficial and is not affiliated with, endorsed by, or supported by HelloZen unless explicitly approved by the HelloZen owner. Do not use HelloZen logos or imply official partnership.

> This connector cannot create, update or delete HelloZen data. Its credential contains no write scopes, and its application transport rejects every method except GET.

## What it does

A small read-only Model Context Protocol server that exposes selected HelloZen / LeadConnector **configuration** data to trusted AI clients. The HelloZen Private Integration token remains on the server; MCP clients never receive it.

Exposes **13 read-only MCP tools** (four original inventory tools preserved, plus auditor tools):

| Tool | Returns |
|------|---------|
| `list_custom_fields` | Field definitions (`id`, `name`, `fieldKey`, `model`, `dataType`, `picklistOptions`) — not field values on records |
| `list_pipelines` | Pipeline names and stage configuration — not opportunity records |
| `list_calendars` | Calendar inventory metadata — not appointments |
| `list_workflows` | Workflow IDs, names, and status — not enrolments or execution history |
| `list_tags` | Tag inventory for dependency resolution |
| `list_users` | Team member display names for configuration resolution (no emails) |
| `list_forms` | Form inventory only — no submissions |
| `get_workflow` | Workflow detail + dependency graph when supported by upstream API |
| `get_calendar` | Calendar configuration + availability schedule when exposed |
| `audit_configuration_dependencies` | Reverse-reference index across scanned configuration |
| `audit_configuration` | Structural audit: duplicates, broken refs, legacy candidates |
| `get_configuration_snapshot` | Machine-readable configuration export |
| `get_capabilities` | Visibility matrix and API coverage report |

Every tool response includes freshness metadata (`meta.source`, `meta.fetchedAt`, `meta.cacheAgeMs`). Pass `fresh: true` to bypass cache. See [docs/configuration-auditor.md](docs/configuration-auditor.md).

It does **not** access contacts, conversations, appointments, opportunity records, emails, form submissions, calendar events, or workflow enrolments.

## Architecture

```text
                 trusted private LAN (no Internet route to MCP)

Cursor (workstation) ──────────────────────┐
                                           ▼
                              http://<host>:8790/mcp
                                           ▲
ChatGPT ──► OpenAI Secure MCP Tunnel ──► tunnel-client (private host)
                                           │
                                           ▼
                              hellozen-mcp (Docker, on-demand)
                                           │
                              server-side read-only token
                                           ▼
                                   HelloZen API (GET only)
```

**There is no public HelloZen MCP endpoint. Do not port-forward TCP 8790.**

### Client paths

**Cursor — trusted private LAN**

```text
Cursor
   ↓
http://<host-lan-ip>:8790/mcp
   ↓
hellozen-mcp
```

**ChatGPT — OpenAI Secure MCP Tunnel**

```text
ChatGPT
   ↓
OpenAI Secure MCP Tunnel
   ↓
tunnel-client (on private host)
   ↓
http://<reachable-mcp-address>:8790/mcp
   ↓
hellozen-mcp
```

On a typical Vision deployment, Cursor and `tunnel-client` use the **same** private host address (`HELLOZEN_MCP_PUBLISH_HOST`). Both clients may stay connected to one running MCP listener concurrently.

This connector does **not** provide a public MCP endpoint, OAuth resource server, or general Internet-facing API.

## Security model (v1.1)

- HelloZen API access is **read-only** (four fixed `GET` endpoints only)
- The HelloZen Private Integration token is **server-side only** — never supply it to MCP clients, ChatGPT, or Cursor
- Secrets live in `.env` on the deployment host; `.env` is gitignored and must never be committed
- Responses are normalized and data-minimized; logs are sanitized
- Rate limits, concurrency limits, and response size caps are enforced
- There are **no HelloZen write tools**
- Assumes **trusted private LAN or OpenAI Secure MCP Tunnel** access to the MCP HTTP endpoint
- Does **not** implement OAuth or a public Internet-facing MCP endpoint
- The LAN HTTP endpoint is **not** suitable for public Internet exposure

For on-demand availability and defence-in-depth rationale, see [SECURITY.md](SECURITY.md).

## Documentation

| Document | Description |
|----------|-------------|
| [CHANGELOG.md](CHANGELOG.md) | Release history (`v1.1.0`, `v1.0.0` rollback) |
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

## Tested against
- ChatGPT MCP connectivity using internal OpenAI Tunnel
- Cursor local unauthenticated local network access

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

The default compose file publishes on loopback only via `HELLOZEN_MCP_PUBLISH_HOST` (default `127.0.0.1`):

```text
${HELLOZEN_MCP_PUBLISH_HOST:-127.0.0.1}:8790:8790
```

Set `HELLOZEN_MCP_PUBLISH_HOST` in `.env` on the deployment host for trusted-LAN access — do not edit `compose.yml` and do not use `0.0.0.0`.

Docker is configured with `restart: "no"`, so a host or Docker daemon reboot does **not** automatically start the connector.

For operator-specific deployment paths, copy `DEPLOYMENT.local.md.example` to `DEPLOYMENT.local.md` (gitignored).

## On-demand operation

The MCP connector is intentionally **not** a continuously running service. Its normal resting state is **STOPPED**. Starting it requires an explicit operator action. This is a deliberate security control — see [SECURITY.md](SECURITY.md).

Expected lifecycle:

```text
STOPPED normally
    ↓
./scripts/hellozen-session start
    ↓
MCP healthy + tunnel ready (when configured)
    ↓
Cursor and/or ChatGPT inspection session
    ↓
./scripts/hellozen-session stop
    ↓
STOPPED
```

### Session commands (recommended)

```bash
./scripts/hellozen-session status   # MCP + tunnel state, no secrets
./scripts/hellozen-session start    # start MCP, then tunnel if not ready
./scripts/hellozen-session stop     # stop owned tunnel, then MCP
./scripts/hellozen-session doctor   # tunnel-client diagnostics
```

npm aliases: `npm run session:status`, `session:start`, `session:stop`, `session:doctor`.

### Manual MCP commands

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

## Cursor setup

Cursor can connect directly to the MCP over Streamable HTTP on a **trusted LAN**.

Add a server entry to your Cursor MCP configuration (for example `~/.cursor/mcp.json` or project `.cursor/mcp.json`). Use the **URL** transport — no HTTP authentication headers are required:

```json
{
  "mcpServers": {
    "hellozen": {
      "url": "http://192.168.50.234:8790/mcp"
    }
  }
}
```

Replace `192.168.50.234` with the LAN address of the host running `hellozen-mcp`. That address is **deployment-specific** — it is shown here only as the current Vision host example, not as a portable default.

Before relying on Cursor:

1. Start the MCP container: `docker compose start hellozen-mcp`
2. Confirm health from a machine that can reach the host:

```bash
curl -fsS http://<host-lan-ip>:8790/healthz && echo
```

Cursor direct access requires Docker (or the Node process) to publish port `8790` on an interface reachable from your workstation — see [Docker networking](#docker-networking-v10).

## ChatGPT setup

ChatGPT connects through the **OpenAI Secure MCP Tunnel**. High-level operator sequence:

```text
1. Start hellozen-mcp
2. Verify MCP health (/healthz)
3. Start the OpenAI tunnel-client on the Vision host
4. Point the tunnel upstream at an MCP address reachable from that host
5. Verify tunnel readiness (/readyz on the tunnel health port)
6. Configure the ChatGPT custom MCP app (Tunnel connection, no authentication)
```

**Full setup guide:** [docs/connecting-to-chatgpt.md](docs/connecting-to-chatgpt.md)

Useful verification commands (replace addresses as appropriate):

```bash
docker compose ps
curl -fsS http://<reachable-mcp-address>:8790/healthz && echo
curl -fsS http://127.0.0.1:8791/readyz && echo
```

The tunnel upstream URL must match an address where the MCP is **actually listening**. A healthy Docker container does not guarantee ChatGPT connectivity if the tunnel points at the wrong interface — see [Troubleshooting](#troubleshooting).

## Docker networking

Host publish address (`HELLOZEN_MCP_PUBLISH_HOST`) controls which host interface receives MCP traffic. This is **distinct** from `HELLOZEN_MCP_BIND_HOST` (in-container listen address, default `0.0.0.0`).

Committed default (safe for local dev and host-only tunnel):

```yaml
ports:
  - "${HELLOZEN_MCP_PUBLISH_HOST:-127.0.0.1}:8790:8790"
```

**Vision / trusted LAN** — set in gitignored `.env`:

```text
HELLOZEN_MCP_PUBLISH_HOST=192.168.50.234
```

Then use the same endpoint for Cursor and tunnel-client:

```text
http://192.168.50.234:8790/mcp
```

| `HELLOZEN_MCP_PUBLISH_HOST` | Cursor from LAN | tunnel-client upstream |
|-----------------------------|-----------------|------------------------|
| `127.0.0.1` (default) | No | `http://127.0.0.1:8790/mcp` |
| `<private LAN IP>` | Yes | `http://<private LAN IP>:8790/mcp` |

**Do not** set publish host to `0.0.0.0`. **Do not** port-forward TCP 8790 to the Internet.

Document deployment-specific values in gitignored `DEPLOYMENT.local.md`.

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

### Option A — tunnel client on the host (Vision default)

Publish MCP on the private LAN IP. Configure the tunnel upstream and Cursor to the **same** URL, for example:

```text
http://192.168.50.234:8790/mcp
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
| `HELLOZEN_MCP_PUBLISH_HOST` | Docker host publish address (default `127.0.0.1`; use private LAN IP on Vision) |
| `HELLOZEN_MCP_BIND_HOST` | In-container bind address (default `0.0.0.0`) |
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
