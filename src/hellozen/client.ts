import { CACHE_KEYS, ConfigCache } from '../cache/config-cache.js';
import { Semaphore } from '../concurrency/semaphore.js';
import {
  filterContactCustomFields,
  mergeCustomFieldsById,
  normalizeCalendars,
  normalizeCustomFields,
  normalizePipelines,
  normalizeWorkflows,
} from '../normalize/index.js';
import type {
  CalendarOutput,
  CustomFieldOutput,
  PipelineOutput,
  WorkflowOutput,
} from '../schemas/mcp-output.js';
import {
  ReadOnlyHelloZenTransport,
  type FetchFn,
} from './transport.js';

export type ReadOnlyHelloZenClientOptions = {
  readonlyToken: string;
  locationId: string;
  requestTimeoutMs: number;
  cacheTtlSeconds: number;
  fetchImpl?: FetchFn;
};

export class ReadOnlyHelloZenClient {
  private readonly transport: ReadOnlyHelloZenTransport;
  private readonly cache: ConfigCache;
  private readonly semaphore = new Semaphore(4);

  constructor(private readonly options: ReadOnlyHelloZenClientOptions) {
    this.transport = new ReadOnlyHelloZenTransport({
      readonlyToken: options.readonlyToken,
      locationId: options.locationId,
      requestTimeoutMs: options.requestTimeoutMs,
      fetchImpl: options.fetchImpl,
    });
    this.cache = new ConfigCache(options.cacheTtlSeconds);
  }

  async listCustomFields(
    model: 'all' | 'contact' | 'opportunity' = 'all',
  ): Promise<CustomFieldOutput[]> {
    if (model === 'contact') {
      return filterContactCustomFields(await this.getBaseCustomFields());
    }
    if (model === 'opportunity') {
      return this.getOpportunityCustomFields();
    }

    const [contactFields, opportunityFields] = await Promise.all([
      this.getBaseCustomFields(),
      this.getOpportunityCustomFields(),
    ]);
    return mergeCustomFieldsById(
      filterContactCustomFields(contactFields),
      opportunityFields,
    );
  }

  async listPipelines(): Promise<PipelineOutput[]> {
    const cached = this.cache.get<PipelineOutput[]>(CACHE_KEYS.pipelines);
    if (cached) {
      return cached;
    }

    const payload = await this.fetchWithSemaphore({
      kind: 'pipelines',
    });
    const pipelines = normalizePipelines(payload);
    this.cache.set(CACHE_KEYS.pipelines, pipelines);
    return pipelines;
  }

  async listCalendars(): Promise<CalendarOutput[]> {
    const cached = this.cache.get<CalendarOutput[]>(CACHE_KEYS.calendars);
    if (cached) {
      return cached;
    }

    const payload = await this.fetchWithSemaphore({ kind: 'calendars' });
    const calendars = normalizeCalendars(payload);
    this.cache.set(CACHE_KEYS.calendars, calendars);
    return calendars;
  }

  async listWorkflows(): Promise<WorkflowOutput[]> {
    const cached = this.cache.get<WorkflowOutput[]>(CACHE_KEYS.workflows);
    if (cached) {
      return cached;
    }

    const payload = await this.fetchWithSemaphore({ kind: 'workflows' });
    const workflows = normalizeWorkflows(payload);
    this.cache.set(CACHE_KEYS.workflows, workflows);
    return workflows;
  }

  private async getBaseCustomFields(): Promise<CustomFieldOutput[]> {
    const cached = this.cache.get<CustomFieldOutput[]>(
      CACHE_KEYS.customFieldsBase,
    );
    if (cached) {
      return cached;
    }

    const payload = await this.fetchWithSemaphore({
      kind: 'customFieldsBase',
    });
    const fields = normalizeCustomFields(payload);
    this.cache.set(CACHE_KEYS.customFieldsBase, fields);
    return fields;
  }

  private async getOpportunityCustomFields(): Promise<CustomFieldOutput[]> {
    const cached = this.cache.get<CustomFieldOutput[]>(
      CACHE_KEYS.customFieldsOpportunity,
    );
    if (cached) {
      return cached;
    }

    const payload = await this.fetchWithSemaphore({
      kind: 'customFieldsOpportunity',
    });
    const fields = normalizeCustomFields(payload);
    this.cache.set(CACHE_KEYS.customFieldsOpportunity, fields);
    return fields;
  }

  private async fetchWithSemaphore(
    endpoint:
      | { kind: 'customFieldsBase' }
      | { kind: 'customFieldsOpportunity' }
      | { kind: 'pipelines' }
      | { kind: 'calendars' }
      | { kind: 'workflows' },
  ): Promise<unknown> {
    const release = await this.semaphore.acquire();
    try {
      return await this.transport.getJson(endpoint);
    } finally {
      release();
    }
  }
}
