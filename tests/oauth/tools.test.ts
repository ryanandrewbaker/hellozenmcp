import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { ReadOnlyHelloZenClient } from '../../src/hellozen/client.js';
import { buildMcpServer } from '../../src/mcp/server.js';
import { createApp } from '../../src/http/app.js';
import { ToolRateLimiter } from '../../src/rate-limit/tool-rate-limit.js';
import {
  createEnabledTestAuth,
  createTestAccessToken,
  initOAuthTestKeys,
} from '../helpers/oauth-fixtures.js';
import { createFakeFetch, TEST_CONFIG } from '../helpers/fake-fetch.js';

describe('OAuth-protected MCP tools', () => {
  beforeAll(async () => {
    await initOAuthTestKeys();
  });

  const client = new ReadOnlyHelloZenClient({
    ...TEST_CONFIG,
    fetchImpl: createFakeFetch(),
  });

  it('advertises oauth2 security metadata on every tool', async () => {
    const server = buildMcpServer(client, new ToolRateLimiter(10_000));
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const mcpClient = new Client({ name: 'test-client', version: '1.1.0' });
    await mcpClient.connect(clientTransport);
    const tools = await mcpClient.listTools();

    for (const tool of tools.tools) {
      expect(tool._meta).toMatchObject({
        securitySchemes: [{ type: 'oauth2', scopes: ['hellozen.read'] }],
      });
    }

    await mcpClient.close();
    await server.close();
  });

  it('executes all approved tools with a valid bearer token over HTTP', async () => {
    const app = createApp({ client, auth: await createEnabledTestAuth() });
    const token = await createTestAccessToken();

    for (const toolName of [
      'list_custom_fields',
      'list_pipelines',
      'list_calendars',
      'list_workflows',
    ] as const) {
      const response = await request(app)
        .post('/mcp')
        .set('Authorization', `Bearer ${token}`)
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: toolName === 'list_custom_fields' ? { model: 'all' } : {},
          },
        });

      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
      expect(response.text).not.toContain(TEST_CONFIG.readonlyToken);
    }
  });
});
