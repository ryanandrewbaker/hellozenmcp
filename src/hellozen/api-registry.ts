export const HELLOZEN_API_ORIGIN = 'https://services.leadconnectorhq.com';
export const MAX_UPSTREAM_RESPONSE_BYTES = 2 * 1024 * 1024;

/** Default API version for most LeadConnector configuration endpoints. */
export const HELLOZEN_API_VERSION_DEFAULT = '2021-07-28';

export type HelloZenReadRequest =
  | { kind: 'customFieldsBase' }
  | { kind: 'customFieldsOpportunity' }
  | { kind: 'pipelines' }
  | { kind: 'calendars' }
  | { kind: 'calendar'; calendarId: string }
  | { kind: 'calendarSchedule'; calendarId: string }
  | { kind: 'workflows' }
  | { kind: 'workflow'; workflowId: string }
  | { kind: 'tags' }
  | { kind: 'users' }
  | { kind: 'forms' };

export type HelloZenEndpointDefinition = {
  id: string;
  pathPattern: string;
  apiVersion: string;
  documentedScope: string;
  visibility: 'full' | 'partial' | 'metadata_only';
  description: string;
};

export const HELLOZEN_READ_ENDPOINTS: Record<
  HelloZenReadRequest['kind'],
  HelloZenEndpointDefinition
> = {
  customFieldsBase: {
    id: 'customFieldsBase',
    pathPattern: '/locations/{locationId}/customFields',
    apiVersion: HELLOZEN_API_VERSION_DEFAULT,
    documentedScope: 'locations/customFields.readonly',
    visibility: 'full',
    description: 'Contact custom field definitions',
  },
  customFieldsOpportunity: {
    id: 'customFieldsOpportunity',
    pathPattern: '/locations/{locationId}/customFields?model=opportunity',
    apiVersion: HELLOZEN_API_VERSION_DEFAULT,
    documentedScope: 'locations/customFields.readonly',
    visibility: 'full',
    description: 'Opportunity custom field definitions',
  },
  pipelines: {
    id: 'pipelines',
    pathPattern: '/opportunities/pipelines?locationId={locationId}',
    apiVersion: HELLOZEN_API_VERSION_DEFAULT,
    documentedScope: 'opportunities.readonly',
    visibility: 'full',
    description: 'Opportunity pipelines and stages',
  },
  calendars: {
    id: 'calendars',
    pathPattern: '/calendars/?locationId={locationId}',
    apiVersion: HELLOZEN_API_VERSION_DEFAULT,
    documentedScope: 'calendars.readonly',
    visibility: 'partial',
    description: 'Calendar inventory (summary metadata)',
  },
  calendar: {
    id: 'calendar',
    pathPattern: '/calendars/{calendarId}',
    apiVersion: HELLOZEN_API_VERSION_DEFAULT,
    documentedScope: 'calendars.readonly',
    visibility: 'partial',
    description: 'Single calendar configuration',
  },
  calendarSchedule: {
    id: 'calendarSchedule',
    pathPattern: '/calendars/schedules/event-calendar/{calendarId}',
    apiVersion: HELLOZEN_API_VERSION_DEFAULT,
    documentedScope: 'calendars.readonly',
    visibility: 'partial',
    description: 'Event calendar availability schedule',
  },
  workflows: {
    id: 'workflows',
    pathPattern: '/workflows/?locationId={locationId}',
    apiVersion: HELLOZEN_API_VERSION_DEFAULT,
    documentedScope: 'workflows.readonly',
    visibility: 'metadata_only',
    description: 'Workflow inventory (identity and status only)',
  },
  workflow: {
    id: 'workflow',
    pathPattern: '/workflows/{workflowId}?locationId={locationId}',
    apiVersion: HELLOZEN_API_VERSION_DEFAULT,
    documentedScope: 'workflows.readonly',
    visibility: 'partial',
    description:
      'Workflow detail (triggers/actions when exposed by upstream API)',
  },
  tags: {
    id: 'tags',
    pathPattern: '/locations/{locationId}/tags',
    apiVersion: HELLOZEN_API_VERSION_DEFAULT,
    documentedScope: 'locations/tags.readonly',
    visibility: 'full',
    description: 'Sub-account tag inventory',
  },
  users: {
    id: 'users',
    pathPattern: '/users/search?locationId={locationId}',
    apiVersion: HELLOZEN_API_VERSION_DEFAULT,
    documentedScope: 'users.readonly',
    visibility: 'partial',
    description: 'User/team member search for configuration resolution',
  },
  forms: {
    id: 'forms',
    pathPattern: '/forms/?locationId={locationId}',
    apiVersion: HELLOZEN_API_VERSION_DEFAULT,
    documentedScope: 'forms.readonly',
    visibility: 'metadata_only',
    description: 'Form inventory (field dependencies may be unavailable)',
  },
};

