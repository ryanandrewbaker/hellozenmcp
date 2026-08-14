/** Required OAuth scope for all MCP tools in v1.1. Not configurable. */
export const HELLOZEN_READ_SCOPE = 'hellozen.read' as const;

export function parseTokenScopes(
  scopeClaim: unknown,
): string[] {
  if (typeof scopeClaim === 'string') {
    return scopeClaim.split(/\s+/).filter(Boolean);
  }

  if (Array.isArray(scopeClaim)) {
    return scopeClaim
      .filter((value): value is string => typeof value === 'string')
      .flatMap((value) => value.split(/\s+/))
      .filter(Boolean);
  }

  return [];
}

export function tokenHasScope(scopes: string[], requiredScope: string): boolean {
  return scopes.includes(requiredScope);
}
