import type { Request } from 'express';
import rateLimit from 'express-rate-limit';

const PRE_AUTH_LIMIT_PER_MINUTE = 300;
const AUTHENTICATED_LIMIT_PER_MINUTE = 300;

/**
 * Resolve a client key for coarse pre-authentication rate limiting.
 *
 * Uses only the socket peer address. Does not inspect forwarded headers or
 * enable Express `trust proxy`.
 */
export function resolvePreAuthClientKey(req: Request): string {
  return `socket:${req.socket.remoteAddress ?? 'unknown'}`;
}

export function resolveAuthenticatedClientKey(req: Request): string {
  return `client:${req.auth?.clientId ?? 'unknown'}`;
}

export function createPreAuthRateLimiter() {
  return rateLimit({
    windowMs: 60_000,
    max: PRE_AUTH_LIMIT_PER_MINUTE,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many MCP requests' },
    keyGenerator: (req) => resolvePreAuthClientKey(req),
  });
}

export function createAuthenticatedRateLimiter() {
  return rateLimit({
    windowMs: 60_000,
    max: AUTHENTICATED_LIMIT_PER_MINUTE,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many MCP requests' },
    keyGenerator: (req) => resolveAuthenticatedClientKey(req),
  });
}
