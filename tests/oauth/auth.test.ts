import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { ReadOnlyHelloZenClient } from '../../src/hellozen/client.js';
import { createApp } from '../../src/http/app.js';
import {
  createDisabledTestAuth,
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
  const openApp = createApp({
    client: new ReadOnlyHelloZenClient({
      ...TEST_CONFIG,
      fetchImpl: createFakeFetch(),
    }),
    auth: createDisabledTestAuth(),
  });

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
      issuer: 'https://evil.example',
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

  it('rejects ID tokens presented as access tokens', async () => {
    const token = await createTestAccessToken({ tokenUse: 'id' });
    const response = await request(protectedApp)
      .post('/mcp')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(response.status).toBe(401);
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
          clientInfo: { name: 'test', version: '1.0.0' },
        },
      });

    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });

  it('does not call HelloZen API on authentication failure', async () => {
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
    await request(app).post('/mcp').send({});
    expect(upstreamCalls).toBe(0);
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

  it('exposes authorization server metadata mirror without authentication', async () => {
    const response = await request(protectedApp).get(
      '/.well-known/oauth-authorization-server',
    );

    expect(response.status).toBe(200);
    expect(response.body.issuer).toBe(TEST_ISSUER);
    expect(response.body.authorization_endpoint).toContain('/authorize');
    expect(response.body.token_endpoint).toContain('/token');
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

  it('allows MCP access when auth is explicitly disabled for tests', async () => {
    const response = await request(openApp)
      .post('/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' },
        },
      });

    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });
});
