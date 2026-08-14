import { z } from 'zod';
import type { OAuthMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { OAuthTokenVerifier } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import { validateRequiredAuthorizationServerCapabilities } from './capabilities.js';
import {
  canonicalIssuerFromMetadata,
  fetchAuthorizationServerMetadata,
  type AuthorizationServerMetadata,
} from './discovery.js';
import {
  assertJwksUriTrusted,
  parseConfiguredIssuerUrl,
  parseConfiguredResourceUrl,
  parseConfiguredSecurityUrl,
} from './issuer.js';
import { HELLOZEN_READ_SCOPE } from './scopes.js';
import { createRemoteJwtVerifier } from './jwt-verifier.js';
import { loadTrustedIngress } from '../http/rate-limit.js';

const httpsUrlSchema = z
  .string()
  .url('Must be a valid URL')
  .refine(
    (value) => {
      const parsed = new URL(value);
      return (
        parsed.protocol === 'https:' ||
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1'
      );
    },
    { message: 'URL must use HTTPS (localhost is allowed for development)' },
  );

const authEnvSchema = z.object({
  HELLOZEN_MCP_RESOURCE_URL: httpsUrlSchema,
  HELLOZEN_MCP_OAUTH_ISSUER: httpsUrlSchema,
  HELLOZEN_MCP_OAUTH_AUDIENCE: httpsUrlSchema.optional(),
  HELLOZEN_MCP_OAUTH_JWKS_URI: httpsUrlSchema.optional(),
  HELLOZEN_MCP_TRUSTED_INGRESS: z.string().optional(),
});

/** Test-only: injected by unit tests to bypass OAuth. Not available via environment. */
export type DisabledAuthConfig = {
  enabled: false;
};

export type EnabledAuthConfig = {
  enabled: true;
  resourceUrl: URL;
  issuer: URL;
  canonicalIssuer: string;
  audience: string;
  scopesSupported: string[];
  oauthMetadata: OAuthMetadata;
  verifier: OAuthTokenVerifier;
  resourceMetadataUrl: string;
};

export type AuthConfig = EnabledAuthConfig;

export type AppAuthOptions = AuthConfig | DisabledAuthConfig;

function toOAuthMetadata(
  metadata: AuthorizationServerMetadata,
): OAuthMetadata {
  if (!metadata.authorization_endpoint || !metadata.token_endpoint) {
    throw new Error(
      'Authorization server metadata must include authorization_endpoint and token_endpoint',
    );
  }

  validateRequiredAuthorizationServerCapabilities(metadata);

  return {
    issuer: metadata.issuer,
    authorization_endpoint: metadata.authorization_endpoint,
    token_endpoint: metadata.token_endpoint,
    jwks_uri: metadata.jwks_uri,
    registration_endpoint: metadata.registration_endpoint,
    revocation_endpoint: metadata.revocation_endpoint,
    response_types_supported: metadata.response_types_supported,
    code_challenge_methods_supported: metadata.code_challenge_methods_supported,
    grant_types_supported: metadata.grant_types_supported,
    token_endpoint_auth_methods_supported:
      metadata.token_endpoint_auth_methods_supported,
    scopes_supported: metadata.scopes_supported,
    service_documentation: metadata.service_documentation,
  };
}

function buildScopesSupported(
  metadata: AuthorizationServerMetadata,
): string[] {
  const supported = metadata.scopes_supported ?? [];
  if (supported.includes(HELLOZEN_READ_SCOPE)) {
    return supported;
  }
  return [...supported, HELLOZEN_READ_SCOPE];
}

export async function loadAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<AuthConfig> {
  const parsed = authEnvSchema.safeParse(env);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => issue.message)
      .join('; ');
    throw new Error(`Invalid OAuth environment configuration: ${message}`);
  }

  const resourceUrl = parseConfiguredResourceUrl(
    parsed.data.HELLOZEN_MCP_RESOURCE_URL,
  );
  const configuredIssuer = parseConfiguredIssuerUrl(
    parsed.data.HELLOZEN_MCP_OAUTH_ISSUER,
  );
  const audience = parsed.data.HELLOZEN_MCP_OAUTH_AUDIENCE
    ? parseConfiguredSecurityUrl(
        parsed.data.HELLOZEN_MCP_OAUTH_AUDIENCE,
        'HELLOZEN_MCP_OAUTH_AUDIENCE',
      ).href
    : resourceUrl.href;

  loadTrustedIngress(env);

  const metadata = await fetchAuthorizationServerMetadata(
    configuredIssuer,
    fetchImpl,
  );
  const canonicalIssuer = canonicalIssuerFromMetadata(metadata);
  const oauthMetadata = toOAuthMetadata(metadata);

  const jwksUri = parsed.data.HELLOZEN_MCP_OAUTH_JWKS_URI
    ? parseConfiguredSecurityUrl(
        parsed.data.HELLOZEN_MCP_OAUTH_JWKS_URI,
        'HELLOZEN_MCP_OAUTH_JWKS_URI',
      )
    : metadata.jwks_uri
      ? new URL(metadata.jwks_uri)
      : undefined;

  if (!jwksUri) {
    throw new Error(
      'Authorization server metadata did not provide jwks_uri; set HELLOZEN_MCP_OAUTH_JWKS_URI',
    );
  }

  assertJwksUriTrusted(jwksUri);

  const verifier = createRemoteJwtVerifier({
    issuer: canonicalIssuer,
    audience,
    expectedResource: resourceUrl,
    jwksUri,
  });

  const { getOAuthProtectedResourceMetadataUrl } = await import(
    '@modelcontextprotocol/sdk/server/auth/router.js'
  );

  return {
    enabled: true,
    resourceUrl,
    issuer: configuredIssuer,
    canonicalIssuer,
    audience,
    scopesSupported: buildScopesSupported(metadata),
    oauthMetadata,
    verifier,
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceUrl),
  };
}
