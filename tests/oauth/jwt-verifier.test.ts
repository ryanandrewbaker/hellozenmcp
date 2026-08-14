import { beforeAll, describe, expect, it } from 'vitest';
import {
  createTestAccessToken,
  createTestVerifier,
  initOAuthTestKeys,
  TEST_AUDIENCE,
  TEST_ISSUER,
} from '../helpers/oauth-fixtures.js';

describe('JwtAccessTokenVerifier', () => {
  beforeAll(async () => {
    await initOAuthTestKeys();
  });

  it('accepts access tokens with typ at+jwt', async () => {
    const verifier = await createTestVerifier();
    const token = await createTestAccessToken({ typ: 'at+jwt' });
    const authInfo = await verifier.verifyAccessToken(token);
    expect(authInfo.scopes).toContain('hellozen.read');
  });

  it('accepts tokens with correct aud and no resource claim', async () => {
    const verifier = await createTestVerifier();
    const token = await createTestAccessToken({ resource: null });
    const authInfo = await verifier.verifyAccessToken(token);
    expect(authInfo.clientId).toBe('test-client');
  });

  it('accepts tokens when aud and resource are both correct', async () => {
    const verifier = await createTestVerifier();
    const token = await createTestAccessToken({
      audience: TEST_AUDIENCE,
      resource: TEST_AUDIENCE,
    });
    await expect(verifier.verifyAccessToken(token)).resolves.toBeDefined();
  });

  it('rejects tokens with wrong audience even if resource claim matches', async () => {
    const verifier = await createTestVerifier();
    const token = await createTestAccessToken({
      audience: 'https://other.example/mcp',
      resource: TEST_AUDIENCE,
    });
    await expect(verifier.verifyAccessToken(token)).rejects.toThrow(
      /audience|Invalid access token/i,
    );
  });

  it('rejects tokens with wrong resource claim when present', async () => {
    const verifier = await createTestVerifier();
    const token = await createTestAccessToken({
      resource: 'https://other.example/mcp',
    });
    await expect(verifier.verifyAccessToken(token)).rejects.toThrow(
      /resource mismatch/i,
    );
  });

  it('validates issuer exactly including trailing slash', async () => {
    const verifier = await createTestVerifier({ issuer: TEST_ISSUER });
    const matchingToken = await createTestAccessToken({
      issuer: TEST_ISSUER,
    });
    const wrongIssuerToken = await createTestAccessToken({
      issuer: 'https://auth.test.example',
    });

    await expect(verifier.verifyAccessToken(matchingToken)).resolves.toBeDefined();
    await expect(verifier.verifyAccessToken(wrongIssuerToken)).rejects.toThrow(
      /issuer|Invalid access token/i,
    );
  });

  it('rejects unsupported typ values', async () => {
    const verifier = await createTestVerifier();
    const token = await createTestAccessToken({ typ: 'refresh+jwt' });
    await expect(verifier.verifyAccessToken(token)).rejects.toThrow(
      /Unsupported token type/i,
    );
  });
});
