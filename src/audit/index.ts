import type { ReadOnlyHelloZenClient } from '../hellozen/client.js';
import { HELLOZEN_READ_ENDPOINTS } from '../hellozen/api-registry.js';
import type {
  CustomFieldOutput,
  FormOutput,
  PipelineOutput,
  TagOutput,
  UserOutput,
  WorkflowDetailOutput,
  WorkflowOutput,
} from '../schemas/mcp-output.js';
import { buildResponseMeta } from '../schemas/meta.js';

export type ScanCoverage = [
  'workflows',
  'forms',
  'calendars',
  'pipelines',
  'custom_fields',
  'tags',
];

export const DEFAULT_SCAN_COVERAGE: ScanCoverage = [
  'workflows',
  'forms',
  'calendars',
  'pipelines',
  'custom_fields',
  'tags',
];

type ReferenceEntry = {
  objectType: string;
  objectId?: string;
  objectName?: string;
  fieldKey?: string;
  referencedBy: Array<{
    workflowId: string;
    workflowName: string;
    location: string;
    actionId?: string;
    triggerId?: string;
  }>;
};

export async function buildDependencyAudit(
  client: ReadOnlyHelloZenClient,
  options: { fresh?: boolean } = {},
) {
  const [
    fields,
    pipelines,
    calendars,
    tags,
    forms,
    workflows,
    users,
  ] = await Promise.all([
    client.listCustomFields('all', options),
    client.listPipelines(options),
    client.listCalendars(options),
    client.listTags(options),
    client.listForms(options),
    client.listWorkflows(options),
    client.listUsers(options),
  ]);

  const index = new Map<string, ReferenceEntry>();
  const visibilityLimitations = [
    'Workflow trigger/action graphs are only indexed when the supported workflow detail API returns them.',
    'Forms may expose inventory only; field-level dependencies can be incomplete.',
    'External websites, manual processes, and integrations outside scanned surfaces are not included.',
  ];

  const workflowDetails: WorkflowDetailOutput[] = [];
  for (const workflow of workflows.data) {
    try {
      const detail = await client.getWorkflow(workflow.id, options);
      workflowDetails.push(detail.data);
      indexWorkflowDependencies(index, detail.data);
    } catch {
      indexWorkflowMetadata(index, workflow);
    }
  }

  return {
    customFields: toDependencySection(index, 'custom_field', fields.data),
    pipelines: toDependencySection(index, 'pipeline', pipelines.data),
    pipelineStages: toDependencySection(
      index,
      'pipeline_stage',
      flattenStages(pipelines.data),
    ),
    calendars: toDependencySection(index, 'calendar', calendars.data),
    tags: toDependencySection(index, 'tag', tags.data),
    users: toDependencySection(index, 'user', users.data),
    workflows: toDependencySection(index, 'workflow', workflows.data),
    forms: toDependencySection(index, 'form', forms.data),
    other: toDependencySection(index, 'other', []),
    visibilityLimitations,
    meta: buildResponseMeta({
      source: workflows.meta.source,
      fetchedAt: new Date(workflows.meta.fetchedAt),
      cacheAgeMs: workflows.meta.cacheAgeMs,
      complete: false,
    }),
  };
}

function flattenStages(pipelines: PipelineOutput[]) {
  return pipelines.flatMap((pipeline) =>
    pipeline.stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
    })),
  );
}

function indexWorkflowDependencies(
  index: Map<string, ReferenceEntry>,
  workflow: WorkflowDetailOutput,
): void {
  const add = (
    objectType: string,
    ref: { id?: string; name?: string; fieldKey?: string },
    location: string,
    ids?: { actionId?: string; triggerId?: string },
  ) => {
    const key = `${objectType}:${ref.id ?? ref.fieldKey ?? ref.name ?? 'unknown'}`;
    const entry = index.get(key) ?? {
      objectType,
      objectId: ref.id,
      objectName: ref.name,
      fieldKey: ref.fieldKey,
      referencedBy: [],
    };
    entry.referencedBy.push({
      workflowId: workflow.id,
      workflowName: workflow.name,
      location,
      ...(ids?.actionId ? { actionId: ids.actionId } : {}),
      ...(ids?.triggerId ? { triggerId: ids.triggerId } : {}),
    });
    index.set(key, entry);
  };

  for (const field of workflow.dependencies.customFields) {
    add('custom_field', field, `workflow/${workflow.id}/dependency`, {});
  }
  for (const pipeline of workflow.dependencies.pipelines) {
    add('pipeline', pipeline, `workflow/${workflow.id}/dependency`, {});
  }
  for (const stage of workflow.dependencies.pipelineStages) {
    add('pipeline_stage', stage, `workflow/${workflow.id}/dependency`, {});
  }
  for (const calendar of workflow.dependencies.calendars) {
    add('calendar', calendar, `workflow/${workflow.id}/dependency`, {});
  }
  for (const tag of workflow.dependencies.tags) {
    add('tag', tag, `workflow/${workflow.id}/dependency`, {});
  }
  for (const user of workflow.dependencies.users) {
    add('user', user, `workflow/${workflow.id}/dependency`, {});
  }
  for (const nestedWorkflow of workflow.dependencies.workflows) {
    add('workflow', nestedWorkflow, `workflow/${workflow.id}/dependency`, {});
  }
  for (const form of workflow.dependencies.forms) {
    add('form', form, `workflow/${workflow.id}/dependency`, {});
  }
}

