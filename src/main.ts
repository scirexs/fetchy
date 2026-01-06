export {
  _correctNumber,
  _fetchWithJitter,
  _fetchWithRetry,
  _fetchWithTimeout,
  _getBody,
  _getContentType,
  _getHeaders,
  _getNextInterval,
  _getOptions,
  _getRequestInit,
  _getRetryOption,
  _handleRedirectResponse,
  _isBool,
  _isJSONObject,
  _isNumber,
  _isPlainObject,
  _isString,
  _parseRetryAfter,
  _shouldNotRetry,
  _shouldRedirect,
  _throwError,
  _wait,
  DEFAULT,
  fetchy,
  fetchyb,
  HTTPStatusError,
  RedirectError,
};

import type { ErrorOptions, FetchyBody, FetchyOptions, RetryOptions } from "./types.ts";

/*=============== Constant Values ===============*/
/**
 * Default configuration values for fetchy.
 * These values are used when corresponding options are not specified.
 */
const DEFAULT: Options = {
  timeout: 15,
  jitter: 0,
  interval: 3,
  maxInterval: 30,
  max: 3,
  byHeader: true,
  onError: true,
  onErrorStatus: false,
  userRedirect: "follow",
} as const;

/*=============== Internal Types ================*/
/**
 * Valid input types for fetch requests.
 * @internal
 */
type Input = string | URL | Request;
/**
 * Response body parsing type specification.
 * @internal
 */
type ParseType = "text" | "json" | "bytes" | "auto";
/**
 * Internal normalized options used throughout the fetch process.
 * @internal
 */
interface Options {
  timeout: number;
  jitter: number;
  interval: number;
  maxInterval: number;
  max: number;
  byHeader: boolean;
  onError?: boolean;
  onErrorStatus: boolean;
  abort?: AbortController;
  userRedirect: "follow" | "error" | "manual";
}

/*=============== Main Code =====================*/
/**
 * Error thrown when HTTP response has a non-OK status code (4xx, 5xx).
 * Only thrown when throwError.onErrorStatus is set to true.
 *
 * @example
 * ```ts
 * try {
 *   await fetchy("https://api.example.com/data", {
 *     throwError: { onErrorStatus: true }
 *   });
 * } catch (error) {
 *   if (error instanceof HTTPStatusError) {
 *     console.error("HTTP error:", error.message); // e.g., "404 Not Found"
 *   }
 * }
 * ```
 */
class HTTPStatusError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "HTTPStatusError";
  }
}
/**
 * Error thrown when a redirect response is received and redirect option is set to "error".
 *
 * @example
 * ```ts
 * try {
 *   await fetchy("https://example.com/redirect", {
 *     redirect: "error"
 *   });
 * } catch (error) {
 *   if (error instanceof RedirectError) {
 *     console.error("Unexpected redirect:", error.message);
 *   }
 * }
 * ```
 */
class RedirectError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "RedirectError";
  }
}
/**
 * Performs an HTTP request and automatically parses the response body based on Content-Type or specified type.
 * Returns null if the request fails or response is not OK, unless throwError is configured.
 *
 * @param url - The URL to fetch. Can be a string, URL object, or Request object.
 * @param type - The expected response type. "auto" detects type from Content-Type header.
 * @param options - Configuration options for the request.
 * @returns Parsed response body or null on failure.
 *
 * @example
 * ```ts
 * import { fetchyb } from "@scirexs/fetchy";
 *
 * // Automatic type detection
 * const data = await fetchyb("https://api.example.com/user");
 *
 * // Explicit JSON parsing with type assertion
 * interface User { id: number; name: string; }
 * const user = await fetchyb<User>("https://api.example.com/user", "json");
 *
 * // Text response
 * const text = await fetchyb("https://example.com/page", "text");
 *
 * // Binary data
 * const bytes = await fetchyb("https://example.com/image.png", "bytes");
 * ```
 */
