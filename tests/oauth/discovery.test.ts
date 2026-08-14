import { describe, expect, it } from 'vitest';
import {
  buildAuthorizationServerDiscoveryCandidates,
  buildPathAwareWellKnownUrl,
  issuersCorrespond,
  parseConfiguredIssuerUrl,
  parseConfiguredResourceUrl,
} from '../../src/auth/issuer.js';

describe('issuer discovery URL construction', () => {
  it('builds well-known URL for issuer without path', () => {
    const issuer = new URL('https://auth.example.com');
    expect(
      buildPathAwareWellKnownUrl(issuer, 'oauth-authorization-server').href,
    ).toBe('https://auth.example.com/.well-known/oauth-authorization-server');
  });

  it('builds well-known URL for issuer with trailing slash', () => {
    const issuer = new URL('https://auth.example.com/');
    expect(
      buildPathAwareWellKnownUrl(issuer, 'openid-configuration').href,
    ).toBe('https://auth.example.com/.well-known/openid-configuration');
  });

  it('builds well-known URL for issuer with path component', () => {
    const issuer = new URL('https://auth.example.com/tenant1');
    expect(
      buildPathAwareWellKnownUrl(issuer, 'oauth-authorization-server').href,
    ).toBe(
      'https://auth.example.com/.well-known/oauth-authorization-server/tenant1',
    );
  });

  it('builds well-known URL for issuer with multi-segment path', () => {
    const issuer = new URL('https://auth.example.com/tenant1/realm');
    expect(
      buildPathAwareWellKnownUrl(issuer, 'openid-configuration').href,
    ).toBe(
      'https://auth.example.com/.well-known/openid-configuration/tenant1/realm',
    );
  });

  it('orders root-issuer discovery candidates OAuth before OIDC', () => {
    expect(
      buildAuthorizationServerDiscoveryCandidates(
        new URL('https://auth.example.com'),
      ).map((url) => url.href),
    ).toEqual([
      'https://auth.example.com/.well-known/oauth-authorization-server',
      'https://auth.example.com/.well-known/openid-configuration',
    ]);
  });

  it('orders path-issuer discovery candidates OAuth, OIDC, then OIDC legacy', () => {
    expect(
      buildAuthorizationServerDiscoveryCandidates(
        new URL('https://auth.example.com/tenant1'),
      ).map((url) => url.href),
    ).toEqual([
      'https://auth.example.com/.well-known/oauth-authorization-server/tenant1',
      'https://auth.example.com/.well-known/openid-configuration/tenant1',
      'https://auth.example.com/tenant1/.well-known/openid-configuration',
    ]);
  });

  it('orders multi-segment path issuer discovery candidates', () => {
    expect(
      buildAuthorizationServerDiscoveryCandidates(
        new URL('https://auth.example.com/tenant1/realm'),
      ).map((url) => url.href),
    ).toEqual([
      'https://auth.example.com/.well-known/oauth-authorization-server/tenant1/realm',
      'https://auth.example.com/.well-known/openid-configuration/tenant1/realm',
      'https://auth.example.com/tenant1/realm/.well-known/openid-configuration',
    ]);
  });
});

describe('configured security URL parsing', () => {
  it('rejects issuer URLs with query strings', () => {
    expect(() =>
      parseConfiguredIssuerUrl('https://auth.example.com?tenant=1'),
    ).toThrow(/HELLOZEN_MCP_OAUTH_ISSUER must not contain a query string/);
  });

  it('rejects issuer URLs with fragments', () => {
    expect(() =>
      parseConfiguredIssuerUrl('https://auth.example.com#fragment'),
    ).toThrow(/HELLOZEN_MCP_OAUTH_ISSUER must not contain a fragment/);
  });

  it('rejects resource URLs with query strings', () => {
    expect(() =>
      parseConfiguredResourceUrl('https://mcp.example.com/mcp?foo=bar'),
    ).toThrow(/HELLOZEN_MCP_RESOURCE_URL must not contain a query string/);
  });

  it('rejects resource URLs with fragments', () => {
    expect(() =>
      parseConfiguredResourceUrl('https://mcp.example.com/mcp#section'),
    ).toThrow(/HELLOZEN_MCP_RESOURCE_URL must not contain a fragment/);
  });

  it('preserves configured issuer URL without mutation', () => {
    const issuer = parseConfiguredIssuerUrl('https://auth.example.com/');
    expect(issuer.href).toBe('https://auth.example.com/');
  });
});

describe('issuer correspondence', () => {
  it('accepts exact issuer match with trailing slash', () => {
    expect(
      issuersCorrespond(
        'https://auth.example.com/',
        'https://auth.example.com/',
      ),
    ).toBe(true);
  });

  it('accepts configured issuer without slash when metadata includes slash', () => {
    expect(
      issuersCorrespond(
        'https://auth.example.com',
        'https://auth.example.com/',
      ),
    ).toBe(true);
  });

  it('rejects unrelated issuer', () => {
    expect(
      issuersCorrespond(
        'https://auth.example.com',
        'https://evil.example.com',
      ),
    ).toBe(false);
  });
});
