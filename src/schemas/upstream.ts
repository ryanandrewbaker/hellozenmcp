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
  calendarType: z.string().optional(),
  slotInterval: z.number().optional(),
  teamMembers: z.array(z.unknown()).optional(),
  locationConfiguration: z.unknown().optional(),
  formId: z.string().optional(),
  eventTitle: z.string().optional(),
  eventColor: z.string().optional(),
  allowReschedule: z.boolean().optional(),
  allowCancellation: z.boolean().optional(),
  preBuffer: z.number().optional(),
  postBuffer: z.number().optional(),
  appointmentPerSlot: z.number().optional(),
  appointmentPerDay: z.number().optional(),
  openHours: z.unknown().optional(),
  notifications: z.array(z.unknown()).optional(),
});

export const upstreamCalendarsResponseSchema = z.object({
  calendars: z.array(z.unknown()).optional(),
});

export const upstreamCalendarDetailResponseSchema = z.object({
  calendar: z.unknown().optional(),
}).passthrough();

export const upstreamWorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  version: z.number().optional(),
});

export const upstreamWorkflowsResponseSchema = z.object({
  workflows: z.array(z.unknown()).optional(),
});

export const upstreamWorkflowDetailResponseSchema = z
  .object({
    workflow: z.unknown().optional(),
  })
  .passthrough();

export const upstreamTagSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
});

export const upstreamTagsResponseSchema = z.object({
  tags: z.array(z.unknown()).optional(),
});

export const upstreamUserSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  role: z.string().optional(),
  roles: z.unknown().optional(),
  deleted: z.boolean().optional(),
});

export const upstreamUsersResponseSchema = z.object({
  users: z.array(z.unknown()).optional(),
});

export const upstreamFormSchema = z.object({
  id: z.string(),
  name: z.string(),
  locationId: z.string().optional(),
});

export const upstreamFormsResponseSchema = z.object({
  forms: z.array(z.unknown()).optional(),
});
