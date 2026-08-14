import { describe, expect, it } from 'vitest';
import {
  fetchAuthorizationServerMetadata,
} from '../../src/auth/discovery.js';

function metadataResponse(metadata: Record<string, unknown>): Response {
  return new Response(JSON.stringify(metadata), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('fetchAuthorizationServerMetadata', () => {
  it('uses canonical metadata issuer with trailing slash', async () => {
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (
        url ===
        'https://auth.example.com/.well-known/oauth-authorization-server'
      ) {
        return metadataResponse({
          issuer: 'https://auth.example.com/',
          authorization_endpoint: 'https://auth.example.com/authorize',
          token_endpoint: 'https://auth.example.com/token',
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
  });

  it('discovers path-based issuer metadata', async () => {
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (
        url ===
        'https://auth.example.com/.well-known/openid-configuration/tenant1'
      ) {
        return metadataResponse({
          issuer: 'https://auth.example.com/tenant1',
          authorization_endpoint:
            'https://auth.example.com/tenant1/authorize',
          token_endpoint: 'https://auth.example.com/tenant1/token',
          jwks_uri:
            'https://auth.example.com/tenant1/.well-known/jwks.json',
        });
      }
      return new Response('not found', { status: 404 });
    };

    const metadata = await fetchAuthorizationServerMetadata(
      new URL('https://auth.example.com/tenant1'),
      fetchImpl as typeof fetch,
    );

    expect(metadata.issuer).toBe('https://auth.example.com/tenant1');
  });

  it('rejects metadata issuer mismatch', async () => {
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('.well-known')) {
        return metadataResponse({
          issuer: 'https://evil.example.com/',
          authorization_endpoint: 'https://evil.example.com/authorize',
          token_endpoint: 'https://evil.example.com/token',
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

  it('tries later discovery candidate when the first fails', async () => {
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('openid-configuration')) {
        return new Response('not found', { status: 404 });
      }
      if (url.includes('oauth-authorization-server')) {
        return metadataResponse({
          issuer: 'https://auth.example.com',
          authorization_endpoint: 'https://auth.example.com/authorize',
          token_endpoint: 'https://auth.example.com/token',
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
