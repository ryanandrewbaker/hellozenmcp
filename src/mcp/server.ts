import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  buildCapabilitiesMeta,
  buildConfigurationAudit,
  buildConfigurationSnapshot,
  buildDependencyAudit,
} from '../audit/index.js';
import type { ReadOnlyHelloZenClient } from '../hellozen/client.js';
import { HelloZenError } from '../hellozen/errors.js';
import { log } from '../logging/logger.js';
import { ToolRateLimiter } from '../rate-limit/tool-rate-limit.js';
import {
  auditConfigurationDependenciesInputSchema,
  auditConfigurationDependenciesOutputSchema,
  auditConfigurationInputSchema,
  auditConfigurationOutputSchema,
  configurationSnapshotInputSchema,
  configurationSnapshotOutputSchema,
  getCalendarInputSchema,
  getCalendarOutputSchema,
  getCapabilitiesOutputSchema,
  getWorkflowInputSchema,
  getWorkflowOutputSchema,
  listCalendarsInputSchema,
  listCalendarsOutputSchema,
  listCustomFieldsInputSchema,
  listCustomFieldsOutputSchema,
  listFormsInputSchema,
  listFormsOutputSchema,
  listPipelinesInputSchema,
  listPipelinesOutputSchema,
  listTagsInputSchema,
  listTagsOutputSchema,
  listUsersInputSchema,
  listUsersOutputSchema,
  listWorkflowsInputSchema,
  listWorkflowsOutputSchema,
} from '../schemas/mcp-output.js';

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

export const APPROVED_TOOL_NAMES = [
  'list_custom_fields',
  'list_pipelines',
  'list_calendars',
  'list_workflows',
  'list_tags',
  'list_users',
  'list_forms',
  'get_workflow',
  'get_calendar',
  'audit_configuration_dependencies',
  'audit_configuration',
  'get_configuration_snapshot',
  'get_capabilities',
] as const;

export type ApprovedToolName = (typeof APPROVED_TOOL_NAMES)[number];

