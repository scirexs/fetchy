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
 * Reviver function passed as the second argument to `JSON.parse`.
 * Used via `JSONParseOptions.reviver` to transform values during parsing.
 */
export type JSONReviver = Parameters<typeof JSON.parse>[1];

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
 * Options for `FetchyResponse.json`.
 *
 * @example
 * ```ts
 * const user = await res.json<User>({
 *   safe: true,
 *   refine: (v) => UserSchema.parse(v),
 *   reviver: (_, v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(v) : v,
 * });
 * ```
 */
export interface JSONParseOptions<T> {
  /**
   * If true, returns `null` instead of throwing on parse, reviver, or refine errors.
   * @default false
   */
  safe?: boolean;
  /** Validates or transforms the parsed value. Thrown errors are caught when `safe: true`. */
  refine?: (v: unknown) => T | Promise<T>;
  /** Reviver function passed as the second argument to `JSON.parse`. */
  reviver?: JSONReviver;
}

/**
 * Extended `Headers` with a typed `parse` method for converting header values.
 * Returned as `response.headers` from `FetchyResponse`.
 * Still satisfies `instanceof Headers`.
 *
 * @example
 * ```ts
 * const res = await fetchy("https://api.example.com/data");
 *
 * // With default value when header is missing
 * const limit = res.headers.parse("x-rate-limit", Number, 0);
 *
 * // Parser handles `null` itself when header is missing
 * const date = res.headers.parse("date", (v) => v ? new Date(v) : null);
 * ```
 */
export interface FetchyHeaders extends Headers {
  /** Parses a header value with `parser`, returning `dflt` when the header is missing. */
  parse<T>(key: string, parser: (v: string) => T, dflt: T): T;
  /** Parses a header value with `parser`, passing `null` when the header is missing. */
  parse<T>(key: string, parser: (v: string | null) => T): T;
}

/**
 * Extended `Response` returned by `fetchy` / `sfetchy` after awaiting.
 * Adds an optional `safe` flag to body parsing methods (returns `null` on failure instead of throwing)
 * and replaces `headers` with `FetchyHeaders`.
 * Still satisfies `instanceof Response`.
 *
 * @example
 * ```ts
 * const res = await fetchy("https://api.example.com/data");
 *
 * // Standard parsing (throws on error)
 * const user = await res.json<User>();
 * const text = await res.text();
 *
 * // Safe parsing (returns null on error)
 * const userOrNull = await res.json<User>({ safe: true });
 * const textOrNull = await res.text(true);
 *
 * // JSON with validation and reviver
 * const validated = await res.json<User>({ refine: (v) => UserSchema.parse(v) });
 * ```
 */
export interface FetchyResponse extends Response {
  readonly headers: FetchyHeaders;
  /** Parses response body as text. */
  text(safe?: false): Promise<string>;
  text(safe: boolean): Promise<string | null>;
  /** Parses response body as JSON with optional type parameter. */
  json<T>(options?: JSONParseOptions<T> & { safe?: false }): Promise<T>;
  json<T>(options: JSONParseOptions<T>): Promise<T | null>;
  /** Parses response body as Uint8Array. */
  bytes(safe?: false): Promise<Uint8Array<ArrayBuffer>>;
  bytes(safe: boolean): Promise<Uint8Array<ArrayBuffer> | null>;
  /** Parses response body as Blob. */
  blob(safe?: false): Promise<Blob>;
  blob(safe: boolean): Promise<Blob | null>;
  /** Parses response body as ArrayBuffer. */
  arrayBuffer(safe?: false): Promise<ArrayBuffer>;
  arrayBuffer(safe: boolean): Promise<ArrayBuffer | null>;
  /** Parses response body as FormData. */
  formData(safe?: false): Promise<FormData>;
  formData(safe: boolean): Promise<FormData | null>;
}

