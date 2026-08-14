import type { OAuthMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';
import {
  assertHttpsOrLocalhost,
  buildAuthorizationServerDiscoveryCandidates,
  issuersCorrespond,
  parseConfiguredIssuerUrl,
} from './issuer.js';

export type AuthorizationServerMetadata = OAuthMetadata & {
  jwks_uri?: string;
};

const MAX_REDIRECTS = 3;

async function fetchJson(
  url: URL,
  fetchImpl: typeof fetch,
  redirectCount = 0,
): Promise<unknown> {
  if (redirectCount > MAX_REDIRECTS) {
    throw new Error(`Too many redirects while fetching ${url.href}`);
  }

  assertHttpsOrLocalhost(url, 'Discovery URL');

  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json' },
    redirect: 'manual',
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (!location) {
      throw new Error(`Redirect without Location header from ${url.href}`);
    }

    const redirectUrl = new URL(location, url);
    if (redirectUrl.origin !== url.origin) {
      throw new Error(
        `Discovery redirect to unrelated host rejected: ${redirectUrl.origin}`,
      );
    }

    return fetchJson(redirectUrl, fetchImpl, redirectCount + 1);
  }

  if (!response.ok) {
    throw new Error(
      `Authorization server discovery failed (${response.status}) at ${url.href}`,
    );
  }

  return response.json();
}

export async function fetchAuthorizationServerMetadata(
  configuredIssuer: URL,
  fetchImpl: typeof fetch = fetch,
): Promise<AuthorizationServerMetadata> {
  const discoveryUrls = buildAuthorizationServerDiscoveryCandidates(
    configuredIssuer,
  );

  let lastError: unknown;

  for (const discoveryUrl of discoveryUrls) {
    try {
      const metadata = (await fetchJson(
        discoveryUrl,
        fetchImpl,
      )) as AuthorizationServerMetadata;

      if (!metadata.issuer) {
        throw new Error('Authorization server metadata is missing issuer');
      }

      if (!issuersCorrespond(configuredIssuer.href, metadata.issuer)) {
        throw new Error(
          'Authorization server metadata issuer does not correspond to configured issuer',
        );
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

export function canonicalIssuerFromMetadata(
  metadata: AuthorizationServerMetadata,
): string {
  return metadata.issuer;
}

export function configuredIssuerUrl(value: string): URL {
  return parseConfiguredIssuerUrl(value);
}