function indexWorkflowMetadata(
  index: Map<string, ReferenceEntry>,
  workflow: WorkflowOutput,
): void {
  const key = `workflow:${workflow.id}`;
  if (!index.has(key)) {
    index.set(key, {
      objectType: 'workflow',
      objectId: workflow.id,
      objectName: workflow.name,
      referencedBy: [],
    });
  }
}

function toDependencySection(
  index: Map<string, ReferenceEntry>,
  objectType: string,
  inventory: Array<{ id?: string; name?: string; fieldKey?: string; displayName?: string }>,
) {
  const entries = [...index.values()].filter(
    (entry) => entry.objectType === objectType,
  );

  const inventoryRefs = inventory.map((item) => {
    const objectId = item.id;
    const objectName = item.name ?? item.displayName;
    const fieldKey = item.fieldKey;
    const key = `${objectType}:${objectId ?? fieldKey ?? objectName ?? 'unknown'}`;
    const found = index.get(key);
    const referencesFound = found?.referencedBy.length ?? 0;
    return {
      objectType,
      objectId,
      objectName,
      fieldKey,
      referencedBy: found?.referencedBy ?? [],
      referencesFound,
      referenceScanCoverage: [...DEFAULT_SCAN_COVERAGE],
      classification:
        referencesFound === 0
          ? 'no_reference_found_in_scanned_configuration'
          : 'references_found_in_scanned_configuration',
    };
  });

  const unmatched = entries.filter(
    (entry) =>
      !inventoryRefs.some(
        (item) =>
          (item.objectId && item.objectId === entry.objectId) ||
          (item.objectName && item.objectName === entry.objectName) ||
          (item.fieldKey && item.fieldKey === entry.fieldKey),
      ),
  );

  return [
    ...inventoryRefs,
    ...unmatched.map((entry) => ({
      objectType: entry.objectType,
      objectId: entry.objectId,
      objectName: entry.objectName,
      fieldKey: entry.fieldKey,
      referencedBy: entry.referencedBy,
      referencesFound: entry.referencedBy.length,
      referenceScanCoverage: [...DEFAULT_SCAN_COVERAGE],
      classification: 'references_found_in_scanned_configuration',
    })),
  ];
}

export async function buildConfigurationAudit(
  client: ReadOnlyHelloZenClient,
  options: { fresh?: boolean } = {},
) {
  const [fields, pipelines, calendars, tags, workflows, forms] =
    await Promise.all([
      client.listCustomFields('all', options),
      client.listPipelines(options),
      client.listCalendars(options),
      client.listTags(options),
      client.listWorkflows(options),
      client.listForms(options),
    ]);

  const duplicates = [
    ...findDuplicates('custom_field', fields.data.map((f) => ({ id: f.id, name: f.name }))),
    ...findDuplicates('tag', tags.data.map((t) => ({ id: t.id ?? t.name, name: t.name }))),
    ...findDuplicates('calendar', calendars.data),
    ...findDuplicates('workflow', workflows.data),
    ...findDuplicates(
      'pipeline_stage',
      pipelines.data.flatMap((p) => p.stages),
    ),
  ];

  const dependencyAudit = await buildDependencyAudit(client, options);
  const brokenReferences = dependencyAudit.other
    .filter((entry) => entry.referencesFound > 0)
    .map((entry) => ({
      type: entry.objectType,
      id: entry.objectId,
      name: entry.objectName,
      context: 'unresolved_inventory_match',
    }));

  const legacyCandidates = [
    ...fields.data
      .filter((field) => {
        const match = dependencyAudit.customFields.find(
          (entry) => entry.objectId === field.id,
        );
        return (match?.referencesFound ?? 0) === 0;
      })
      .map((field) => ({
        objectType: 'custom_field',
        objectId: field.id,
        objectName: field.name,
        reason: 'No references found in scanned workflow/form configuration',
        evidence: [`fieldKey=${field.fieldKey}`],
        referencesFound: 0,
        scanCoverage: [...DEFAULT_SCAN_COVERAGE],
        confidence: 'low' as const,
      })),
    ...tags.data
      .filter((tag) => {
        const match = dependencyAudit.tags.find(
          (entry) => entry.objectName === tag.name,
        );
        return (match?.referencesFound ?? 0) === 0;
      })
      .map((tag) => ({
        objectType: 'tag',
        objectId: tag.id,
        objectName: tag.name,
        reason: 'No references found in scanned workflow configuration',
        evidence: [`tag=${tag.name}`],
        referencesFound: 0,
        scanCoverage: [...DEFAULT_SCAN_COVERAGE],
        confidence: 'low' as const,
      })),
  ];

  return {
    counts: {
      customFields: fields.data.length,
      pipelines: pipelines.data.length,
      pipelineStages: pipelines.data.reduce(
        (sum, pipeline) => sum + pipeline.stages.length,
        0,
      ),
      calendars: calendars.data.length,
      workflows: workflows.data.length,
      publishedWorkflows: workflows.data.filter(
        (workflow) => workflow.status === 'published',
      ).length,
      draftWorkflows: workflows.data.filter(
        (workflow) => workflow.status === 'draft',
      ).length,
      tags: tags.data.length,
      forms: forms.data.length,
    },
    duplicates,
    brokenReferences,
    legacyCandidates,
    visibilityLimitations: dependencyAudit.visibilityLimitations,
    meta: dependencyAudit.meta,
  };
}

