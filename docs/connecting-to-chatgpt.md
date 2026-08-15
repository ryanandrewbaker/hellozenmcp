# Connecting HelloZen Read-Only MCP to ChatGPT

> **Status:** Implementation notes / field guide  
> **Purpose:** Describe one successful pattern for connecting this private, self-hosted MCP server to ChatGPT without publishing the MCP endpoint to the internet.
>
> This is **not authoritative OpenAI product documentation**. ChatGPT, Developer Mode, Secure MCP Tunnel, account entitlements, UI labels, tunnel-client configuration, and deployment workflows may change. Treat this as a practical reference based on a working implementation and check current platform documentation when reproducing it.

## 1. What we were trying to achieve

The goal was to let ChatGPT inspect HelloZen configuration through MCP while preserving a strict security boundary.

The resulting architecture was:

```text
ChatGPT
   ↓
OpenAI custom MCP app / Developer Mode
   ↓
OpenAI Secure MCP Tunnel
   ↓
tunnel-client on private server
   ↓
http://127.0.0.1:<port>/mcp
   ↓
HelloZen Read-Only MCP
   ↓
restricted HelloZen / LeadConnector API
```

The MCP endpoint itself was **never published through a public reverse proxy, Cloudflare public route, Nginx Proxy Manager, or public host port**.

The server remained reachable only from localhost on the private host.

---

## 2. Security decisions made before deployment

The connector was deliberately designed as a closed, read-only surface rather than a general API proxy.

For this implementation:

* a dedicated HelloZen Private Integration token was created
* the token had read-only scopes only
* the MCP server exposed a small fixed set of tools
* the upstream HTTP transport allowed only `GET`
* upstream origins and endpoints were fixed in code
* responses were normalized and data-minimized
* logs were sanitized
* request and tool rate limits were applied
* concurrency and response sizes were bounded
* the Docker container ran as a non-root user
* the container filesystem was read-only
* Linux capabilities were dropped
* `no-new-privileges` was enabled
* the MCP host port was bound only to `127.0.0.1`
* secrets were stored only on the private server
* secrets were never copied into ChatGPT, Cursor, Git, Docker images, or documentation

The design principle was:

> Expose the minimum capability required for the investigation, rather than giving an AI interface access to a general-purpose API client.

---

## 3. Prepare the repository safely

Before making the source repository public, we verified that deployment credentials could not enter Git accidentally.

The project kept its real environment file outside version control:

```text
.env
```

and included only a placeholder:

```text
.env.example
```

Before the first commit we verified:

```bash
git check-ignore -v .env
```

and:

```bash
git ls-files --error-unmatch .env
```

The real `.env` had to be:

* ignored
* untracked
* absent from the staged commit

### Secret scanning

We also ran Gitleaks against the staged changes before publishing.

A useful lesson from this setup was that scanning the entire working tree can legitimately find the local deployment `.env`, because secret scanners do not necessarily interpret `.gitignore` as "do not inspect this".

The meaningful pre-push gate was therefore the **staged Git content**.

Example:

```bash
gitleaks git \
  --pre-commit \
  --staged \
  --config .gitleaks.toml \
  --redact \
  --no-banner
```

The result had to be:

```text
no leaks found
```

### Tool-version caveat

During this setup, Gitleaks `8.30.1` had a known detection regression, so `8.30.0` was used instead.

Do not blindly copy that version pin in the future. Check the currently supported release and known issues first.

---

## 4. Use Git as the deployment source

Instead of copying the project directory manually to the server, the repository was pushed to GitHub and cloned onto the private host.

This made deployment repeatable:

```text
developer machine
    ↓
GitHub
    ↓
private server
```

The server checkout lived at:

```text
/mnt/user/devconcepts/hellozenmcp
```

A normal update therefore became:

```bash
cd /mnt/user/devconcepts/hellozenmcp
git pull
```

Secrets were **not** stored in Git and were therefore not transferred this way.

---

## 5. Create deployment secrets directly on the private server

The real environment file was created directly on the server.