async function fetchyb(url: Input, type: "text", options?: FetchyOptions): Promise<string | null>;
async function fetchyb<T>(url: Input, type: "json", options?: FetchyOptions): Promise<T | null>;
async function fetchyb(url: Input, type: "bytes", options?: FetchyOptions): Promise<Uint8Array | null>;
async function fetchyb<T>(url: Input, type?: "auto", options?: FetchyOptions): Promise<T | string | Uint8Array | null>;
async function fetchyb<T>(url: Input, type: ParseType = "auto", options?: FetchyOptions): Promise<T | string | Uint8Array | null> {
  const resp = await fetchy(url, options);
  if (!resp || !resp.ok) return null;
  const btype = resp.headers.get("Content-Type") ?? "";
  try {
    if (type === "text" || (type === "auto" && btype.startsWith("text/"))) return await resp.text();
    if (type === "json" || (type === "auto" && btype === "application/json")) return await resp.json() as T;
    return await resp.bytes();
  } catch (e) {
    if (_throwError("onError", options?.throwError)) throw e;
    return null;
  }
}
/**
 * Performs an HTTP request with enhanced features like timeout, retry, and automatic header management.
 * Returns the raw Response object or null on failure, unless throwError is configured.
 *
 * @param url - The URL to fetch. Can be a string, URL object, or Request object.
 * @param options - Configuration options for the request.
 * @returns Response object or null on failure.
 *
 * @example
 * ```ts
 * import { fetchy } from "@scirexs/fetchy";
 *
 * // Simple GET request
 * const response = await fetchy("https://api.example.com/data");
 * if (response?.ok) {
 *   const data = await response.json();
 * }
 *
 * // POST request with JSON body
 * const response = await fetchy("https://api.example.com/create", {
 *   body: { name: "John", age: 30 },
 *   bearerToken: "your-token"
 * });
 *
 * // With retry and timeout
 * const response = await fetchy("https://api.example.com/data", {
 *   timeout: 10,
 *   retry: { max: 5, interval: 2 },
 *   throwError: { onErrorStatus: true }
 * });
 * ```
 */
async function fetchy(url: Input, options?: FetchyOptions): Promise<Response | null> {
  try {
    const opts = _getOptions(options);
    const init = _getRequestInit(options, opts.abort);
    const resp = await _fetchWithRetry(url, init, opts);
    if (!resp.ok && opts.onErrorStatus) throw new HTTPStatusError(`${resp.status} ${resp.statusText}`.trim());
    return resp;
  } catch (e) {
    if (_throwError("onError", options?.throwError)) throw e;
    return null;
  }
}

/*=============== Helper Code ===================*/
/**
 * Checks if a value is a string.
 * @internal
 * @param v - Value to check.
 * @returns True if the value is a string.
 */
function _isString(v: unknown): v is string {
  return typeof v === "string";
}
/**
 * Checks if a value is a number.
 * @internal
 * @param v - Value to check.
 * @returns True if the value is a number.
 */
function _isNumber(v: unknown): v is number {
  return typeof v === "number";
}
/**
 * Checks if a value is a boolean.
 * @internal
 * @param v - Value to check.
 * @returns True if the value is a boolean.
 */
function _isBool(v: unknown): v is boolean {
  return typeof v === "boolean";
}
/**
 * Checks if a value is a plain object (not array, null, or other object types).
 * @internal
 * @param v - Value to check.
 * @returns True if the value is a plain object.
 */
function _isPlainObject(v: unknown): v is object {
  return Boolean(
    v &&
      typeof v === "object" &&
      Object.prototype.toString.call(v).slice(8, -1) === "Object" &&
      v.constructor === Object,
  );
}
/**
 * Determines whether to throw an error based on configuration.
 * @internal
 * @param prop - The error option property to check.
 * @param options - Error configuration or boolean flag.
 * @returns True if error should be thrown.
 */
function _throwError(prop: keyof ErrorOptions, options?: ErrorOptions | boolean): boolean {
  return Boolean(
    (options === void 0 && DEFAULT[prop]) ||
      (typeof options === "boolean" && options) ||
      (typeof options === "object" && (options[prop] ?? DEFAULT[prop])),
  );
}
/**
 * Corrects a number to be non-negative, using default if invalid.
 * @internal
 * @param dflt - Default value to use if number is invalid.
 * @param num - Number to validate.
 * @param integer - Whether to truncate to integer.
 * @returns Corrected number.
 */
function _correctNumber(dflt: number, num?: number, integer: boolean = false): number {
  if (num === void 0 || num < 0) return dflt;
  return integer ? Math.trunc(num) : num;
}
/**
 * Gets retry option value from configuration with fallback to default.
 * @internal
 * @param prop - The retry option property to get.
 * @param off - Fallback value when retry is disabled.
 * @param options - Retry configuration.
 * @returns The retry option value.
 */
