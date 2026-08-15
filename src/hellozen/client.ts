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
import { normalizeCalendarDetail } from '../normalize/calendars.js';
import {
  normalizeForms,
  normalizeTags,
  normalizeUsers,
} from '../normalize/inventories.js';
import {
  findWorkflowInListPayload,
  normalizeWorkflowDetail,
} from '../normalize/workflows.js';
import { buildResponseMeta, type ResponseMeta } from '../schemas/meta.js';
import type {
  CalendarDetailOutput,
  CalendarOutput,
  CustomFieldOutput,
  FormOutput,
  PipelineOutput,
  TagOutput,
  UserOutput,
  WorkflowDetailOutput,
  WorkflowOutput,
} from '../schemas/mcp-output.js';
import type { HelloZenReadRequest } from './api-registry.js';
import {
  HELLOZEN_ERROR_MESSAGES,
  HelloZenError,
} from './errors.js';
import {
  ReadOnlyHelloZenTransport,
  type FetchFn,
} from './transport.js';

export type FetchOptions = {
  fresh?: boolean;
};

export type CachedResult<T> = {
  data: T;
  meta: ResponseMeta;
};

export type ReadOnlyHelloZenClientOptions = {
  readonlyToken: string;
  locationId: string;
  companyId?: string;
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
      companyId: options.companyId,
      requestTimeoutMs: options.requestTimeoutMs,
      fetchImpl: options.fetchImpl,
    });
    this.cache = new ConfigCache(options.cacheTtlSeconds);
  }

  async listCustomFields(
    model: 'all' | 'contact' | 'opportunity' = 'all',
    options: FetchOptions = {},
  ): Promise<CachedResult<CustomFieldOutput[]>> {
    if (model === 'contact') {
      const result = await this.fetchCached(
        CACHE_KEYS.customFieldsBase,
        async () =>
          filterContactCustomFields(
            normalizeCustomFields(
              await this.fetchWithSemaphore({ kind: 'customFieldsBase' }),
            ),
          ),
        options,
      );
      return result;
    }
    if (model === 'opportunity') {
      return this.fetchCached(
        CACHE_KEYS.customFieldsOpportunity,
        async () =>
          normalizeCustomFields(
            await this.fetchWithSemaphore({
              kind: 'customFieldsOpportunity',
            }),
          ),
        options,
      );
    }

    const [contactFields, opportunityFields] = await Promise.all([
      this.listCustomFields('contact', options),
      this.listCustomFields('opportunity', options),
    ]);

    return {
      data: mergeCustomFieldsById(contactFields.data, opportunityFields.data),
      meta: contactFields.meta,
    };
  }

  async listPipelines(
    options: FetchOptions = {},
  ): Promise<CachedResult<PipelineOutput[]>> {
    return this.fetchCached(
      CACHE_KEYS.pipelines,
      async () =>
        normalizePipelines(
          await this.fetchWithSemaphore({ kind: 'pipelines' }),
        ),
      options,
    );
  }

  async listCalendars(
    options: FetchOptions = {},
  ): Promise<CachedResult<CalendarOutput[]>> {
    return this.fetchCached(
      CACHE_KEYS.calendars,
      async () =>
        normalizeCalendars(
          await this.fetchWithSemaphore({ kind: 'calendars' }),
        ),
      options,
    );
  }

  async listWorkflows(
    options: FetchOptions = {},
  ): Promise<CachedResult<WorkflowOutput[]>> {
    return this.fetchCached(
      CACHE_KEYS.workflows,
      async () =>
        normalizeWorkflows(
          await this.fetchWithSemaphore({ kind: 'workflows' }),
        ),
      options,
    );
  }

  async listTags(
    options: FetchOptions = {},
  ): Promise<CachedResult<TagOutput[]>> {
    return this.fetchCached(
      CACHE_KEYS.tags,
      async () =>
        normalizeTags(await this.fetchWithSemaphore({ kind: 'tags' })),
      options,
    );
  }

  async listUsers(
    options: FetchOptions = {},
  ): Promise<CachedResult<UserOutput[]>> {
    return this.fetchCached(
      CACHE_KEYS.users,
      async () =>
        normalizeUsers(await this.fetchWithSemaphore({ kind: 'users' })),
      options,
    );
  }

  async listForms(
    options: FetchOptions = {},
  ): Promise<CachedResult<FormOutput[]>> {
    return this.fetchCached(
      CACHE_KEYS.forms,
      async () =>
        normalizeForms(await this.fetchWithSemaphore({ kind: 'forms' })),
      options,
    );
  }

  async getCalendar(
    calendarId: string,
    options: FetchOptions = {},
  ): Promise<CachedResult<CalendarDetailOutput>> {
    const cacheKey = CACHE_KEYS.calendar(calendarId);
    return this.fetchCached(
      cacheKey,
      async () => {
        const calendarPayload = await this.fetchWithSemaphore({
          kind: 'calendar',
          calendarId,
        });
        let schedulePayload: unknown;
        try {
          schedulePayload = await this.fetchWithSemaphore({
            kind: 'calendarSchedule',
            calendarId,
          });
        } catch {
          schedulePayload = undefined;
        }
        return normalizeCalendarDetail(calendarPayload, schedulePayload);
      },
      options,
    );
  }

  async getWorkflow(
    workflowId: string,
    options: FetchOptions = {},
  ): Promise<CachedResult<WorkflowDetailOutput>> {
    const cacheKey = CACHE_KEYS.workflow(workflowId);
    return this.fetchCached(
      cacheKey,
      async () => {
        try {
          const detailPayload = await this.fetchWithSemaphore({
            kind: 'workflow',
            workflowId,
          });
          return normalizeWorkflowDetail(detailPayload, workflowId);
        } catch (error) {
          if (!(error instanceof HelloZenError)) {
            throw error;
          }

          const listPayload = await this.fetchWithSemaphore({
            kind: 'workflows',
          });
          const listItem = findWorkflowInListPayload(listPayload, workflowId);
          if (!listItem) {
            throw error;
          }
          return normalizeWorkflowDetail(
            { workflow: listItem },
            workflowId,
          );
        }
      },
      options,
    );
  }

  private async fetchCached<T>(
    cacheKey: string,
    fetcher: () => Promise<T>,
    options: FetchOptions,
  ): Promise<CachedResult<T>> {
    if (!options.fresh) {
      const cached = this.cache.lookup<T>(cacheKey);
      if (cached) {
        return {
          data: cached.value,
          meta: buildResponseMeta({
            source: 'cache',
            fetchedAt: cached.fetchedAt,
            cacheAgeMs: cached.cacheAgeMs,
            complete: true,
          }),
        };
      }
    }

    try {
      const data = await this.cache.dedupe(cacheKey, async () => {
        const value = await fetcher();
        const fetchedAt = new Date();
        this.cache.set(cacheKey, value, fetchedAt);
        return value;
      });

      const lookup = this.cache.lookup<T>(cacheKey);
      const fetchedAt = lookup?.fetchedAt ?? new Date();
      const cacheAgeMs = lookup?.cacheAgeMs ?? 0;

      return {
        data,
        meta: buildResponseMeta({
          source: 'live',
          fetchedAt,
          cacheAgeMs,
          complete: true,
        }),
      };
    } catch (error) {
      if (options.fresh) {
        throw new HelloZenError(
          HELLOZEN_ERROR_MESSAGES.freshness,
          'freshness',
        );
      }
      throw error;
    }
  }

  private async fetchWithSemaphore(
    request: HelloZenReadRequest,
  ): Promise<unknown> {
    const release = await this.semaphore.acquire();
    try {
      return await this.transport.getJson(request);
    } finally {
      release();
    }
  }
}
