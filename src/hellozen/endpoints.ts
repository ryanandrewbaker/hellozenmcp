export {
  ALLOWED_HTTP_METHODS,
  assertPermittedQueryParams,
  buildHelloZenRequestUrl,
  FORBIDDEN_PATH_FRAGMENTS,
  getApiVersionForRequest,
  HELLOZEN_API_ORIGIN,
  HELLOZEN_API_VERSION_DEFAULT as HELLOZEN_API_VERSION,
  HELLOZEN_READ_ENDPOINTS,
  isForbiddenHelloZenPath,
  isPermittedHelloZenUrl,
  MAX_UPSTREAM_RESPONSE_BYTES,
  type HelloZenReadRequest,
} from './api-registry.js';

import {
  buildHelloZenRequestUrl,
  type HelloZenReadRequest,
} from './api-registry.js';

/** @deprecated Use buildHelloZenRequestUrl(request, { locationId }) */
export function buildHelloZenUrl(
  locationId: string,
  endpoint: HelloZenReadRequest,
): URL {
  return buildHelloZenRequestUrl(endpoint, { locationId });
}

// Legacy alias for existing tests
export type HelloZenReadEndpoint = import('./api-registry.js').HelloZenReadRequest;
