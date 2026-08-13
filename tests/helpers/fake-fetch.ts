import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FetchFn } from '../../src/hellozen/transport.js';
import { HELLOZEN_API_ORIGIN } from '../../src/hellozen/endpoints.js';

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'fixtures',
);

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf8')) as unknown;
}

const responses: Record<string, unknown> = {
  '/locations/loc_example/customFields': loadFixture(
    'custom-fields-base.json',
  ),
  '/locations/loc_example/customFields?model=opportunity': loadFixture(
    'custom-fields-opportunity.json',
  ),
  '/opportunities/pipelines?locationId=loc_example': loadFixture(
    'pipelines.json',
  ),
  '/calendars/?locationId=loc_example': loadFixture('calendars.json'),
  '/workflows/?locationId=loc_example': loadFixture('workflows.json'),
};

export function createFakeFetch(
  overrides: Partial<Record<string, unknown>> = {},
): FetchFn {
  const merged = { ...responses, ...overrides };

  return async (input, init) => {
    const method = init?.method?.toUpperCase() ?? 'GET';
    if (method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const url = new URL(typeof input === 'string' ? input : input.url);
    if (url.origin !== HELLOZEN_API_ORIGIN) {
      return new Response('Forbidden origin', { status: 403 });
    }

    const key = `${url.pathname}${url.search}`;
    const payload = merged[key];
    if (payload === undefined) {
      return new Response('Not Found', { status: 404 });
    }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

export const TEST_CONFIG = {
  readonlyToken: 'test-readonly-token-value',
  locationId: 'loc_example',
  requestTimeoutMs: 5000,
  cacheTtlSeconds: 60,
} as const;