/**
 * Promise-like response object that extends `Promise<FetchyResponse>` with convenience methods.
 * Provides methods to parse response body in various formats.
 * All methods return parsed data directly without needing to await the FetchyResponse first.
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
export interface FetchyPromise extends Promise<FetchyResponse> {
  /** Parses response body as text. */
  text(safe?: false): Promise<string>;
  text(safe: boolean): Promise<string | null>;
  /** Parses response body as JSON with optional type parameter. */
  json<T>(options?: JSONParseOptions<T> & { safe?: false }): Promise<T>;
  json<T>(options: JSONParseOptions<T>): Promise<T | null>;
  /** Parses response body as Uint8Array. */
  bytes(safe?: false): Promise<Uint8Array<ArrayBuffer>>;
  bytes(safe: boolean): Promise<Uint8Array<ArrayBuffer> | null>;
  /** Parses response body as Blob. */
  blob(safe?: false): Promise<Blob>;
  blob(safe: boolean): Promise<Blob | null>;
  /** Parses response body as ArrayBuffer. */
  arrayBuffer(safe?: false): Promise<ArrayBuffer>;
  arrayBuffer(safe: boolean): Promise<ArrayBuffer | null>;
  /** Parses response body as FormData. */
  formData(safe?: false): Promise<FormData>;
  formData(safe: boolean): Promise<FormData | null>;
}

/**
 * Promise-like response object for safe mode that extends `Promise<FetchyResponse | null>`.
 * Returns null instead of throwing errors on request failure.
 * Provides the same convenience methods as FetchyPromise.
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
export interface FetchySafePromise extends Promise<FetchyResponse | null> {
  /** Parses response body safely as text. */
  text(): Promise<string | null>;
  /** Parses response body safely as JSON with optional type parameter. */
  json<T>(options?: Omit<JSONParseOptions<T>, "safe">): Promise<T | null>;
  /** Parses response body safely as Uint8Array. */
  bytes(): Promise<Uint8Array<ArrayBuffer> | null>;
  /** Parses response body safely as Blob. */
  blob(): Promise<Blob | null>;
  /** Parses response body safely as ArrayBuffer. */
  arrayBuffer(): Promise<ArrayBuffer | null>;
  /** Parses response body safely as FormData. */
  formData(): Promise<FormData | null>;
}
/**
 * Fluent HTTP client interface with pre-configured options.
 * Created by `fy()` function, this interface allows method chaining and provides
 * both standard and safe (error-suppressing) variants of HTTP methods.
 *
 * All methods inherit the options specified when creating the Fetchy instance,
 * which can be overridden by passing additional options to individual method calls.
 *
 * @example
 * ```ts
 * import { fy } from "@scirexs/fetchy";
 *
 * // Create client with base configuration
 * const api = fy({
 *   base: "https://api.example.com",
 *   bearer: "token123",
 *   timeout: 10,
 *   retry: { maxAttempts: 3 }
 * });
 *
 * // Use standard methods (throw on error)
 * const user = await api.get("/user").json<User>();
 * const result = await api.post("/data", { body: { key: "value" } }).json();
 *
 * // Use safe methods (return null on error)
 * const posts = await api.sget("/posts").json<Post[]>();
 * if (posts === null) {
 *   console.log("Failed to fetch posts");
 * }
 *
 * // Override instance options
 * const data = await api.get("/important", {
 *   timeout: 30,
 *   retry: { maxAttempts: 5 }
 * }).json();
 * ```
 */
export interface Fetchy extends FetchyOptions {
  /**
   * Performs HTTP request with instance options.
   * Equivalent to calling `fetchy()` with pre-configured options.
   *
   * @param url - Request URL (uses instance `url` if omitted).
   * @param options - Additional options to merge with instance options.
   * @returns Promise-like response object with parsing methods.
   */
  fetch(url?: string | URL | Request | null, options?: FetchyOptions): FetchyPromise;

  /**
   * Performs GET request with instance options.
   *
   * @param url - Request URL (uses instance `url` if omitted).
   * @param options - Additional options to merge with instance options.
   * @returns Promise-like response object with parsing methods.
   */
  get(url?: string | URL | Request | null, options?: FetchyOptions): FetchyPromise;

  /**
   * Performs HEAD request with instance options.
   * HEAD requests only retrieve headers without response body.
   *
   * @param url - Request URL (uses instance `url` if omitted).
   * @param options - Additional options to merge with instance options.
   * @returns Promise resolving to Response object.
   */
  head(url?: string | URL | Request | null, options?: FetchyOptions): Promise<FetchyResponse>;

