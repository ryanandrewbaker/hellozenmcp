import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { ReadOnlyHelloZenClient } from '../hellozen/client.js';
import { SERVICE_NAME } from '../config/env.js';
import { buildMcpServer } from '../mcp/server.js';
import { ToolRateLimiter } from '../rate-limit/tool-rate-limit.js';

const MCP_BODY_LIMIT = '16kb';

export type CreateAppOptions = {
  client: ReadOnlyHelloZenClient;
  toolRateLimiter?: ToolRateLimiter;
};

export function createApp(options: CreateAppOptions): Express {
  const app = express();
  app.disable('x-powered-by');

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', service: SERVICE_NAME });
  });

  const mcpRouter = express.Router();
  mcpRouter.use(express.json({ limit: MCP_BODY_LIMIT }));
  mcpRouter.use(
    rateLimit({
      windowMs: 60_000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many MCP requests' },
    }),
  );

  const toolRateLimiter =
    options.toolRateLimiter ?? new ToolRateLimiter(30);

  const handleMcp = async (
    req: express.Request,
    res: express.Response,
  ): Promise<void> => {
    const server = buildMcpServer(options.client, toolRateLimiter);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on('close', () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch {
      if (!res.headersSent) {
        res.status(500).json({ error: 'MCP request failed' });
      }
    }
  };

  mcpRouter.post('/mcp', (req, res) => {
    void handleMcp(req, res);
  });

  mcpRouter.get('/mcp', (req, res) => {
    void handleMcp(req, res);
  });

  mcpRouter.delete('/mcp', (req, res) => {
    void handleMcp(req, res);
  });

  app.use(mcpRouter);

  return app;
}

export async function createMcpServerForTests(
  client: ReadOnlyHelloZenClient,
): Promise<McpServer> {
  return buildMcpServer(client, new ToolRateLimiter(10_000));
}
