export {
  _buildOption,
  _cloneRequestF,
  _correctNumber,
  _createRequest,
  _DEFAULT,
  _fetchWithJitter,
  _fetchWithRetry,
  _findRetryHeader,
  _genMethods,
  _getBody,
  _getContentType,
  _getHeaders,
  _getNextInterval,
  _getOptions,
  _getRequestInit,
  _getRetryOption,
  _includeStream,
  _isJSONObject,
  _isPlain,
  _isRequest,
  _isString,
  _main,
  _makeFetchyResponse,
  _mergeHeaders,
  _mergeSignals,
  _parseRetryHeader,
  _shouldRetry,
  _wait,
  _waitInterval,
  _withTimeout,
  fetchy,
  fy,
  HTTPStatusError,
  setFetchy,
  sfetchy,
};

import type { Fetchy, FetchyBody, FetchyOptions, FetchyResponse, FetchySafeResponse, RetryOptions } from "./types.ts";

/*=============== Constant Values ===============*/
/** Default configuration values for fetchy. */
const _DEFAULT: Omit<Options, "signal"> = {
  timeout: 15,
  jitter: 0,
  interval: 3,
  maxInterval: 30,
  maxAttempts: 3,
  onTimeout: true,
  noIdempotent: false,
  statusCodes: Object.freeze([500, 502, 503, 504, 408, 429]),
  respects: Object.freeze(["retry-after", "ratelimit-reset", "x-ratelimit-reset"]),
  native: false,
} as const;
/** HTTP methods that do not have idempotency. */
const _NO_IDEM: readonly string[] = ["POST", "PATCH", "CONNECT"];
/** Additional methods for Promise-like interface. */
const _METHODS = ["text", "json", "bytes", "blob", "arrayBuffer", "formData"] as const;
/** methods for Fetchy. */
const _FETCHY = ["fetch", "get", "head", "post", "put", "patch", "delete"] as const;

/*=============== Internal Types ================*/
/** Internal normalized options used throughout the fetch process. */
interface Options {
  timeout: number;
  jitter: number;
  interval: number;
  maxInterval: number;
  maxAttempts: number;
  onTimeout: boolean;
  noIdempotent: boolean;
  statusCodes: readonly number[];
  respects: readonly string[];
  native: boolean;
  signal: AbortSignal;
  body?: FetchyBody;
}
/** URL argument type for fetchy functions. */
type InputArg = string | URL | Request | null;
/** Internal retry-related options extracted from RetryOptions. */
type InternalRetry = Pick<
  Options,
  "interval" | "maxInterval" | "maxAttempts" | "onTimeout" | "noIdempotent" | "statusCodes" | "respects"
>;

/*=============== Main Codes ====================*/
let _baseOption: FetchyOptions = {};
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
  constructor(res: Response) {
    super(`${res.status} ${res.url}`);
    this.name = "HTTPStatusError";
    this.status = res.status;
    this.response = res;
  }
}

/**
 * A fluent HTTP client that provides methods for making HTTP requests.
 * Supports features like timeout, retry with exponential backoff, automatic header management, and response parsing.
 *
 * @param options - Configuration options to apply to all requests made with this instance.
 * @returns An object that has Fetchy interface.
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
 *
 * // Safe mode - returns null on error instead of throwing
 * const result = await client.sfetch("https://api.example.com/data").json<Data>();
 * if (result !== null) {
 *   // Handle successful response
 * }
 * ```
 */
