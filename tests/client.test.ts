import { describe, expect, it, vi } from 'vitest';
import { ReadOnlyHelloZenClient } from '../src/hellozen/client.js';
import { createFakeFetch, TEST_CONFIG } from './helpers/fake-fetch.js';

describe('ReadOnlyHelloZenClient cache', () => {
  it('caches contact and opportunity custom field sets separately', async () => {
    const fetchImpl = vi.fn(createFakeFetch());
    const client = new ReadOnlyHelloZenClient({
      ...TEST_CONFIG,
      fetchImpl,
    });

    await client.listCustomFields('all');
    await client.listCustomFields('contact');
    await client.listCustomFields('opportunity');

    const urls = fetchImpl.mock.calls.map(
      (call) => new URL(String(call[0])).pathname + new URL(String(call[0])).search,
    );

    expect(
      urls.filter((url) => url.includes('/customFields')).length,
    ).toBe(2);
  });
});
