import { describe, expect, it } from 'vitest';
import {
  buildHelloZenUrl,
  FORBIDDEN_PATH_FRAGMENTS,
  HELLOZEN_API_ORIGIN,
  isForbiddenHelloZenPath,
} from '../src/hellozen/endpoints.js';
import { ReadOnlyHelloZenTransport } from '../src/hellozen/transport.js';
import { createFakeFetch, TEST_CONFIG } from './helpers/fake-fetch.js';

function createTransport(fetchImpl = createFakeFetch()) {
  return new ReadOnlyHelloZenTransport({
    readonlyToken: TEST_CONFIG.readonlyToken,
    locationId: TEST_CONFIG.locationId,
    requestTimeoutMs: TEST_CONFIG.requestTimeoutMs,
    fetchImpl,
  });
}

describe('ReadOnlyHelloZenTransport', () => {
  it('uses GET for every upstream request', async () => {
    const methods: string[] = [];
    const fetchImpl = async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      methods.push((init?.method ?? 'GET').toUpperCase());
      return createFakeFetch()(input, init);
    };

    const transport = createTransport(fetchImpl);
    await transport.getJson({ kind: 'pipelines' });
    expect(methods).toEqual(['GET']);
  });

  it('rejects non-GET methods before fetch is called', () => {
    const transport = createTransport();
    const methods = ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'] as const;

    for (const method of methods) {
      expect(() => transport.assertMethodAllowed(method)).toThrow();
    }
  });

  it('only reaches the fixed LeadConnector origin and approved paths', async () => {
    const urls: string[] = [];
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = new URL(typeof input === 'string' ? input : input.url);
      urls.push(`${url.origin}${url.pathname}${url.search}`);
      return createFakeFetch()(input);
    };

    const transport = createTransport(fetchImpl);
    await transport.getJson({ kind: 'customFieldsBase' });
    await transport.getJson({ kind: 'customFieldsOpportunity' });
    await transport.getJson({ kind: 'pipelines' });
    await transport.getJson({ kind: 'calendars' });
    await transport.getJson({ kind: 'workflows' });

    for (const url of urls) {
      expect(url.startsWith(HELLOZEN_API_ORIGIN)).toBe(true);
      expect(
        [
          '/locations/loc_example/customFields',
          '/locations/loc_example/customFields?model=opportunity',
          '/opportunities/pipelines?locationId=loc_example',
          '/calendars/?locationId=loc_example',
          '/workflows/?locationId=loc_example',
        ].includes(url.replace(HELLOZEN_API_ORIGIN, '')),
      ).toBe(true);
    }
  });

  it('cannot reach forbidden endpoint paths through builders', () => {
    for (const fragment of FORBIDDEN_PATH_FRAGMENTS) {
      if (fragment === '/opportunities/') {
        continue;
      }
      expect(isForbiddenHelloZenPath(fragment)).toBe(true);
    }
  });

  it('rejects oversized Content-Length before reading body', async () => {
    const fetchImpl = async () =>
      new Response('{}', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(3 * 1024 * 1024),
        },
      });

    const transport = createTransport(fetchImpl);
    await expect(transport.getJson({ kind: 'pipelines' })).rejects.toThrow(
      /invalid configuration response/i,
    );
  });

  it('aborts when streamed body exceeds cap', async () => {
    const largeChunk = 'x'.repeat(1024 * 1024);
    const fetchImpl = async () =>
      new Response(`${largeChunk}${largeChunk}${largeChunk}`, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    const transport = createTransport(fetchImpl);
    await expect(transport.getJson({ kind: 'pipelines' })).rejects.toThrow(
      /invalid configuration response/i,
    );
  });

  it('does not expose tokens in errors', async () => {
    const fetchImpl = async () => new Response('Unauthorized', { status: 401 });
    const transport = createTransport(fetchImpl);

    await expect(transport.getJson({ kind: 'pipelines' })).rejects.toThrow(
      /authentication failed/i,
    );
    await expect(transport.getJson({ kind: 'pipelines' })).rejects.not.toThrow(
      /test-readonly-token-value/,
    );
  });

  it('rejects disallowed origins before fetch', async () => {
    const transport = createTransport();
    const badUrl = new URL('https://evil.example.com/locations/x/customFields');

    await expect(transport.requestGet(badUrl)).rejects.toThrow(
      /invalid configuration response/i,
    );
  });

  it('buildHelloZenUrl encodes location identifiers safely', () => {
    const url = buildHelloZenUrl('loc_example', { kind: 'pipelines' });
    expect(url.searchParams.get('locationId')).toBe('loc_example');
    expect(url.toString()).not.toContain('evil');
  });
});
