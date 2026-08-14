# OAuth, Cloudflare Tunnel, and v1.1 deployment

HelloZen MCP **v1.1** adds OAuth 2.1 resource-server protection for `/mcp` while preserving the OpenAI Secure MCP Tunnel path for ChatGPT.

`v1.0.0` remains the rollback baseline (unauthenticated LAN access). v1.1 requires bearer tokens on every `/mcp` request — including LAN, Cloudflare, and OpenAI tunnel paths.

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
                       HelloZen MCP
                             │
                    server-side token
                             ▼
                          HelloZen
```

Neither tunnel replaces OAuth:

| Layer | Purpose |
|-------|---------|
| **Cloudflare Tunnel** | General external HTTPS ingress (transport only) |
| **OpenAI Secure MCP Tunnel** | Private OpenAI-specific MCP transport |
| **OAuth** | Application authorization to invoke MCP tools |

Cloudflare Access is **not** used. There is a single application authorization model: MCP OAuth.

## v1.0 vs v1.1 access patterns

### v1.0 (`v1.0.0` tag)

```text
Cursor → trusted LAN → MCP (no OAuth)
ChatGPT → OpenAI Secure MCP Tunnel → MCP (no OAuth)
```

### v1.1 (this branch)

```text
Cursor / external clients → HTTPS → Cloudflare Tunnel → OAuth → MCP
ChatGPT → OpenAI Secure MCP Tunnel → OAuth → MCP
```

## OAuth resource server behaviour

HelloZen MCP is an **OAuth 2.1 resource server only**. It:

- accepts bearer access tokens
- verifies JWT signatures via the authorization server's JWKS
- enforces `hellozen.read` on `/mcp`
- publishes RFC 9728 protected-resource metadata
- returns standards-compliant `WWW-Authenticate` challenges

It does **not**:

- host user passwords or login UI
- issue production access tokens
- store Cursor/ChatGPT OAuth client secrets
- expose `HELLOZEN_MCP_READONLY_TOKEN` to clients

### SDK primitives used

From `@modelcontextprotocol/sdk@1.30.0`:

- `mcpAuthMetadataRouter` — protected-resource metadata + AS metadata mirror
- `getOAuthProtectedResourceMetadataUrl` — path-aware metadata URL
- `requireBearerAuth` — bearer validation, 401/403, `WWW-Authenticate`
- `OAuthTokenVerifier` — implemented by `JwtAccessTokenVerifier`

JWT validation uses [`jose`](https://github.com/panva/jose) with remote or local JWKS.

### Tool metadata note

SDK 1.30 exposes tool OAuth requirements via `registerTool` `_meta.securitySchemes`. OpenAI's current documentation shows top-level `securitySchemes` in newer SDK examples. Runtime enforcement happens at the HTTP layer via `requireBearerAuth`; tool metadata is advisory for clients such as ChatGPT.

## Authorization server requirements (external configuration)

You must provision a standards-compliant OAuth/OIDC authorization server. The MCP server is provider-neutral — configure it via discovery metadata.

### Required capabilities

| Capability | Required |
|------------|----------|
| Authorization Code + PKCE (S256) | Yes |
| OIDC/OAuth discovery metadata | Yes |
| JWKS endpoint (JWT access tokens) | Yes |
| Resource/audience targeting compatible with MCP | Yes |
| Scope `hellozen.read` | Yes |
| Redirect URI registration for Cursor + ChatGPT clients | Yes |

### Recommended configuration

```text
HELLOZEN_MCP_RESOURCE_URL=https://mcp.<your-domain>/mcp
HELLOZEN_MCP_OAUTH_ISSUER=https://auth.<your-domain>
HELLOZEN_MCP_OAUTH_AUDIENCE=https://mcp.<your-domain>/mcp
HELLOZEN_MCP_REQUIRED_SCOPE=hellozen.read
```

On startup the MCP server:

1. fetches `/.well-known/openid-configuration` (then `/.well-known/oauth-authorization-server` as fallback)
2. validates issuer, endpoints, and JWKS URI
3. fails closed if OAuth is enabled but discovery/validation fails

### Client registration strategy (v1.1)

Use **predefined/static OAuth clients** (not DCR/CIMD as a hard requirement):

| Client name | Used by |
|-------------|---------|
| HelloZen MCP - Cursor | Cursor Desktop / Cursor Cloud |
| HelloZen MCP - ChatGPT | ChatGPT custom MCP app |

Register redirect URIs from current official documentation:

**Cursor (2026 docs)**

- Desktop: `http://localhost:8787/callback` (any localhost port may work; `/callback` path is standard)
- Cursor web/agents: `https://www.cursor.com/agents/mcp/oauth/callback`

**ChatGPT**

- Inspect the redirect URI shown in the ChatGPT MCP connector UI when configuring OAuth — register that exact URI on your authorization server. Do not guess.

Request scope `hellozen.read`. Add `offline_access` only if your authorization server uses it for refresh tokens.

**Never commit** client secrets to git, Docker images, README, or `.cursor/mcp.json`. Use environment variable interpolation.

## Environment variables

See [.env.example](../.env.example). Key values:

