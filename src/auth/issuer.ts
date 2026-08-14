/**
 * Issuer URL utilities per RFC 8414 and OpenID Connect Discovery 1.0.
 *
 * JWT `iss` matching is exact-string. Discovery metadata `issuer` is canonical.
 * Configured issuer must correspond to discovered issuer before trusting metadata.
 */

export function stripUrlQueryAndFragment(value: string): URL {
  const url = new URL(value);
  url.hash = '';
  url.search = '';
  return url;
}

/** Remove a single trailing slash from the pathname (not the scheme delimiter). */
export function stripTrailingSlash(href: string): string {
  return href.endsWith('/') && href.length > 'https://x'.length
    ? href.slice(0, -1)
    : href;
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

export function buildAuthorizationServerDiscoveryCandidates(
  issuer: URL,
): URL[] {
  const candidates = [
    buildPathAwareWellKnownUrl(issuer, 'openid-configuration'),
    buildPathAwareWellKnownUrl(issuer, 'oauth-authorization-server'),
  ];

  // Legacy fallback: well-known appended to issuer path (some deployments).
  const legacyBase = stripTrailingSlash(issuer.href);
  candidates.push(
    new URL('.well-known/openid-configuration', `${legacyBase}/`),
    new URL('.well-known/oauth-authorization-server', `${legacyBase}/`),
  );

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
 * JWKS URI must be HTTPS (or localhost) and originate from the same host as the
 * configured issuer unless explicitly overridden via HELLOZEN_MCP_OAUTH_JWKS_URI.
 */
export function assertJwksUriTrusted(
  jwksUri: URL,
  issuer: URL,
  overridden: boolean,
): void {
  assertHttpsOrLocalhost(jwksUri, 'JWKS URI');

  if (overridden) {
    return;
  }

  if (jwksUri.origin !== issuer.origin) {
    throw new Error(
      `JWKS URI origin ${jwksUri.origin} does not match issuer origin ${issuer.origin}`,
    );
  }
}
