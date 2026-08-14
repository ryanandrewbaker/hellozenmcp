import {
  createLocalJWKSet,
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey,
} from 'jose';
import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type { OAuthTokenVerifier } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { log } from '../logging/logger.js';
import { parseTokenScopes } from './scopes.js';

const ALLOWED_ALGORITHMS = [
  'RS256',
  'RS384',
  'RS512',
  'ES256',
  'ES384',
  'ES512',
  'PS256',
  'PS384',
  'PS512',
] as const;

export type JwtVerifierOptions = {
  issuer: string;
  audience: string | string[];
  expectedResource?: URL;
  jwks: JWTVerifyGetKey;
};

function mapVerificationError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('expired')) {
      return 'Token has expired';
    }
    if (error.message.includes('not yet valid')) {
      return 'Token is not yet valid';
    }
    if (error.message.includes('signature')) {
      return 'Invalid token signature';
    }
    if (error.message.includes('audience')) {
      return 'Token audience mismatch';
    }
    if (error.message.includes('issuer')) {
      return 'Token issuer mismatch';
    }
    return 'Invalid access token';
  }

  return 'Invalid access token';
}

function assertAccessTokenClaims(payload: Record<string, unknown>): void {
  if (payload.typ === 'ID' || payload.token_use === 'id') {
    throw new InvalidTokenError('ID token cannot be used as access token');
  }
}

function resolveClientId(payload: Record<string, unknown>): string {
  const candidate =
    payload.client_id ?? payload.azp ?? payload.sub ?? payload.cid;

  if (typeof candidate !== 'string' || candidate.length === 0) {
    throw new InvalidTokenError('Token is missing client identifier');
  }

  return candidate;
}

export class JwtAccessTokenVerifier implements OAuthTokenVerifier {
  constructor(private readonly options: JwtVerifierOptions) {}

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    if (!token || token.split('.').length !== 3) {
      throw new InvalidTokenError('Malformed bearer token');
    }

    try {
      const { payload } = await jwtVerify(token, this.options.jwks, {
        issuer: this.options.issuer,
        audience: this.options.audience,
        algorithms: [...ALLOWED_ALGORITHMS],
        typ: 'JWT',
      });

      const claims = payload as Record<string, unknown>;
      assertAccessTokenClaims(claims);

      if (this.options.expectedResource) {
        const resourceClaim = claims.resource ?? claims.aud;
        const expected = this.options.expectedResource.href.replace(/\/$/, '');
        const resources = Array.isArray(resourceClaim)
          ? resourceClaim
          : [resourceClaim];

        const matches = resources.some((value) => {
          if (typeof value !== 'string') {
            return false;
          }
          return value.replace(/\/$/, '') === expected;
        });

        if (!matches) {
          log({
            event: 'auth_failure',
            success: false,
            error_category: 'resource_mismatch',
          });
          throw new InvalidTokenError('Token resource mismatch');
        }
      }

      const scopes = parseTokenScopes(claims.scope ?? claims.scp);
      const expiresAt = typeof claims.exp === 'number' ? claims.exp : undefined;
      const notBefore =
        typeof claims.nbf === 'number' ? claims.nbf : undefined;

      if (notBefore !== undefined && notBefore > Date.now() / 1000) {
        throw new InvalidTokenError('Token is not yet valid');
      }

      if (expiresAt === undefined) {
        throw new InvalidTokenError('Token has no expiration time');
      }

      const resource =
        typeof claims.resource === 'string'
          ? new URL(claims.resource)
          : undefined;

      return {
        token,
        clientId: resolveClientId(claims),
        scopes,
        expiresAt,
        resource,
        extra: {
          sub:
            typeof claims.sub === 'string' ? claims.sub : undefined,
        },
      };
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        log({
          event: 'auth_failure',
          success: false,
          error_category: 'invalid_token',
        });
        throw error;
      }

      log({
        event: 'auth_failure',
        success: false,
        error_category: 'verification_error',
      });
      throw new InvalidTokenError(mapVerificationError(error));
    }
  }
}

export function createRemoteJwtVerifier(
  options: Omit<JwtVerifierOptions, 'jwks'> & { jwksUri: URL },
): JwtAccessTokenVerifier {
  return new JwtAccessTokenVerifier({
    ...options,
    jwks: createRemoteJWKSet(options.jwksUri),
  });
}

export function createLocalJwtVerifier(
  options: Omit<JwtVerifierOptions, 'jwks'> & {
    jwks: { keys: Record<string, unknown>[] };
  },
): JwtAccessTokenVerifier {
  return new JwtAccessTokenVerifier({
    ...options,
    jwks: createLocalJWKSet(options.jwks),
  });
}