export function buildMcpServer(
  client: ReadOnlyHelloZenClient,
  rateLimiter: ToolRateLimiter = new ToolRateLimiter(30),
): McpServer {
  const server = new McpServer({
    name: 'hellozen-mcp',
    version: '2.0.0',
  });

  server.registerTool(
    'list_custom_fields',
    {
      description:
        'Inspect HelloZen custom contact and opportunity field definitions for integration planning.',
      inputSchema: listCustomFieldsInputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (input) =>
      runTool('list_custom_fields', rateLimiter, async () => {
        const model = input.model ?? 'all';
        const result = await client.listCustomFields(model, {
          fresh: input.fresh,
        });
        const output = listCustomFieldsOutputSchema.parse({
          fields: result.data,
          meta: result.meta,
        });
        return toolResult(
          `Found ${output.fields.length} custom field definition(s) (model=${model}). Source=${output.meta.source}.`,
          output,
        );
      }),
  );

  server.registerTool(
    'list_pipelines',
    {
      description:
        'Inspect HelloZen opportunity pipeline and stage configuration.',
      inputSchema: listPipelinesInputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (input) =>
      runTool('list_pipelines', rateLimiter, async () => {
        const result = await client.listPipelines({ fresh: input.fresh });
        const output = listPipelinesOutputSchema.parse({
          pipelines: result.data,
          meta: result.meta,
        });
        return toolResult(
          `Found ${output.pipelines.length} pipeline(s). Source=${output.meta.source}.`,
          output,
        );
      }),
  );

  server.registerTool(
    'list_calendars',
    {
      description:
        'Inspect HelloZen calendar configuration such as a portrait planning call calendar.',
      inputSchema: listCalendarsInputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (input) =>
      runTool('list_calendars', rateLimiter, async () => {
        const result = await client.listCalendars({ fresh: input.fresh });
        const output = listCalendarsOutputSchema.parse({
          calendars: result.data,
          meta: result.meta,
        });
        return toolResult(
          `Found ${output.calendars.length} calendar(s). Source=${output.meta.source}.`,
          output,
        );
      }),
  );

  server.registerTool(
    'list_workflows',
    {
      description:
        'List HelloZen workflow IDs, names, and status for delivery and nurture flows.',
      inputSchema: listWorkflowsInputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (input) =>
      runTool('list_workflows', rateLimiter, async () => {
        const result = await client.listWorkflows({ fresh: input.fresh });
        const output = listWorkflowsOutputSchema.parse({
          workflows: result.data,
          meta: result.meta,
        });
        return toolResult(
          `Found ${output.workflows.length} workflow(s). Source=${output.meta.source}.`,
          output,
        );
      }),
  );

  server.registerTool(
    'list_tags',
    {
      description: 'List HelloZen tags for workflow dependency resolution.',
      inputSchema: listTagsInputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (input) =>
      runTool('list_tags', rateLimiter, async () => {
        const result = await client.listTags({ fresh: input.fresh });
        const output = listTagsOutputSchema.parse({
          tags: result.data,
          meta: result.meta,
        });
        return toolResult(
          `Found ${output.tags.length} tag(s). Source=${output.meta.source}.`,
          output,
        );
      }),
  );

  server.registerTool(
    'list_users',
    {
      description:
        'List HelloZen users/team members for configuration resolution (display names only).',
      inputSchema: listUsersInputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (input) =>
      runTool('list_users', rateLimiter, async () => {
        const result = await client.listUsers({ fresh: input.fresh });
        const output = listUsersOutputSchema.parse({
          users: result.data,
          meta: result.meta,
        });
        return toolResult(
          `Found ${output.users.length} user(s). Source=${output.meta.source}.`,
          output,
        );
      }),
  );

  server.registerTool(
    'list_forms',
    {
      description:
        'List HelloZen forms (configuration inventory only; no submissions).',
      inputSchema: listFormsInputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (input) =>
      runTool('list_forms', rateLimiter, async () => {
        const result = await client.listForms({ fresh: input.fresh });
        const output = listFormsOutputSchema.parse({
          forms: result.data,
          meta: result.meta,
          visibilityLimitations: [
            'Form field definitions and workflow bindings may not be exposed by GET /forms/.',
          ],
        });
        return toolResult(
          `Found ${output.forms.length} form(s). Source=${output.meta.source}.`,
          output,
        );
      }),
  );

  server.registerTool(
    'get_workflow',
    {
      description:
        'Get workflow configuration and derived dependencies where supported by the read API.',
      inputSchema: getWorkflowInputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (input) =>
      runTool('get_workflow', rateLimiter, async () => {
        const result = await client.getWorkflow(input.workflow_id, {
          fresh: input.fresh,
        });
        const output = getWorkflowOutputSchema.parse({
          workflow: result.data,
          meta: result.meta,
        });
        return toolResult(
          `${output.workflow.summary ?? output.workflow.name} Source=${output.meta.source}.`,
          output,
        );
      }),
  );

  server.registerTool(
    'get_calendar',
    {
      description:
        'Get detailed HelloZen calendar configuration and availability schedule when exposed.',
      inputSchema: getCalendarInputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (input) =>
      runTool('get_calendar', rateLimiter, async () => {
        const result = await client.getCalendar(input.calendar_id, {
          fresh: input.fresh,
        });
        const output = getCalendarOutputSchema.parse({
          calendar: result.data,
          meta: result.meta,
          visibilityLimitations: result.data.availabilitySchedule
            ? []
            : ['Availability schedule endpoint returned no data or is unavailable.'],
        });
        return toolResult(
          `Calendar "${output.calendar.name}" (${output.calendar.status ?? 'unknown'}). Source=${output.meta.source}.`,
          output,
        );
      }),
  );

  server.registerTool(
    'audit_configuration_dependencies',
    {
      description:
        'Build a reverse-reference index across scanned HelloZen configuration surfaces.',
      inputSchema: auditConfigurationDependenciesInputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (input) =>
      runTool('audit_configuration_dependencies', rateLimiter, async () => {
        const output = auditConfigurationDependenciesOutputSchema.parse(
          await buildDependencyAudit(client, { fresh: input.fresh }),
        );
        return toolResult(
          `Dependency audit complete. Source=${output.meta.source}.`,
          output,
        );
      }),
  );

  server.registerTool(
    'audit_configuration',
    {
      description:
        'Run a fact-based structural audit: duplicates, broken references, and legacy candidates.',
      inputSchema: auditConfigurationInputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (input) =>
      runTool('audit_configuration', rateLimiter, async () => {
        const output = auditConfigurationOutputSchema.parse(
          await buildConfigurationAudit(client, { fresh: input.fresh }),
        );
        return toolResult(
          `Configuration audit complete (${output.legacyCandidates.length} legacy candidate(s)). Source=${output.meta.source}.`,
          output,
        );
      }),
  );

  server.registerTool(
    'get_configuration_snapshot',
    {
      description:
        'Export a machine-readable configuration snapshot for drift comparison.',
      inputSchema: configurationSnapshotInputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (input) =>
      runTool('get_configuration_snapshot', rateLimiter, async () => {
        const output = configurationSnapshotOutputSchema.parse(
          await buildConfigurationSnapshot(client, { fresh: input.fresh }),
        );
        return toolResult(
          `Configuration snapshot at ${output.snapshotTimestamp}. Source=${output.meta.source}.`,
          output,
        );
      }),
  );

  server.registerTool(
    'get_capabilities',
    {
      description:
        'Report which HelloZen configuration surfaces are inspectable and known visibility gaps.',
      inputSchema: {},
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () =>
      runTool('get_capabilities', rateLimiter, async () => {
        const output = getCapabilitiesOutputSchema.parse(buildCapabilitiesMeta());
        return toolResult(
          `Capabilities report with ${output.capabilities.length} surface(s).`,
          output,
        );
      }),
  );

  return server;
}

function toolResult(text: string, structuredContent: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text }],
    structuredContent,
  };
}

async function runTool<T>(
  tool: ApprovedToolName,
  rateLimiter: ToolRateLimiter,
  handler: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  try {
    rateLimiter.check();
    const result = await handler();
    log({
      event: 'tool_execution',
      tool,
      duration_ms: Date.now() - started,
      success: true,
    });
    return result;
  } catch (error) {
    const category =
      error instanceof HelloZenError ? error.category : 'internal';
    log({
      event: 'tool_execution',
      tool,
      duration_ms: Date.now() - started,
      success: false,
      error_category: category,
    });

    if (error instanceof HelloZenError) {
      return {
        content: [{ type: 'text' as const, text: error.message }],
        isError: true,
      } as T;
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: 'HelloZen returned an invalid configuration response.',
        },
      ],
      isError: true,
    } as T;
  }
}

export function createToolTestServer(
  client: ReadOnlyHelloZenClient,
): McpServer {
  return buildMcpServer(client, new ToolRateLimiter(10_000));
}