function findDuplicates(
  objectType: string,
  items: Array<{ id: string; name: string }>,
) {
  const byName = new Map<string, string[]>();
  const idsByName = new Map<string, string[]>();
  for (const item of items) {
    const normalized = item.name.trim().toLowerCase();
    byName.set(normalized, [...(byName.get(normalized) ?? []), item.name]);
    idsByName.set(normalized, [...(idsByName.get(normalized) ?? []), item.id]);
  }

  const duplicates: Array<{
    objectType: string;
    names: string[];
    ids: string[];
  }> = [];

  for (const [normalized, names] of byName.entries()) {
    const ids = idsByName.get(normalized) ?? [];
    if (ids.length > 1) {
      duplicates.push({
        objectType,
        names: [...new Set(names)],
        ids: [...new Set(ids)],
      });
    }
  }

  return duplicates;
}

export function buildCapabilitiesMeta() {
  return {
    capabilities: Object.values(HELLOZEN_READ_ENDPOINTS).map((endpoint) => ({
      surface: endpoint.id,
      visibility: endpoint.visibility,
      endpoint: endpoint.pathPattern,
      documentedScope: endpoint.documentedScope,
      notes: endpoint.description,
    })),
    dependencyCategoriesResolvable: [
      'custom_fields',
      'pipelines',
      'pipeline_stages',
      'calendars',
      'tags',
      'users',
      'workflows',
      'forms',
      'templates',
    ],
    visibilityLimitations: [
      'Contacts, opportunities, conversations, appointments/events, and form submissions are intentionally unavailable.',
      'Workflow trigger/action detail depends on upstream API visibility; list endpoints return metadata only.',
      'Form definitions may be inventory-only via GET /forms/.',
    ],
    meta: buildResponseMeta({
      source: 'live',
      fetchedAt: new Date(),
      cacheAgeMs: 0,
      complete: true,
    }),
  };
}

export async function buildConfigurationSnapshot(
  client: ReadOnlyHelloZenClient,
  options: { fresh?: boolean } = {},
) {
  const [fields, pipelines, calendars, workflows, tags, users, forms] =
    await Promise.all([
      client.listCustomFields('all', options),
      client.listPipelines(options),
      client.listCalendars(options),
      client.listWorkflows(options),
      client.listTags(options),
      client.listUsers(options),
      client.listForms(options),
    ]);

  const workflowSummaries = [];
  for (const workflow of workflows.data) {
    try {
      const detail = await client.getWorkflow(workflow.id, options);
      workflowSummaries.push({
        id: workflow.id,
        name: workflow.name,
        status: workflow.status,
        dependencyCounts: countDependencies(detail.data.dependencies),
      });
    } catch {
      workflowSummaries.push({
        id: workflow.id,
        name: workflow.name,
        status: workflow.status,
        dependencyCounts: {},
      });
    }
  }

  const apiVersions = Object.fromEntries(
    Object.values(HELLOZEN_READ_ENDPOINTS).map((endpoint) => [
      endpoint.id,
      endpoint.apiVersion,
    ]),
  );

  return {
    snapshotTimestamp: new Date().toISOString(),
    inventories: {
      customFields: fields.data,
      pipelines: pipelines.data,
      calendars: calendars.data,
      workflows: workflows.data,
      tags: tags.data,
      users: users.data,
      forms: forms.data,
    },
    workflowSummaries,
    apiVersions,
    visibilityLimitations: buildCapabilitiesMeta().visibilityLimitations,
    meta: buildResponseMeta({
      source: workflows.meta.source,
      fetchedAt: new Date(workflows.meta.fetchedAt),
      cacheAgeMs: workflows.meta.cacheAgeMs,
      complete: false,
    }),
  };
}

function countDependencies(dependencies: WorkflowDetailOutput['dependencies']) {
  return Object.fromEntries(
    Object.entries(dependencies).map(([key, value]) => [key, value.length]),
  );
}
