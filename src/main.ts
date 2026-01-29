export {
  _assignToPromise,
  _buildOption,
  _cloneRequestF,
  _correctNumber,
  _createRequest,
  _DEFAULT,
  _fetchWithJitter,
  _fetchWithRetry,
  _findRetryHeader,
  _getBody,
  _getContentType,
  _getHeaders,
  _getNextInterval,
  _getOptions,
  _getRequestInit,
  _getRetryOption,
  _handleByNative,
  _includeStream,
  _isBool,
  _isHttpError,
  _isJSONObject,
  _isNoHeader,
  _isNumber,
  _isPlain,
  _isRequest,
  _isStream,
  _isString,
  _main,
  _makeFetchyResponse,
  _mergeSignals,
  _METHODS,
  _NO_IDEM,
  _parseRetryHeader,
  _shouldRetry,
  _wait,
  _withTimeout,
  Fetchy,
  fetchy,
  fy,
  HTTPStatusError,
  sfetchy,
};

import type { FetchyBody, FetchyOptions, FetchyResponse, FetchySafeResponse, RetryOptions } from "./types.ts";

/*=============== Constant Values ===============*/
const MGET = "GET";
const MHEAD = "HEAD";
const MPOST = "POST";
const MPUT = "PUT";
const MPATCH = "PATCH";
const MDELETE = "DELETE";
const H_ACCEPT = "Accept";
const H_CTYPE = "Content-Type";
const MIME_JSON = "application/json";
/** Default configuration values for fetchy. */
const _DEFAULT: Options = {
  ztimeout: 15,
  zjitter: 0,
  zinterval: 3,
  zmaxInterval: 30,
  zmaxAttempts: 3,
  zonTimeout: true,
  znoIdempotent: false,
  zstatusCodes: [500, 502, 503, 504, 408, 429],
  zrespects: ["retry-after", "ratelimit-reset", "x-ratelimit-reset"],
  znative: false,
} as const;
/** HTTP methods that do not have idempotency. */
const _NO_IDEM = [MPOST, MPATCH, "CONNECT"];
/** Additional methods for Promise-like interface. */
const _METHODS = ["text", "json", "bytes", "blob", "arrayBuffer", "formData"] as const;

/*=============== Internal Types ================*/
/** Internal normalized options used throughout the fetch process. */
interface Options {
  ztimeout: number;
  zjitter: number;
  zinterval: number;
  zmaxInterval: number;
  zmaxAttempts: number;
  zonTimeout: boolean;
  znoIdempotent: boolean;
  zstatusCodes: number[];
  zrespects: string[];
  znative: boolean;
  zsignal?: AbortSignal;
}
/** URL argument type for fetchy functions. */
type InputArg = string | URL | Request | null;
/** Internal retry-related options extracted from RetryOptions. */
type InternalRetry = Pick<
  Options,
  "zinterval" | "zmaxInterval" | "zmaxAttempts" | "zonTimeout" | "znoIdempotent" | "zstatusCodes" | "zrespects"
>;

/*=============== Main Codes ====================*/
/**
 * Error thrown when HTTP response has a non-OK status code (4xx, 5xx).
 * Only thrown when `native` option is set to false (default behavior).
 *
 * @example
 * ```ts
 * try {
 *   await fetchy("https://api.example.com/data");
 * } catch (error) {
 *   if (error instanceof HTTPStatusError) {
 *     console.error(`HTTP ${error.status}:`, error.message);
 *     console.error("Response:", error.response);
 *   }
 * }
 * ```
 */
class HTTPStatusError extends Error {
  status: number;
  response: Response;
  constructor(resp: Response) {
    super(`${resp.status} ${resp.url}`);
    this.name = "HTTPStatusError";
    this.status = resp.status;
    this.response = resp;
  }
}

/**
 * A fluent HTTP client class that provides both instance and static methods for making HTTP requests.
 * Supports features like timeout, retry with exponential backoff, automatic header management, and response parsing.
 *
 * @example
 * ```ts
 * // Instance usage - reuse configuration
 * const client = new Fetchy({
 *   bearer: "token123",
 *   timeout: 10,
 *   retry: { maxAttempts: 3 }
 * });
 * const user = await client.get("https://api.example.com/user").json<User>();
 * const posts = await client.get("https://api.example.com/posts").json<Post[]>();
 *
 * // Safe mode - returns null on error instead of throwing
 * const result = await client.safe("https://api.example.com/data").json<Data>();
 * if (result !== null) {
 *   // Handle successful response
 * }
 * ```
 */
