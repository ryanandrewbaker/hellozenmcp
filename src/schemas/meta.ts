import { z } from 'zod';

export const freshInputSchema = z.object({
  fresh: z.boolean().optional(),
});

export const responseMetaSchema = z.object({
  source: z.enum(['live', 'cache']),
  fetchedAt: z.string(),
  cacheAgeMs: z.number().int().nonnegative(),
  complete: z.boolean(),
});

export type ResponseMeta = z.infer<typeof responseMetaSchema>;

export function buildResponseMeta(options: {
  source: ResponseMeta['source'];
  fetchedAt: Date;
  cacheAgeMs: number;
  complete: boolean;
}): ResponseMeta {
  return {
    source: options.source,
    fetchedAt: options.fetchedAt.toISOString(),
    cacheAgeMs: options.cacheAgeMs,
    complete: options.complete,
  };
}

export function withMeta<T extends Record<string, unknown>>(
  data: T,
  meta: ResponseMeta,
): T & { meta: ResponseMeta } {
  return { ...data, meta };
}
