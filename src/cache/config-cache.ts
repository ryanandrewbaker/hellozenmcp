type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class ConfigCache {
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private readonly ttlMs: number;

  constructor(ttlSeconds: number) {
    this.ttlMs = ttlSeconds * 1000;
  }

  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T): void {
    if (this.ttlMs <= 0) {
      return;
    }
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  clear(): void {
    this.entries.clear();
  }
}

export const CACHE_KEYS = {
  customFieldsBase: 'customFields:base',
  customFieldsOpportunity: 'customFields:opportunity',
  pipelines: 'pipelines',
  calendars: 'calendars',
  workflows: 'workflows',
} as const;
