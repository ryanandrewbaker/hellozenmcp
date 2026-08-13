export type HelloZenErrorCategory =
  | 'authentication'
  | 'access_denied'
  | 'invalid_response'
  | 'timeout'
  | 'upstream'
  | 'rate_limit'
  | 'internal';

export class HelloZenError extends Error {
  readonly category: HelloZenErrorCategory;

  constructor(message: string, category: HelloZenErrorCategory) {
    super(message);
    this.name = 'HelloZenError';
    this.category = category;
  }
}

export const HELLOZEN_ERROR_MESSAGES = {
  authentication: 'HelloZen authentication failed.',
  accessDenied: 'HelloZen denied access to this configuration resource.',
  invalidResponse: 'HelloZen returned an invalid configuration response.',
  timeout: 'HelloZen configuration request timed out.',
  rateLimit: 'Tool rate limit exceeded. Try again shortly.',
} as const;
