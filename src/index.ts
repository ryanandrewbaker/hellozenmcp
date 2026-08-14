import 'dotenv/config';
import { loadConfig } from './config/env.js';
import { loadAuthConfig } from './auth/config.js';
import { ReadOnlyHelloZenClient } from './hellozen/client.js';
import { createApp } from './http/app.js';

const config = loadConfig();
const auth = await loadAuthConfig();

const client = new ReadOnlyHelloZenClient({
  readonlyToken: config.readonlyToken,
  locationId: config.locationId,
  requestTimeoutMs: config.requestTimeoutMs,
  cacheTtlSeconds: config.cacheTtlSeconds,
});

const app = createApp({ client, auth });

const server = app.listen(config.port, config.bindHost, () => {
  process.stdout.write(
    `${JSON.stringify({
      event: 'server_started',
      success: true,
      auth_enabled: auth.enabled,
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
