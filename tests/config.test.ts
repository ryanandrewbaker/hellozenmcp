import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env.js';

describe('loadConfig', () => {
  const baseEnv = {
    HELLOZEN_MCP_READONLY_TOKEN: 'test-token',
    HELLOZEN_MCP_LOCATION_ID: 'loc_example',
  };

  it('fails closed when token is missing', () => {
    expect(() =>
      loadConfig({
        HELLOZEN_MCP_LOCATION_ID: 'loc_example',
      }),
    ).toThrow(/Invalid environment configuration/);
  });

  it('fails closed when location ID is missing', () => {
    expect(() =>
      loadConfig({
        HELLOZEN_MCP_READONLY_TOKEN: 'test-token',
      }),
    ).toThrow(/Invalid environment configuration/);
  });

  it('rejects legacy integration token variable', () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        HELLOZEN_PRIVATE_INTEGRATION_TOKEN: 'legacy-token',
      }),
    ).toThrow(/HELLOZEN_PRIVATE_INTEGRATION_TOKEN is not supported/);
  });

  it('rejects invalid location ID characters', () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        HELLOZEN_MCP_LOCATION_ID: 'bad/id',
      }),
    ).toThrow(/Invalid location ID format/);
  });

  it('never includes token value in validation errors', () => {
    try {
      loadConfig({
        HELLOZEN_MCP_LOCATION_ID: 'loc_example',
        HELLOZEN_MCP_READONLY_TOKEN: 'super-secret-token-value',
      });
    } catch {
      // loading with valid token succeeds — test invalid oversized token instead
    }

    expect(() =>
      loadConfig({
        HELLOZEN_MCP_LOCATION_ID: 'loc_example',
        HELLOZEN_MCP_READONLY_TOKEN: 'x'.repeat(600),
      }),
    ).toThrow(/Invalid environment configuration/);

    try {
      loadConfig({
        HELLOZEN_MCP_LOCATION_ID: 'loc_example',
        HELLOZEN_MCP_READONLY_TOKEN: 'x'.repeat(600),
      });
    } catch (error) {
      expect(String(error)).not.toContain('x'.repeat(100));
    }
  });

  it('loads valid configuration', () => {
    const config = loadConfig(baseEnv);
    expect(config.locationId).toBe('loc_example');
    expect(config.port).toBe(8790);
  });

  it('treats empty HELLOZEN_MCP_COMPANY_ID as unset', () => {
    const config = loadConfig({
      ...baseEnv,
      HELLOZEN_MCP_COMPANY_ID: '',
    });
    expect(config.companyId).toBeUndefined();
  });
});
