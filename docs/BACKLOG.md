# Backlog

Planned improvements for HelloZen Read-Only MCP. Items are ordered by priority within each section unless noted otherwise.

**v1.0 baseline is tagged `v1.0.0`.** Items below are post-v1.0 work — not implemented in the baseline release.

---

## Security

### 1. OAuth for the MCP endpoint

**Status:** Planned (post-v1.0)  
**Priority:** High

The v1.0 deployment uses a deliberately **no-auth** MCP server behind OpenAI Secure MCP Tunnel and loopback-only (or trusted LAN) networking. That pattern is documented in [connecting-to-chatgpt.md](connecting-to-chatgpt.md) (section 15). `tunnel-client doctor` can pass when OAuth metadata routes return `404`, which is acceptable for v1.0 but is not the only long-term option.

**Goal:** Add OAuth 2.1 (or OAuth-protected-resource metadata) at the MCP HTTP layer as defence in depth — especially when combined with Cloudflare Tunnel or broader client access.

**Scope considerations:**

* MCP endpoint authentication separate from HelloZen Private Integration credentials
* Support OAuth discovery endpoints expected by tunnel-client / MCP clients where appropriate
* Preserve read-only tool surface — OAuth must not imply write access to HelloZen
* Keep secrets server-side; no tokens in Git, images, or documentation
* Maintain on-demand operation model (service and tunnel stopped by default)
* Document migration path from v1.0 no-auth deployment
* Add tests for auth middleware, metadata routes, and failure modes (invalid token, expired session)

**Out of scope for this item:**

* Broadening HelloZen API scopes or adding write-capable tools
* Public internet exposure without additional controls

### 2. Cloudflare Tunnel + canonical HTTPS MCP endpoint

**Status:** Planned (post-v1.0)  
**Priority:** High

Provide a secure HTTPS MCP endpoint usable by Cursor and other external MCP clients without LAN dependency, likely combined with OAuth 2.1 from item 1.

**Out of scope for v1.0.**

---

## Operations

### 3. Tunnel start/stop wrapper

**Status:** Idea  
**Priority:** Medium

Improve on-demand tunnel lifecycle so start/stop is repeatable and does not leave orphaned `tunnel-client` / bundled `cloudflared` processes. See [connecting-to-chatgpt.md](connecting-to-chatgpt.md) section 18.

---

## Documentation

### 4. Docker-in-Docker tunnel arrangement

**Status:** Idea  
**Priority:** Low

Expand README and field guide with a worked example for tunnel-client running in Docker on a private network with `http://hellozen-mcp:8790/mcp` (no host-published MCP port).