function _getRetryOption(prop: keyof RetryOptions, off: number, options?: RetryOptions | false): number;
function _getRetryOption(prop: keyof RetryOptions, off: boolean, options?: RetryOptions | false): boolean;
function _getRetryOption(prop: keyof RetryOptions, off: number | boolean, options?: RetryOptions | false): number | boolean {
  if (_isBool(options)) return off;
  if (options === void 0 || options[prop] === void 0) return DEFAULT[prop];
  if (_isNumber(options[prop])) return _correctNumber(DEFAULT[prop] as number, options[prop], prop === "max");
  return options[prop];
}
/**
 * Converts FetchyOptions to internal Options format with validated values.
 * @internal
 * @param options - User-provided options.
 * @returns Normalized internal options.
 */
function _getOptions(options?: FetchyOptions): Options {
  const timeout = _correctNumber(DEFAULT.timeout, options?.timeout);
  return {
    timeout,
    jitter: _correctNumber(DEFAULT.jitter, options?.jitter),
    interval: _getRetryOption("interval", 0, options?.retry),
    maxInterval: _getRetryOption("maxInterval", 0, options?.retry),
    max: _getRetryOption("max", 0, options?.retry),
    byHeader: _getRetryOption("byHeader", false, options?.retry),
    onErrorStatus: _throwError("onErrorStatus", options?.throwError),
    abort: options?.abort ?? (timeout ? new AbortController() : undefined),
    userRedirect: options?.redirect ?? DEFAULT.userRedirect,
  };
}
/**
 * Converts FetchyOptions to standard RequestInit format.
 * @internal
 * @param options - User-provided options.
 * @param optsAbort - AbortController for timeout handling.
 * @returns Standard RequestInit object.
 */
function _getRequestInit(options?: FetchyOptions, optsAbort?: AbortController): RequestInit {
  const { body, timeout, retry, bearerToken, throwError, jitter, abort, redirect, ...rest } = options ?? {};
  return {
    method: body === void 0 ? "GET" : "POST",
    headers: _getHeaders(options),
    ...(redirect && { redirect: redirect === "error" ? "manual" : redirect }),
    ...(optsAbort && { signal: optsAbort.signal }),
    ...(body && { body: _getBody(body) }),
    ...rest,
  };
}
/**
 * Converts FetchyBody to standard BodyInit format.
 * @internal
 * @param body - Body content to convert.
 * @returns Standard BodyInit or undefined.
 */
function _getBody(body: FetchyBody): BodyInit | undefined {
  return _isJSONObject(body) ? JSON.stringify(body) : body as BodyInit;
}
/**
 * Checks if a value should be treated as JSON object for serialization.
 * @internal
 * @param arg - Value to check.
 * @returns True if value should be JSON stringified.
 */
function _isJSONObject(arg?: FetchyBody): boolean {
  return Boolean(arg === null || _isNumber(arg) || _isBool(arg) || Array.isArray(arg) || _isPlainObject(arg));
}
/**
 * Constructs request headers with automatic Content-Type and Authorization.
 * @internal
 * @param options - User-provided options.
 * @returns Headers object.
 */
function _getHeaders(options?: FetchyOptions): HeadersInit {
  const type = _getContentType(options?.body);
  return {
    "Accept": "application/json, text/plain",
    ...(type && { "Content-Type": type }),
    ...(options?.bearerToken && { "Authorization": `Bearer ${options.bearerToken}` }),
    ...options?.headers,
  };
}
/**
 * Determines Content-Type header based on body type.
 * @internal
 * @param body - Request body content.
 * @returns Content-Type string or undefined.
 */
function _getContentType(body?: FetchyBody): string | undefined {
  if (body === void 0 || _isString(body) || body instanceof FormData || body instanceof URLSearchParams) return;
  if (body instanceof Blob && body.type) return;
  if (_isJSONObject(body)) return "application/json";
  return "application/octet-stream";
}

/**
 * Waits for specified seconds with optional randomization.
 * @internal
 * @param sec - Seconds to wait.
 * @param random - Whether to randomize the delay.
 */
async function _wait(sec: number, random: boolean = true) {
  if (sec <= 0) return;
  const delay = Math.trunc((random ? Math.random() : 1) * sec * 1000);
  await new Promise((resolve) => setTimeout(resolve, delay));
}
/**
 * Checks if response is a redirect (3xx status).
 * @internal
 * @param resp - Response to check.
 * @returns True if response is a redirect.
 */
