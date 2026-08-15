import {
  HELLOZEN_ERROR_MESSAGES,
  HelloZenError,
} from '../hellozen/errors.js';
import type { FormOutput, TagOutput, UserOutput } from '../schemas/mcp-output.js';
import {
  upstreamFormSchema,
  upstreamFormsResponseSchema,
  upstreamTagSchema,
  upstreamTagsResponseSchema,
  upstreamUserSchema,
  upstreamUsersResponseSchema,
} from '../schemas/upstream.js';

const MAX_ITEMS = 500;

export function normalizeTags(payload: unknown): TagOutput[] {
  const parsed = upstreamTagsResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HelloZenError(
      HELLOZEN_ERROR_MESSAGES.invalidResponse,
      'invalid_response',
    );
  }

  const tags = parsed.data.tags ?? [];
  if (tags.length > MAX_ITEMS) {
    throw new HelloZenError(
      HELLOZEN_ERROR_MESSAGES.invalidResponse,
      'invalid_response',
    );
  }

  const normalized: TagOutput[] = [];
  for (const item of tags) {
    const tag = upstreamTagSchema.safeParse(item);
    if (!tag.success) {
      throw new HelloZenError(
        HELLOZEN_ERROR_MESSAGES.invalidResponse,
        'invalid_response',
      );
    }
    normalized.push({
      ...(tag.data.id ? { id: tag.data.id } : {}),
      name: tag.data.name,
    });
  }
  return normalized;
}

export function normalizeUsers(payload: unknown): UserOutput[] {
  const parsed = upstreamUsersResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HelloZenError(
      HELLOZEN_ERROR_MESSAGES.invalidResponse,
      'invalid_response',
    );
  }

  const users = parsed.data.users ?? [];
  if (users.length > MAX_ITEMS) {
    throw new HelloZenError(
      HELLOZEN_ERROR_MESSAGES.invalidResponse,
      'invalid_response',
    );
  }

  const normalized: UserOutput[] = [];
  for (const item of users) {
    const user = upstreamUserSchema.safeParse(item);
    if (!user.success) {
      throw new HelloZenError(
        HELLOZEN_ERROR_MESSAGES.invalidResponse,
        'invalid_response',
      );
    }

    const displayName =
      user.data.name ??
      [user.data.firstName, user.data.lastName].filter(Boolean).join(' ').trim();
    if (!displayName) {
      continue;
    }

    normalized.push({
      id: user.data.id,
      displayName,
      ...(user.data.role ? { role: user.data.role } : {}),
      status: user.data.deleted ? 'deleted' : 'active',
    });
  }
  return normalized;
}

export function normalizeForms(payload: unknown): FormOutput[] {
  const parsed = upstreamFormsResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HelloZenError(
      HELLOZEN_ERROR_MESSAGES.invalidResponse,
      'invalid_response',
    );
  }

  const forms = parsed.data.forms ?? [];
  if (forms.length > MAX_ITEMS) {
    throw new HelloZenError(
      HELLOZEN_ERROR_MESSAGES.invalidResponse,
      'invalid_response',
    );
  }

  const normalized: FormOutput[] = [];
  for (const item of forms) {
    const form = upstreamFormSchema.safeParse(item);
    if (!form.success) {
      throw new HelloZenError(
        HELLOZEN_ERROR_MESSAGES.invalidResponse,
        'invalid_response',
      );
    }

    const record = item as Record<string, unknown>;
    const fieldReferences = extractFormFieldReferences(record);

    normalized.push({
      id: form.data.id,
      name: form.data.name,
      ...(record.status ? { status: String(record.status) } : {}),
      ...(fieldReferences.length > 0 ? { fieldReferences } : {}),
      visibilityLimitations: [
        'Form field definitions and workflow bindings may not be exposed by GET /forms/.',
      ],
    });
  }
  return normalized;
}

function extractFormFieldReferences(record: Record<string, unknown>): string[] {
  const refs = new Set<string>();
  const candidates = [record.fields, record.formFields, record.customFields];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) {
      continue;
    }
    for (const field of candidate) {
      if (!field || typeof field !== 'object') {
        continue;
      }
      const fieldRecord = field as Record<string, unknown>;
      const key = fieldRecord.fieldKey ?? fieldRecord.id ?? fieldRecord.name;
      if (typeof key === 'string' && key.length > 0) {
        refs.add(key);
      }
    }
  }
  return [...refs];
}
