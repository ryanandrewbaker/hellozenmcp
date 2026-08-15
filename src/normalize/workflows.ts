import {
  HELLOZEN_ERROR_MESSAGES,
  HelloZenError,
} from '../hellozen/errors.js';
import type {
  WorkflowActionOutput,
  WorkflowBranchOutput,
  WorkflowDetailOutput,
  WorkflowTriggerOutput,
} from '../schemas/mcp-output.js';
import {
  upstreamWorkflowDetailResponseSchema,
  upstreamWorkflowSchema,
} from '../schemas/upstream.js';
import {
  extractWorkflowDependencies,
  hasWorkflowDetailPayload,
} from './workflow-detail.js';

const MAX_ITEMS = 500;

const WORKFLOW_DETAIL_VISIBILITY_GAP =
  'The official HelloZen workflows.readonly API exposes workflow identity and status only. Triggers, branches, and actions are not returned by the supported public list/detail endpoints.';

export function normalizeWorkflowDetail(
  payload: unknown,
  workflowId: string,
): WorkflowDetailOutput {
  const parsed = upstreamWorkflowDetailResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HelloZenError(
      HELLOZEN_ERROR_MESSAGES.invalidResponse,
      'invalid_response',
    );
  }

  const rawWorkflow =
    parsed.data.workflow ??
  (parsed.data as Record<string, unknown>).workflows ??
    parsed.data;

  const workflowRecord =
    Array.isArray(rawWorkflow) ? rawWorkflow[0] : rawWorkflow;

  const workflow = upstreamWorkflowSchema.safeParse(workflowRecord);
  if (!workflow.success) {
    throw new HelloZenError(
      HELLOZEN_ERROR_MESSAGES.invalidResponse,
      'invalid_response',
    );
  }

  if (workflow.data.id !== workflowId) {
    throw new HelloZenError(
      HELLOZEN_ERROR_MESSAGES.invalidResponse,
      'invalid_response',
    );
  }

  const hasDetail = hasWorkflowDetailPayload(payload);
  const { dependencies, unresolvedReferences } =
    extractWorkflowDependencies(payload);

  const detail: WorkflowDetailOutput = {
    id: workflow.data.id,
    name: workflow.data.name,
    status: workflow.data.status,
    ...(workflow.data.createdAt ? { createdAt: workflow.data.createdAt } : {}),
    ...(workflow.data.updatedAt ? { updatedAt: workflow.data.updatedAt } : {}),
    ...(workflow.data.version !== undefined
      ? { version: workflow.data.version }
      : {}),
    publishedState: workflow.data.status,
    dependencies,
    unresolvedReferences,
    visibilityLimitations: hasDetail ? [] : [WORKFLOW_DETAIL_VISIBILITY_GAP],
  };

  if (hasDetail && workflowRecord && typeof workflowRecord === 'object') {
    const record = workflowRecord as Record<string, unknown>;
    detail.triggers = normalizeTriggers(record.triggers ?? record.trigger);
    detail.actions = normalizeActions(
      record.actions ?? record.steps ?? record.workflowData ?? record.nodes,
    );
    detail.controlFlow = buildControlFlow(record);
    detail.summary = buildWorkflowSummary(detail);
    captureOtherConfiguration(detail, record);
  } else {
    detail.summary = `Workflow "${workflow.data.name}" (${workflow.data.status}). Trigger and action detail is not available through the supported read API.`;
  }

  if ((detail.triggers?.length ?? 0) > MAX_ITEMS) {
    throw new HelloZenError(
      HELLOZEN_ERROR_MESSAGES.invalidResponse,
      'invalid_response',
    );
  }

  return detail;
}

function normalizeTriggers(input: unknown): WorkflowTriggerOutput[] {
  if (!input) {
    return [];
  }
  const items = Array.isArray(input) ? input : [input];
  const triggers: WorkflowTriggerOutput[] = [];

  for (const item of items) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const record = item as Record<string, unknown>;
    const type = String(
      record.type ?? record.triggerType ?? record.key ?? 'unknown_trigger',
    );
    triggers.push({
      id: stringOrUndefined(record.id ?? record.triggerId),
      type,
      summary: summarizeTrigger(record, type),
      filters: Array.isArray(record.filters)
        ? record.filters
        : Array.isArray(record.conditions)
          ? record.conditions
          : undefined,
      referencedIds: collectReferencedIds(record),
      configuration: sanitizeConfiguration(record),
    });
  }

  return triggers;
}

function normalizeActions(input: unknown): WorkflowActionOutput[] {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input
      .flatMap((item) => normalizeActionNode(item))
      .slice(0, MAX_ITEMS);
  }

  if (typeof input === 'object' && input !== null) {
    const record = input as Record<string, unknown>;
    if (Array.isArray(record.actions)) {
      return normalizeActions(record.actions);
    }
    if (Array.isArray(record.steps)) {
      return normalizeActions(record.steps);
    }
    if (Array.isArray(record.nodes)) {
      return normalizeActions(record.nodes);
    }
  }

  return normalizeActionNode(input);
}