class Fetchy implements FetchyOptions {
  /** Request URL. Used when calling methods with null as URL argument. */
  url?: string | URL | Request;
  /**
   * Base URL prepended to the request URL.
   * Only used when the URL argument is a string or URL (not when it's a Request object).
   */
  base?: string | URL;
  /** Request body content. Automatically serializes JSON objects. */
  body?: FetchyBody;
  /** Request timeout in seconds. Default is 15 seconds. */
  timeout?: number;
  /** Retry configuration. Set to false to disable retry functionality. */
  retry?: false | RetryOptions;
  /** Bearer token for Authorization header. Automatically adds "Bearer " prefix. */
  bearer?: string;
  /**
   * Maximum jitter delay in seconds applied before each request (including retries).
   * Adds randomness (0 to specified value) to prevent thundering herd.
   */
  jitter?: number;
  /** If true, does not throw error on HTTP error status, behaving like native fetch. */
  native?: boolean;
  /** Property of RequestInit. */
  cache?: RequestCache;
  /** Property of RequestInit. */
  credentials?: RequestCredentials;
  /** Property of RequestInit. */
  headers?: HeadersInit;
  /** Property of RequestInit. */
  integrity?: string;
  /** Property of RequestInit. */
  keepalive?: boolean;
  /** Property of RequestInit. */
  method?: string;
  /** Property of RequestInit. */
  mode?: RequestMode;
  /** Property of RequestInit. */
  redirect?: RequestRedirect;
  /** Property of RequestInit. */
  referrer?: string;
  /** Property of RequestInit. */
  referrerPolicy?: ReferrerPolicy;
  /** Property of RequestInit. */
  signal?: AbortSignal | null;

  constructor(options?: FetchyOptions) {
    Object.assign(this, options);
  }
  /** Calls fetchy with instance options. */
  fetch(url?: string | URL | Request | null, options?: FetchyOptions): FetchyResponse {
    return fetchy(url, _buildOption(this, options));
  }
  /** Calls fetchy as GET request with instance options. */
  get(url?: string | URL | Request | null, options?: FetchyOptions): FetchyResponse {
    return fetchy(url, _buildOption(this, options, MGET));
  }
  /** Calls fetchy as HEAD request with instance options. */
  head(url?: string | URL | Request | null, options?: FetchyOptions): Promise<Response> {
    return fetchy(url, _buildOption(this, options, MHEAD));
  }
  /** Calls fetchy as POST request with instance options. */
  post(url?: string | URL | Request | null, options?: FetchyOptions): FetchyResponse {
    return fetchy(url, _buildOption(this, options, MPOST));
  }
  /** Calls fetchy as PUT request with instance options. */
  put(url?: string | URL | Request | null, options?: FetchyOptions): FetchyResponse {
    return fetchy(url, _buildOption(this, options, MPUT));
  }
  /** Calls fetchy as PATCH request with instance options. */
  patch(url?: string | URL | Request | null, options?: FetchyOptions): FetchyResponse {
    return fetchy(url, _buildOption(this, options, MPATCH));
  }
  /** Calls fetchy as DELETE request with instance options. */
  delete(url?: string | URL | Request | null, options?: FetchyOptions): FetchyResponse {
    return fetchy(url, _buildOption(this, options, MDELETE));
  }
  /** Calls sfetchy with instance options. Returns null on error. */
  safe(url?: string | URL | Request | null, options?: FetchyOptions): FetchySafeResponse | null {
    return sfetchy(url, _buildOption(this, options));
  }
  /** Calls sfetchy as GET request with instance options. Returns null on error. */
  sget(url?: string | URL | Request | null, options?: FetchyOptions): FetchySafeResponse | null {
    return sfetchy(url, _buildOption(this, options, MGET));
  }
  /** Calls sfetchy as HEAD request with instance options. Returns null on error. */
  shead(url?: string | URL | Request | null, options?: FetchyOptions): Promise<Response | null> | null {
    return sfetchy(url, _buildOption(this, options, MHEAD));
  }
  /** Calls sfetchy as POST request with instance options. Returns null on error. */
  spost(url?: string | URL | Request | null, options?: FetchyOptions): FetchySafeResponse | null {
    return sfetchy(url, _buildOption(this, options, MPOST));
  }
  /** Calls sfetchy as PUT request with instance options. Returns null on error. */
  sput(url?: string | URL | Request | null, options?: FetchyOptions): FetchySafeResponse | null {
    return sfetchy(url, _buildOption(this, options, MPUT));
  }
  /** Calls sfetchy as PATCH request with instance options. Returns null on error. */
  spatch(url?: string | URL | Request | null, options?: FetchyOptions): FetchySafeResponse | null {
    return sfetchy(url, _buildOption(this, options, MPATCH));
  }
  /** Calls sfetchy as DELETE request with instance options. Returns null on error. */
  sdelete(url?: string | URL | Request | null, options?: FetchyOptions): FetchySafeResponse | null {
    return sfetchy(url, _buildOption(this, options, MDELETE));
  }
}

