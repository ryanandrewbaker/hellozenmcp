import {
  exportJWK,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
  type JWK,
} from 'jose';
import { createLocalJwtVerifier } from '../../src/auth/jwt-verifier.js';

export const TEST_ISSUER = 'https://auth.test.example';
export const TEST_AUDIENCE = 'https://mcp.test.example/mcp';
export const TEST_RESOURCE_URL = new URL(TEST_AUDIENCE);
export const TEST_REQUIRED_SCOPE = 'hellozen.read';

let privateKey: CryptoKey | undefined;
let publicJwk: JWK | undefined;
let keysReady: Promise<void> | undefined;

export async function initOAuthTestKeys(): Promise<void> {
  if (keysReady) {
    return keysReady;
  }

  keysReady = (async () => {
    const keyPair = await generateKeyPair('RS256');
    privateKey = keyPair.privateKey;
    publicJwk = await exportJWK(keyPair.publicKey);
    publicJwk.kid = 'test-key';
    publicJwk.alg = 'RS256';
    publicJwk.use = 'sig';
  })();

  return keysReady;
}

async function ensureOAuthTestKeys(): Promise<void> {
  await initOAuthTestKeys();
}

export function getTestJwks(): { keys: JWK[] } {
  if (!publicJwk) {
    throw new Error('OAuth test keys are not initialized');
  }
  return { keys: [publicJwk] };
}

export async function createTestVerifier() {
  await ensureOAuthTestKeys();
  return createLocalJwtVerifier({
    issuer: TEST_ISSUER,
    audience: TEST_AUDIENCE,
    expectedResource: TEST_RESOURCE_URL,
    jwks: getTestJwks(),
  });
}

export type TestTokenOptions = {
  scope?: string;
  audience?: string | string[];
  issuer?: string;
  expiresInSeconds?: number;
  notBeforeOffsetSeconds?: number;
  resource?: string;
  includeExpiration?: boolean;
  tokenUse?: string;
  unsigned?: boolean;
  wrongKey?: boolean;
};

export async function createTestAccessToken(
  options: TestTokenOptions = {},
): Promise<string> {
  await ensureOAuthTestKeys();
  if (!privateKey) {
    throw new Error('OAuth test keys are not initialized');
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresInSeconds = options.expiresInSeconds ?? 3600;
  const includeExpiration = options.includeExpiration ?? true;

  const payload: Record<string, unknown> = {
    scope: options.scope ?? TEST_REQUIRED_SCOPE,
    client_id: 'test-client',
    sub: 'test-subject',
    resource: options.resource ?? TEST_AUDIENCE,
  };

  if (options.tokenUse) {
    payload.token_use = options.tokenUse;
  }

  const builder = new SignJWT(payload)
    .setProtectedHeader({
      alg: 'RS256',
      kid: 'test-key',
      typ: options.tokenUse === 'id' ? 'JWT' : 'JWT',
    })
    .setIssuer(options.issuer ?? TEST_ISSUER)
    .setAudience(options.audience ?? TEST_AUDIENCE)
    .setIssuedAt(now);

  if (includeExpiration) {
    builder.setExpirationTime(now + expiresInSeconds);
  }

  if (options.notBeforeOffsetSeconds !== undefined) {
    builder.setNotBefore(now + options.notBeforeOffsetSeconds);
  }

  if (options.unsigned) {
    const header = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' }),
    ).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${header}.${body}.`;
  }

  if (options.wrongKey) {
    const wrongPair = await generateKeyPair('RS256');
    return builder.sign(wrongPair.privateKey);
  }

  return builder.sign(privateKey);
}

export const TEST_OAUTH_METADATA = {
  issuer: TEST_ISSUER,
  authorization_endpoint: `${TEST_ISSUER}/authorize`,
  token_endpoint: `${TEST_ISSUER}/token`,
  jwks_uri: `${TEST_ISSUER}/.well-known/jwks.json`,
  response_types_supported: ['code'],
  code_challenge_methods_supported: ['S256'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
  scopes_supported: [TEST_REQUIRED_SCOPE, 'hellozen.write'],
} as const;

export async function createEnabledTestAuth() {
  const verifier = await createTestVerifier();
  return {
    enabled: true as const,
    resourceUrl: TEST_RESOURCE_URL,
    issuer: new URL(TEST_ISSUER),
    audience: TEST_AUDIENCE,
    requiredScope: TEST_REQUIRED_SCOPE,
    scopesSupported: [TEST_REQUIRED_SCOPE, 'hellozen.write'],
    oauthMetadata: TEST_OAUTH_METADATA,
    verifier,
    resourceMetadataUrl:
      'https://mcp.test.example/.well-known/oauth-protected-resource/mcp',
  };
}

export function createDisabledTestAuth() {
  return { enabled: false as const };
}
