import { describe, expect, it, vi } from 'vitest';
import { ReadOnlyHelloZenClient } from '../src/hellozen/client.js';
import { HelloZenError } from '../src/hellozen/errors.js';
import { createFakeFetch, TEST_CONFIG } from './helpers/fake-fetch.js';

describe('ReadOnlyHelloZenClient cache and freshness', () => {
  it('separates cache keys for custom field models', async () => {
    const fetchImpl = vi.fn(createFakeFetch());
    const client = new ReadOnlyHelloZenClient({
      ...TEST_CONFIG,
      fetchImpl,
    });

    await client.listCustomFields('contact');
    await client.listCustomFields('opportunity');
    await client.listCustomFields('all');

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('reports cache metadata on repeated reads', async () => {
    const client = new ReadOnlyHelloZenClient({
      ...TEST_CONFIG,
      fetchImpl: createFakeFetch(),
    });

    const first = await client.listPipelines();
    const second = await client.listPipelines();

    expect(first.meta.source).toBe('live');
    expect(second.meta.source).toBe('cache');
    expect(second.meta.cacheAgeMs).toBeGreaterThanOrEqual(0);
  });

  it('bypasses cache when fresh=true', async () => {
    const fetchImpl = vi.fn(createFakeFetch());
    const client = new ReadOnlyHelloZenClient({
      ...TEST_CONFIG,
      fetchImpl,
    });

    await client.listPipelines();
    await client.listPipelines({ fresh: true });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('returns freshness error on fresh=true upstream failure', async () => {
    const fetchImpl = vi.fn(async () => new Response('Unauthorized', { status: 401 }));
    const client = new ReadOnlyHelloZenClient({
      ...TEST_CONFIG,
      fetchImpl,
    });

    await expect(client.listPipelines({ fresh: true })).rejects.toMatchObject({
      category: 'freshness',
    });
  });
});

describe('ReadOnlyHelloZenClient workflow detail', () => {
  it('extracts workflow dependencies from detail payload', async () => {
    const client = new ReadOnlyHelloZenClient({
      ...TEST_CONFIG,
      fetchImpl: createFakeFetch(),
    });

    const result = await client.getWorkflow('wf_detail');
    expect(result.data.dependencies.customFields.length).toBeGreaterThan(0);
    expect(result.data.dependencies.tags.some((tag) => tag.name === 'Booked')).toBe(
      true,
    );
    expect(result.data.dependencies.workflows.some((wf) => wf.id === 'wf_1')).toBe(
      true,
    );
    expect(result.data.triggers?.length).toBeGreaterThan(0);
    expect(result.data.actions?.length).toBeGreaterThan(0);
  });

  it('reports visibility limitations for metadata-only workflow', async () => {
    const client = new ReadOnlyHelloZenClient({
      ...TEST_CONFIG,
      fetchImpl: createFakeFetch(),
    });

    const result = await client.getWorkflow('wf_1');
    expect(result.data.visibilityLimitations.length).toBeGreaterThan(0);
  });
});

describe('ReadOnlyHelloZenClient read-only boundary', () => {
  it('never issues non-GET upstream requests', async () => {
    const methods: string[] = [];
    const fetchImpl = async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      methods.push((init?.method ?? 'GET').toUpperCase());
      return createFakeFetch()(input, init);
    };

    const client = new ReadOnlyHelloZenClient({
      ...TEST_CONFIG,
      fetchImpl,
    });

    await client.listTags();
    await client.getCalendar('cal_1');
    await client.getWorkflow('wf_detail');

    expect(methods.every((method) => method === 'GET')).toBe(true);
  });
});

describe('ReadOnlyHelloZenClient redaction', () => {
  it('does not leak bearer token into thrown errors', async () => {
    const client = new ReadOnlyHelloZenClient({
      ...TEST_CONFIG,
      fetchImpl: async () => new Response('Unauthorized', { status: 401 }),
    });

    try {
      await client.listPipelines({ fresh: true });
      expect.fail('expected error');
    } catch (error) {
      expect(error).toBeInstanceOf(HelloZenError);
      expect(String(error)).not.toContain(TEST_CONFIG.readonlyToken);
    }
  });
});
