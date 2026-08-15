import { z } from 'zod';

export const SERVICE_NAME = 'hellozen-mcp';

const locationIdSchema = z
  .string()
  .min(1, 'Location ID is required')
  .max(64, 'Location ID is too long')
  .regex(/^[A-Za-z0-9_-]+$/, 'Invalid location ID format');

const tokenSchema = z
  .string()
  .min(1, 'Read-only token is required')
  .max(512, 'Read-only token is too long');

const envSchema = z.object({
  HELLOZEN_MCP_READONLY_TOKEN: tokenSchema,
  HELLOZEN_MCP_LOCATION_ID: locationIdSchema,
  HELLOZEN_MCP_COMPANY_ID: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.string().min(1).max(64).optional(),
  ),
  HELLOZEN_MCP_PORT: z.coerce.number().int().min(1).max(65535).default(8790),
  HELLOZEN_MCP_BIND_HOST: z.string().min(1).default('0.0.0.0'),
  HELLOZEN_MCP_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(120_000)
    .default(10_000),
  HELLOZEN_MCP_CACHE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(0)
    .max(3600)
    .default(60),
});

export type AppConfig = {
  readonlyToken: string;
  locationId: string;
  companyId?: string;
  port: number;
  bindHost: string;
  requestTimeoutMs: number;
  cacheTtlSeconds: number;
};

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
): AppConfig {
  if (env.HELLOZEN_PRIVATE_INTEGRATION_TOKEN) {
    throw new Error(
      'HELLOZEN_PRIVATE_INTEGRATION_TOKEN is not supported. Use HELLOZEN_MCP_READONLY_TOKEN.',
    );
  }

  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => issue.message)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${message}`);
  }

  return {
    readonlyToken: parsed.data.HELLOZEN_MCP_READONLY_TOKEN,
    locationId: parsed.data.HELLOZEN_MCP_LOCATION_ID,
    companyId: parsed.data.HELLOZEN_MCP_COMPANY_ID,
    port: parsed.data.HELLOZEN_MCP_PORT,
    bindHost: parsed.data.HELLOZEN_MCP_BIND_HOST,
    requestTimeoutMs: parsed.data.HELLOZEN_MCP_REQUEST_TIMEOUT_MS,
    cacheTtlSeconds: parsed.data.HELLOZEN_MCP_CACHE_TTL_SECONDS,
  };
}
