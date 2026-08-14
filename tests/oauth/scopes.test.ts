import { describe, expect, it } from 'vitest';
import { parseTokenScopes, tokenHasScope } from '../../src/auth/scopes.js';

describe('scope parsing', () => {
  it('parses space-delimited scope strings', () => {
    expect(parseTokenScopes('hellozen.read other.scope')).toEqual([
      'hellozen.read',
      'other.scope',
    ]);
  });

  it('parses array scope claims', () => {
    expect(parseTokenScopes(['hellozen.read', 'hellozen.write'])).toEqual([
      'hellozen.read',
      'hellozen.write',
    ]);
  });

  it('returns empty array for missing scope claims', () => {
    expect(parseTokenScopes(undefined)).toEqual([]);
  });

  it('checks required scope membership', () => {
    expect(tokenHasScope(['hellozen.read'], 'hellozen.read')).toBe(true);
    expect(tokenHasScope(['other.scope'], 'hellozen.read')).toBe(false);
  });
});
