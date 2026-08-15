import { z } from 'zod';
import { responseMetaSchema } from './meta.js';

export const freshInputSchema = z.object({
  fresh: z.boolean().optional(),
});

export const customFieldModelFilterSchema = z
  .enum(['all', 'contact', 'opportunity'])
  .default('all');

export const customFieldOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  fieldKey: z.string(),
  model: z.string(),
  dataType: z.string(),
  picklistOptions: z.array(z.string()).optional(),
});

export const listCustomFieldsInputSchema = freshInputSchema.extend({
  model: customFieldModelFilterSchema.optional(),
});

export const listCustomFieldsOutputSchema = z.object({
  fields: z.array(customFieldOutputSchema),
  meta: responseMetaSchema,
});

export const pipelineStageOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number(),
});

export const pipelineOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  stages: z.array(pipelineStageOutputSchema),
});

export const listPipelinesInputSchema = freshInputSchema;
export const listPipelinesOutputSchema = z.object({
  pipelines: z.array(pipelineOutputSchema),
  meta: responseMetaSchema,
});

export const calendarOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  duration: z.number().optional(),
  status: z.string().optional(),
  timezone: z.string().optional(),
  groupId: z.string().optional(),
});

export const listCalendarsInputSchema = freshInputSchema;
export const listCalendarsOutputSchema = z.object({
  calendars: z.array(calendarOutputSchema),
  meta: responseMetaSchema,
});

export const calendarDetailOutputSchema = calendarOutputSchema.extend({
  calendarType: z.string().optional(),
  slotInterval: z.number().optional(),
  assignedUsers: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().optional(),
      }),
    )
    .optional(),
  locationConfiguration: z.record(z.unknown()).optional(),
  eventTitle: z.string().optional(),
  allowReschedule: z.boolean().optional(),
  allowCancellation: z.boolean().optional(),
  preBuffer: z.number().optional(),
  postBuffer: z.number().optional(),
  appointmentPerSlot: z.number().optional(),
  appointmentPerDay: z.number().optional(),
  openHours: z.unknown().optional(),
  notifications: z.array(z.unknown()).optional(),
  availabilitySchedule: z.unknown().optional(),
  otherConfiguration: z.record(z.unknown()).optional(),
});

export const getCalendarInputSchema = freshInputSchema.extend({
  calendar_id: z.string().min(1),
});

export const getCalendarOutputSchema = z.object({
  calendar: calendarDetailOutputSchema,
  meta: responseMetaSchema,
  visibilityLimitations: z.array(z.string()).optional(),
});

export const workflowOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  version: z.number().optional(),
});

export const listWorkflowsInputSchema = freshInputSchema;
export const listWorkflowsOutputSchema = z.object({
  workflows: z.array(workflowOutputSchema),
  meta: responseMetaSchema,
});

export const workflowTriggerOutputSchema = z.object({
  id: z.string().optional(),
  type: z.string(),
  summary: z.string(),
  filters: z.array(z.unknown()).optional(),
  referencedIds: z.record(z.array(z.string())).optional(),
  configuration: z.record(z.unknown()).optional(),
});

export const workflowActionOutputSchema = z.object({
  id: z.string().optional(),
  type: z.string(),
  summary: z.string(),
  configuration: z.record(z.unknown()).optional(),
  branches: z.lazy(() => z.array(workflowBranchOutputSchema)).optional(),
});

export const workflowBranchOutputSchema: z.ZodType<{
  id?: string;
  condition?: string;
  actions: z.infer<typeof workflowActionOutputSchema>[];
}> = z.object({
  id: z.string().optional(),
  condition: z.string().optional(),
  actions: z.array(workflowActionOutputSchema),
});

export const workflowDependencyRefSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  fieldKey: z.string().optional(),
  usage: z.array(z.string()),
});

export const workflowDependenciesSchema = z.object({
  customFields: z.array(workflowDependencyRefSchema),
  pipelines: z.array(workflowDependencyRefSchema),
  pipelineStages: z.array(workflowDependencyRefSchema),
  calendars: z.array(workflowDependencyRefSchema),
  tags: z.array(workflowDependencyRefSchema),
  users: z.array(workflowDependencyRefSchema),
  workflows: z.array(workflowDependencyRefSchema),
  templates: z.array(workflowDependencyRefSchema),
  customValues: z.array(workflowDependencyRefSchema),
  forms: z.array(workflowDependencyRefSchema),
  other: z.array(workflowDependencyRefSchema),
});

export const unresolvedReferenceSchema = z.object({
  type: z.string(),
  id: z.string().optional(),
  name: z.string().optional(),
  sourceActionId: z.string().optional(),
  sourceTriggerId: z.string().optional(),
  context: z.string().optional(),
});

export const workflowDetailOutputSchema = workflowOutputSchema.extend({
  publishedState: z.string().optional(),
  triggers: z.array(workflowTriggerOutputSchema).optional(),
  actions: z.array(workflowActionOutputSchema).optional(),
  controlFlow: z.unknown().optional(),
  summary: z.string().optional(),
  dependencies: workflowDependenciesSchema,
  unresolvedReferences: z.array(unresolvedReferenceSchema),
  visibilityLimitations: z.array(z.string()),
  otherConfiguration: z.record(z.unknown()).optional(),
});

export const getWorkflowInputSchema = freshInputSchema.extend({
  workflow_id: z.string().min(1),
});

export const getWorkflowOutputSchema = z.object({
  workflow: workflowDetailOutputSchema,
  meta: responseMetaSchema,
});

