import { describe, expect, it } from 'vitest';
import { fetchAuthorizationServerMetadata } from '../../src/auth/discovery.js';
import { loadAuthConfig } from '../../src/auth/config.js';

function metadataResponse(metadata: Record<string, unknown>): Response {
  return new Response(JSON.stringify(metadata), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const baseMetadata = {
  authorization_endpoint: 'https://auth.example.com/authorize',
  token_endpoint: 'https://auth.example.com/token',
  response_types_supported: ['code'],
  code_challenge_methods_supported: ['S256'],
};

describe('fetchAuthorizationServerMetadata', () => {
  it('uses canonical metadata issuer with trailing slash from first OAuth candidate', async () => {
    const requested: string[] = [];
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      requested.push(url);
      if (
        url ===
        'https://auth.example.com/.well-known/oauth-authorization-server'
      ) {
        return metadataResponse({
          issuer: 'https://auth.example.com/',
          ...baseMetadata,
          jwks_uri: 'https://auth.example.com/.well-known/jwks.json',
        });
      }
      return new Response('not found', { status: 404 });
    };

    const metadata = await fetchAuthorizationServerMetadata(
      new URL('https://auth.example.com/'),
      fetchImpl as typeof fetch,
    );

    expect(metadata.issuer).toBe('https://auth.example.com/');
    expect(requested).toEqual([
      'https://auth.example.com/.well-known/oauth-authorization-server',
    ]);
  });

  it('attempts OAuth metadata before OIDC when OAuth fails', async () => {
    const requested: string[] = [];
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      requested.push(url);
      if (url.includes('oauth-authorization-server')) {
        return new Response('not found', { status: 404 });
      }
      if (url.includes('openid-configuration')) {
        return metadataResponse({
          issuer: 'https://auth.example.com',
          ...baseMetadata,
          jwks_uri: 'https://auth.example.com/.well-known/jwks.json',
        });
      }
      return new Response('not found', { status: 404 });
    };

    const metadata = await fetchAuthorizationServerMetadata(
      new URL('https://auth.example.com'),
      fetchImpl as typeof fetch,
    );

    expect(metadata.issuer).toBe('https://auth.example.com');
    expect(requested).toEqual([
      'https://auth.example.com/.well-known/oauth-authorization-server',
      'https://auth.example.com/.well-known/openid-configuration',
    ]);
  });

  it('discovers path-based issuer metadata from OAuth candidate first', async () => {
    const requested: string[] = [];
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      requested.push(url);
      if (
        url ===
        'https://auth.example.com/.well-known/oauth-authorization-server/tenant1'
      ) {
        return metadataResponse({
          issuer: 'https://auth.example.com/tenant1',
          authorization_endpoint:
            'https://auth.example.com/tenant1/authorize',
          token_endpoint: 'https://auth.example.com/tenant1/token',
          jwks_uri:
            'https://auth.example.com/tenant1/.well-known/jwks.json',
          response_types_supported: ['code'],
          code_challenge_methods_supported: ['S256'],
        });
      }
      return new Response('not found', { status: 404 });
    };

    const metadata = await fetchAuthorizationServerMetadata(
      new URL('https://auth.example.com/tenant1'),
      fetchImpl as typeof fetch,
    );

    expect(metadata.issuer).toBe('https://auth.example.com/tenant1');
    expect(requested).toEqual([
      'https://auth.example.com/.well-known/oauth-authorization-server/tenant1',
    ]);
  });

  it('rejects metadata issuer mismatch', async () => {
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('.well-known')) {
        return metadataResponse({
          issuer: 'https://evil.example.com/',
          ...baseMetadata,
        });
      }
      return new Response('not found', { status: 404 });
    };

    await expect(
      fetchAuthorizationServerMetadata(
        new URL('https://auth.example.com/'),
        fetchImpl as typeof fetch,
      ),
    ).rejects.toThrow(/does not correspond/);
  });

  it('rejects discovery redirects to unrelated hosts', async () => {
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('.well-known')) {
        return new Response(null, {
          status: 302,
          headers: { Location: 'https://evil.example.com/metadata' },
        });
      }
      return new Response('not found', { status: 404 });
    };

    await expect(
      fetchAuthorizationServerMetadata(
        new URL('https://auth.example.com'),
        fetchImpl as typeof fetch,
      ),
    ).rejects.toThrow(/unrelated host rejected/);
  });
});

describe('loadAuthConfig JWKS trust', () => {
  const envBase = {
    HELLOZEN_MCP_RESOURCE_URL: 'https://mcp.test.example/mcp',
    HELLOZEN_MCP_OAUTH_ISSUER: 'https://auth.test.example',
  };

  function discoveryFetch(jwksUri: string) {
    return async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('oauth-authorization-server')) {
        return metadataResponse({
          issuer: 'https://auth.test.example',
          authorization_endpoint: 'https://auth.test.example/authorize',
          token_endpoint: 'https://auth.test.example/token',
          jwks_uri: jwksUri,
          response_types_supported: ['code'],
          code_challenge_methods_supported: ['S256'],
        });
      }
      return new Response('not found', { status: 404 });
    };
  }

  it('accepts same-origin HTTPS JWKS from discovery metadata', async () => {
    const config = await loadAuthConfig(
      envBase,
      discoveryFetch('https://auth.test.example/.well-known/jwks.json') as typeof fetch,
    );
    expect(config.enabled).toBe(true);
  });

  it('accepts cross-origin HTTPS JWKS from validated discovery metadata', async () => {
    const config = await loadAuthConfig(
      envBase,
      discoveryFetch('https://keys.example-cdn.com/oauth/jwks') as typeof fetch,
    );
    expect(config.enabled).toBe(true);
  });

  it('rejects HTTP JWKS from discovery metadata', async () => {
    await expect(
      loadAuthConfig(
        envBase,
        discoveryFetch('http://auth.test.example/.well-known/jwks.json') as typeof fetch,
      ),
    ).rejects.toThrow(/JWKS URI must use HTTPS/);
  });

  it('accepts explicit HTTPS JWKS override on a different origin', async () => {
    const config = await loadAuthConfig(
      {
        ...envBase,
        HELLOZEN_MCP_OAUTH_JWKS_URI:
          'https://override.example.com/.well-known/jwks.json',
      },
      discoveryFetch('https://auth.test.example/.well-known/jwks.json') as typeof fetch,
    );
    expect(config.enabled).toBe(true);
  });
});