Example pattern:

```bash
cd /path/to/project

install -m 600 .env.example .env
nano .env
```

Only the operator entered the actual token and location identifiers.

After saving:

```bash
stat -c '%a %U:%G %n' .env
```

The expected mode was:

```text
600
```

The secret values themselves should never be printed as part of routine verification.

Also verify:

```bash
git status --short
```

The `.env` file should not appear.

---

## 6. Build the hardened Docker service

The Compose service bound the MCP port only to localhost:

```yaml
ports:
  - "127.0.0.1:8790:8790"
```

This is materially different from:

```yaml
ports:
  - "8790:8790"
```

The latter may expose the service on the host's network interfaces.

The runtime also retained hardening controls such as:

```yaml
read_only: true

cap_drop:
  - ALL

security_opt:
  - no-new-privileges:true
```

### Host-specific build compatibility

On the server used for this implementation:

```text
Docker Engine: 27.0.3
Docker Compose: v5.1.2
Docker Buildx: v0.15.1
```

`docker compose build` required a newer Buildx version.

Rather than modifying the server's Docker installation, the image was built directly:

```bash
docker build --pull -t hellozenmcp-hellozen-mcp .
```

and started using:

```bash
docker compose up -d --no-build hellozen-mcp
```

This is a deployment-specific workaround, not a general MCP requirement.

---

## 7. Verify the MCP service locally first

Before adding any tunnel, verify that the local service itself is healthy.

Example:

```bash
docker compose ps
```

and:

```bash
curl -fsS http://127.0.0.1:8790/healthz && echo
```

The MCP server was also given a purpose-built verification command that exercised every allowed upstream configuration resource.

In this implementation the hardened runtime image did not contain development tooling such as `tsx`, so the compiled verifier was run directly:

```bash
docker exec hellozen-mcp node dist/cli/verify-hellozen.js
```

Only after all expected upstream resources were accessible did we continue to the OpenAI connection.

---

## 8. Make the MCP service on-demand

Initially the Compose service used:

```yaml
restart: unless-stopped
```

We changed this to:

```yaml
restart: "no"
```

The connector contains credentials and can inspect private business configuration, so there was no reason to leave it running continuously.

The intended resting state became:

```text
STOPPED
```

### Start when needed

```bash
cd /mnt/user/devconcepts/hellozenmcp

docker compose start hellozen-mcp
```

If the container does not exist yet:

```bash
docker compose up -d --no-build hellozen-mcp
```

### Stop when finished

```bash
docker compose stop hellozen-mcp
```

Routine shutdown uses `stop` rather than `down` so the container remains available for a quick later start.

This reduces the amount of time that both the credential and service are live.

---

## 9. Enable the ChatGPT development capability

The ChatGPT account/workspace used for this setup already supported Developer Mode.

At the time of implementation, the relevant UI was under approximately:

```text
Settings
→ Apps
→ Advanced Settings
→ Developer Mode
```

The exact location and availability may vary by account type and future ChatGPT releases.

Developer Mode was enabled before configuring the custom MCP app.

---

## 10. Create the Secure MCP Tunnel

Because the MCP server lived on a private network and was intentionally not public, a Secure MCP Tunnel was created in the OpenAI Platform.

The tunnel configuration produced:

* a tunnel ID
* a dedicated runtime API key

A dedicated runtime key was used rather than reusing unrelated API credentials.

Neither value was pasted into ChatGPT or committed to Git.

The runtime API key was only entered directly onto the private server.

---

## 11. Install `tunnel-client` on the private server

The host architecture was checked first:

```bash
uname -m
```

For this server:

```text
x86_64
```

The matching official tunnel-client release archive was downloaded.

The archive checksum was verified before installation:

```bash
grep 'tunnel-client-<version>-linux-amd64.zip' SHA256SUMS.txt \
  | sha256sum -c -
```

Only after receiving:

```text
OK
```

was it unpacked.

The release bundle contained:

```text
tunnel-client
cloudflared
cloudflared-manifest.json
LICENSE
```

