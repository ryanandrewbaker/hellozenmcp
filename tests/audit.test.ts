import { describe, expect, it } from 'vitest';
import { ReadOnlyHelloZenClient } from '../src/hellozen/client.js';
import { buildDependencyAudit } from '../src/audit/index.js';
import { createFakeFetch, TEST_CONFIG } from './helpers/fake-fetch.js';

describe('dependency audit', () => {
  it('builds reverse references and no-reference classifications', async () => {
    const client = new ReadOnlyHelloZenClient({
      ...TEST_CONFIG,
      fetchImpl: createFakeFetch(),
    });

    const audit = await buildDependencyAudit(client);
    const appointmentField = audit.customFields.find(
      (entry) => entry.fieldKey === 'contact.session_type',
    );
    expect(appointmentField).toBeDefined();
    expect(appointmentField?.referenceScanCoverage).toContain('workflows');
    expect(audit.visibilityLimitations.length).toBeGreaterThan(0);
  });
});