function fy(options?: FetchyOptions): Fetchy {
  const result = Object.assign({}, options);
  _genMethods(result);
  _genMethods(result, true);
  return result as Fetchy;
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
function sfetchy(url?: string | URL | Request | null, options?: FetchyOptions): FetchySafeResponse {
  return _makeFetchyResponse(_main(url, options).catch(() => null), true);
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
 *   method: "POST",
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
  return _makeFetchyResponse(_main(url, options));
}

/**
 * Sets global default options for all fetchy instances.
 * Calling this function replaces previously set global options entirely (no merge with prior calls).
 * The stored options are then merged with per-request options at call time, with per-request options taking precedence.
 *
 * @param options - Default configuration options to apply globally.
 *
 * @example
 * ```ts
 * import { setFetchy, fetchy } from "@scirexs/fetchy";
 *
 * // Set global defaults
 * setFetchy({
 *   timeout: 30,
 *   retry: { maxAttempts: 5 },
 *   bearer: "global-token"
 * });
 *
 * // All subsequent requests use these defaults
 * await fetchy("https://api.example.com/data");
 * ```
 */
function setFetchy(options: FetchyOptions) {
  _baseOption = { ...options };
}

/** Main procedure for fetchy and sfetchy. @internal */
async function _main(url?: InputArg, options?: FetchyOptions): Promise<Response> {
  options = _buildOption(_baseOption, options);
  const req = _createRequest(options, url);
  const init = _getRequestInit(req, url, options);
  return await _fetchWithRetry(req, init, _getOptions(req, init, options));
}

/*=============== Helper Codes ==================*/
/** Creates new options object with specified HTTP method and temporal options. @internal */
function _buildOption(options?: FetchyOptions, req?: FetchyOptions, method?: string): FetchyOptions {
  const result = { ...options, ...req, ...(method && { method }) };
  if (_isPlain(options?.retry) && _isPlain(req?.retry)) result.retry = { ...options.retry, ...req.retry };
  const headers = options?.headers ? new Headers(options.headers) : undefined;
  if (headers && req?.headers) _mergeHeaders(headers, new Headers(req.headers));
  result.headers = headers ?? new Headers(req?.headers);
  return result;
}
/** Merges multiple headers into one. @internal */
function _mergeHeaders(headers: Headers, init: Headers): Headers {
  init.forEach((v, k) => headers.set(k, v));
  return headers;
}
/** Creates Request object from various input types. @internal */
function _createRequest(options: FetchyOptions, url?: InputArg): Request {
  const v = url || (options?.url ?? "");
  if (_isRequest(v)) return new Request(v);
  return new Request(URL.parse(v, options?.base) ?? v);
}
/** Type guard: checks if value is a string. @internal */
function _isString(v: unknown): v is string {
  return typeof v === "string";
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
  return (num ?? -1) >= 0 && Number.isFinite(num) ? num! : dflt;
}
/** Converts FetchyOptions to standard RequestInit format. @internal */
function _getRequestInit(req: Request, url?: InputArg, options?: FetchyOptions): RequestInit {
  const { method, body, timeout, retry, bearer, native, jitter, headers, signal, ...rest } = options ?? {};
  return {
    headers: _getHeaders(_mergeHeaders(req.headers, headers as Headers), options),
    method: method ?? (_isRequest(url || options?.url) ? req.method : body === undefined ? "GET" : "POST"),
    ..._getBody(body),
    ...rest,
  };
}
/** Converts FetchyBody to standard BodyInit format. @internal */
function _getBody(body?: FetchyBody): Record<string, BodyInit> | null {
  return body instanceof ReadableStream ? null : { body: _isJSONObject(body) ? JSON.stringify(body) : body as BodyInit };
}
/** Checks if value should be treated as JSON for serialization. @internal */
function _isJSONObject(v?: FetchyBody): boolean {
  return Boolean(v === null || typeof v === "number" || typeof v === "boolean" || Array.isArray(v) || _isPlain(v));
}
/** Constructs request headers with automatic Content-Type and Authorization. @internal */
function _getHeaders(headers: Headers, options?: FetchyOptions): Headers {
  if (!headers.has("Accept")) headers.set("Accept", "application/json, text/plain");
  if (!headers.has("Content-Type")) {
    const type = _getContentType(options?.body);
    if (type) headers.set("Content-Type", type);
  }
  if (options?.bearer) headers.set("Authorization", `Bearer ${options.bearer}`);
  return headers;
}
/** Determines Content-Type header based on body type. @internal */
function _getContentType(body?: FetchyBody): string {
  if (_isJSONObject(body)) return "application/json";
  return body === undefined || _isString(body) || body instanceof FormData || body instanceof URLSearchParams ||
      (body instanceof Blob && !!body.type)
    ? ""
    : "application/octet-stream";
}
/** Extracts retry-related options with defaults. @internal */
function _getRetryOption(init: RequestInit, options?: RetryOptions | false): InternalRetry {
  if (options === false) return { ..._DEFAULT, maxAttempts: 1 };
  return {
    maxAttempts: Math.max(_correctNumber(_DEFAULT.maxAttempts, options?.maxAttempts), 1),
    interval: Math.max(_correctNumber(_DEFAULT.interval, options?.interval), 0.01),
    maxInterval: Math.max(_correctNumber(_DEFAULT.maxInterval, options?.maxInterval), 1),
    onTimeout: options?.retryOnTimeout ?? _DEFAULT.onTimeout,
    noIdempotent: options?.idempotentOnly ? _NO_IDEM.includes((init.method ?? "").toUpperCase()) : false,
    statusCodes: options?.statusCodes ?? _DEFAULT.statusCodes,
    respects: options?.respectHeaders ?? _DEFAULT.respects,
  };
}
/** Converts FetchyOptions to internal Options format with validated values. @internal */
function _getOptions(req: Request, init: RequestInit, options?: FetchyOptions): Options {
  return {
    ..._getRetryOption(init, options?.retry),
    timeout: _correctNumber(_DEFAULT.timeout, options?.timeout),
    jitter: _correctNumber(_DEFAULT.jitter, options?.jitter),
    native: options?.native ?? _DEFAULT.native,
    signal: _mergeSignals(req.signal, options?.signal),
    body: options?.body,
  };
}
/** Merges multiple AbortSignals into one. @internal */
function _mergeSignals(s1: AbortSignal, s2?: AbortSignal | null): AbortSignal {
  return s2 ? AbortSignal.any([s1, s2]) : s1;
}
/** Creates timeout signal and merges with existing signal. @internal */
function _withTimeout(options: Options): AbortSignal {
  if (options.timeout <= 0) return options.signal;
  return _mergeSignals(AbortSignal.timeout(options.timeout * 1000), options.signal);
}
/** Waits for specified seconds with optional randomization. @internal */
async function _wait(sec: number, random: boolean = false) {
  if (sec <= 0) return;
  const delay = Math.trunc((random ? Math.random() : 1) * sec * 1000);
  await new Promise((resolve) => setTimeout(resolve, delay));
}
/** Calculates next retry interval using exponential backoff or response headers. @internal */
function _getNextInterval(count: number, options: Options, headers?: Headers): number {
  return options.respects.some((x) => headers?.has(x))
    ? _findRetryHeader(options, headers!) ?? options.interval
    : Math.min(options.interval * 2 ** count, options.maxInterval);
}
/** Finds and parses retry timing from response headers. @internal */
function _findRetryHeader(options: Options, headers: Headers): number | undefined {
  for (const name of options.respects) {
    const value = Math.trunc(_parseRetryHeader(headers.get(name)?.trim()));
    if (!Number.isNaN(value)) return Math.max(value, options.interval);
  }
}
/** Parses retry header value to seconds. @internal */
function _parseRetryHeader(value?: string | null): number {
  if (!value) return NaN;
  const sec = Number(value);
  const now = Date.now() / 1000;
  if (!Number.isNaN(sec)) return sec > now ? sec - now : sec;
  return (new Date(value).getTime() / 1000) - now;
}
/** Waits for next retry interval unless over max interval. @internal */
async function _waitInterval(count: number, options: Options, headers?: Headers): Promise<boolean> {
  const interval = _getNextInterval(count, options, headers);
  if (interval > options.maxInterval) return false;
  await _wait(interval);
  return true;
}
/** Determines whether to retry based on conditions and waits before next attempt. @internal */
async function _shouldRetry(count: number, options: Options, r: Response | unknown): Promise<boolean> {
  if (options.noIdempotent || count >= options.maxAttempts - 1) return false;
  if (r instanceof Response) {
    if (options.native || !options.statusCodes.includes(r.status)) return false;

    return await _waitInterval(count, options, r.headers);
  } else {
    if (!(r instanceof Error && r.name == "TimeoutError" && options.onTimeout)) return false;
    return await _waitInterval(count, options);
  }
}
/** Creates new Request with ReadableStream body if present in options. @internal */
function _includeStream(req: Request, options: Options): Request {
  if (!(options.body instanceof ReadableStream)) return req;
  const method = ["GET", "HEAD"].includes(req.method) ? "POST" : req.method;
  return new Request(req, { method, body: options.body });
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
async function _fetchWithRetry(req: Request, init: RequestInit, options: Options): Promise<Response> {
  let creq;
  let cancel = false;
  for (let i = 0;; i++) {
    try {
      if (i === 0) creq = _cloneRequestF(_includeStream(req, options));
      const res = await _fetchWithJitter(await creq!(), init, options);
      if (await _shouldRetry(i, options, res)) continue;
      if ((res.status >= 400 || res.status < 100) && !options.native) throw new HTTPStatusError(res);
      cancel = true;
      return res;
    } catch (e) {
      if (await _shouldRetry(i, options, e)) continue;
      cancel = true;
      throw e;
    } finally {
      if (cancel) await creq?.(true);
    }
  }
}
/** Executes fetch with initial jitter delay. @internal */
async function _fetchWithJitter(req: Request, init: RequestInit, options: Options): Promise<Response> {
  await _wait(options.jitter, true);
  return await fetch(req, { ...init, signal: _withTimeout(options) });
}
/** Creates promise-like object with convenience parsing methods. @internal */
function _makeFetchyResponse(res: Promise<Response | null>, safe?: undefined): FetchyResponse;
function _makeFetchyResponse(res: Promise<Response | null>, safe: true): FetchySafeResponse;
function _makeFetchyResponse(res: Promise<Response | null>, safe?: boolean): FetchyResponse | FetchySafeResponse {
  return Object.assign(
    res,
    Object.fromEntries([
      ...(
        safe
          // deno-lint-ignore no-explicit-any
          ? _METHODS.map((m) => [m, () => res.then((x: any) => x[m]()).catch(() => null)])
          // deno-lint-ignore no-explicit-any
          : _METHODS.map((m) => [m, () => res.then((x: any) => x[m]())])
      ),
    ]),
  ) as FetchyResponse | FetchySafeResponse;
}
function _genMethods(obj: object, safe?: boolean) {
  for (const method of _FETCHY) {
    const name = (safe ? "s" : "") + method;
    Object.defineProperty(obj, name, {
      value: function (this: Fetchy, url?: InputArg, options?: FetchyOptions) {
        const result = method === "fetch" ? _buildOption(this, options) : _buildOption(this, options, method);
        return safe ? sfetchy(url, result) : fetchy(url, result);
      },
    });
  }
}