| Variable | Purpose |
|----------|---------|
| `HELLOZEN_MCP_AUTH_ENABLED` | `true` in production (default) |
| `HELLOZEN_MCP_ALLOW_AUTH_DISABLED` | Second gate; required with `AUTH_ENABLED=false` (tests/dev only) |
| `HELLOZEN_MCP_RESOURCE_URL` | Canonical MCP resource identity |
| `HELLOZEN_MCP_OAUTH_ISSUER` | External authorization server issuer |
| `HELLOZEN_MCP_OAUTH_AUDIENCE` | Token audience (defaults to resource URL) |
| `HELLOZEN_MCP_REQUIRED_SCOPE` | `hellozen.read` |
| `HELLOZEN_MCP_OAUTH_JWKS_URI` | Optional override if discovery omits `jwks_uri` |
| `CLOUDFLARE_TUNNEL_TOKEN` | Remotely managed tunnel token (never commit) |

## Docker deployment

### MCP service (unchanged on-demand model)

```bash
docker compose up -d --no-build hellozen-mcp
curl -fsS http://127.0.0.1:8790/healthz
```

Loopback binding `127.0.0.1:8790:8790` is preserved for OpenAI tunnel-client reachability from the Vision host.

### Cloudflare Tunnel (after OAuth verified locally)

```bash
# Configure tunnel ingress in Cloudflare Zero Trust:
# public hostname https://mcp.<your-domain>/mcp → http://hellozen-mcp:8790

docker compose -f compose.yml -f compose.cloudflare.yml --profile cloudflare up -d
```

`cloudflared` connects over the private Docker network `hellozen-mcp-net` to `http://hellozen-mcp:8790`. No router port-forward or Cloudflare Access policies.

**Do not** publish the Cloudflare hostname until OAuth is verified locally.

## Cursor setup (v1.1)

Canonical endpoint:

```text
https://mcp.<your-domain>/mcp
```

Example `.cursor/mcp.json` (use env interpolation for secrets):

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

Notes:

- `CLIENT_SECRET` is optional for public PKCE clients
- Cursor uses authorization code + PKCE (not client credentials), even when a secret is present
- Open **Cursor Settings → Tools & MCP** and click **Connect** to complete browser OAuth

## ChatGPT setup (v1.1)

ChatGPT continues to use the **OpenAI Secure MCP Tunnel** — do not point ChatGPT at the Cloudflare public hostname.

### Operator sequence

1. Start `hellozen-mcp` with OAuth env vars configured
2. Verify local health: `curl -fsS http://127.0.0.1:8790/healthz`
3. Verify unauthenticated MCP is rejected:
   ```bash
   curl -i -X POST http://127.0.0.1:8790/mcp -H 'Content-Type: application/json' -d '{}'
   # Expect 401 + WWW-Authenticate
   ```
4. Start OpenAI `tunnel-client` targeting a **reachable** upstream (see [connecting-to-chatgpt.md](connecting-to-chatgpt.md))
5. Verify tunnel readiness: `curl -fsS http://127.0.0.1:8791/readyz`
6. Verify OAuth metadata through tunnel:
   ```bash
   curl -fsS http://127.0.0.1:8791/.well-known/oauth-protected-resource/mcp
   ```
7. In ChatGPT → Settings → Connectors → configure custom MCP:
   - Connection: **OpenAI Secure MCP Tunnel** (not public URL)
   - Authentication: OAuth with your predefined ChatGPT client
   - Scope: `hellozen.read`
8. Complete the browser OAuth flow when ChatGPT prompts
9. Confirm four tools appear and a tool call succeeds

### Manual ChatGPT reconnection checklist

If reconnecting after v1.1 upgrade:

1. Ensure MCP container is running with OAuth enabled
2. Ensure tunnel-client upstream matches a reachable MCP address (`127.0.0.1:8790` vs Docker LAN IP mismatch causes 502/503)
3. Remove any v1.0 "no authentication" connector configuration
4. Re-authorize OAuth in ChatGPT when prompted
5. Confirm `hellozen.read` scope was granted

## Troubleshooting

| Symptom | Likely cause | Check |
|---------|--------------|-------|
| MCP returns 401 immediately | OAuth working; client not authenticated yet | `WWW-Authenticate`, protected-resource metadata |
| OAuth succeeds but MCP still 401 | issuer/audience/signature/expiry mismatch | token claims vs `HELLOZEN_MCP_OAUTH_*` env |
| OAuth succeeds but MCP 403 | missing `hellozen.read` | authorization server scope grant |
| Cursor works, ChatGPT does not | tunnel/upstream/OAuth client for ChatGPT | tunnel `/readyz`, redirect URI, resource URL |
| ChatGPT works, Cursor does not | Cloudflare/public hostname/Cursor client | tunnel token, Cursor callback URI, `mcp.json` |
| Public hostname 502 | cloudflared origin misconfigured | `hellozen-mcp:8790` on Docker network, MCP health |

Do not disable OAuth as a diagnostic shortcut.

## Security regression checklist

Before deploying:

- [ ] No secrets in git diff
- [ ] No auth bypass by network path
- [ ] No Cloudflare Access configuration
- [ ] No permissive CORS
- [ ] `HELLOZEN_MCP_READONLY_TOKEN` remains server-side only
- [ ] Unauthenticated `/mcp` returns 401
- [ ] Protected-resource metadata is public; `/mcp` is not
