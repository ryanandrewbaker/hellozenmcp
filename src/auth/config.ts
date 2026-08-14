import { z } from 'zod';
import type { OAuthMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { OAuthTokenVerifier } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import {
  fetchAuthorizationServerMetadata,
  type AuthorizationServerMetadata,
} from './discovery.js';
import { createRemoteJwtVerifier } from './jwt-verifier.js';

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
  HELLOZEN_MCP_AUTH_ENABLED: z
    .enum(['true', 'false'])
    .default('true'),
  HELLOZEN_MCP_ALLOW_AUTH_DISABLED: z
    .enum(['true', 'false'])
    .default('false'),
  HELLOZEN_MCP_RESOURCE_URL: httpsUrlSchema.optional(),
  HELLOZEN_MCP_OAUTH_ISSUER: httpsUrlSchema.optional(),
  HELLOZEN_MCP_OAUTH_AUDIENCE: httpsUrlSchema.optional(),
  HELLOZEN_MCP_REQUIRED_SCOPE: z.string().min(1).default('hellozen.read'),
  HELLOZEN_MCP_OAUTH_JWKS_URI: httpsUrlSchema.optional(),
});

export type DisabledAuthConfig = {
  enabled: false;
};

export type EnabledAuthConfig = {
  enabled: true;
  resourceUrl: URL;
  issuer: URL;
  audience: string;
  requiredScope: string;
  scopesSupported: string[];
  oauthMetadata: OAuthMetadata;
  verifier: OAuthTokenVerifier;
  resourceMetadataUrl: string;
};

export type AuthConfig = DisabledAuthConfig | EnabledAuthConfig;

export type AppAuthOptions = AuthConfig;

function normalizeIssuerUrl(value: string): URL {
  const url = new URL(value);
  url.hash = '';
  url.search = '';
  return url;
}

function normalizeResourceUrl(value: string): URL {
  const url = new URL(value);
  url.hash = '';
  url.search = '';
  return url;
}

function toOAuthMetadata(
  metadata: AuthorizationServerMetadata,
): OAuthMetadata {
  if (!metadata.authorization_endpoint || !metadata.token_endpoint) {
    throw new Error(
      'Authorization server metadata must include authorization_endpoint and token_endpoint',
    );
  }

  return {
    issuer: metadata.issuer,
    authorization_endpoint: metadata.authorization_endpoint,
    token_endpoint: metadata.token_endpoint,
    jwks_uri: metadata.jwks_uri,
    registration_endpoint: metadata.registration_endpoint,
    revocation_endpoint: metadata.revocation_endpoint,
    response_types_supported: metadata.response_types_supported ?? ['code'],
    code_challenge_methods_supported:
      metadata.code_challenge_methods_supported ?? ['S256'],
    grant_types_supported: metadata.grant_types_supported ?? [
      'authorization_code',
      'refresh_token',
    ],
    token_endpoint_auth_methods_supported:
      metadata.token_endpoint_auth_methods_supported ?? [
        'client_secret_post',
        'none',
      ],
    scopes_supported: metadata.scopes_supported,
    service_documentation: metadata.service_documentation,
  };
}

function buildScopesSupported(
  metadata: AuthorizationServerMetadata,
  requiredScope: string,
): string[] {
  const supported = metadata.scopes_supported ?? [];
  if (supported.includes(requiredScope)) {
    return supported;
  }
  return [...supported, requiredScope];
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

  const authEnabled = parsed.data.HELLOZEN_MCP_AUTH_ENABLED === 'true';

  if (!authEnabled) {
    if (parsed.data.HELLOZEN_MCP_ALLOW_AUTH_DISABLED !== 'true') {
      throw new Error(
        'HELLOZEN_MCP_AUTH_ENABLED=false requires HELLOZEN_MCP_ALLOW_AUTH_DISABLED=true',
      );
    }

    return { enabled: false };
  }

  const resourceUrlValue = parsed.data.HELLOZEN_MCP_RESOURCE_URL;
  const issuerValue = parsed.data.HELLOZEN_MCP_OAUTH_ISSUER;

  if (!resourceUrlValue || !issuerValue) {
    throw new Error(
      'OAuth is enabled but HELLOZEN_MCP_RESOURCE_URL and HELLOZEN_MCP_OAUTH_ISSUER are required',
    );
  }

  const resourceUrl = normalizeResourceUrl(resourceUrlValue);
  const issuer = normalizeIssuerUrl(issuerValue);
  const audience =
    parsed.data.HELLOZEN_MCP_OAUTH_AUDIENCE ?? resourceUrl.href;
  const requiredScope = parsed.data.HELLOZEN_MCP_REQUIRED_SCOPE;

  const metadata = await fetchAuthorizationServerMetadata(issuer, fetchImpl);
  const oauthMetadata = toOAuthMetadata(metadata);

  const jwksUri = parsed.data.HELLOZEN_MCP_OAUTH_JWKS_URI
    ? new URL(parsed.data.HELLOZEN_MCP_OAUTH_JWKS_URI)
    : metadata.jwks_uri
      ? new URL(metadata.jwks_uri)
      : undefined;

  if (!jwksUri) {
    throw new Error(
      'Authorization server metadata did not provide jwks_uri; set HELLOZEN_MCP_OAUTH_JWKS_URI',
    );
  }

  const verifier = createRemoteJwtVerifier({
    issuer: issuer.href.replace(/\/$/, ''),
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
    issuer,
    audience,
    requiredScope,
    scopesSupported: buildScopesSupported(metadata, requiredScope),
    oauthMetadata,
    verifier,
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceUrl),
  };
}
