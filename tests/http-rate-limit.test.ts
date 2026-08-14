import { describe, expect, it } from 'vitest';
import {
  loadTrustedIngress,
  resolvePreAuthClientKey,
} from '../src/http/rate-limit.js';

describe('HTTP rate limiting keys', () => {
  it('uses socket remote address by default', () => {
    const key = resolvePreAuthClientKey({
      headers: {},
      socket: { remoteAddress: '10.0.0.5' },
    } as never);
    expect(key).toBe('socket:10.0.0.5');
  });

  it('uses CF-Connecting-IP only when trusted ingress is cloudflare', () => {
    const key = resolvePreAuthClientKey(
      {
        headers: { 'cf-connecting-ip': '203.0.113.10' },
        socket: { remoteAddress: '172.18.0.2' },
      } as never,
      'cloudflare',
    );
    expect(key).toBe('cf:203.0.113.10');
  });

  it('falls back to socket address when cloudflare ingress is set but header is absent', () => {
    const key = resolvePreAuthClientKey(
      {
        headers: {},
        socket: { remoteAddress: '172.18.0.2' },
      } as never,
      'cloudflare',
    );
    expect(key).toBe('socket:172.18.0.2');
  });

  it('rejects unknown trusted ingress values at startup', () => {
    expect(() =>
      loadTrustedIngress({ HELLOZEN_MCP_TRUSTED_INGRESS: 'nginx' }),
    ).toThrow(/must be "cloudflare"/);
  });
});
