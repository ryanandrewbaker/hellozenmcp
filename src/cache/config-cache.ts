type CacheEntry<T> = {
  value: T;
  fetchedAt: number;
  expiresAt: number;
};

export type CacheLookup<T> = {
  value: T;
  fetchedAt: Date;
  cacheAgeMs: number;
};

export class ConfigCache {
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private readonly ttlMs: number;
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(ttlSeconds: number) {
    this.ttlMs = ttlSeconds * 1000;
  }

  get<T>(key: string): T | undefined {
    return this.lookup<T>(key)?.value;
  }

  lookup<T>(key: string): CacheLookup<T> | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }

    const cacheAgeMs = Date.now() - entry.fetchedAt;
    return {
      value: entry.value as T,
      fetchedAt: new Date(entry.fetchedAt),
      cacheAgeMs,
    };
  }

  set<T>(key: string, value: T, fetchedAt: Date = new Date()): void {
    if (this.ttlMs <= 0) {
      return;
    }
    this.entries.set(key, {
      value,
      fetchedAt: fetchedAt.getTime(),
      expiresAt: fetchedAt.getTime() + this.ttlMs,
    });
  }

  clear(): void {
    this.entries.clear();
    this.inFlight.clear();
  }

  async dedupe<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const pending = this.inFlight.get(key);
    if (pending) {
      return pending as Promise<T>;
    }

    const promise = fetcher().finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, promise);
    return promise;
  }
}

export const CACHE_KEYS = {
  customFieldsBase: 'customFields:base',
  customFieldsOpportunity: 'customFields:opportunity',
  pipelines: 'pipelines',
  calendars: 'calendars',
  workflows: 'workflows',
  tags: 'tags',
  users: 'users',
  forms: 'forms',
  calendar: (calendarId: string) => `calendar:${calendarId}`,
  calendarSchedule: (calendarId: string) => `calendarSchedule:${calendarId}`,
  workflow: (workflowId: string) => `workflow:${workflowId}`,
} as const;
