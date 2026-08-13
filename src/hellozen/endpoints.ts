export const HELLOZEN_API_ORIGIN = 'https://services.leadconnectorhq.com';
export const HELLOZEN_API_VERSION = '2021-07-28';
export const MAX_UPSTREAM_RESPONSE_BYTES = 2 * 1024 * 1024;

export type HelloZenReadEndpoint =
  | { kind: 'customFieldsBase' }
  | { kind: 'customFieldsOpportunity' }
  | { kind: 'pipelines' }
  | { kind: 'calendars' }
  | { kind: 'workflows' };

export const FORBIDDEN_PATH_FRAGMENTS = [
  '/contacts',
  '/contacts/search',
  '/opportunities/search',
  '/opportunities/',
  '/calendars/events',
  '/conversations',
  '/workflow',
] as const;

export function buildHelloZenUrl(
  locationId: string,
  endpoint: HelloZenReadEndpoint,
): URL {
  const encodedLocationId = encodeURIComponent(locationId);

  switch (endpoint.kind) {
    case 'customFieldsBase':
      return new URL(
        `/locations/${encodedLocationId}/customFields`,
        HELLOZEN_API_ORIGIN,
      );
    case 'customFieldsOpportunity':
      return new URL(
        `/locations/${encodedLocationId}/customFields?model=opportunity`,
        HELLOZEN_API_ORIGIN,
      );
    case 'pipelines': {
      const url = new URL('/opportunities/pipelines', HELLOZEN_API_ORIGIN);
      url.searchParams.set('locationId', locationId);
      return url;
    }
    case 'calendars': {
      const url = new URL('/calendars/', HELLOZEN_API_ORIGIN);
      url.searchParams.set('locationId', locationId);
      return url;
    }
    case 'workflows': {
      const url = new URL('/workflows/', HELLOZEN_API_ORIGIN);
      url.searchParams.set('locationId', locationId);
      return url;
    }
    default: {
      const _exhaustive: never = endpoint;
      return _exhaustive;
    }
  }
}

export function isForbiddenHelloZenPath(pathname: string): boolean {
  return FORBIDDEN_PATH_FRAGMENTS.some((fragment) =>
    pathname.includes(fragment),
  );
}