Both `tunnel-client` and the bundled `cloudflared` were kept together.

---

## 12. Keep tunnel runtime state outside Git

Rather than installing the tunnel tooling into the host operating system, this deployment kept it with the project:

```text
.runtime/tunnel-client/
```

Before storing any runtime files there, the directory was added to `.gitignore`:

```gitignore
# Local runtime tooling and credentials
.runtime/
```

Verification:

```bash
git check-ignore -v .runtime/tunnel-client/tunnel-client
```

This guardrail was committed to Git **before** any tunnel credentials were stored there.

This order matters.

---

## 13. Store the tunnel runtime key without shell-history exposure

The runtime key was entered interactively rather than embedding it in a command line.

Example pattern:

```bash
read -rsp "Paste tunnel runtime API key: " TUNNEL_KEY
echo

printf '%s\n' "$TUNNEL_KEY" \
  > .runtime/tunnel-client/control-plane-api-key

unset TUNNEL_KEY

chmod 600 .runtime/tunnel-client/control-plane-api-key
```

The tunnel ID was likewise supplied locally.

A tunnel config was then created under `.runtime/` and given mode `600`.

The MCP target for the host-based tunnel client should match `HELLOZEN_MCP_PUBLISH_HOST` on the deployment host. On Vision with LAN publish:

```text
http://192.168.50.234:8790/mcp
```

Loopback-only publish (`127.0.0.1`) is appropriate when Cursor is not used from another LAN machine.

The health/admin listener was also loopback-only.

Example conceptually:

```yaml
config_version: 1

control_plane:
  tunnel_id: <tunnel-id>
  api_key: file:/path/to/control-plane-api-key

mcp:
  server_urls:
    - channel: main
      url: http://127.0.0.1:8790/mcp

health:
  listen_addr: 127.0.0.1:8791

admin_ui:
  open_browser: false
```

Check the currently installed tunnel-client configuration schema before copying this literally.

---

## 14. Validate with `tunnel-client doctor`

Before running the tunnel continuously, its built-in diagnostics were used:

```bash
.runtime/tunnel-client/tunnel-client doctor \
  --config .runtime/tunnel-client/hellozen.yaml \
  --explain
```

Checks included:

* configuration loading
* tunnel ID
* control-plane API key presence
* MCP target
* MCP reachability
* OAuth metadata behaviour
* local health listener

The desired result was:

```text
RESULT ok
```

---

## 15. No-auth MCP servers and OAuth discovery

Our MCP server intentionally did not implement OAuth.

Initially `doctor` reported:

```text
oauth_metadata FAIL
```

This did **not** mean OAuth had to be bolted onto the server.

`tunnel-client` included a built-in sample profile for this case:

```bash
tunnel-client profiles samples show sample_mcp_remote_no_auth
```

That sample documented that a plain HTTP MCP server can be valid when OAuth/protected-resource metadata is intentionally absent.

We verified the discovery candidates returned ordinary `404` responses:

```bash
/.well-known/oauth-protected-resource
/.well-known/oauth-protected-resource/mcp
/.well-known/oauth-authorization-server
/
```

Example check:

```bash
curl -sS --max-time 5 -o /dev/null \
  -w 'HTTP %{http_code}\n' \
  http://127.0.0.1:8790/.well-known/oauth-protected-resource/mcp
```

Once all unsupported metadata routes consistently returned `404`, `doctor` reported:

```text
CHECK oauth_metadata PASS
RESULT ok
```

Do not implement OAuth merely to silence a diagnostic if the intended MCP architecture is deliberately no-auth behind a private tunnel.

For planned OAuth enhancements, see [BACKLOG.md](BACKLOG.md).

---

## 16. Start the tunnel on demand

Once `doctor` passed, the tunnel was started:

```bash
nohup .runtime/tunnel-client/tunnel-client run \
  --config .runtime/tunnel-client/hellozen.yaml \
  > .runtime/tunnel-client/tunnel.log 2>&1 &

echo $! > .runtime/tunnel-client/tunnel.pid
```

