import type { WorkflowDependencies } from '../schemas/mcp-output.js';

export type UnresolvedReference = {
  type: string;
  id?: string;
  name?: string;
  sourceActionId?: string;
  sourceTriggerId?: string;
  context?: string;
};

export type DependencyContext = {
  usage: string;
  sourceActionId?: string;
  sourceTriggerId?: string;
};

type DependencyBuckets = WorkflowDependencies & {
  unresolved: UnresolvedReference[];
};

const KNOWN_ACTION_TYPES = new Set([
  'send_email',
  'send_sms',
  'wait',
  'delay',
  'create_task',
  'assign_user',
  'add_tag',
  'remove_tag',
  'update_contact_field',
  'update_opportunity_field',
  'create_opportunity',
  'update_opportunity',
  'change_pipeline_stage',
  'pipeline_stage',
  'workflow_enrollment',
  'remove_from_workflow',
  'calendar',
  'appointment',
  'if_else',
  'branch',
  'goal',
  'webhook',
  'custom_action',
]);

function emptyDependencies(): DependencyBuckets {
  return {
    customFields: [],
    pipelines: [],
    pipelineStages: [],
    calendars: [],
    tags: [],
    users: [],
    workflows: [],
    templates: [],
    customValues: [],
    forms: [],
    other: [],
    unresolved: [],
  };
}

function addUsage(
  list: WorkflowDependencies['customFields'],
  entry: {
    id?: string;
    name?: string;
    fieldKey?: string;
    usage: string;
  },
): void {
  const key = entry.id ?? entry.fieldKey ?? entry.name;
  if (!key) {
    return;
  }
  const existing = list.find(
    (item) =>
      (entry.id && item.id === entry.id) ||
      (entry.fieldKey && item.fieldKey === entry.fieldKey) ||
      (entry.name && item.name === entry.name),
  );
  if (existing) {
    if (!existing.usage.includes(entry.usage)) {
      existing.usage.push(entry.usage);
    }
    return;
  }
  list.push({
    id: entry.id,
    name: entry.name,
    fieldKey: entry.fieldKey,
    usage: [entry.usage],
  });
}

function walkNode(
  node: unknown,
  buckets: DependencyBuckets,
  context: DependencyContext,
  depth = 0,
): void {
  if (depth > 40 || node === null || node === undefined) {
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      walkNode(item, buckets, context, depth + 1);
    }
    return;
  }

  if (typeof node !== 'object') {
    return;
  }

  const record = node as Record<string, unknown>;

  const actionType = String(
    record.type ?? record.actionType ?? record.action ?? '',
  ).toLowerCase();

  if (actionType && KNOWN_ACTION_TYPES.has(actionType)) {
    extractFromAction(record, actionType, buckets, context);
  }

  const triggerType = String(record.triggerType ?? record.trigger ?? '').toLowerCase();
  if (triggerType) {
    extractFromTrigger(record, triggerType, buckets, context);
  }

  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string') {
      extractFromStringField(key, value, buckets, context);
    } else if (typeof value === 'object') {
      walkNode(value, buckets, context, depth + 1);
    }
  }
}

function extractFromStringField(
  key: string,
  value: string,
  buckets: DependencyBuckets,
  context: DependencyContext,
): void {
  const normalizedKey = key.toLowerCase();

  if (
    normalizedKey.includes('customfield') ||
    normalizedKey === 'fieldkey' ||
    normalizedKey === 'field_key'
  ) {
    addUsage(buckets.customFields, {
      fieldKey: value,
      usage: context.usage,
    });
  }

  if (normalizedKey.includes('tag')) {
    addUsage(buckets.tags, { name: value, usage: context.usage });
  }

  if (normalizedKey.includes('pipeline') && normalizedKey.includes('stage')) {
    addUsage(buckets.pipelineStages, { id: value, usage: context.usage });
  } else if (normalizedKey.includes('pipeline')) {
    addUsage(buckets.pipelines, { id: value, usage: context.usage });
  }

  if (normalizedKey.includes('calendar')) {
    addUsage(buckets.calendars, { id: value, usage: context.usage });
  }

  if (normalizedKey.includes('userid') || normalizedKey === 'assignedto') {
    addUsage(buckets.users, { id: value, usage: context.usage });
  }

  if (normalizedKey.includes('workflow')) {
    addUsage(buckets.workflows, { id: value, usage: context.usage });
  }

  if (normalizedKey.includes('template')) {
    addUsage(buckets.templates, { id: value, usage: context.usage });
  }

  if (normalizedKey.includes('form')) {
    addUsage(buckets.forms, { id: value, usage: context.usage });
  }
}

