import {
  HELLOZEN_ERROR_MESSAGES,
  HelloZenError,
} from '../hellozen/errors.js';
import type { CalendarDetailOutput } from '../schemas/mcp-output.js';
import {
  upstreamCalendarDetailResponseSchema,
  upstreamCalendarSchema,
} from '../schemas/upstream.js';

const MAX_ITEMS = 500;

export function normalizeCalendarDetail(
  calendarPayload: unknown,
  schedulePayload?: unknown,
): CalendarDetailOutput {
  const parsed = upstreamCalendarDetailResponseSchema.safeParse(calendarPayload);
  if (!parsed.success) {
    throw new HelloZenError(
      HELLOZEN_ERROR_MESSAGES.invalidResponse,
      'invalid_response',
    );
  }

  const rawCalendar = parsed.data.calendar ?? parsed.data;
  const calendar = upstreamCalendarSchema.safeParse(rawCalendar);
  if (!calendar.success) {
    throw new HelloZenError(
      HELLOZEN_ERROR_MESSAGES.invalidResponse,
      'invalid_response',
    );
  }

  const output: CalendarDetailOutput = {
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
  if (calendar.data.calendarType) {
    output.calendarType = calendar.data.calendarType;
  }
  if (calendar.data.slotInterval !== undefined) {
    output.slotInterval = calendar.data.slotInterval;
  }
  if (calendar.data.eventTitle) {
    output.eventTitle = calendar.data.eventTitle;
  }
  if (calendar.data.allowReschedule !== undefined) {
    output.allowReschedule = calendar.data.allowReschedule;
  }
  if (calendar.data.allowCancellation !== undefined) {
    output.allowCancellation = calendar.data.allowCancellation;
  }
  if (calendar.data.preBuffer !== undefined) {
    output.preBuffer = calendar.data.preBuffer;
  }
  if (calendar.data.postBuffer !== undefined) {
    output.postBuffer = calendar.data.postBuffer;
  }
  if (calendar.data.appointmentPerSlot !== undefined) {
    output.appointmentPerSlot = calendar.data.appointmentPerSlot;
  }
  if (calendar.data.appointmentPerDay !== undefined) {
    output.appointmentPerDay = calendar.data.appointmentPerDay;
  }
  if (calendar.data.openHours) {
    output.openHours = calendar.data.openHours;
  }
  if (calendar.data.notifications) {
    output.notifications = calendar.data.notifications;
  }
  if (calendar.data.locationConfiguration) {
    output.locationConfiguration = sanitizeRecord(
      calendar.data.locationConfiguration,
    );
  }

  if (Array.isArray(calendar.data.teamMembers)) {
    if (calendar.data.teamMembers.length > MAX_ITEMS) {
      throw new HelloZenError(
        HELLOZEN_ERROR_MESSAGES.invalidResponse,
        'invalid_response',
      );
    }
    output.assignedUsers = calendar.data.teamMembers
      .map((member) => {
        if (!member || typeof member !== 'object') {
          return null;
        }
        const record = member as Record<string, unknown>;
        const id = String(record.userId ?? record.id ?? '');
        if (!id) {
          return null;
        }
        const name = stringOrUndefined(
          record.name ?? record.displayName ?? record.firstName,
        );
        return { id, ...(name ? { name } : {}) };
      })
      .filter((item): item is { id: string; name?: string } => item !== null);
  }

  if (schedulePayload !== undefined) {
    output.availabilitySchedule = schedulePayload;
  }

  captureOtherConfiguration(output, calendar.data as Record<string, unknown>);

  return output;
}

function captureOtherConfiguration(
  output: CalendarDetailOutput,
  record: Record<string, unknown>,
): void {
  const knownKeys = new Set([
    'id',
    'name',
    'description',
    'slotDuration',
    'isActive',
    'timezone',
    'selectedTimezone',
    'groupId',
    'calendarType',
    'slotInterval',
    'teamMembers',
    'locationConfiguration',
    'formId',
    'eventTitle',
    'eventColor',
    'allowReschedule',
    'allowCancellation',
    'preBuffer',
    'postBuffer',
    'appointmentPerSlot',
    'appointmentPerDay',
    'openHours',
    'notifications',
  ]);

  const other: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!knownKeys.has(key)) {
      other[key] = value;
    }
  }
  if (Object.keys(other).length > 0) {
    output.otherConfiguration = other;
  }
}

function sanitizeRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const blocked = new Set(['email', 'phone', 'contactId', 'locationId']);
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (!blocked.has(key)) {
      result[key] = val;
    }
  }
  return result;
}

function stringOrUndefined(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return undefined;
}
