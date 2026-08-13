import { z } from 'zod';

export const upstreamCustomFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  fieldKey: z.string(),
  model: z.string().optional(),
  dataType: z.string(),
  picklistOptions: z.array(z.string()).optional(),
});

export const upstreamCustomFieldsResponseSchema = z.object({
  customFields: z.array(z.unknown()).optional(),
});

export const upstreamStageSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number(),
});

export const upstreamPipelineSchema = z.object({
  id: z.string(),
  name: z.string(),
  stages: z.array(z.unknown()).optional(),
});

export const upstreamPipelinesResponseSchema = z.object({
  pipelines: z.array(z.unknown()).optional(),
});

export const upstreamCalendarSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  slotDuration: z.number().optional(),
  isActive: z.boolean().optional(),
  timezone: z.string().optional(),
  selectedTimezone: z.string().optional(),
  groupId: z.string().optional(),
});

export const upstreamCalendarsResponseSchema = z.object({
  calendars: z.array(z.unknown()).optional(),
});

export const upstreamWorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const upstreamWorkflowsResponseSchema = z.object({
  workflows: z.array(z.unknown()).optional(),
});
