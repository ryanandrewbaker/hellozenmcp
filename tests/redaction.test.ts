import { describe, expect, it } from 'vitest';
import { assertNoSecrets, redactSecrets } from '../src/logging/redaction.js';

describe('secret redaction', () => {
  it('redacts bearer tokens from strings', () => {
    const redacted = redactSecrets(
      'Authorization: Bearer abc.def.ghi failed for HELLOZEN_MCP_READONLY_TOKEN=secret',
    );
    expect(redacted).not.toContain('abc.def.ghi');
    expect(redacted).not.toContain('secret');
    expect(redacted).toContain('[REDACTED]');
  });

  it('throws when token appears in output assertions', () => {
    expect(() => assertNoSecrets('ok', 'secret-token')).not.toThrow();
    expect(() =>
      assertNoSecrets('leaked Bearer abcdefghijklmnop value'),
    ).toThrow();
  });
});
