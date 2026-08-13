import { z } from 'zod';

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

export const listCustomFieldsInputSchema = z.object({
  model: customFieldModelFilterSchema.optional(),
});

export const listCustomFieldsOutputSchema = z.object({
  fields: z.array(customFieldOutputSchema),
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

export const listPipelinesInputSchema = z.object({});
export const listPipelinesOutputSchema = z.object({
  pipelines: z.array(pipelineOutputSchema),
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

export const listCalendarsInputSchema = z.object({});
export const listCalendarsOutputSchema = z.object({
  calendars: z.array(calendarOutputSchema),
});

export const workflowOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const listWorkflowsInputSchema = z.object({});
export const listWorkflowsOutputSchema = z.object({
  workflows: z.array(workflowOutputSchema),
});

export type CustomFieldOutput = z.infer<typeof customFieldOutputSchema>;
export type PipelineOutput = z.infer<typeof pipelineOutputSchema>;
export type CalendarOutput = z.infer<typeof calendarOutputSchema>;
export type WorkflowOutput = z.infer<typeof workflowOutputSchema>;
