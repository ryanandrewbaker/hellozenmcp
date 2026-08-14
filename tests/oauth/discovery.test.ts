import { describe, expect, it } from 'vitest';
import {
  buildAuthorizationServerDiscoveryCandidates,
  buildPathAwareWellKnownUrl,
  issuersCorrespond,
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

  it('includes RFC and legacy discovery candidates', () => {
    const candidates = buildAuthorizationServerDiscoveryCandidates(
      new URL('https://auth.example.com/tenant1'),
    );
    expect(candidates.map((url) => url.href)).toContain(
      'https://auth.example.com/.well-known/openid-configuration/tenant1',
    );
    expect(candidates.map((url) => url.href)).toContain(
      'https://auth.example.com/.well-known/oauth-authorization-server/tenant1',
    );
    expect(candidates.map((url) => url.href)).toContain(
      'https://auth.example.com/tenant1/.well-known/openid-configuration',
    );
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
