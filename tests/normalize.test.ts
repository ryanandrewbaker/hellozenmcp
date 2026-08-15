import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ReadOnlyHelloZenClient } from '../src/hellozen/client.js';
import {
  mergeCustomFieldsById,
  normalizeCalendars,
  normalizeCustomFields,
  normalizePipelines,
  normalizeWorkflows,
} from '../src/normalize/index.js';
import { normalizeWorkflowDetail } from '../src/normalize/workflows.js';
import {
  listCalendarsOutputSchema,
  listCustomFieldsOutputSchema,
  listPipelinesOutputSchema,
  listWorkflowsOutputSchema,
} from '../src/schemas/mcp-output.js';
import { createFakeFetch, TEST_CONFIG } from './helpers/fake-fetch.js';

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures',
);
const baseFields = JSON.parse(
  readFileSync(join(fixturesDir, 'custom-fields-base.json'), 'utf8'),
);
const opportunityFields = JSON.parse(
  readFileSync(join(fixturesDir, 'custom-fields-opportunity.json'), 'utf8'),
);
const pipelines = JSON.parse(
  readFileSync(join(fixturesDir, 'pipelines.json'), 'utf8'),
);
const calendars = JSON.parse(
  readFileSync(join(fixturesDir, 'calendars.json'), 'utf8'),
);
const workflows = JSON.parse(
  readFileSync(join(fixturesDir, 'workflows.json'), 'utf8'),
);
const workflowDetail = JSON.parse(
  readFileSync(join(fixturesDir, 'workflow-detail.json'), 'utf8'),
);

describe('normalizers', () => {
  it('normalizes custom fields and strips upstream-only fields', () => {
    const fields = normalizeCustomFields(baseFields);
    const output = listCustomFieldsOutputSchema.parse({
      fields,
      meta: {
        source: 'live',
        fetchedAt: new Date().toISOString(),
        cacheAgeMs: 0,
        complete: true,
      },
    });
    expect(output.fields[0]?.name).toBe('Session Type');
    expect(JSON.stringify(output)).not.toContain('traceId');
  });

  it('merges custom fields by id for all model', () => {
    const contact = normalizeCustomFields(baseFields);
    const opportunity = normalizeCustomFields(opportunityFields);
    const merged = mergeCustomFieldsById(contact, opportunity);
    expect(merged.length).toBeGreaterThan(contact.length - 1);
  });

  it('normalizes pipelines and stages', () => {
    const output = listPipelinesOutputSchema.parse({
      pipelines: normalizePipelines(pipelines),
      meta: {
        source: 'live',
        fetchedAt: new Date().toISOString(),
        cacheAgeMs: 0,
        complete: true,
      },
    });
    expect(output.pipelines[0]?.stages.length).toBeGreaterThan(0);
  });

  it('normalizes calendars', () => {
    const output = listCalendarsOutputSchema.parse({
      calendars: normalizeCalendars(calendars),
      meta: {
        source: 'live',
        fetchedAt: new Date().toISOString(),
        cacheAgeMs: 0,
        complete: true,
      },
    });
    expect(output.calendars[0]?.duration).toBe(30);
    expect(JSON.stringify(output)).not.toContain('teamMembers');
  });

  it('normalizes workflows', () => {
    const output = listWorkflowsOutputSchema.parse({
      workflows: normalizeWorkflows(workflows),
      meta: {
        source: 'live',
        fetchedAt: new Date().toISOString(),
        cacheAgeMs: 0,
        complete: true,
      },
    });
    expect(output.workflows.length).toBe(2);
  });

  it('extracts workflow dependency graph from detail fixture', () => {
    const detail = normalizeWorkflowDetail(workflowDetail, 'wf_detail');
    expect(
      detail.dependencies.customFields.some(
        (field) => field.fieldKey === 'contact.appointment_status',
      ),
    ).toBe(true);
    expect(
      detail.dependencies.tags.some((tag) => tag.name === 'Booked'),
    ).toBe(true);
    expect(
      detail.dependencies.calendars.some((calendar) => calendar.id === 'cal_1'),
    ).toBe(true);
    expect(detail.actions?.some((action) => action.type === 'branch')).toBe(
      true,
    );
  });
});

describe('client custom field routing', () => {
  it('returns contact fields only for contact model', async () => {
    const client = new ReadOnlyHelloZenClient({
      ...TEST_CONFIG,
      fetchImpl: createFakeFetch(),
    });
    const fields = await client.listCustomFields('contact');
    expect(fields.data.every((field) => field.model !== 'opportunity')).toBe(
      true,
    );
  });
});
