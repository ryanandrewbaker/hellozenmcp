import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ReadOnlyHelloZenClient } from '../src/hellozen/client.js';
import { createApp } from '../src/http/app.js';
import { createDisabledTestAuth } from './helpers/oauth-fixtures.js';
import { createFakeFetch, TEST_CONFIG } from './helpers/fake-fetch.js';

describe('HTTP server', () => {
  const client = new ReadOnlyHelloZenClient({
    ...TEST_CONFIG,
    fetchImpl: createFakeFetch(),
  });
  const app = createApp({ client, auth: createDisabledTestAuth() });

  it('returns health without environment details', async () => {
    const response = await request(app).get('/healthz');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'hellozen-mcp',
    });
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('does not include x-powered-by header', async () => {
    const response = await request(app).get('/healthz');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