function normalizeActionNode(input: unknown): WorkflowActionOutput[] {
  if (!input || typeof input !== 'object') {
    return [];
  }

  const record = input as Record<string, unknown>;
  const type = String(
    record.type ?? record.actionType ?? record.action ?? 'unknown_action',
  );

  const action: WorkflowActionOutput = {
    id: stringOrUndefined(record.id ?? record.actionId ?? record.nodeId),
    type,
    summary: summarizeAction(record, type),
    configuration: sanitizeConfiguration(record),
  };

  const branches = normalizeBranches(record);
  if (branches.length > 0) {
    action.branches = branches;
  }

  return [action];
}

function normalizeBranches(
  record: Record<string, unknown>,
): WorkflowBranchOutput[] {
  const branchSources = [
    record.branches,
    record.conditions,
    record.paths,
    record.elseBranch,
    record.thenBranch,
  ];

  const branches: WorkflowBranchOutput[] = [];
  for (const source of branchSources) {
    if (!Array.isArray(source)) {
      continue;
    }
    for (const branch of source) {
      if (!branch || typeof branch !== 'object') {
        continue;
      }
      const branchRecord = branch as Record<string, unknown>;
      branches.push({
        id: stringOrUndefined(branchRecord.id),
        condition: stringOrUndefined(
          branchRecord.condition ?? branchRecord.name ?? branchRecord.label,
        ),
        actions: normalizeActions(
          branchRecord.actions ?? branchRecord.steps ?? branchRecord.nodes,
        ),
      });
    }
  }

  return branches;
}

function buildControlFlow(record: Record<string, unknown>): unknown {
  return {
    triggers: record.triggers ?? record.trigger ?? null,
    actions: record.actions ?? record.steps ?? record.workflowData ?? record.nodes,
    branches: record.branches ?? record.conditions ?? null,
  };
}

function buildWorkflowSummary(detail: WorkflowDetailOutput): string {
  const triggerCount = detail.triggers?.length ?? 0;
  const actionCount = detail.actions?.length ?? 0;
  return `Workflow "${detail.name}" (${detail.status}) with ${triggerCount} trigger(s) and ${actionCount} top-level action node(s).`;
}

function captureOtherConfiguration(
  detail: WorkflowDetailOutput,
  record: Record<string, unknown>,
): void {
  const knownKeys = new Set([
    'id',
    'name',
    'status',
    'createdAt',
    'updatedAt',
    'version',
    'triggers',
    'trigger',
    'actions',
    'steps',
    'workflowData',
    'nodes',
    'locationId',
  ]);
  const other: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!knownKeys.has(key)) {
      other[key] = value;
    }
  }
  if (Object.keys(other).length > 0) {
    detail.otherConfiguration = other;
  }
}

function summarizeTrigger(
  record: Record<string, unknown>,
  type: string,
): string {
  const name = stringOrUndefined(record.name ?? record.title ?? record.label);
  return name ? `${type}: ${name}` : type;
}

function summarizeAction(
  record: Record<string, unknown>,
  type: string,
): string {
  const parts = [type];
  const subject = stringOrUndefined(record.subject ?? record.title);
  const channel = stringOrUndefined(record.channel);
  const fieldKey = stringOrUndefined(record.fieldKey ?? record.field);
  const tag = stringOrUndefined(record.tag ?? record.tagName);
  if (subject) {
    parts.push(`subject=${subject}`);
  }
  if (channel) {
    parts.push(`channel=${channel}`);
  }
  if (fieldKey) {
    parts.push(`field=${fieldKey}`);
  }
  if (tag) {
    parts.push(`tag=${tag}`);
  }
  return parts.join(' ');
}

function collectReferencedIds(
  record: Record<string, unknown>,
): Record<string, string[]> | undefined {
  const buckets: Record<string, string[]> = {};
  const add = (key: string, value: unknown) => {
    if (typeof value !== 'string' || !value) {
      return;
    }
    buckets[key] ??= [];
    if (!buckets[key].includes(value)) {
      buckets[key].push(value);
    }
  };

  add('pipelineId', record.pipelineId);
  add('stageId', record.stageId ?? record.pipelineStageId);
  add('calendarId', record.calendarId);
  add('workflowId', record.workflowId);
  add('userId', record.userId);
  add('fieldKey', record.fieldKey);
  add('tag', record.tag ?? record.tagName);

  return Object.keys(buckets).length > 0 ? buckets : undefined;
}

function sanitizeConfiguration(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const blocked = new Set([
    'locationId',
    'traceId',
    'email',
    'phone',
    'contactId',
    'contactName',
  ]);
  const config: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (blocked.has(key)) {
      continue;
    }
    if (
      key.toLowerCase().includes('body') &&
      typeof value === 'string' &&
      value.length > 500
    ) {
      config[key] = `${value.slice(0, 500)}…`;
      continue;
    }
    config[key] = value;
  }
  return config;
}

function stringOrUndefined(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return undefined;
}

export function findWorkflowInListPayload(
  payload: unknown,
  workflowId: string,
): unknown {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  const record = payload as Record<string, unknown>;
  const workflows = record.workflows;
  if (!Array.isArray(workflows)) {
    return undefined;
  }
  return workflows.find((item) => {
    if (!item || typeof item !== 'object') {
      return false;
    }
    return (item as Record<string, unknown>).id === workflowId;
  });
}