Readiness was checked locally:

```bash
curl -fsS http://127.0.0.1:8791/readyz && echo
```

Expected:

```text
ready
```

The tunnel was **not configured to autostart**.

The desired usage model remained:

```text
MCP OFF
Tunnel OFF
    ↓
operator starts MCP
    ↓
operator starts tunnel
    ↓
ChatGPT inspection session
    ↓
operator stops tunnel
    ↓
operator stops MCP
```

---

## 17. Important tunnel logging warning

During later operation we observed that tunnel logs could contain sensitive runtime information, including the runtime API key.

Therefore:

* do not paste tunnel logs into ChatGPT
* do not attach them to public bug reports without reviewing/redacting them
* do not commit them
* keep `.runtime/` ignored
* consider restrictive file permissions for log files
* prefer health/status endpoints over dumping logs when diagnosing routine problems

This was one of the most important operational lessons from the setup.

---

## 18. Be careful when restarting the tunnel

During a later startup attempt:

* `/readyz` returned `503`
* a second tunnel process exited
* logs reported that the tunnel was already in use
* ChatGPT could nevertheless still query the MCP server successfully

This indicated that the tunnel/runtime lifecycle was not as simple as assuming the PID saved by the wrapper command was the only relevant process.

The release also bundles `cloudflared`, so when diagnosing "tunnel already in use":

1. first confirm whether ChatGPT can already reach the MCP server
2. inspect running `tunnel-client` and bundled `cloudflared` processes
3. identify executables by their path
4. do not indiscriminately kill every `cloudflared` process on a shared server
5. avoid starting repeated tunnel processes while an existing tunnel is functional

A safe process-inspection pattern is:

```bash
for name in tunnel-client cloudflared; do
  echo "=== $name ==="
  for pid in $(pgrep -x "$name" 2>/dev/null); do
    printf 'PID=%s PPID=%s EXE=%s\n' \
      "$pid" \
      "$(ps -o ppid= -p "$pid" | tr -d ' ')" \
      "$(readlink "/proc/$pid/exe")"
  done
done
```

This avoids printing process arguments or environment variables that might contain secrets.

This area deserves further refinement if this deployment pattern is reused broadly.

---

## 19. Create the custom MCP app in ChatGPT

With:

* MCP server running
* tunnel-client running
* `/readyz` healthy
* Developer Mode enabled

a custom app was created in ChatGPT.

At the time of this implementation the UI was approximately:

```text
Settings
→ Apps
→ Create
```

The app used:

```text
Name:
HelloZen Read-Only MCP

Connection:
Tunnel

Tunnel:
<the previously created tunnel>

Authentication:
None / No authentication
```

The app was left as a development/draft app rather than being published broadly.

The exact UI terminology may change.

---

## 20. Verify tool discovery before trusting the connection

The MCP server was designed to expose exactly four tools:

```text
list_custom_fields
list_pipelines
list_calendars
list_workflows
```

A simple first test was deliberately narrow:

```text
Use HelloZen Read-Only MCP to call list_workflows.
Tell me only how many workflows were returned
and the names of the first five.
```

The result matched the direct server-side verifier output.

That established the complete path:

```text
ChatGPT
→ custom app
→ Secure MCP Tunnel
→ tunnel-client
→ localhost MCP
→ read-only HelloZen client
→ HelloZen configuration API
```

Only after this end-to-end verification did we use the MCP to inspect the full configuration.

---

## 21. Recommended validation sequence

For future private MCP deployments, the sequence that worked well was:

```text
1. Validate security model in code
2. Verify secrets are ignored/untracked
3. Secret-scan staged source
4. Publish source repository
5. Clone to private host
6. Create deployment secrets directly on host
7. Build container
8. Verify localhost health
9. Verify upstream HelloZen API access
10. Disable automatic service restart
11. Create Secure MCP Tunnel
12. Install and checksum tunnel-client
13. Ignore runtime directory before adding credentials
14. Store runtime credentials locally
15. Run tunnel-client doctor
16. Verify /readyz
17. Create ChatGPT development app
18. Verify exact tool inventory
19. Run one narrow read-only end-to-end query
20. Only then use the connector for real inspection
```