function _shouldRedirect(resp: Response): boolean {
  return resp.status < 400 && resp.status >= 300;
}
/**
 * Determines if retry should stop based on conditions and waits if continuing.
 * @internal
 * @param count - Current retry attempt number.
 * @param opts - Internal options.
 * @param resp - Response from previous attempt.
 * @returns True if retry should stop.
 */
async function _shouldNotRetry(count: number, opts: Options, resp?: Response): Promise<boolean> {
  if (count >= opts.max || resp?.ok) return true;
  if (resp && _shouldRedirect(resp)) {
    if (opts.userRedirect === "manual") return true;
    if (opts.userRedirect === "error") {
      opts.max = 0;
      throw new RedirectError(`Received redirect response: ${resp.status}`);
    }
  }
  const interval = _getNextInterval(count, opts, resp);
  if (interval > opts.maxInterval) return true;

  await _wait(interval, false);
  return false;
}
/**
 * Calculates next retry interval using exponential backoff or Retry-After header.
 * @internal
 * @param count - Current retry attempt number.
 * @param opts - Internal options.
 * @param resp - Response from previous attempt.
 * @returns Next retry interval in seconds.
 */
function _getNextInterval(count: number, opts: Options, resp?: Response): number {
  return opts.byHeader && resp
    ? Math.max(_parseRetryAfter(resp.headers.get("Retry-After")?.trim() ?? ""), opts.interval)
    : Math.min(Math.pow(Math.max(1, opts.interval), count), opts.maxInterval);
}
/**
 * Parses Retry-After header value to seconds.
 * @internal
 * @param value - Retry-After header value (seconds or HTTP date).
 * @returns Retry delay in seconds, or Infinity if invalid.
 */
function _parseRetryAfter(value: string): number {
  if (!value) return Infinity;
  const sec1 = Number.parseInt(value, 10);
  if (!Number.isNaN(sec1)) return sec1;
  const sec2 = Math.ceil((new Date(value).getTime() - Date.now()) / 1000);
  if (!Number.isNaN(sec2)) return sec2;
  return Infinity;
}
/**
 * Updates URL and method for redirect responses.
 * @internal
 * @param url - Original request URL.
 * @param init - Request initialization object.
 * @param resp - Redirect response.
 * @returns Updated URL for next request.
 */
function _handleRedirectResponse(url: Input, init: RequestInit, resp: Response): Input {
  if (!resp.redirected) return url;
  if (resp.status === 303) init.method = "GET";
  return url instanceof Request ? new Request(resp.url, url) : resp.url;
}
/**
 * Executes fetch with retry logic and exponential backoff.
 * @internal
 * @param url - Request URL.
 * @param init - Request initialization object.
 * @param opts - Internal options.
 * @returns Response from successful request.
 */
async function _fetchWithRetry(url: Input, init: RequestInit, opts: Options): Promise<Response> {
  if (!opts.max) return await _fetchWithTimeout(url, init, opts);
  for (let i = 1; i <= opts.max; i++) {
    try {
      const resp = await (opts.jitter ? _fetchWithJitter(url, init, opts) : _fetchWithTimeout(url, init, opts));
      if (await _shouldNotRetry(i, opts, resp)) return resp;
      url = _handleRedirectResponse(url, init, resp);
      continue;
    } catch (e) {
      if (await _shouldNotRetry(i, opts)) throw e;
      continue;
    }
  }
  throw new Error("never reach");
}
/**
 * Executes fetch with initial jitter delay.
 * @internal
 * @param url - Request URL.
 * @param init - Request initialization object.
 * @param opts - Internal options.
 * @returns Response from request.
 */
async function _fetchWithJitter(url: Input, init: RequestInit, opts: Options): Promise<Response> {
  await _wait(opts.jitter);
  return await _fetchWithTimeout(url, init, opts);
}
/**
 * Executes fetch with timeout handling.
 * @internal
 * @param url - Request URL.
 * @param init - Request initialization object.
 * @param opts - Internal options.
 * @returns Response from request.
 */
async function _fetchWithTimeout(url: Input, init: RequestInit, opts: Options): Promise<Response> {
  const req = url instanceof Request ? url.clone() : url;
  const id = opts.abort ? setTimeout(() => opts.abort?.abort("timeout"), opts.timeout * 1000) : 0;
  try {
    return await fetch(req, init);
  } catch (e) {
    throw e;
  } finally {
    clearTimeout(id);
  }
}
