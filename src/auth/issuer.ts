/**
 * Issuer URL utilities per RFC 8414 and OpenID Connect Discovery 1.0.
 *
 * JWT `iss` matching is exact-string. Discovery metadata `issuer` is canonical.
 * Configured issuer must correspond to discovered issuer before trusting metadata.
 */

/** Remove a single trailing slash from the pathname (not the scheme delimiter). */
export function stripTrailingSlash(href: string): string {
  return href.endsWith('/') && href.length > 'https://x'.length
    ? href.slice(0, -1)
    : href;
}

/**
 * Parse a configured security URL without mutating query or fragment components.
 * Rejects URLs that contain query strings or fragments.
 */
export function parseConfiguredSecurityUrl(
  value: string,
  envVar: string,
): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${envVar} must be a valid absolute URL`);
  }

  if (url.search) {
    throw new Error(`${envVar} must not contain a query string`);
  }

  if (url.hash) {
    throw new Error(`${envVar} must not contain a fragment`);
  }

  return url;
}

export function parseConfiguredIssuerUrl(value: string): URL {
  return parseConfiguredSecurityUrl(value, 'HELLOZEN_MCP_OAUTH_ISSUER');
}

export function parseConfiguredResourceUrl(value: string): URL {
  return parseConfiguredSecurityUrl(value, 'HELLOZEN_MCP_RESOURCE_URL');
}

/**
 * Returns true when two issuer identifiers refer to the same authorization server
 * for configuration validation. JWT validation still uses the exact canonical issuer.
 */
export function issuersCorrespond(
  configured: string,
  discovered: string,
): boolean {
  if (configured === discovered) {
    return true;
  }

  return stripTrailingSlash(configured) === stripTrailingSlash(discovered);
}

/**
 * RFC 8414 / OIDC Discovery path-aware well-known URL construction.
 *
 * Issuer `https://auth.example.com/tenant1` becomes:
 * `https://auth.example.com/.well-known/{suffix}/tenant1`
 *
 * Issuer without path becomes:
 * `https://auth.example.com/.well-known/{suffix}`
 */
export function buildPathAwareWellKnownUrl(
  issuer: URL,
  wellKnownSuffix: string,
): URL {
  const issuerHref = issuer.href;
  const withoutTrailingSlash = stripTrailingSlash(issuerHref);
  const parsed = new URL(withoutTrailingSlash);

  const path = parsed.pathname;
  if (path === '/' || path === '') {
    return new URL(`/.well-known/${wellKnownSuffix}`, parsed);
  }

  const pathWithoutLeadingSlash = path.startsWith('/')
    ? path.slice(1)
    : path;
  return new URL(
    `/.well-known/${wellKnownSuffix}/${pathWithoutLeadingSlash}`,
    `${parsed.origin}/`,
  );
}

function issuerHasPathComponent(issuer: URL): boolean {
  const parsed = new URL(stripTrailingSlash(issuer.href));
  return parsed.pathname !== '/' && parsed.pathname !== '';
}

/**
 * Discovery candidates per RFC 8414 (OAuth AS Metadata) before OIDC Discovery.
 *
 * Root issuer:
 *   1. /.well-known/oauth-authorization-server
 *   2. /.well-known/openid-configuration
 *
 * Path issuer adds OIDC legacy path-appended form after the RFC path-aware pair:
 *   3. {issuer-path}/.well-known/openid-configuration
 */
export function buildAuthorizationServerDiscoveryCandidates(
  issuer: URL,
): URL[] {
  const candidates = [
    buildPathAwareWellKnownUrl(issuer, 'oauth-authorization-server'),
    buildPathAwareWellKnownUrl(issuer, 'openid-configuration'),
  ];

  if (issuerHasPathComponent(issuer)) {
    const legacyBase = stripTrailingSlash(issuer.href);
    candidates.push(
      new URL('.well-known/openid-configuration', `${legacyBase}/`),
    );
  }

  return candidates;
}

export function assertHttpsOrLocalhost(url: URL, label: string): void {
  if (
    url.protocol === 'https:' ||
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1'
  ) {
    return;
  }

  throw new Error(`${label} must use HTTPS: ${url.href}`);
}

/**
 * JWKS URI must be HTTPS (or localhost in development).
 * Cross-origin JWKS endpoints advertised by validated discovery metadata are permitted.
 */
export function assertJwksUriTrusted(jwksUri: URL): void {
  assertHttpsOrLocalhost(jwksUri, 'JWKS URI');
}
