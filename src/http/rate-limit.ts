import type { Request } from 'express';
import rateLimit from 'express-rate-limit';

export type TrustedIngress = 'cloudflare';

const PRE_AUTH_LIMIT_PER_MINUTE = 300;
const AUTHENTICATED_LIMIT_PER_MINUTE = 300;

export function loadTrustedIngress(
  env: NodeJS.ProcessEnv = process.env,
): TrustedIngress | undefined {
  const value = env.HELLOZEN_MCP_TRUSTED_INGRESS?.trim();
  if (!value) {
    return undefined;
  }

  if (value === 'cloudflare') {
    return 'cloudflare';
  }

  throw new Error(
    'HELLOZEN_MCP_TRUSTED_INGRESS must be "cloudflare" when set',
  );
}

/**
 * Resolve a client IP for coarse pre-authentication rate limiting.
 *
 * Does not enable Express `trust proxy`. When HELLOZEN_MCP_TRUSTED_INGRESS=cloudflare,
 * uses Cloudflare's CF-Connecting-IP header set by cloudflared at the tunnel edge.
 */
export function resolvePreAuthClientKey(
  req: Request,
  trustedIngress?: TrustedIngress,
): string {
  if (trustedIngress === 'cloudflare') {
    const cfConnectingIp = req.headers['cf-connecting-ip'];
    if (typeof cfConnectingIp === 'string' && cfConnectingIp.length > 0) {
      return `cf:${cfConnectingIp}`;
    }
  }

  return `socket:${req.socket.remoteAddress ?? 'unknown'}`;
}

export function createPreAuthRateLimiter(trustedIngress?: TrustedIngress) {
  return rateLimit({
    windowMs: 60_000,
    max: PRE_AUTH_LIMIT_PER_MINUTE,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many MCP requests' },
    keyGenerator: (req) => resolvePreAuthClientKey(req, trustedIngress),
  });
}

export function createAuthenticatedRateLimiter() {
  return rateLimit({
    windowMs: 60_000,
    max: AUTHENTICATED_LIMIT_PER_MINUTE,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many MCP requests' },
    keyGenerator: (req) => `client:${req.auth?.clientId ?? 'unknown'}`,
  });
}