/**
 * Creates a new Fetchy instance with the specified options.
 * Shorthand for `new Fetchy(options)`.
 *
 * @param options - Configuration options to apply to all requests made with this instance.
 * @returns A new Fetchy instance.
 *
 * @example
 * ```ts
 * import { fy } from "@scirexs/fetchy";
 *
 * const client = fy({
 *   bearer: "token123",
 *   timeout: 10,
 *   base: "https://api.example.com"
 * });
 *
 * const user = await client.get("/user").json<User>();
 * const posts = await client.get("/posts").json<Post[]>();
 * ```
 */
function fy(options?: FetchyOptions): Fetchy {
  return new Fetchy(options);
}

/**
 * Performs an HTTP request with safe error handling that returns null on failure.
 * Unlike `fetchy`, this function never throws errors - it returns null for any failure.
 *
 * This is useful when you want to handle errors gracefully without try-catch blocks,
 * or when a failed request should be treated as "no data" rather than an error condition.
 *
 * @param url - The URL to fetch. Can be a string, URL object, Request object, or null (uses options.url).
 * @param options - Configuration options for the request (timeout, retry, headers, etc.).
 * @returns Promise that resolves to Response object or null if request fails.
 *
 * @example
 * ```ts
 * import { sfetchy } from "@scirexs/fetchy";
 *
 * // Returns null instead of throwing on error
 * const response = await sfetchy("https://api.example.com/user");
 * if (response === null) {
 *   console.log("Request failed, using default data");
 *   // Handle failure case
 * } else {
 *   const data = await response.json();
 * }
 *
 * // Using convenience methods
 * const user = await sfetchy("https://api.example.com/user").json<User>();
 * if (user !== null) {
 *   // Handle successful response
 * }
 *
 * // Text response - returns null on any error
 * const text = await sfetchy("https://example.com/page").text();
 *
 * // Binary data with safe error handling
 * const bytes = await sfetchy("https://example.com/image.png").bytes();
 * if (bytes !== null) {
 *   // Process binary data
 * }
 * ```
 */
function sfetchy(url?: string | URL | Request | null, options?: FetchyOptions): FetchySafeResponse | null {
  try {
    return _main(url, options, true);
  } catch {
    return null;
  }
}

