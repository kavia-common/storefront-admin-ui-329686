import { ApiHttpError, ApiNetworkError, ApiParseError } from "./errors";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiLogLevel = "debug" | "info" | "warn" | "error";

export type ApiLogger = (event: {
  level: ApiLogLevel;
  operation: string;
  message: string;
  meta?: Record<string, unknown>;
}) => void;

export type ResponseParser<T> = (params: { url: string; text: string }) => T;

export interface ApiRequestOptions<TResponse> {
  method: HttpMethod;
  /**
   * Path relative to the client basePath (e.g. "/actuator/health").
   * Must start with "/".
   */
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  /**
   * Request body. If an object is provided, it will be JSON-stringified and
   * content-type will be set to "application/json" (unless overridden).
   */
  body?: unknown;
  signal?: AbortSignal;
  /**
   * Parse strategy. Defaults to returning text as-is.
   *
   * Use `parseJson<T>()` for JSON endpoints.
   */
  parse?: ResponseParser<TResponse>;
  /**
   * Operation name used for logs (debuggability).
   */
  operation: string;
}

export interface ApiSuccess<T> {
  ok: true;
  status: number;
  url: string;
  text: string;
  data: T;
}

export interface ApiFailure {
  ok: false;
  status: number;
  url: string;
  text: string;
  error: ApiHttpError | ApiNetworkError | ApiParseError;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

function defaultLogger(event: {
  level: ApiLogLevel;
  operation: string;
  message: string;
  meta?: Record<string, unknown>;
}) {
  // Keep logs deterministic + searchable, but lightweight.
  // eslint-disable-next-line no-console
  console[event.level === "debug" ? "debug" : event.level](
    `[api:${event.operation}] ${event.message}`,
    event.meta ?? {},
  );
}

function buildQueryString(
  query: Record<string, string | number | boolean | undefined | null> | undefined,
): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

function normalizeBasePath(basePath: string): string {
  // Normalize to no trailing slash, and ensure leading slash.
  const trimmed = basePath.trim();
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeading.endsWith("/") ? withLeading.slice(0, -1) : withLeading;
}

function assertValidPath(path: string) {
  if (!path.startsWith("/")) {
    throw new Error(`ApiRequestOptions.path must start with "/". Got: "${path}"`);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// PUBLIC_INTERFACE
export function createHttpClient(params: {
  /**
   * Base path for all API calls, usually "/api" to use the Vite proxy.
   * You can override using VITE_API_BASE_PATH if needed.
   */
  basePath: string;
  logger?: ApiLogger;
}) {
  /**
   * Canonical HTTP client used by all frontend API modules.
   *
   * Contract:
   * - Inputs: ApiRequestOptions (method/path/query/headers/body/signal)
   * - Output: ApiResponse<T> (never throws for HTTP status; only wraps failures)
   * - Errors:
   *   - Network: ok=false + ApiNetworkError
   *   - HTTP non-2xx: ok=false + ApiHttpError (includes response text)
   *   - Parse failure: ok=false + ApiParseError (includes response text)
   * - Side effects: performs a browser `fetch` call
   * - Observability: logs start/end/failure with operation + URL + status
   */
  const basePath = normalizeBasePath(params.basePath);
  const logger = params.logger ?? defaultLogger;

  async function request<TResponse>(options: ApiRequestOptions<TResponse>): Promise<ApiResponse<TResponse>> {
    assertValidPath(options.path);
    const url = `${basePath}${options.path}${buildQueryString(options.query)}`;

    logger({
      level: "debug",
      operation: options.operation,
      message: "request:start",
      meta: { method: options.method, url },
    });

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...options.headers,
    };

    let body: BodyInit | undefined;
    if (options.body !== undefined) {
      if (typeof options.body === "string") {
        body = options.body;
      } else if (isPlainObject(options.body) || Array.isArray(options.body)) {
        // Default JSON encoding for objects/arrays.
        if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
        body = JSON.stringify(options.body);
      } else {
        // Fallback to string conversion for other primitives.
        body = String(options.body);
      }
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method: options.method,
        headers,
        body,
        signal: options.signal,
      });
    } catch (e) {
      const error = new ApiNetworkError({ url, cause: e });
      logger({
        level: "error",
        operation: options.operation,
        message: "request:network_error",
        meta: { url, error: error.message },
      });
      return { ok: false, status: 0, url, text: "", error };
    }

    const text = await res.text();

    if (!res.ok) {
      const error = new ApiHttpError({ status: res.status, url, responseText: text });
      logger({
        level: "warn",
        operation: options.operation,
        message: "request:http_error",
        meta: { url, status: res.status },
      });
      return { ok: false, status: res.status, url, text, error };
    }

    const parse = options.parse ?? ((p: { text: string }) => p.text as unknown as TResponse);

    let data: TResponse;
    try {
      data = parse({ url, text });
    } catch (e) {
      const error = new ApiParseError({ url, responseText: text, cause: e });
      logger({
        level: "error",
        operation: options.operation,
        message: "request:parse_error",
        meta: { url },
      });
      return { ok: false, status: res.status, url, text, error };
    }

    logger({
      level: "debug",
      operation: options.operation,
      message: "request:success",
      meta: { url, status: res.status },
    });

    return { ok: true, status: res.status, url, text, data };
  }

  return {
    request,
  };
}

// PUBLIC_INTERFACE
export function parseJson<T>(): ResponseParser<T> {
  /**
   * JSON parsing strategy for `createHttpClient().request`.
   *
   * Contract:
   * - Input: response text
   * - Output: parsed JSON typed as T
   * - Errors: throws if JSON.parse fails (caught and wrapped by the client)
   */
  return ({ text }) => JSON.parse(text) as T;
}
