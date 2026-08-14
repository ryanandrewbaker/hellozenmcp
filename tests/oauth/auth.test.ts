import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { ReadOnlyHelloZenClient } from '../../src/hellozen/client.js';
import { createApp } from '../../src/http/app.js';
import {
  createEnabledTestAuth,
  createTestAccessToken,
  initOAuthTestKeys,
  TEST_AUDIENCE,
  TEST_ISSUER,
  TEST_REQUIRED_SCOPE,
} from '../helpers/oauth-fixtures.js';
import { createFakeFetch, TEST_CONFIG } from '../helpers/fake-fetch.js';

describe('OAuth resource server', () => {
  beforeAll(async () => {
    await initOAuthTestKeys();
  });

  const client = new ReadOnlyHelloZenClient({
    ...TEST_CONFIG,
    fetchImpl: createFakeFetch(),
  });

  let protectedApp: ReturnType<typeof createApp>;

  beforeAll(async () => {
    protectedApp = createApp({
      client,
      auth: await createEnabledTestAuth(),
    });
  });

  it('rejects MCP requests without Authorization header', async () => {
    const response = await request(protectedApp).post('/mcp').send({});
    expect(response.status).toBe(401);
    expect(response.headers['www-authenticate']).toContain('Bearer');
    expect(response.headers['www-authenticate']).toContain('resource_metadata=');
    expect(response.body.error).toBe('invalid_token');
  });

  it('rejects malformed three-segment JWTs at the HTTP layer with 401', async () => {
    const response = await request(protectedApp)
      .post('/mcp')
      .set('Authorization', 'Bearer abc.def.ghi')
      .send({});
    expect(response.status).toBe(401);
    expect(response.status).not.toBe(500);
  });

  it('rejects non-bearer Authorization schemes', async () => {
    const response = await request(protectedApp)
      .post('/mcp')
      .set('Authorization', 'Basic abc')
      .send({});
    expect(response.status).toBe(401);
  });

  it('rejects malformed bearer tokens', async () => {
    const response = await request(protectedApp)
      .post('/mcp')
      .set('Authorization', 'Bearer not-a-jwt')
      .send({});
    expect(response.status).toBe(401);
  });

  it('rejects unsigned JWTs', async () => {
    const token = await createTestAccessToken({ unsigned: true });
    const response = await request(protectedApp)
      .post('/mcp')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(response.status).toBe(401);
  });

  it('rejects tokens with invalid signatures', async () => {
    const token = await createTestAccessToken({ wrongKey: true });
    const response = await request(protectedApp)
      .post('/mcp')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(response.status).toBe(401);
  });

  it('rejects tokens with wrong issuer', async () => {
    const token = await createTestAccessToken({
      issuer: 'https://evil.example/',
    });
    const response = await request(protectedApp)
      .post('/mcp')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(response.status).toBe(401);
  });

  it('rejects tokens with wrong audience', async () => {
    const token = await createTestAccessToken({
      audience: 'https://other.example/mcp',
    });
    const response = await request(protectedApp)
      .post('/mcp')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(response.status).toBe(401);
  });

  it('rejects expired tokens', async () => {
    const token = await createTestAccessToken({ expiresInSeconds: -60 });
    const response = await request(protectedApp)
      .post('/mcp')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(response.status).toBe(401);
  });

  it('rejects not-yet-valid tokens', async () => {
    const token = await createTestAccessToken({ notBeforeOffsetSeconds: 3600 });
    const response = await request(protectedApp)
      .post('/mcp')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(response.status).toBe(401);
  });

  it('accepts access tokens with typ at+jwt', async () => {
    const token = await createTestAccessToken({ typ: 'at+jwt' });
    const response = await request(protectedApp)
      .post('/mcp')
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.1.0' },
        },
      });

    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });

  it('returns 403 when hellozen.read scope is missing', async () => {
    const token = await createTestAccessToken({ scope: 'other.scope' });
    const response = await request(protectedApp)
      .post('/mcp')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('insufficient_scope');
    expect(response.headers['www-authenticate']).toContain(
      `scope="${TEST_REQUIRED_SCOPE}"`,
    );
  });

  it('accepts valid bearer tokens', async () => {
    const token = await createTestAccessToken();
    const response = await request(protectedApp)
      .post('/mcp')
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.1.0' },
        },
      });

    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });

  async function expectNoUpstreamCalls(
    tokenFactory: () => Promise<string | undefined>,
  ): Promise<void> {
    let upstreamCalls = 0;
    const spyClient = new ReadOnlyHelloZenClient({
      ...TEST_CONFIG,
      fetchImpl: async (input, init) => {
        upstreamCalls += 1;
        return createFakeFetch()(input, init);
      },
    });

    const app = createApp({
      client: spyClient,
      auth: await createEnabledTestAuth(),
    });

    const token = await tokenFactory();
    const requestBuilder = request(app).post('/mcp');
    if (token) {
      requestBuilder.set('Authorization', `Bearer ${token}`);
    }
    await requestBuilder.send({});
    expect(upstreamCalls).toBe(0);
  }

  it('does not call HelloZen API without Authorization header', async () => {
    await expectNoUpstreamCalls(async () => undefined);
  });

  it('does not call HelloZen API for invalid signatures', async () => {
    await expectNoUpstreamCalls(async () =>
      createTestAccessToken({ wrongKey: true }),
    );
  });

  it('does not call HelloZen API for wrong audience', async () => {
    await expectNoUpstreamCalls(async () =>
      createTestAccessToken({ audience: 'https://other.example/mcp' }),
    );
  });

  it('does not call HelloZen API for missing scope', async () => {
    await expectNoUpstreamCalls(async () =>
      createTestAccessToken({ scope: 'other.scope' }),
    );
  });

  it('exposes protected resource metadata without authentication', async () => {
    const response = await request(protectedApp).get(
      '/.well-known/oauth-protected-resource/mcp',
    );

    expect(response.status).toBe(200);
    expect(response.body.resource).toBe(TEST_AUDIENCE);
    expect(response.body.authorization_servers).toEqual([TEST_ISSUER]);
    expect(response.body.scopes_supported).toContain(TEST_REQUIRED_SCOPE);
    expect(JSON.stringify(response.body)).not.toContain(TEST_CONFIG.readonlyToken);
  });

  it('exposes authorization server metadata without fabricated capabilities', async () => {
    const response = await request(protectedApp).get(
      '/.well-known/oauth-authorization-server',
    );

    expect(response.status).toBe(200);
    expect(response.body.issuer).toBe(TEST_ISSUER);
    expect(response.body.authorization_endpoint).toContain('/authorize');
    expect(response.body.token_endpoint).toContain('/token');
    expect(response.body.code_challenge_methods_supported).toEqual(['S256']);
    expect(response.body.response_types_supported).toEqual(['code']);
    expect(response.body).not.toHaveProperty('client_secret');
    expect(response.body).not.toHaveProperty('client_id');
  });

  it('keeps health endpoint public with minimal output', async () => {
    const response = await request(protectedApp).get('/healthz');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'hellozen-mcp',
    });
  });
});
