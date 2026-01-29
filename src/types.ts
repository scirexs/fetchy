/**
 * Represents a JSON-compatible value that can be serialized and deserialized.
 * This type includes primitives, arrays, and plain objects with string keys.
 */
export type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };

/**
 * Represents the body content that can be sent in a fetch request.
 * Includes JSON-compatible values and standard BodyInit types except ReadableStream.
 */
export type FetchyBody = JSONValue | BodyInit;

/**
 * Configuration options for fetchy requests.
 * Extends standard RequestInit but provides additional features like timeout, retry, and error handling.
 *
 * @example
 * ```ts
 * import { fetchy } from "@scirexs/fetchy";
 *
 * const response = await fetchy("https://api.example.com/data", {
 *   method: "POST",
 *   body: { key: "value" },
 *   timeout: 10,
 *   retry: { maxAttempts: 3, interval: 2 },
 *   bearer: "your-token-here"
 * });
 * ```
 */
export interface FetchyOptions extends Omit<RequestInit, "body"> {
  /** Request URL. Used when calling fetchy with null as the first argument. */
  url?: string | URL | Request;
  /**
   * Base URL prepended to the request URL.
   * Only used when the URL argument is a string or URL (not when it's a Request object).
   */
  base?: string | URL;
  /** Request body content. Automatically serializes JSON objects. */
  body?: FetchyBody;
  /**
   * Request timeout in seconds.
   * @default 15
   */
  timeout?: number;
  /** Retry configuration. Set to false to disable retry functionality. */
  retry?: RetryOptions | false;
  /** Bearer token for Authorization header. Automatically adds "Bearer " prefix. */
  bearer?: string;
  /**
   * Maximum jitter delay in seconds applied before each request (including retries).
   * Adds randomness (0 to specified value) to prevent thundering herd.
   * @default 0
   */
  jitter?: number;
  /**
   * If true, does not throw error on HTTP error status, behaving like native fetch.
   * @default false
   */
  native?: boolean;
}

/**
 * Configuration options for retry behavior.
 * Supports exponential backoff and respects Retry-After headers.
 *
 * @example
 * ```ts
 * const retryOptions: RetryOptions = {
 *   interval: 3,
 *   maxInterval: 30,
 *   maxAttempts: 3,
 *   idempotentOnly: true,
 * };
 * ```
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts. Minimum is 1.
   * @default 3
   */
  maxAttempts?: number;
  /**
   * Base interval in seconds between retries. Used for exponential backoff calculation. Minimum is 0.01.
   * @default 3
   */
  interval?: number;
  /**
   * Maximum interval in seconds between retries. Caps the exponential backoff. Minimum is 1.
   * @default 30
   */
  maxInterval?: number;
  /**
   * Whether to retry on request timeout.
   * @default true
   */
  retryOnTimeout?: boolean;
  /**
   * Whether to only retry on idempotent HTTP methods (GET, HEAD, PUT, DELETE, OPTIONS, TRACE).
   * @default false
   */
  idempotentOnly?: boolean;
  /**
   * HTTP status codes that should trigger a retry.
   * @default [500,502,503,504,408,429]
   */
  statusCodes?: number[];
  /**
   * Response headers to respect for retry timing.
   * @default ["retry-after","ratelimit-reset","x-ratelimit-reset"]
   */
  respectHeaders?: string[];
}

/**
 * Promise-like response object that extends Promise<Response> with convenience methods.
 * Provides methods to parse response body in various formats.
 * All methods return parsed data directly without needing to await the Response first.
 *
 * @example
 * ```ts
 * // Return response same with native fetch
 * const response = await fetchy("https://api.example.com/hello");
 *
 * // Direct parsing methods
 * const data = await fetchy("https://api.example.com/data").json<User>();
 * const text = await fetchy("https://example.com/page").text();
 * const bytes = await fetchy("https://example.com/file").bytes();
 * ```
 */
export interface FetchyResponse extends Promise<Response> {
  /** Parses response body as text. */
  text: () => Promise<string>;
  /** Parses response body as JSON with optional type parameter. */
  json: <T>() => Promise<T>;
  /** Parses response body as Uint8Array. */
  bytes: () => Promise<Uint8Array<ArrayBuffer>>;
  /** Parses response body as Blob. */
  blob: () => Promise<Blob>;
  /** Parses response body as ArrayBuffer. */
  arrayBuffer: () => Promise<ArrayBuffer>;
  /** Parses response body as FormData. */
  formData: () => Promise<FormData>;
}

/**
 * Promise-like response object for safe mode that extends Promise<Response | null>.
 * Returns null instead of throwing errors on request failure.
 * Provides the same convenience methods as FetchyResponse.
 *
 * @example
 * ```ts
 * // Returns null on error instead of throwing
 * const response = await sfetchy("https://api.example.com/data");
 * if (response === null) {
 *   // Handle error case
 * }
 *
 * // Direct safe parsing
 * const data = await sfetchy("https://api.example.com/data").json<User>();
 * ```
 */
export interface FetchySafeResponse extends Promise<Response | null> {
  /** Parses response body safety as text. */
  text: () => Promise<string | null>;
  /** Parses response body safety as JSON with optional type parameter. */
  json: <T>() => Promise<T | null>;
  /** Parses response body safety as Uint8Array. */
  bytes: () => Promise<Uint8Array<ArrayBuffer> | null>;
  /** Parses response body safety as Blob. */
  blob: () => Promise<Blob | null>;
  /** Parses response body safety as ArrayBuffer. */
  arrayBuffer: () => Promise<ArrayBuffer | null>;
  /** Parses response body safety as FormData. */
  formData: () => Promise<FormData | null>;
}
