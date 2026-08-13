import 'dotenv/config';
import { loadConfig } from '../config/env.js';
import { ReadOnlyHelloZenClient } from '../hellozen/client.js';
import { HelloZenError } from '../hellozen/errors.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new ReadOnlyHelloZenClient({
    readonlyToken: config.readonlyToken,
    locationId: config.locationId,
    requestTimeoutMs: config.requestTimeoutMs,
    cacheTtlSeconds: 0,
  });

  const checks: Array<{ label: string; run: () => Promise<number> }> = [
    {
      label: 'Custom fields',
      run: async () => (await client.listCustomFields('all')).length,
    },
    {
      label: 'Pipelines',
      run: async () => (await client.listPipelines()).length,
    },
    {
      label: 'Calendars',
      run: async () => (await client.listCalendars()).length,
    },
    {
      label: 'Workflows',
      run: async () => (await client.listWorkflows()).length,
    },
  ];

  for (const check of checks) {
    try {
      const count = await check.run();
      process.stdout.write(
        `${check.label}: accessible, ${count}\n`,
      );
    } catch (error) {
      const message =
        error instanceof HelloZenError
          ? error.message
          : 'HelloZen returned an invalid configuration response.';
      process.stdout.write(`${check.label}: not accessible (${message})\n`);
      process.exitCode = 1;
    }
  }
}

main().catch(() => {
  process.exitCode = 1;
});
