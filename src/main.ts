export {
  _assign,
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
  _parseRetryHeader,
  _shouldRetry,
  _wait,
  _withTimeout,
  fetchy,
  fy,
  HTTPStatusError,
  setFetchy,
  sfetchy,
};

import type { Fetchy, FetchyBody, FetchyOptions, FetchyResponse, FetchySafeResponse, RetryOptions } from "./types.ts";

/*=============== Constant Values ===============*/
const MGET = "GET";
const MHEAD = "HEAD";
const MPOST = "POST";
const MPUT = "PUT";
const MPATCH = "PATCH";
const MDELETE = "DELETE";
const MFETCH = "fetch";
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
/** methods for Fetchy. */
const _FETCHY = [MFETCH, MGET, MHEAD, MPOST, MPUT, MPATCH, MDELETE];

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
  zurl?: string | URL | Request;
  zbase?: string | URL;
  zbody?: FetchyBody;
}
/** URL argument type for fetchy functions. */
type InputArg = string | URL | Request | null;
/** Internal retry-related options extracted from RetryOptions. */
type InternalRetry = Pick<
  Options,
  "zinterval" | "zmaxInterval" | "zmaxAttempts" | "zonTimeout" | "znoIdempotent" | "zstatusCodes" | "zrespects"
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
  constructor(resp: Response) {
    super(`${resp.status} ${resp.url}`);
    this.name = "HTTPStatusError";
    this.status = resp.status;
    this.response = resp;
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
  const result = _assign({}, options);
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
  return _main(url, options, true);
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

/**
 * Sets global default options for all fetchy instances.
 * These options will be merged with instance-specific options, with instance options taking precedence.
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
  _baseOption = options;
}

/** Main procedure for fetchy and sfetchy. @internal */
function _main(url: InputArg | undefined, options: FetchyOptions | undefined, safe?: undefined): FetchyResponse;
function _main(url: InputArg | undefined, options: FetchyOptions | undefined, safe: true): FetchySafeResponse;
function _main(url?: InputArg, options?: FetchyOptions, safe: boolean = false): FetchyResponse | FetchySafeResponse {
  options = _buildOption(_baseOption, options);
  const init = _getRequestInit(url, options);
  const opts = _getOptions(init, url, options);
  return _makeFetchyResponse(_fetchWithRetry(url, init, opts, safe), safe);
}

/*=============== Helper Codes ==================*/
/** Creates new options object with specified HTTP method and temporal options. @internal */
function _buildOption(options?: FetchyOptions, temp?: FetchyOptions, method?: string): FetchyOptions {
  return { ...options, ...temp, ...(method && { method }) };
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
// deno-lint-ignore ban-types
function _assign<T extends {}>(target: T, source: unknown) {
  return Object.assign(target, source);
}
/** Corrects a number to be non-negative, using default if invalid. @internal */
function _correctNumber(dflt: number, num?: number): number {
  return (num ?? -1) >= 0 ? num! : dflt;
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
    zurl: options?.url,
    zbase: options?.base,
    zbody: options?.body,
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
async function _shouldRetry(count: number, opts: Options, r: Response | unknown, fn?: unknown): Promise<boolean> {
  if (opts.znoIdempotent || count >= opts.zmaxAttempts - 1 || !fn) return false;
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
/** Creates new Request with ReadableStream body if present in options. @internal */
function _includeStream(req: Request, opts: Options): Request {
  if (!_isStream(opts.zbody)) return req;
  const method = [MGET, MHEAD].includes(req.method) ? MPOST : req.method;
  return new Request(req, { method, body: opts.zbody });
}
/** Creates Request object from various input types. @internal */
function _createRequest(opts: Options, url?: InputArg): Request {
  if (_isRequest(url)) return url;
  if (!url) url = opts?.zurl ?? "";
  if (_isRequest(url)) return url;
  return new Request(URL.parse(url, opts?.zbase) ?? "");
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
async function _fetchWithRetry(url: InputArg | undefined, init: RequestInit, opts: Options, safe: boolean): Promise<Response | null> {
  let creq;
  for (let i = 0; i < opts.zmaxAttempts; i++) {
    try {
      if (i === 0) creq = _cloneRequestF(_includeStream(_createRequest(opts, url), opts));
      const resp = await _fetchWithJitter(await creq!(), init, opts);
      if (await _shouldRetry(i, opts, resp, creq)) continue;
      if (_isHttpError(resp.status) && !opts.znative) throw new HTTPStatusError(resp);
      return resp;
    } catch (e) {
      if (await _shouldRetry(i, opts, e, creq)) continue;
      if (safe) return null;
      throw e;
    } finally {
      await creq?.(true);
    }
  }
  throw new Error();
}
/** Executes fetch with initial jitter delay. @internal */
async function _fetchWithJitter(req: Request, init: RequestInit, opts: Options): Promise<Response> {
  await _wait(opts.zjitter, true);
  return await fetch(req, { ...init, signal: _withTimeout(opts) });
}
/** Creates promise-like object with convenience parsing methods. @internal */
function _makeFetchyResponse(resp: Promise<Response | null>, safe: boolean): FetchyResponse | FetchySafeResponse {
  return _assign(
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
  ) as FetchyResponse | FetchySafeResponse;
}
function _genMethods(obj: object, safe?: boolean) {
  for (const m of _FETCHY) {
    const name = (safe ? "s" : "") + m.toLowerCase();
    // deno-lint-ignore no-explicit-any
    (obj as any)[name] = function (this: Fetchy, url?: InputArg, opts?: FetchyOptions) {
      const o = m === MFETCH ? _buildOption(this, opts) : _buildOption(this, opts, m);
      return safe ? sfetchy(url, o) : fetchy(url, o);
    };
  }
}