  /**
   * Performs POST request with instance options.
   *
   * @param url - Request URL (uses instance `url` if omitted).
   * @param options - Additional options to merge with instance options (typically includes `body`).
   * @returns Promise-like response object with parsing methods.
   */
  post(url?: string | URL | Request | null, options?: FetchyOptions): FetchyPromise;

  /**
   * Performs PUT request with instance options.
   *
   * @param url - Request URL (uses instance `url` if omitted).
   * @param options - Additional options to merge with instance options (typically includes `body`).
   * @returns Promise-like response object with parsing methods.
   */
  put(url?: string | URL | Request | null, options?: FetchyOptions): FetchyPromise;

  /**
   * Performs PATCH request with instance options.
   *
   * @param url - Request URL (uses instance `url` if omitted).
   * @param options - Additional options to merge with instance options (typically includes `body`).
   * @returns Promise-like response object with parsing methods.
   */
  patch(url?: string | URL | Request | null, options?: FetchyOptions): FetchyPromise;

  /**
   * Performs DELETE request with instance options.
   *
   * @param url - Request URL (uses instance `url` if omitted).
   * @param options - Additional options to merge with instance options.
   * @returns Promise-like response object with parsing methods.
   */
  delete(url?: string | URL | Request | null, options?: FetchyOptions): FetchyPromise;

  /**
   * Performs HTTP request in safe mode with instance options.
   * Returns `null` on any error instead of throwing.
   * Equivalent to calling `sfetchy()` with pre-configured options.
   *
   * @param url - Request URL (uses instance `url` if omitted).
   * @param options - Additional options to merge with instance options.
   * @returns Promise-like response object that resolves to Response or null.
   */
  sfetch(url?: string | URL | Request | null, options?: FetchyOptions): FetchySafePromise;

  /**
   * Performs GET request in safe mode with instance options.
   * Returns `null` on any error instead of throwing.
   *
   * @param url - Request URL (uses instance `url` if omitted).
   * @param options - Additional options to merge with instance options.
   * @returns Promise-like response object that resolves to Response or null.
   */
  sget(url?: string | URL | Request | null, options?: FetchyOptions): FetchySafePromise;

  /**
   * Performs HEAD request in safe mode with instance options.
   * Returns `null` on any error instead of throwing.
   *
   * @param url - Request URL (uses instance `url` if omitted).
   * @param options - Additional options to merge with instance options.
   * @returns Promise resolving to Response or null.
   */
  shead(url?: string | URL | Request | null, options?: FetchyOptions): Promise<FetchyResponse | null>;

  /**
   * Performs POST request in safe mode with instance options.
   * Returns `null` on any error instead of throwing.
   *
   * @param url - Request URL (uses instance `url` if omitted).
   * @param options - Additional options to merge with instance options (typically includes `body`).
   * @returns Promise-like response object that resolves to Response or null.
   */
  spost(url?: string | URL | Request | null, options?: FetchyOptions): FetchySafePromise;

  /**
   * Performs PUT request in safe mode with instance options.
   * Returns `null` on any error instead of throwing.
   *
   * @param url - Request URL (uses instance `url` if omitted).
   * @param options - Additional options to merge with instance options (typically includes `body`).
   * @returns Promise-like response object that resolves to Response or null.
   */
  sput(url?: string | URL | Request | null, options?: FetchyOptions): FetchySafePromise;

  /**
   * Performs PATCH request in safe mode with instance options.
   * Returns `null` on any error instead of throwing.
   *
   * @param url - Request URL (uses instance `url` if omitted).
   * @param options - Additional options to merge with instance options (typically includes `body`).
   * @returns Promise-like response object that resolves to Response or null.
   */
  spatch(url?: string | URL | Request | null, options?: FetchyOptions): FetchySafePromise;

  /**
   * Performs DELETE request in safe mode with instance options.
   * Returns `null` on any error instead of throwing.
   *
   * @param url - Request URL (uses instance `url` if omitted).
   * @param options - Additional options to merge with instance options.
   * @returns Promise-like response object that resolves to Response or null.
   */
  sdelete(url?: string | URL | Request | null, options?: FetchyOptions): FetchySafePromise;
}
