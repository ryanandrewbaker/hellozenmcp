import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ReadOnlyHelloZenClient } from '../hellozen/client.js';
import { HelloZenError } from '../hellozen/errors.js';
import { log } from '../logging/logger.js';
import { ToolRateLimiter } from '../rate-limit/tool-rate-limit.js';
import {
  listCalendarsInputSchema,
  listCalendarsOutputSchema,
  listCustomFieldsInputSchema,
  listCustomFieldsOutputSchema,
  listPipelinesInputSchema,
  listPipelinesOutputSchema,
  listWorkflowsInputSchema,
  listWorkflowsOutputSchema,
} from '../schemas/mcp-output.js';

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

const READ_SCOPE = 'hellozen.read';

const OAUTH_TOOL_META = {
  securitySchemes: [{ type: 'oauth2', scopes: [READ_SCOPE] }],
} as const;

export const APPROVED_TOOL_NAMES = [
  'list_custom_fields',
  'list_pipelines',
  'list_calendars',
  'list_workflows',
] as const;

export type ApprovedToolName = (typeof APPROVED_TOOL_NAMES)[number];

export function buildMcpServer(
  client: ReadOnlyHelloZenClient,
  rateLimiter: ToolRateLimiter = new ToolRateLimiter(30),
): McpServer {
  const server = new McpServer({
    name: 'hellozen-mcp',
    version: '1.1.0',
  });

  server.registerTool(
    'list_custom_fields',
    {
      description:
        'Inspect HelloZen custom contact and opportunity field definitions for integration planning.',
      inputSchema: listCustomFieldsInputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META,
    },
    async (input) => {
      return runTool('list_custom_fields', rateLimiter, async () => {
        const model = input.model ?? 'all';
        const fields = await client.listCustomFields(model);
        const output = listCustomFieldsOutputSchema.parse({ fields });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Found ${output.fields.length} custom field definition(s) (model=${model}).`,
            },
          ],
          structuredContent: output,
        };
      });
    },
  );

  server.registerTool(
    'list_pipelines',
    {
      description:
        'Inspect HelloZen opportunity pipeline and stage configuration.',
      inputSchema: listPipelinesInputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META,
    },
    async () => {
      return runTool('list_pipelines', rateLimiter, async () => {
        const pipelines = await client.listPipelines();
        const output = listPipelinesOutputSchema.parse({ pipelines });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Found ${output.pipelines.length} pipeline(s).`,
            },
          ],
          structuredContent: output,
        };
      });
    },
  );

  server.registerTool(
    'list_calendars',
    {
      description:
        'Inspect HelloZen calendar configuration such as a portrait planning call calendar.',
      inputSchema: listCalendarsInputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META,
    },
    async () => {
      return runTool('list_calendars', rateLimiter, async () => {
        const calendars = await client.listCalendars();
        const output = listCalendarsOutputSchema.parse({ calendars });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Found ${output.calendars.length} calendar(s).`,
            },
          ],
          structuredContent: output,
        };
      });
    },
  );

  server.registerTool(
    'list_workflows',
    {
      description:
        'List HelloZen workflow IDs, names, and status for delivery and nurture flows.',
      inputSchema: listWorkflowsInputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
      _meta: OAUTH_TOOL_META,
    },
    async () => {
      return runTool('list_workflows', rateLimiter, async () => {
        const workflows = await client.listWorkflows();
        const output = listWorkflowsOutputSchema.parse({ workflows });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Found ${output.workflows.length} workflow(s).`,
            },
          ],
          structuredContent: output,
        };
      });
    },
  );

  return server;
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
