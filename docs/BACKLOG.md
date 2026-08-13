# Backlog

Planned improvements for HelloZen Read-Only MCP. Items are ordered by priority within each section unless noted otherwise.

---

## Security

### 1. OAuth for the MCP endpoint

**Status:** Planned  
**Priority:** High

The current deployment uses a deliberately **no-auth** MCP server behind OpenAI Secure MCP Tunnel and loopback-only networking. That pattern is documented in [connecting-to-chatgpt.md](connecting-to-chatgpt.md) (section 15). `tunnel-client doctor` can pass when OAuth metadata routes return `404`, which is acceptable for the present architecture but is not the only long-term option.

**Goal:** Add optional OAuth (or OAuth-protected-resource metadata) at the MCP HTTP layer as defence in depth — especially if the deployment model changes (broader network exposure, additional clients, or platform requirements).

**Scope considerations:**

* MCP endpoint authentication separate from HelloZen Private Integration credentials
* Support OAuth discovery endpoints expected by tunnel-client / MCP clients where appropriate
* Preserve read-only tool surface — OAuth must not imply write access to HelloZen
* Keep secrets server-side; no tokens in Git, images, or documentation
* Maintain on-demand operation model (service and tunnel stopped by default)
* Document migration path from no-auth + private tunnel to OAuth-enabled deployment
* Add tests for auth middleware, metadata routes, and failure modes (invalid token, expired session)

**Out of scope for this item:**

* Broadening HelloZen API scopes or adding write-capable tools
* Public internet exposure without additional controls
* Replacing Secure MCP Tunnel with a public reverse proxy

**Acceptance criteria (draft):**

* [ ] Design document for OAuth model (resource server vs authorization server placement)
* [ ] Configurable enable/disable for local dev and MCP Inspector
* [ ] Protected `/mcp` when OAuth enabled; health endpoint behaviour documented
* [ ] Updated field guide and SECURITY.md
* [ ] No regression to existing read-only transport and four-tool limit

---

## Operations

### 2. Tunnel start/stop wrapper

**Status:** Idea  
**Priority:** Medium

Improve on-demand tunnel lifecycle so start/stop is repeatable and does not leave orphaned `tunnel-client` / bundled `cloudflared` processes. See [connecting-to-chatgpt.md](connecting-to-chatgpt.md) section 18.

---

## Documentation

### 3. Docker-in-Docker tunnel arrangement

**Status:** Idea  
**Priority:** Low

Expand README and field guide with a worked example for tunnel-client running in Docker on a private network with `http://hellozen-mcp:8790/mcp` (no host-published MCP port).
