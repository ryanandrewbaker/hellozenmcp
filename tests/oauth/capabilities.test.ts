import { describe, expect, it } from 'vitest';
import { validateRequiredAuthorizationServerCapabilities } from '../../src/auth/capabilities.js';

const baseMetadata = {
  issuer: 'https://auth.example.com',
  authorization_endpoint: 'https://auth.example.com/authorize',
  token_endpoint: 'https://auth.example.com/token',
  response_types_supported: ['code'],
  code_challenge_methods_supported: ['S256'],
};

describe('validateRequiredAuthorizationServerCapabilities', () => {
  it('accepts metadata with required capabilities advertised', () => {
    expect(() =>
      validateRequiredAuthorizationServerCapabilities(baseMetadata),
    ).not.toThrow();
  });

  it('fails when response_types_supported is missing', () => {
    expect(() =>
      validateRequiredAuthorizationServerCapabilities({
        ...baseMetadata,
        response_types_supported: undefined,
      }),
    ).toThrow(/response_types_supported/);
  });

  it('fails when PKCE S256 is not advertised', () => {
    expect(() =>
      validateRequiredAuthorizationServerCapabilities({
        ...baseMetadata,
        code_challenge_methods_supported: ['plain'],
      }),
    ).toThrow(/S256/);
  });

  it('fails when authorization_code grant is explicitly unsupported', () => {
    expect(() =>
      validateRequiredAuthorizationServerCapabilities({
        ...baseMetadata,
        grant_types_supported: ['client_credentials'],
      }),
    ).toThrow(/authorization_code/);
  });
});