export const tagOutputSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
});

export const listTagsInputSchema = freshInputSchema;
export const listTagsOutputSchema = z.object({
  tags: z.array(tagOutputSchema),
  meta: responseMetaSchema,
});

export const userOutputSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  role: z.string().optional(),
  status: z.string().optional(),
});

export const listUsersInputSchema = freshInputSchema;
export const listUsersOutputSchema = z.object({
  users: z.array(userOutputSchema),
  meta: responseMetaSchema,
});

export const formOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string().optional(),
  fieldReferences: z.array(z.string()).optional(),
  visibilityLimitations: z.array(z.string()).optional(),
});

export const listFormsInputSchema = freshInputSchema;
export const listFormsOutputSchema = z.object({
  forms: z.array(formOutputSchema),
  meta: responseMetaSchema,
  visibilityLimitations: z.array(z.string()).optional(),
});

export const dependencyReferenceSchema = z.object({
  objectType: z.string(),
  objectId: z.string().optional(),
  objectName: z.string().optional(),
  fieldKey: z.string().optional(),
  referencedBy: z.array(
    z.object({
      workflowId: z.string(),
      workflowName: z.string(),
      location: z.string(),
      actionId: z.string().optional(),
      triggerId: z.string().optional(),
    }),
  ),
  referencesFound: z.number().int().nonnegative(),
  referenceScanCoverage: z.array(z.string()),
  classification: z.string(),
});

export const auditConfigurationDependenciesInputSchema = freshInputSchema;
export const auditConfigurationDependenciesOutputSchema = z.object({
  customFields: z.array(dependencyReferenceSchema),
  pipelines: z.array(dependencyReferenceSchema),
  pipelineStages: z.array(dependencyReferenceSchema),
  calendars: z.array(dependencyReferenceSchema),
  tags: z.array(dependencyReferenceSchema),
  users: z.array(dependencyReferenceSchema),
  workflows: z.array(dependencyReferenceSchema),
  forms: z.array(dependencyReferenceSchema),
  other: z.array(dependencyReferenceSchema),
  visibilityLimitations: z.array(z.string()),
  meta: responseMetaSchema,
});

export const legacyCandidateSchema = z.object({
  objectType: z.string(),
  objectId: z.string().optional(),
  objectName: z.string().optional(),
  reason: z.string(),
  evidence: z.array(z.string()),
  referencesFound: z.number().int().nonnegative(),
  scanCoverage: z.array(z.string()),
  confidence: z.enum(['low', 'medium']),
});

export const auditConfigurationInputSchema = freshInputSchema;
export const auditConfigurationOutputSchema = z.object({
  counts: z.record(z.number()),
  duplicates: z.array(
    z.object({
      objectType: z.string(),
      names: z.array(z.string()),
      ids: z.array(z.string()),
    }),
  ),
  brokenReferences: z.array(unresolvedReferenceSchema),
  legacyCandidates: z.array(legacyCandidateSchema),
  visibilityLimitations: z.array(z.string()),
  meta: responseMetaSchema,
});

export const configurationSnapshotInputSchema = freshInputSchema;
export const configurationSnapshotOutputSchema = z.object({
  snapshotTimestamp: z.string(),
  inventories: z.object({
    customFields: z.array(customFieldOutputSchema),
    pipelines: z.array(pipelineOutputSchema),
    calendars: z.array(calendarOutputSchema),
    workflows: z.array(workflowOutputSchema),
    tags: z.array(tagOutputSchema),
    users: z.array(userOutputSchema),
    forms: z.array(formOutputSchema),
  }),
  workflowSummaries: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      status: z.string(),
      dependencyCounts: z.record(z.number()),
    }),
  ),
  apiVersions: z.record(z.string()),
  visibilityLimitations: z.array(z.string()),
  meta: responseMetaSchema,
});

export const capabilitySurfaceSchema = z.object({
  surface: z.string(),
  visibility: z.enum(['full', 'partial', 'metadata_only', 'unavailable']),
  endpoint: z.string().optional(),
  documentedScope: z.string().optional(),
  notes: z.string().optional(),
});

export const getCapabilitiesOutputSchema = z.object({
  capabilities: z.array(capabilitySurfaceSchema),
  dependencyCategoriesResolvable: z.array(z.string()),
  visibilityLimitations: z.array(z.string()),
  meta: responseMetaSchema,
});

export type CustomFieldOutput = z.infer<typeof customFieldOutputSchema>;
export type PipelineOutput = z.infer<typeof pipelineOutputSchema>;
export type CalendarOutput = z.infer<typeof calendarOutputSchema>;
export type CalendarDetailOutput = z.infer<typeof calendarDetailOutputSchema>;
export type WorkflowOutput = z.infer<typeof workflowOutputSchema>;
export type WorkflowTriggerOutput = z.infer<typeof workflowTriggerOutputSchema>;
export type WorkflowActionOutput = z.infer<typeof workflowActionOutputSchema>;
export type WorkflowBranchOutput = z.infer<typeof workflowBranchOutputSchema>;
export type WorkflowDetailOutput = z.infer<typeof workflowDetailOutputSchema>;
export type TagOutput = z.infer<typeof tagOutputSchema>;
export type UserOutput = z.infer<typeof userOutputSchema>;
export type FormOutput = z.infer<typeof formOutputSchema>;
export type WorkflowDependencies = z.infer<typeof workflowDependenciesSchema>;