The sequence deliberately proves one boundary at a time rather than debugging the whole chain simultaneously.

---

## 22. Suggested normal operating procedure

Use the repository session wrapper when available:

```bash
cd /mnt/user/devconcepts/hellozenmcp

./scripts/hellozen-session start
./scripts/hellozen-session status
# … inspection session …
./scripts/hellozen-session stop
```

Or npm aliases: `npm run session:start`, `session:status`, `session:stop`.

The wrapper starts MCP if needed, waits for `/healthz`, avoids duplicate tunnel instances when `/readyz` is already healthy, and stops only tunnel processes owned under `.runtime/tunnel-client/`.

### Manual procedure (legacy)

```bash
cd /mnt/user/devconcepts/hellozenmcp

docker compose start hellozen-mcp

nohup .runtime/tunnel-client/tunnel-client run \
  --config .runtime/tunnel-client/hellozen.yaml \
  > .runtime/tunnel-client/tunnel.log 2>&1 &

echo $! > .runtime/tunnel-client/tunnel.pid
```

Then verify:

```bash
curl -fsS http://<publish-host>:8790/healthz && echo
curl -fsS http://127.0.0.1:8791/readyz && echo
```

However, if tunnel startup reports that the tunnel is already in use, **do not repeatedly launch additional instances**. First test whether the existing tunnel is already functional.

### End an inspection session

```bash
./scripts/hellozen-session stop
```

Or manually stop the tunnel deliberately (owned processes only), then:

```bash
docker compose stop hellozen-mcp
```

The desired final state is:

```text
MCP: STOPPED
Tunnel: STOPPED
```

Further work on tunnel lifecycle is implemented in `scripts/hellozen-session` for repeatable start/stop without orphaned processes.

---

## 23. Things not to copy blindly

This document records one implementation, not universal requirements.

Do not assume future deployments should use the same:

* ChatGPT menu paths
* OpenAI account/workspace requirements
* tunnel-client version
* YAML schema
* ports
* filesystem paths
* Docker version
* Buildx workaround
* Gitleaks version
* authentication model
* MCP transport
* operating system
* exact commands

Instead preserve the architectural intentions:

### Keep the MCP private

Prefer a private tunnel over publishing an internal MCP endpoint simply to make it reachable.

### Minimise authority

Give the MCP server only the permissions and tools actually needed.

### Keep secrets server-side

Never make credentials part of prompts, Git history, browser code, container images, or copied diagnostic output.

### Validate boundaries independently

Prove:

```text
HelloZen API
MCP
Docker
localhost networking
tunnel
ChatGPT tool discovery
```

one layer at a time.

### Prefer an on-demand service

If the MCP is only used during administrative or investigative sessions, keeping it stopped outside those sessions provides an additional defence-in-depth control.

---

## 24. Current implementation pattern

The working implementation described by this document used:

```text
Private server:
Vision / Unraid

MCP deployment:
/mnt/user/devconcepts/hellozenmcp

MCP host endpoint:
http://127.0.0.1:8790/mcp

MCP health:
http://127.0.0.1:8790/healthz

Tunnel health:
http://127.0.0.1:8791/readyz

Tunnel runtime directory:
.runtime/tunnel-client/

Container:
hellozen-mcp

Normal service state:
STOPPED

ChatGPT app:
HelloZen Read-Only MCP
```

These values are included as a concrete worked example, not as required defaults.

---

## 25. Final principle

The most useful mental model is:

```text
The tunnel is not the security model.

The security model begins at the MCP server:
small tool surface
+ least-privilege credentials
+ data minimisation
+ private networking
+ secret hygiene
+ bounded runtime exposure.

The tunnel then provides a private path for an approved client to reach that already-constrained service.
```

That separation makes the design easier to reason about, test, audit, and reuse.
