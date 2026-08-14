import { describe, expect, it } from 'vitest';
import { loadAuthConfig } from '../../src/auth/config.js';

describe('loadAuthConfig', () => {
  it('fails closed when required OAuth values are missing', async () => {
    await expect(loadAuthConfig({})).rejects.toThrow(
      /Invalid OAuth environment configuration/,
    );
  });

  it('fails when discovery cannot succeed', async () => {
    const fetchImpl = async () => new Response('not found', { status: 404 });

    await expect(
      loadAuthConfig(
        {
          HELLOZEN_MCP_RESOURCE_URL: 'https://mcp.test.example/mcp',
          HELLOZEN_MCP_OAUTH_ISSUER: 'https://auth.test.example',
        },
        fetchImpl as typeof fetch,
      ),
    ).rejects.toThrow(/discovery failed/i);
  });

  it('fails when metadata lacks required PKCE capability', async () => {
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('.well-known')) {
        return new Response(
          JSON.stringify({
            issuer: 'https://auth.test.example',
            authorization_endpoint: 'https://auth.test.example/authorize',
            token_endpoint: 'https://auth.test.example/token',
            jwks_uri: 'https://auth.test.example/.well-known/jwks.json',
            response_types_supported: ['code'],
            code_challenge_methods_supported: ['plain'],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('not found', { status: 404 });
    };

    await expect(
      loadAuthConfig(
        {
          HELLOZEN_MCP_RESOURCE_URL: 'https://mcp.test.example/mcp',
          HELLOZEN_MCP_OAUTH_ISSUER: 'https://auth.test.example',
        },
        fetchImpl as typeof fetch,
      ),
    ).rejects.toThrow(/S256/);
  });

  it('rejects issuer URLs with query strings at startup', async () => {
    await expect(
      loadAuthConfig({
        HELLOZEN_MCP_RESOURCE_URL: 'https://mcp.test.example/mcp',
        HELLOZEN_MCP_OAUTH_ISSUER: 'https://auth.test.example?tenant=1',
      }),
    ).rejects.toThrow(/HELLOZEN_MCP_OAUTH_ISSUER must not contain a query string/);
  });

  it('rejects resource URLs with fragments at startup', async () => {
    await expect(
      loadAuthConfig({
        HELLOZEN_MCP_RESOURCE_URL: 'https://mcp.test.example/mcp#x',
        HELLOZEN_MCP_OAUTH_ISSUER: 'https://auth.test.example',
      }),
    ).rejects.toThrow(/HELLOZEN_MCP_RESOURCE_URL must not contain a fragment/);
  });
});
