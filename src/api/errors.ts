export type ApiErrorKind = "network" | "http" | "parse";

/**
 * Base API error type for client-layer failures.
 *
 * Contract:
 * - kind: categorizes the error for UI handling
 * - message: human-readable summary
 * - cause: original error (when available) for debugging
 */
export class ApiError extends Error {
  public readonly kind: ApiErrorKind;
  public readonly cause?: unknown;

  constructor(kind: ApiErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = "ApiError2";
    this.kind = kind;
    this.cause = cause;
  }
}

/**
 * Error representing non-2xx HTTP responses.
 *
 * Contract:
 * - status: HTTP status code
 * - url: resolved request URL
 * - responseText: response body as text (captured for diagnostics)
 */
export class ApiHttpError extends ApiError {
  public readonly status: number;
  public readonly url: string;
  public readonly responseText: string;

  constructor(params: { status: number; url: string; responseText: string }) {
    super(
      "http",
      `API request failed with HTTP ${params.status} (${params.url})`,
      undefined,
    );
    this.name = "ApiHttpError";
    this.status = params.status;
    this.url = params.url;
    this.responseText = params.responseText;
  }
}

/**
 * Error representing a network-layer failure (DNS, CORS, connection refused, etc.).
 *
 * Contract:
 * - url: resolved request URL
 * - cause: underlying fetch error
 */
export class ApiNetworkError extends ApiError {
  public readonly url: string;

  constructor(params: { url: string; cause: unknown }) {
    super("network", `Network error while calling API (${params.url})`, params.cause);
    this.name = "ApiNetworkError";
    this.url = params.url;
  }
}

/**
 * Error representing an unexpected response parsing failure.
 *
 * Contract:
 * - url: resolved request URL
 * - responseText: response body as text (captured for diagnostics)
 * - cause: underlying parsing error
 */
export class ApiParseError extends ApiError {
  public readonly url: string;
  public readonly responseText: string;

  constructor(params: { url: string; responseText: string; cause: unknown }) {
    super("parse", `Failed to parse API response (${params.url})`, params.cause);
    this.name = "ApiParseError";
    this.url = params.url;
    this.responseText = params.responseText;
  }
}
