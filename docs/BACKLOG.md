# Backlog

Planned improvements for HelloZen Read-Only MCP.

**v1.0.0** is the unauthenticated baseline rollback tag. **v1.1** (branch `feat/oauth-cloudflare-ingress`) implements OAuth + Cloudflare Tunnel — see [oauth-and-deployment.md](oauth-and-deployment.md).

---

## Operations

### 1. Tunnel start/stop wrapper

**Status:** Idea  
**Priority:** Medium

Improve on-demand tunnel lifecycle so start/stop is repeatable and does not leave orphaned `tunnel-client` / bundled `cloudflared` processes. See [connecting-to-chatgpt.md](connecting-to-chatgpt.md) section 18.

---

## Documentation

### 2. Docker-in-Docker tunnel arrangement

**Status:** Idea  
**Priority:** Low

Expand README and field guide with a worked example for tunnel-client running in Docker on a private network with `http://hellozen-mcp:8790/mcp` (no host-published MCP port).

---

## Future security

### 3. `hellozen.write` scope and write tools

**Status:** Not planned for v1.1  
**Priority:** Low

v1.1 establishes the OAuth resource-server layer with `hellozen.read` only. Write tools would require a separate scope and explicit security review.

### 4. SDK top-level `securitySchemes` in `registerTool`

**Status:** Watch SDK releases  
**Priority:** Low

SDK 1.30 exposes tool OAuth metadata via `_meta.securitySchemes`. Newer OpenAI documentation shows top-level `securitySchemes`. Upgrade when available without breaking 1.30 consumers.
