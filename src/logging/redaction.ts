const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /HELLOZEN_MCP_READONLY_TOKEN[=:]\s*\S+/gi,
  /pit-[a-f0-9-]{20,}/gi,
];

export function redactSecrets(value: string): string {
  let result = value;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

export function assertNoSecrets(value: string, token?: string): void {
  if (token && value.includes(token)) {
    throw new Error('Secret value leaked into output');
  }
  if (/Bearer\s+[A-Za-z0-9._-]{8,}/i.test(value)) {
    throw new Error('Bearer token leaked into output');
  }
}