/**
 * Performs an HTTP request with enhanced features like timeout, retry, and automatic header management.
 * Throws errors on failure unless configured otherwise via the `native` option.
 *
 * @param url - The URL to fetch. Can be a string, URL object, Request object, or null (uses options.url).
 * @param options - Configuration options for the request (timeout, retry, headers, body, etc.).
 * @returns Promise that resolves to Response object.
 * @throws {HTTPStatusError} When response status is not OK (4xx, 5xx) and native mode is disabled.
 * @throws {TypeError} When network error occurs (e.g., DNS resolution failure, connection refused).
 * @throws {DOMException} When request is aborted via timeout or AbortSignal.
 *
 * @example
 * ```ts
 * import { fetchy } from "@scirexs/fetchy";
 *
 * // Simple GET request
 * const response = await fetchy("https://api.example.com/data");
 * const data = await response.json();
 *
 * // Using convenience methods
 * const user = await fetchy("https://api.example.com/user").json<User>();
 *
 * // POST request with JSON body and authentication
 * const result = await fetchy("https://api.example.com/create", {
 *   method: MPOST,
 *   body: { name: "John", age: 30 },
 *   bearer: "your-token-here"
 * }).json();
 *
 * // With retry, timeout, and error handling
 * try {
 *   const data = await fetchy("https://api.example.com/data", {
 *     timeout: 10,
 *     retry: { maxAttempts: 5, interval: 2, maxInterval: 30 }
 *   }).json();
 * } catch (error) {
 *   if (error instanceof HTTPStatusError) {
 *     console.error(`HTTP ${error.status}:`, error.message);
 *   }
 * }
 *
 * // Native error mode - does not throw HTTPStatusError
 * const response = await fetchy("https://api.example.com/data", {
 *   native: true
 * });
 * ```
 */
function fetchy(url?: string | URL | Request | null, options?: FetchyOptions): FetchyResponse {
  return _main(url, options);
}

/** Main procedure for fetchy and sfetchy. @internal */
function _main(url: InputArg | undefined, options: FetchyOptions | undefined, safe?: undefined): FetchyResponse;
function _main(url: InputArg | undefined, options: FetchyOptions | undefined, safe: true): FetchySafeResponse;
function _main(url?: InputArg, options?: FetchyOptions, safe: boolean = false): FetchyResponse | FetchySafeResponse {
  const req = _includeStream(_createRequest(url, options));
  const init = _getRequestInit(url, options);
  const opts = _getOptions(init, url, options);
  return _makeFetchyResponse(req, init, opts, safe);
}

