import type { OAuthMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';

export type AuthorizationServerMetadata = OAuthMetadata & {
  jwks_uri?: string;
};

function joinIssuerPath(issuer: URL, path: string): URL {
  const normalizedIssuer = issuer.href.endsWith('/')
    ? issuer.href
    : `${issuer.href}/`;
  return new URL(path.replace(/^\//, ''), normalizedIssuer);
}

export async function fetchAuthorizationServerMetadata(
  issuer: URL,
  fetchImpl: typeof fetch = fetch,
): Promise<AuthorizationServerMetadata> {
  const discoveryUrls = [
    joinIssuerPath(issuer, '.well-known/openid-configuration'),
    joinIssuerPath(issuer, '.well-known/oauth-authorization-server'),
  ];

  let lastError: unknown;

  for (const discoveryUrl of discoveryUrls) {
    try {
      const response = await fetchImpl(discoveryUrl, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        lastError = new Error(
          `Authorization server discovery failed (${response.status}) at ${discoveryUrl.href}`,
        );
        continue;
      }

      const metadata = (await response.json()) as AuthorizationServerMetadata;

      if (!metadata.issuer) {
        throw new Error('Authorization server metadata is missing issuer');
      }

      if (metadata.issuer !== issuer.href && metadata.issuer !== issuer.href.replace(/\/$/, '')) {
        throw new Error('Authorization server metadata issuer does not match configured issuer');
      }

      return metadata;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Authorization server discovery failed');
}