function extractFromAction(
  record: Record<string, unknown>,
  actionType: string,
  buckets: DependencyBuckets,
  context: DependencyContext,
): void {
  const actionId = stringOrUndefined(record.id ?? record.actionId);
  const actionContext: DependencyContext = {
    usage: `action:${actionType}`,
    sourceActionId: actionId,
  };

  if (actionType.includes('tag')) {
    const tag = stringOrUndefined(record.tag ?? record.tagName ?? record.value);
    if (tag) {
      addUsage(buckets.tags, { name: tag, usage: actionContext.usage });
    }
  }

  if (actionType.includes('field')) {
    const fieldKey = stringOrUndefined(
      record.fieldKey ?? record.customField ?? record.field,
    );
    const fieldId = stringOrUndefined(record.fieldId ?? record.customFieldId);
    if (fieldKey || fieldId) {
      addUsage(buckets.customFields, {
        id: fieldId,
        fieldKey,
        usage: actionContext.usage,
      });
    }
  }

  if (actionType.includes('pipeline') || actionType.includes('stage')) {
    const pipelineId = stringOrUndefined(record.pipelineId);
    const stageId = stringOrUndefined(record.stageId ?? record.pipelineStageId);
    if (pipelineId) {
      addUsage(buckets.pipelines, { id: pipelineId, usage: actionContext.usage });
    }
    if (stageId) {
      addUsage(buckets.pipelineStages, {
        id: stageId,
        usage: actionContext.usage,
      });
    }
  }

  if (actionType.includes('calendar') || actionType.includes('appointment')) {
    const calendarId = stringOrUndefined(record.calendarId);
    if (calendarId) {
      addUsage(buckets.calendars, { id: calendarId, usage: actionContext.usage });
    }
  }

  if (actionType.includes('workflow')) {
    const workflowId = stringOrUndefined(record.workflowId);
    if (workflowId) {
      addUsage(buckets.workflows, { id: workflowId, usage: actionContext.usage });
    }
  }

  if (actionType.includes('email') || actionType.includes('sms')) {
    const templateId = stringOrUndefined(
      record.templateId ?? record.emailTemplateId ?? record.smsTemplateId,
    );
    if (templateId) {
      addUsage(buckets.templates, { id: templateId, usage: actionContext.usage });
    }
  }

  if (actionType.includes('assign') || actionType.includes('task')) {
    const userId = stringOrUndefined(record.userId ?? record.assignedTo);
    if (userId) {
      addUsage(buckets.users, { id: userId, usage: actionContext.usage });
    }
  }

  for (const [key, value] of Object.entries(record)) {
    if (key === 'branches' || key === 'actions' || key === 'steps' || key === 'nodes') {
      walkNode(value, buckets, actionContext, 0);
      continue;
    }
    if (typeof value === 'string') {
      extractFromStringField(key, value, buckets, actionContext);
    }
  }
}

function extractFromTrigger(
  record: Record<string, unknown>,
  triggerType: string,
  buckets: DependencyBuckets,
  context: DependencyContext,
): void {
  const triggerId = stringOrUndefined(record.id ?? record.triggerId);
  const triggerContext: DependencyContext = {
    usage: `trigger:${triggerType}`,
    sourceTriggerId: triggerId,
  };

  const filters = record.filters ?? record.conditions;
  if (Array.isArray(filters)) {
    for (const filter of filters) {
      if (typeof filter !== 'object' || filter === null) {
        continue;
      }
      const filterRecord = filter as Record<string, unknown>;
      const field = stringOrUndefined(
        filterRecord.field ?? filterRecord.fieldKey ?? filterRecord.id,
      );
      if (field) {
        addUsage(buckets.customFields, {
          fieldKey: field,
          usage: triggerContext.usage,
        });
      }
    }
  }

  for (const [key, value] of Object.entries(record)) {
    if (key === 'filters' || key === 'conditions') {
      continue;
    }
    if (typeof value === 'string') {
      extractFromStringField(key, value, buckets, triggerContext);
    } else if (typeof value === 'object') {
      walkNode(value, buckets, triggerContext, 0);
    }
  }
}

function stringOrUndefined(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return undefined;
}

export function extractWorkflowDependencies(
  payload: unknown,
): {
  dependencies: WorkflowDependencies;
  unresolvedReferences: UnresolvedReference[];
} {
  const buckets = emptyDependencies();
  walkNode(payload, buckets, { usage: 'workflow_scan' }, 0);

  const { unresolved, ...dependencies } = buckets;
  return { dependencies, unresolvedReferences: unresolved };
}

export function hasWorkflowDetailPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') {
    return false;
  }
  const record = payload as Record<string, unknown>;
  const workflow = (record.workflow ?? record) as Record<string, unknown>;
  return Boolean(
    workflow.triggers ||
      workflow.actions ||
      workflow.steps ||
      workflow.workflowData ||
      workflow.nodes,
  );
}
