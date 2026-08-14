import { describe, expect, it } from 'vitest';
import { loadAuthConfig } from '../../src/auth/config.js';

describe('loadAuthConfig', () => {
  it('fails closed when OAuth is enabled but required values are missing', async () => {
    await expect(
      loadAuthConfig({
        HELLOZEN_MCP_AUTH_ENABLED: 'true',
      }),
    ).rejects.toThrow(/HELLOZEN_MCP_RESOURCE_URL/);
  });

  it('requires explicit allow flag to disable authentication', async () => {
    await expect(
      loadAuthConfig({
        HELLOZEN_MCP_AUTH_ENABLED: 'false',
      }),
    ).rejects.toThrow(/HELLOZEN_MCP_ALLOW_AUTH_DISABLED=true/);
  });

  it('allows explicit test-only auth disable', async () => {
    const config = await loadAuthConfig({
      HELLOZEN_MCP_AUTH_ENABLED: 'false',
      HELLOZEN_MCP_ALLOW_AUTH_DISABLED: 'true',
    });

    expect(config.enabled).toBe(false);
  });
});