/*=============== Helper Codes ==================*/
/** Creates new options object with specified HTTP method and temporal options. @internal */
function _buildOption(options?: FetchyOptions, temp?: FetchyOptions, method?: string): FetchyOptions {
  return { ...options, ...temp, method };
}
/** Type guard: checks if value is a string. @internal */
function _isString(v: unknown): v is string {
  return typeof v === "string";
}
/** Type guard: checks if value is a number. @internal */
function _isNumber(v: unknown): v is number {
  return typeof v === "number";
}
/** Type guard: checks if value is a boolean. @internal */
function _isBool(v: unknown): v is boolean {
  return typeof v === "boolean";
}
/** Type guard: checks if value is a ReadableStream. @internal */
function _isStream(v: unknown): v is ReadableStream {
  return v instanceof ReadableStream;
}
/** Type guard: checks if value is a Request. @internal */
function _isRequest(v: unknown): v is Request {
  return v instanceof Request;
}
/** Type guard: checks if value is a plain object (not array, null, or other object types). @internal */
function _isPlain(v: unknown): v is object {
  return Boolean(v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype);
}
/** Corrects a number to be non-negative, using default if invalid. @internal */
function _correctNumber(dflt: number, num?: number): number {
  return (num ?? -1) >= 0 ? num! : dflt;
}
/** Creates Request object from various input types. @internal */
function _createRequest(url?: InputArg, options?: FetchyOptions): Request {
  if (_isRequest(url)) return url;
  if (!url) url = options?.url ?? "";
  if (_isRequest(url)) return url;
  return new Request(URL.parse(url, options?.base) ?? "");
}
/** Creates new Request with ReadableStream body if present in options. @internal */
function _includeStream(req: Request, options?: FetchyOptions): Request {
  if (!_isStream(options?.body)) return req;
  const method = [MGET, MHEAD].includes(req.method) ? MPOST : req.method;
  return new Request(req, { method, body: options.body });
}
/** Converts FetchyOptions to standard RequestInit format. @internal */
function _getRequestInit(url?: InputArg, options?: FetchyOptions): RequestInit {
  const { method, body, timeout, retry, bearer, native, jitter, headers, signal, ...rest } = options ?? {};
  return {
    headers: _getHeaders(options, _isRequest(url) ? url.headers : null),
    method: method ? method.toUpperCase() : _isRequest(url) ? url.method : body == void 0 ? MGET : MPOST,
    ..._getBody(body),
    ...rest,
  };
}
/** Converts FetchyBody to standard BodyInit format. @internal */
function _getBody(body?: FetchyBody): Record<string, BodyInit> | null {
  return _isStream(body) ? null : { body: _isJSONObject(body) ? JSON.stringify(body) : body as BodyInit };
}
/** Checks if value should be treated as JSON for serialization. @internal */
function _isJSONObject(arg?: FetchyBody): boolean {
  return Boolean(_isNumber(arg) || _isBool(arg) || Array.isArray(arg) || _isPlain(arg));
}
/** Constructs request headers with automatic Content-Type and Authorization. @internal */
function _getHeaders(options?: FetchyOptions, reqHeaders?: Headers | null): Headers {
  const headers = new Headers(options?.headers);
  if (_isNoHeader(H_ACCEPT, headers, reqHeaders)) headers.set(H_ACCEPT, `${MIME_JSON}, text/plain`);
  if (_isNoHeader(H_CTYPE, headers, reqHeaders)) {
    const type = _getContentType(options?.body);
    if (type) headers.set(H_CTYPE, type);
  }
  if (options?.bearer) headers.set("Authorization", `Bearer ${options.bearer}`);
  return headers;
}
/** Checks if header is absent in both option headers and request headers. @internal */
function _isNoHeader(name: string, optionHeader: Headers, reqHeaders?: Headers | null): boolean {
  return !optionHeader.has(name) && !reqHeaders?.has(name);
}
/** Determines Content-Type header based on body type. @internal */
function _getContentType(body?: FetchyBody): string {
  if (_isJSONObject(body)) return MIME_JSON;
  return _handleByNative(body) ? "" : "application/octet-stream";
}
/** Checks if Content-Type should be handled by native fetch. @internal */
function _handleByNative(body?: FetchyBody): boolean {
  return body == void 0 || _isString(body) || body instanceof FormData || body instanceof URLSearchParams ||
    !!(body instanceof Blob && body.type);
}
/** Extracts retry-related options with defaults. @internal */
function _getRetryOption(init: RequestInit, options?: RetryOptions | false): InternalRetry {
  if (_isBool(options)) return { ..._DEFAULT, zmaxAttempts: 1 };
  return {
    zmaxAttempts: Math.max(_correctNumber(_DEFAULT.zmaxAttempts, options?.maxAttempts), 1),
    zinterval: Math.max(_correctNumber(_DEFAULT.zinterval, options?.interval), 0.01),
    zmaxInterval: Math.max(_correctNumber(_DEFAULT.zmaxInterval, options?.maxInterval), 1),
    zonTimeout: options?.retryOnTimeout ?? _DEFAULT.zonTimeout,
    znoIdempotent: options?.idempotentOnly ? _NO_IDEM.includes(init.method ?? "") : false,
    zstatusCodes: options?.statusCodes ?? _DEFAULT.zstatusCodes,
    zrespects: options?.respectHeaders ?? _DEFAULT.zrespects,
  };
}
/** Converts FetchyOptions to internal Options format with validated values. @internal */
function _getOptions(init: RequestInit, url?: InputArg, options?: FetchyOptions): Options {
  return {
    ..._getRetryOption(init, options?.retry),
    ztimeout: _correctNumber(_DEFAULT.ztimeout, options?.timeout),
    zjitter: _correctNumber(_DEFAULT.zjitter, options?.jitter),
    znative: options?.native ?? _DEFAULT.znative,
    zsignal: _mergeSignals(_isRequest(url) ? url.signal : null, options?.signal),
  };
}
/** Merges multiple AbortSignals into one. @internal */
function _mergeSignals(s1?: AbortSignal | null, s2?: AbortSignal | null): AbortSignal | undefined {
  if (!s1 && !s2) return;
  return s1 && s2 ? AbortSignal.any([s1, s2]) : s1 ? s1 : s2 ?? undefined;
}
/** Creates timeout signal and merges with existing signal. @internal */
function _withTimeout(opts: Options): AbortSignal | undefined {
  if (opts.ztimeout <= 0) return opts.zsignal;
  return _mergeSignals(AbortSignal.timeout(opts.ztimeout * 1000), opts.zsignal);
}
/** Waits for specified seconds with optional randomization. @internal */
async function _wait(sec: number, random: boolean = false) {
  if (sec <= 0) return;
  const delay = Math.trunc((random ? Math.random() : 1) * sec * 1000);
  await new Promise((resolve) => setTimeout(resolve, delay));
}
/** Checks if HTTP status code indicates an error. @internal */
function _isHttpError(stat: number): boolean {
  return stat >= 400 || stat < 100;
}
/** Determines whether to retry based on conditions and waits before next attempt. @internal */
async function _shouldRetry(count: number, opts: Options, r: Response | unknown): Promise<boolean> {
  if (opts.znoIdempotent || count >= opts.zmaxAttempts - 1) return false;
  if (r instanceof Response) {
    if (opts.znative || !opts.zstatusCodes.includes(r.status)) return false;

    const interval = _getNextInterval(count, opts, r.headers);
    if (interval > opts.zmaxInterval) return false;

    await _wait(interval);
    return true;
  } else {
    return r instanceof Error && r.name == "TimeoutError" && opts.zonTimeout;
  }
}
/** Calculates next retry interval using exponential backoff or response headers. @internal */
function _getNextInterval(count: number, opts: Options, headers: Headers): number {
  return opts.zrespects.some((x) => headers.has(x))
    ? _findRetryHeader(opts, headers) ?? opts.zinterval
    : Math.min(opts.zinterval * 2 ** count, opts.zmaxInterval);
}
/** Finds and parses retry timing from response headers. @internal */
function _findRetryHeader(opts: Options, headers: Headers): number | undefined {
  for (const name of opts.zrespects) {
    const value = _parseRetryHeader(headers.get(name)?.trim());
    if (!Number.isNaN(value)) return Math.max(value, opts.zinterval);
  }
}
/** Parses retry header value to seconds. @internal */
function _parseRetryHeader(value?: string | null): number {
  if (!value) return NaN;
  const sec1 = Number.parseInt(value, 10);
  if (!Number.isNaN(sec1)) return sec1;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 1000);
}
/** Fetch with retry and creates promise-like object. @internal */
function _makeFetchyResponse(req: Request, init: RequestInit, opts: Options, safe: boolean = false): FetchyResponse | FetchySafeResponse {
  const resp = _fetchWithRetry(req, init, opts, safe);
  return _assignToPromise(resp, safe);
}
/** Creates promise-like object with convenience parsing methods. @internal */
function _assignToPromise(resp: Promise<Response | null>, safe: boolean): FetchyResponse | FetchySafeResponse {
  return Object.assign(
    resp,
    Object.fromEntries([
      ...(
        safe
          // deno-lint-ignore no-explicit-any
          ? _METHODS.map((m) => [m, () => resp.then((x: any) => x[m]()).catch(() => null)])
          // deno-lint-ignore no-explicit-any
          : _METHODS.map((m) => [m, () => resp.then((x: any) => x[m]())])
      ),
    ]),
  );
}
/** Creates request cloning function with abort handling. @internal */
function _cloneRequestF(req: Request): (cancel?: boolean) => Promise<Request> {
  let next: Request | undefined;
  return async (cancel?: boolean) => {
    if (cancel) await next?.body?.cancel();

    const result = next ?? req;
    if (!cancel) next = next ? next.clone() : req.clone();
    return result;
  };
}
/** Executes fetch with retry logic and exponential backoff. @internal */
async function _fetchWithRetry(req: Request, init: RequestInit, opts: Options, safe: boolean): Promise<Response | null> {
  const creq = _cloneRequestF(req);
  for (let i = 0; i < opts.zmaxAttempts; i++) {
    try {
      const resp = await _fetchWithJitter(await creq(), init, opts);
      if (await _shouldRetry(i, opts, resp)) continue;
      if (_isHttpError(resp.status) && !opts.znative) throw new HTTPStatusError(resp);
      return resp;
    } catch (e) {
      if (await _shouldRetry(i, opts, e)) continue;
      if (safe) return null;
      throw e;
    } finally {
      await creq(true);
    }
  }
  throw new Error();
}
/** Executes fetch with initial jitter delay. @internal */
async function _fetchWithJitter(req: Request, init: RequestInit, opts: Options): Promise<Response> {
  await _wait(opts.zjitter, true);
  return await fetch(req, { ...init, signal: _withTimeout(opts) });
}
