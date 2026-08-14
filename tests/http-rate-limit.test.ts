import { describe, expect, it } from 'vitest';
import {
  resolveAuthenticatedClientKey,
  resolvePreAuthClientKey,
} from '../src/http/rate-limit.js';

describe('HTTP rate limiting keys', () => {
  it('uses socket remoteAddress as the pre-auth key', () => {
    const key = resolvePreAuthClientKey({
      headers: {},
      socket: { remoteAddress: '10.0.0.5' },
    } as never);
    expect(key).toBe('socket:10.0.0.5');
  });

  it('ignores CF-Connecting-IP for the pre-auth key', () => {
    const key = resolvePreAuthClientKey({
      headers: { 'cf-connecting-ip': '203.0.113.10' },
      socket: { remoteAddress: '172.18.0.2' },
    } as never);
    expect(key).toBe('socket:172.18.0.2');
  });

  it('ignores X-Forwarded-For for the pre-auth key', () => {
    const key = resolvePreAuthClientKey({
      headers: { 'x-forwarded-for': '203.0.113.10, 198.51.100.1' },
      socket: { remoteAddress: '172.18.0.2' },
    } as never);
    expect(key).toBe('socket:172.18.0.2');
  });

  it('falls back safely when socket remoteAddress is missing', () => {
    const key = resolvePreAuthClientKey({
      headers: {},
      socket: {},
    } as never);
    expect(key).toBe('socket:unknown');
  });

  it('keys the authenticated limiter by req.auth.clientId', () => {
    const key = resolveAuthenticatedClientKey({
      auth: { clientId: 'cursor-client' },
    } as never);
    expect(key).toBe('client:cursor-client');
  });
});
