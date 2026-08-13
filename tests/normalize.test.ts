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

describe('normalizers', () => {
  it('normalizes custom fields without upstream-only fields', () => {
    const fields = normalizeCustomFields(baseFields);
    const output = listCustomFieldsOutputSchema.parse({ fields });
    expect(output.fields[0]).toMatchObject({
      id: 'field_contact_1',
      fieldKey: 'contact.session_type',
      model: 'contact',
    });
    expect(JSON.stringify(output)).not.toContain('traceId');
    expect(JSON.stringify(output)).not.toContain('locationId');
  });

  it('normalizes pipelines and stages', () => {
    const result = normalizePipelines(pipelines);
    const output = listPipelinesOutputSchema.parse({ pipelines: result });
    expect(output.pipelines[0]?.stages).toHaveLength(2);
  });

  it('normalizes calendars with mapped configuration fields', () => {
    const result = normalizeCalendars(calendars);
    const output = listCalendarsOutputSchema.parse({ calendars: result });
    expect(output.calendars[0]).toMatchObject({
      duration: 30,
      status: 'active',
      timezone: 'Australia/Melbourne',
    });
    expect(JSON.stringify(output)).not.toContain('teamMembers');
  });

  it('normalizes workflows with optional timestamps', () => {
    const result = normalizeWorkflows(workflows);
    const output = listWorkflowsOutputSchema.parse({ workflows: result });
    expect(output.workflows[0]?.createdAt).toBeDefined();
  });

  it('fails safely on malformed upstream payloads', () => {
    expect(() => normalizeCustomFields({ customFields: [{ id: 1 }] })).toThrow();
    expect(() => normalizePipelines({ pipelines: [{}] })).toThrow();
  });

  it('merges custom fields by id', () => {
    const contact = normalizeCustomFields(baseFields).filter(
      (field) => field.model !== 'opportunity',
    );
    const opportunity = normalizeCustomFields(opportunityFields);
    const merged = mergeCustomFieldsById(contact, opportunity);
    expect(merged).toHaveLength(2);
  });
});

describe('ReadOnlyHelloZenClient custom fields', () => {
  const client = new ReadOnlyHelloZenClient({
    ...TEST_CONFIG,
    fetchImpl: createFakeFetch(),
  });

  it('fetches contact fields from base endpoint only', async () => {
    const fields = await client.listCustomFields('contact');
    expect(fields.map((field) => field.id)).toEqual(['field_contact_1']);
  });

  it('fetches opportunity fields from opportunity endpoint only', async () => {
    const fields = await client.listCustomFields('opportunity');
    expect(fields.map((field) => field.id)).toEqual(['field_opp_1']);
  });

  it('merges both endpoint variants for all', async () => {
    const fields = await client.listCustomFields('all');
    expect(fields.map((field) => field.id).sort()).toEqual(
      ['field_contact_1', 'field_opp_1'].sort(),
    );
  });
});
