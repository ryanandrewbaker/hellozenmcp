import {
  HELLOZEN_ERROR_MESSAGES,
  HelloZenError,
} from '../hellozen/errors.js';

type RateLimitState = {
  windowStartMs: number;
  count: number;
};

export class ToolRateLimiter {
  private state: RateLimitState = {
    windowStartMs: Date.now(),
    count: 0,
  };

  constructor(private readonly maxPerMinute: number) {}

  check(): void {
    const now = Date.now();
    if (now - this.state.windowStartMs >= 60_000) {
      this.state = { windowStartMs: now, count: 0 };
    }

    if (this.state.count >= this.maxPerMinute) {
      throw new HelloZenError(
        HELLOZEN_ERROR_MESSAGES.rateLimit,
        'rate_limit',
      );
    }

    this.state.count += 1;
  }

  reset(): void {
    this.state = { windowStartMs: Date.now(), count: 0 };
  }
}