export const FORBIDDEN_PATH_FRAGMENTS = [
  '/contacts',
  '/contacts/search',
  '/opportunities/search',
  '/calendars/events',
  '/conversations',
  '/workflow/',
] as const;

export const ALLOWED_HTTP_METHODS = ['GET'] as const;

export type BuildUrlOptions = {
  locationId: string;
  companyId?: string;
};

export function buildHelloZenRequestUrl(
  request: HelloZenReadRequest,
  options: BuildUrlOptions,
): URL {
  const encodedLocationId = encodeURIComponent(options.locationId);

  switch (request.kind) {
    case 'customFieldsBase':
      return new URL(
        `/locations/${encodedLocationId}/customFields`,
        HELLOZEN_API_ORIGIN,
      );
    case 'customFieldsOpportunity': {
      const url = new URL(
        `/locations/${encodedLocationId}/customFields`,
        HELLOZEN_API_ORIGIN,
      );
      url.searchParams.set('model', 'opportunity');
      return url;
    }
    case 'pipelines': {
      const url = new URL('/opportunities/pipelines', HELLOZEN_API_ORIGIN);
      url.searchParams.set('locationId', options.locationId);
      return url;
    }
    case 'calendars': {
      const url = new URL('/calendars/', HELLOZEN_API_ORIGIN);
      url.searchParams.set('locationId', options.locationId);
      return url;
    }
    case 'calendar': {
      const calendarId = encodeURIComponent(request.calendarId);
      return new URL(`/calendars/${calendarId}`, HELLOZEN_API_ORIGIN);
    }
    case 'calendarSchedule': {
      const calendarId = encodeURIComponent(request.calendarId);
      return new URL(
        `/calendars/schedules/event-calendar/${calendarId}`,
        HELLOZEN_API_ORIGIN,
      );
    }
    case 'workflows': {
      const url = new URL('/workflows/', HELLOZEN_API_ORIGIN);
      url.searchParams.set('locationId', options.locationId);
      return url;
    }
    case 'workflow': {
      const workflowId = encodeURIComponent(request.workflowId);
      const url = new URL(`/workflows/${workflowId}`, HELLOZEN_API_ORIGIN);
      url.searchParams.set('locationId', options.locationId);
      return url;
    }
    case 'tags':
      return new URL(
        `/locations/${encodedLocationId}/tags`,
        HELLOZEN_API_ORIGIN,
      );
    case 'users': {
      const url = new URL('/users/search', HELLOZEN_API_ORIGIN);
      url.searchParams.set('locationId', options.locationId);
      if (options.companyId) {
        url.searchParams.set('companyId', options.companyId);
      }
      return url;
    }
    case 'forms': {
      const url = new URL('/forms/', HELLOZEN_API_ORIGIN);
      url.searchParams.set('locationId', options.locationId);
      return url;
    }
    default: {
      const _exhaustive: never = request;
      return _exhaustive;
    }
  }
}

export function getApiVersionForRequest(request: HelloZenReadRequest): string {
  return HELLOZEN_READ_ENDPOINTS[request.kind].apiVersion;
}

export function isForbiddenHelloZenPath(pathname: string): boolean {
  return FORBIDDEN_PATH_FRAGMENTS.some((fragment) =>
    pathname.includes(fragment),
  );
}

export function isPermittedHelloZenUrl(url: URL): boolean {
  if (url.origin !== HELLOZEN_API_ORIGIN) {
    return false;
  }

  if (isForbiddenHelloZenPath(url.pathname)) {
    return false;
  }

  const path = url.pathname;
  const permittedPrefixes = [
    '/locations/',
    '/opportunities/pipelines',
    '/calendars/',
    '/workflows/',
    '/users/search',
    '/forms/',
  ];

  return permittedPrefixes.some((prefix) => path.startsWith(prefix));
}

export function assertPermittedQueryParams(url: URL): void {
  const allowedParams = new Set([
    'locationId',
    'model',
    'companyId',
    'limit',
    'skip',
  ]);

  for (const key of url.searchParams.keys()) {
    if (!allowedParams.has(key)) {
      throw new Error(`Disallowed query parameter: ${key}`);
    }
  }

  const model = url.searchParams.get('model');
  if (model && model !== 'opportunity') {
    throw new Error(`Disallowed model query value: ${model}`);
  }
}
