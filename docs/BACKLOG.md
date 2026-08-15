# Backlog

Planned improvements for HelloZen Read-Only MCP. Items are ordered by priority within each section unless noted otherwise.

**v1.0 baseline is tagged `v1.0.0`.** Post-v1.0 private-operations work is tracked below.

---

## Operations (v1.1 focus)

### 1. Private host publish configuration

**Status:** In progress (v1.1)  
**Priority:** High

Make Docker host publish address explicit via `HELLOZEN_MCP_PUBLISH_HOST` (default `127.0.0.1`) so trusted-LAN deployments do not require editing committed `compose.yml`.

### 2. MCP + tunnel session lifecycle

**Status:** In progress (v1.1)  
**Priority:** High

`scripts/hellozen-session` for repeatable `status` / `start` / `stop` / `doctor` without duplicate `tunnel-client` / bundled `cloudflared` processes. See [connecting-to-chatgpt.md](connecting-to-chatgpt.md) section 18.

---

## Documentation

### 3. Docker-in-Docker tunnel arrangement

**Status:** Idea  
**Priority:** Low

Expand README and field guide with a worked example for tunnel-client running in Docker on a private network with `http://hellozen-mcp:8790/mcp` (no host-published MCP port).

---

## Deferred — authenticated or public access

The private no-auth MCP behind trusted LAN + OpenAI Secure MCP Tunnel remains the **intentional** architecture.

Revisit application-layer authentication or public HTTPS ingress **only if** requirements change, for example:

- Cursor access from outside the trusted LAN
- Third-party or untrusted MCP clients
- Record-level or write-capable tools
- Deliberate public Internet exposure

A historical OAuth + Cloudflare experiment exists on branch `feat/oauth-cloudflare-ingress` (draft PR #6, not merged). It is **not** the active direction.

**Do not port-forward TCP 8790 to the Internet.**
