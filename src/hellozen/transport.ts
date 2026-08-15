import {
  assertPermittedQueryParams,
  buildHelloZenRequestUrl,
  getApiVersionForRequest,
  HELLOZEN_API_ORIGIN,
  isPermittedHelloZenUrl,
  MAX_UPSTREAM_RESPONSE_BYTES,
  type HelloZenReadRequest,
} from './api-registry.js';
import {
  HELLOZEN_ERROR_MESSAGES,
  HelloZenError,
} from './errors.js';

export type FetchFn = typeof fetch;

const REJECTED_METHODS = new Set([
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
]);

export type ReadOnlyHelloZenTransportOptions = {
  readonlyToken: string;
  locationId: string;
  companyId?: string;
  requestTimeoutMs: number;
  fetchImpl?: FetchFn;
};

export class ReadOnlyHelloZenTransport {
  private readonly fetchImpl: FetchFn;

  constructor(private readonly options: ReadOnlyHelloZenTransportOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getJson(request: HelloZenReadRequest): Promise<unknown> {
    const url = buildHelloZenRequestUrl(request, {
      locationId: this.options.locationId,
      companyId: this.options.companyId,
    });
    return this.requestGet(url, getApiVersionForRequest(request));
  }

  /** @internal Exposed for security tests */
  async requestGet(url: URL, apiVersion?: string): Promise<unknown> {
    this.assertPermittedUrl(url);
    const method = 'GET';
    if (method !== 'GET' || REJECTED_METHODS.has(method)) {
      throw new HelloZenError(
        HELLOZEN_ERROR_MESSAGES.invalidResponse,
        'internal',
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.requestTimeoutMs,
    );

    try {
      const response = await this.fetchImpl(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.options.readonlyToken}`,
          Version: apiVersion ?? '2021-07-28',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw this.mapHttpError(response.status);
      }

      return await this.readLimitedJson(response);
    } catch (error) {
      if (error instanceof HelloZenError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new HelloZenError(
          HELLOZEN_ERROR_MESSAGES.timeout,
          'timeout',
        );
      }
      throw new HelloZenError(
        HELLOZEN_ERROR_MESSAGES.invalidResponse,
        'invalid_response',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /** @internal Exposed for security tests */
  assertMethodAllowed(method: string): void {
    const normalized = method.toUpperCase();
    if (normalized !== 'GET' || REJECTED_METHODS.has(normalized)) {
      throw new HelloZenError(
        HELLOZEN_ERROR_MESSAGES.invalidResponse,
        'internal',
      );
    }
  }

  private assertPermittedUrl(url: URL): void {
    if (!isPermittedHelloZenUrl(url)) {
      throw new HelloZenError(
        HELLOZEN_ERROR_MESSAGES.invalidResponse,
        'internal',
      );
    }

    try {
      assertPermittedQueryParams(url);
    } catch {
      throw new HelloZenError(
        HELLOZEN_ERROR_MESSAGES.invalidResponse,
        'internal',
      );
    }
  }

  private mapHttpError(status: number): HelloZenError {
    if (status === 401) {
      return new HelloZenError(
        HELLOZEN_ERROR_MESSAGES.authentication,
        'authentication',
      );
    }
    if (status === 403) {
      return new HelloZenError(
        HELLOZEN_ERROR_MESSAGES.accessDenied,
        'access_denied',
      );
    }
    return new HelloZenError(
      HELLOZEN_ERROR_MESSAGES.invalidResponse,
      'invalid_response',
    );
  }

  private async readLimitedJson(response: Response): Promise<unknown> {
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const length = Number.parseInt(contentLength, 10);
      if (
        Number.isFinite(length) &&
        length > MAX_UPSTREAM_RESPONSE_BYTES
      ) {
        throw new HelloZenError(
          HELLOZEN_ERROR_MESSAGES.invalidResponse,
          'invalid_response',
        );
      }
    }

    const body = response.body;
    if (!body) {
      throw new HelloZenError(
        HELLOZEN_ERROR_MESSAGES.invalidResponse,
        'invalid_response',
      );
    }

    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (!value) {
          continue;
        }
        totalBytes += value.byteLength;
        if (totalBytes > MAX_UPSTREAM_RESPONSE_BYTES) {
          await reader.cancel();
          throw new HelloZenError(
            HELLOZEN_ERROR_MESSAGES.invalidResponse,
            'invalid_response',
          );
        }
        chunks.push(value);
      }
    } catch (error) {
      if (error instanceof HelloZenError) {
        throw error;
      }
      throw new HelloZenError(
        HELLOZEN_ERROR_MESSAGES.invalidResponse,
        'invalid_response',
      );
    }

    const text = new TextDecoder().decode(
      concatUint8Arrays(chunks, totalBytes),
    );
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new HelloZenError(
        HELLOZEN_ERROR_MESSAGES.invalidResponse,
        'invalid_response',
      );
    }
  }
}

function concatUint8Arrays(
  chunks: Uint8Array[],
  totalBytes: number,
): Uint8Array {
  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export { HELLOZEN_API_ORIGIN };
