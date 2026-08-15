import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { describe, expect, it } from 'vitest';
import { ReadOnlyHelloZenClient } from '../src/hellozen/client.js';
import {
  APPROVED_TOOL_NAMES,
  buildMcpServer,
} from '../src/mcp/server.js';
import { ToolRateLimiter } from '../src/rate-limit/tool-rate-limit.js';
import { createFakeFetch, TEST_CONFIG } from './helpers/fake-fetch.js';

async function listTools(client: ReadOnlyHelloZenClient) {
  const server = buildMcpServer(client, new ToolRateLimiter(10_000));
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);

  const mcpClient = new Client({ name: 'test-client', version: '1.0.0' });
  await mcpClient.connect(clientTransport);

  const tools = await mcpClient.listTools();
  await mcpClient.close();
  await server.close();

  return tools.tools;
}

describe('MCP tools', () => {
  const helloZenClient = new ReadOnlyHelloZenClient({
    ...TEST_CONFIG,
    fetchImpl: createFakeFetch(),
  });

  it('advertises approved tools with correct annotations', async () => {
    const tools = await listTools(helloZenClient);
    const names = tools.map((tool) => tool.name).sort();
    expect(names).toEqual([...APPROVED_TOOL_NAMES].sort());

    for (const tool of tools) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      });
    }
  });

  it('does not expose generic proxy-style tools', async () => {
    const tools = await listTools(helloZenClient);
    const forbidden = ['search', 'fetch', 'request', 'execute', 'debug', 'proxy'];
    for (const name of forbidden) {
      expect(tools.some((tool) => tool.name === name)).toBe(false);
    }
  });

  it('returns normalized structured output with meta and without secrets', async () => {
    const server = buildMcpServer(helloZenClient, new ToolRateLimiter(10_000));
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const mcpClient = new Client({ name: 'test-client', version: '1.0.0' });
    await mcpClient.connect(clientTransport);

    const result = await mcpClient.callTool({
      name: 'list_pipelines',
      arguments: {},
    });

    const text = JSON.stringify(result);
    expect(text).not.toContain(TEST_CONFIG.readonlyToken);
    expect(text).not.toContain('traceId');
    expect(text).not.toContain('locationId');
    expect(text).toMatch(/"meta"/);
    expect(text).toMatch(/"source"/);

    await mcpClient.close();
    await server.close();
  });

  it('enforces tool-level rate limiting', async () => {
    const limiter = new ToolRateLimiter(2);
    const server = buildMcpServer(helloZenClient, limiter);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const mcpClient = new Client({ name: 'test-client', version: '1.0.0' });
    await mcpClient.connect(clientTransport);

    await mcpClient.callTool({ name: 'list_workflows', arguments: {} });
    await mcpClient.callTool({ name: 'list_workflows', arguments: {} });
    const third = await mcpClient.callTool({
      name: 'list_workflows',
      arguments: {},
    });

    expect(JSON.stringify(third)).toMatch(/rate limit/i);

    await mcpClient.close();
    await server.close();
  });
});
