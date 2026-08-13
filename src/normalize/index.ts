import {
  HELLOZEN_ERROR_MESSAGES,
  HelloZenError,
} from '../hellozen/errors.js';
import type {
  CalendarOutput,
  CustomFieldOutput,
  PipelineOutput,
  WorkflowOutput,
} from '../schemas/mcp-output.js';
import {
  upstreamCalendarSchema,
  upstreamCalendarsResponseSchema,
  upstreamCustomFieldSchema,
  upstreamCustomFieldsResponseSchema,
  upstreamPipelineSchema,
  upstreamPipelinesResponseSchema,
  upstreamStageSchema,
  upstreamWorkflowSchema,
  upstreamWorkflowsResponseSchema,
} from '../schemas/upstream.js';

const MAX_ITEMS = 500;

export function normalizeCustomFields(
  payload: unknown,
): CustomFieldOutput[] {
  const parsed = upstreamCustomFieldsResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HelloZenError(
      HELLOZEN_ERROR_MESSAGES.invalidResponse,
      'invalid_response',
    );
  }

  const fields = parsed.data.customFields ?? [];
  if (fields.length > MAX_ITEMS) {
    throw new HelloZenError(
      HELLOZEN_ERROR_MESSAGES.invalidResponse,
      'invalid_response',
    );
  }

  const normalized: CustomFieldOutput[] = [];
  for (const item of fields) {
    const field = upstreamCustomFieldSchema.safeParse(item);
    if (!field.success) {
      throw new HelloZenError(
        HELLOZEN_ERROR_MESSAGES.invalidResponse,
        'invalid_response',
      );
    }
    normalized.push({
      id: field.data.id,
      name: field.data.name,
      fieldKey: field.data.fieldKey,
      model: field.data.model ?? 'contact',
      dataType: field.data.dataType,
      ...(field.data.picklistOptions
        ? { picklistOptions: field.data.picklistOptions }
        : {}),
    });
  }
  return normalized;
}

export function filterContactCustomFields(
  fields: CustomFieldOutput[],
): CustomFieldOutput[] {
  return fields.filter((field) => field.model !== 'opportunity');
}

export function mergeCustomFieldsById(
  ...groups: CustomFieldOutput[][]
): CustomFieldOutput[] {
  const merged = new Map<string, CustomFieldOutput>();
  for (const group of groups) {
    for (const field of group) {
      merged.set(field.id, field);
    }
  }
  return [...merged.values()];
}

export function normalizePipelines(payload: unknown): PipelineOutput[] {
  const parsed = upstreamPipelinesResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HelloZenError(
      HELLOZEN_ERROR_MESSAGES.invalidResponse,
      'invalid_response',
    );
  }

  const pipelines = parsed.data.pipelines ?? [];
  if (pipelines.length > MAX_ITEMS) {
    throw new HelloZenError(
      HELLOZEN_ERROR_MESSAGES.invalidResponse,
      'invalid_response',
    );
  }

  const normalized: PipelineOutput[] = [];
  for (const item of pipelines) {
    const pipeline = upstreamPipelineSchema.safeParse(item);
    if (!pipeline.success) {
      throw new HelloZenError(
        HELLOZEN_ERROR_MESSAGES.invalidResponse,
        'invalid_response',
      );
    }

    const stages: PipelineOutput['stages'] = [];
    for (const stageItem of pipeline.data.stages ?? []) {
      const stage = upstreamStageSchema.safeParse(stageItem);
      if (!stage.success) {
        throw new HelloZenError(
          HELLOZEN_ERROR_MESSAGES.invalidResponse,
          'invalid_response',
        );
      }
      stages.push({
        id: stage.data.id,
        name: stage.data.name,
        position: stage.data.position,
      });
    }

    normalized.push({
      id: pipeline.data.id,
      name: pipeline.data.name,
      stages,
    });
  }

  return normalized;
}

export function normalizeCalendars(payload: unknown): CalendarOutput[] {
  const parsed = upstreamCalendarsResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HelloZenError(
      HELLOZEN_ERROR_MESSAGES.invalidResponse,
      'invalid_response',
    );
  }

  const calendars = parsed.data.calendars ?? [];
  if (calendars.length > MAX_ITEMS) {
    throw new HelloZenError(
      HELLOZEN_ERROR_MESSAGES.invalidResponse,
      'invalid_response',
    );
  }

  const normalized: CalendarOutput[] = [];
  for (const item of calendars) {
    const calendar = upstreamCalendarSchema.safeParse(item);
    if (!calendar.success) {
      throw new HelloZenError(
        HELLOZEN_ERROR_MESSAGES.invalidResponse,
        'invalid_response',
      );
    }

    const output: CalendarOutput = {
      id: calendar.data.id,
      name: calendar.data.name,
    };

    if (calendar.data.description) {
      output.description = calendar.data.description;
    }
    if (calendar.data.slotDuration !== undefined) {
      output.duration = calendar.data.slotDuration;
    }
    if (calendar.data.isActive !== undefined) {
      output.status = calendar.data.isActive ? 'active' : 'inactive';
    }
    const timezone =
      calendar.data.timezone ?? calendar.data.selectedTimezone;
    if (timezone) {
      output.timezone = timezone;
    }
    if (calendar.data.groupId) {
      output.groupId = calendar.data.groupId;
    }

    normalized.push(output);
  }

  return normalized;
}

export function normalizeWorkflows(payload: unknown): WorkflowOutput[] {
  const parsed = upstreamWorkflowsResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HelloZenError(
      HELLOZEN_ERROR_MESSAGES.invalidResponse,
      'invalid_response',
    );
  }

  const workflows = parsed.data.workflows ?? [];
  if (workflows.length > MAX_ITEMS) {
    throw new HelloZenError(
      HELLOZEN_ERROR_MESSAGES.invalidResponse,
      'invalid_response',
    );
  }

  const normalized: WorkflowOutput[] = [];
  for (const item of workflows) {
    const workflow = upstreamWorkflowSchema.safeParse(item);
    if (!workflow.success) {
      throw new HelloZenError(
        HELLOZEN_ERROR_MESSAGES.invalidResponse,
        'invalid_response',
      );
    }

    normalized.push({
      id: workflow.data.id,
      name: workflow.data.name,
      status: workflow.data.status,
      ...(workflow.data.createdAt
        ? { createdAt: workflow.data.createdAt }
        : {}),
      ...(workflow.data.updatedAt
        ? { updatedAt: workflow.data.updatedAt }
        : {}),
    });
  }

  return normalized;
}
