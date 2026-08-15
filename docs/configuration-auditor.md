# Configuration Auditor

HelloZen MCP **2.0** extends the read-only inventory tools into a configuration-discovery and dependency-analysis connector.

## Read-only guarantee

This MCP issues **GET requests only** to an explicit allowlist of LeadConnector endpoints. No POST, PUT, PATCH, DELETE, enrolment, or contact mutation paths exist in the transport layer. Tests enforce this boundary.

## Freshness semantics

Every tool response includes:

```json
{
  "meta": {
    "source": "live",
    "fetchedAt": "2026-08-15T09:40:00.000Z",
    "cacheAgeMs": 0,
    "complete": true
  }
}
```

| Input | Behaviour |
|-------|-----------|
| `fresh` omitted or `false` | May return cached data; `meta.source` is `cache` when served from TTL cache |
| `fresh: true` | Bypasses cache and fetches upstream live |
| Upstream failure with `fresh: true` | Returns explicit freshness error — **does not** return stale data labelled as live |

Cache TTL is controlled by `HELLOZEN_MCP_CACHE_TTL_SECONDS` (default 60).

## Tool inventory

### Inventory tools (preserved)

| Tool | Purpose | Key input |
|------|---------|-----------|
| `list_custom_fields` | Contact/opportunity field definitions | `model?`, `fresh?` |
| `list_pipelines` | Pipelines and stages | `fresh?` |
| `list_calendars` | Calendar inventory | `fresh?` |
| `list_workflows` | Workflow IDs, names, status | `fresh?` |

### New inventory tools

| Tool | Purpose | Key input |
|------|---------|-----------|
| `list_tags` | Tag inventory for dependency resolution | `fresh?` |
| `list_users` | Team members (display names; no emails) | `fresh?` |
| `list_forms` | Form inventory (no submissions) | `fresh?` |

### Detail tools

| Tool | Purpose | Key input |
|------|---------|-----------|
| `get_workflow` | Workflow identity, triggers/actions when API exposes them, dependency graph | `workflow_id`, `fresh?` |
| `get_calendar` | Calendar configuration + availability schedule when available | `calendar_id`, `fresh?` |

### Audit tools

| Tool | Purpose | Key input |
|------|---------|-----------|
| `audit_configuration_dependencies` | Reverse-reference index across scanned surfaces | `fresh?` |
| `audit_configuration` | Duplicates, broken references, legacy candidates | `fresh?` |
| `get_configuration_snapshot` | Machine-readable export for drift comparison | `fresh?` |
| `get_capabilities` | Visibility matrix and API coverage | — |

## Audit semantics

The MCP **never** returns `safeToDelete: true`.

Instead:

- `referencesFound: 0` with `classification: "no_reference_found_in_scanned_configuration"`
- `referenceScanCoverage` lists which surfaces were scanned (workflows, forms, etc.)
- `visibilityLimitations` explains what was **not** scanned (external websites, manual processes, unsupported API surfaces)

Use: *"No references were found in the configuration surfaces we can inspect"* — not *"unused"* or *"safe to delete"*.

## Visibility matrix

| Surface | Visibility | API | Notes |
|---------|------------|-----|-------|
| Custom fields | Full | `GET /locations/{id}/customFields` | Contact + opportunity models |
| Pipelines/stages | Full | `GET /opportunities/pipelines` | |
| Workflow identity | Full | `GET /workflows/` | List returns id, name, status, dates |
| Workflow triggers/actions | **Partial / often unavailable** | `GET /workflows/{id}` | Official public API typically returns metadata only; dependency extraction runs when detail payload is present |
| Calendar inventory | Partial | `GET /calendars/` | Summary metadata |
| Calendar detail | Partial | `GET /calendars/{id}` | Rich config when upstream exposes it |
| Calendar availability | Partial | `GET /calendars/schedules/event-calendar/{id}` | Fetched alongside calendar detail |
| Tags | Full | `GET /locations/{id}/tags` | Requires `locations/tags.readonly` scope |
| Users | Partial | `GET /users/search` | Display names only; may need `HELLOZEN_MCP_COMPANY_ID` |
| Forms | Metadata only | `GET /forms/` | No `get_form` — field definitions not exposed by supported API |
| Contacts | **Unavailable** | — | Intentionally blocked |
| Opportunities (records) | **Unavailable** | — | Intentionally blocked |
| Conversations/messages | **Unavailable** | — | Intentionally blocked |
| Appointments/events | **Unavailable** | — | Intentionally blocked |
| Form submissions | **Unavailable** | — | Intentionally blocked |

## Required OAuth / Private Integration scopes

Existing scopes:

```
locations/customFields.readonly
opportunities.readonly
calendars.readonly
workflows.readonly
```

**New scopes for full auditor coverage:**

```
locations/tags.readonly
users.readonly
forms.readonly
```

Add these to the dedicated read-only Private Integration before using tag, user, and form tools.

## Known visibility gaps

1. **Workflow builder graph** — The official `workflows.readonly` API lists workflows but generally does not expose the full trigger/action builder graph. `get_workflow` returns identity + derived dependencies when detail is available; otherwise it reports `visibilityLimitations` explicitly.
2. **Form field dependencies** — `GET /forms/` returns inventory; there is no supported read endpoint for full form field definitions.
3. **External usage** — Websites, Integration Hub, manual processes, and third-party integrations are outside scan coverage.

## Example questions this release supports

- *Get the live definition of workflow X* — `get_workflow` with `fresh: true` (detail depth depends on API)
- *Which workflows reference field Y?* — `audit_configuration_dependencies`
- *Was this result cached?* — check `meta.source` and `meta.cacheAgeMs`
- *What scheduling rules does calendar Z have?* — `get_calendar` with `fresh: true`
- *Is this tag unreferenced?* — audit tool with `classification` and `visibilityLimitations`
