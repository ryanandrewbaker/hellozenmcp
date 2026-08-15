import 'dotenv/config';
import { loadConfig } from './config/env.js';
import { ReadOnlyHelloZenClient } from './hellozen/client.js';
import { createApp } from './http/app.js';

const config = loadConfig();

const client = new ReadOnlyHelloZenClient({
  readonlyToken: config.readonlyToken,
  locationId: config.locationId,
  companyId: config.companyId,
  requestTimeoutMs: config.requestTimeoutMs,
  cacheTtlSeconds: config.cacheTtlSeconds,
});

const app = createApp({ client });

const server = app.listen(config.port, config.bindHost, () => {
  process.stdout.write(
    `${JSON.stringify({
      event: 'server_started',
      success: true,
    })}\n`,
  );
});

function shutdown(): void {
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
