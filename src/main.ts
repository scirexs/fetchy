export {
  _cloneInput,
  _combineSignal,
  _correctNumber,
  _DEFAULT,
  _fetchWithJitter,
  _fetchWithRetry,
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
  _main,
  _parseBody,
  _parseRetryAfter,
  _shouldCorrectRequest,
  _shouldNotRetry,
  _shouldRedirect,
  _wait,
  fetchy,
  fy,
  HTTPStatusError,
  NO_RETRY_ERROR,
  RedirectError,
  sfetchy,
};

import type { FetchyBody, FetchyOptions, RetryOptions } from "./types.ts";

/*=============== Constant Values ===============*/
/** Error message to simulate immediate failures without retry for writing tests. */
const NO_RETRY_ERROR = "$$_NO_RETRY_$$";
/** Default configuration values for fetchy. */
const _DEFAULT: Options = {
  timeout: 15,
  delay: 0,
  interval: 3,
  maxInterval: 30,
  maxAttempts: 3,
  retryAfter: true,
  native: false,
  redirect: "follow",
} as const;

/*=============== Internal Types ================*/
/** Valid input types for fetch requests. */
type Input = string | URL | Request;
type FetchyReturn<T> = Response | string | Uint8Array<ArrayBuffer> | Blob | ArrayBuffer | FormData | T;
/** Response body parsing method specification. */
type ParseMethod = "text" | "json" | "bytes" | "blob" | "buffer" | "form";
/** Internal normalized options used throughout the fetch process. */
interface Options {
  timeout: number;
  delay: number;
  interval: number;
  maxInterval: number;
  maxAttempts: number;
  retryAfter: boolean;
  native: boolean;
  redirect: "follow" | "error" | "manual";
}

/*=============== Main Codes ====================*/
/**
 * Error thrown when HTTP response has a non-OK status code (4xx, 5xx, ...).
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
 *     console.error("HTTP error:", error.message); // e.g., "403 Forbidden: {success:false}"
 *   }
 * }
 * ```
 */
class HTTPStatusError extends Error {
  static #MAX_BODY_LEN = 80;
  status: number;
  body: string;
  constructor(msg: string, status: number, body: string) {
    super(msg);
    this.name = "HTTPStatusError";
    this.status = status;
    this.body = body;
  }
  static async fromResponse(resp: Response): Promise<HTTPStatusError> {
    const body = await resp.text();
    const bodyMsg = body.length > this.#MAX_BODY_LEN
      ? `${body.slice(0, this.#MAX_BODY_LEN)}... (more ${body.length - this.#MAX_BODY_LEN} chars)`
      : body || "(no response body)";
    const msg = `${resp.status} ${resp.statusText}: ${bodyMsg}`;
    return new this(msg, resp.status, body);
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
  status: number;
  constructor(msg: string, status: number) {
    super(msg);
    this.name = "RedirectError";
    this.status = status;
  }
  static fromResponse(resp: Response): RedirectError {
    const msg = `${resp.status} ${resp.statusText}`.trim();
    return new this(msg, resp.status);
  }
}
/**
 * A fluent HTTP client class that provides both instance and static methods for making HTTP requests.
 * Supports features like timeout, retry with exponential backoff, automatic header management, and response parsing.
 *
 * This class can be used in two ways:
 * - Instance methods: Create an instance with default options, then call methods with optional URL override
 * - Static methods: Call methods directly with URL and options
 *
 * @example
 * ```ts
 * // Instance usage - reuse configuration
 * const client = new Fetchy({
 *   bearer: "token123",
 *   timeout: 10,
 *   retry: { max: 3 }
 * });
 * const user = await client.json<User>("https://api.example.com/user");
 * const posts = await client.json<Post[]>("https://api.example.com/posts");
 *
 * // Static usage - one-off requests
 * const data = await Fetchy.json("https://api.example.com/data");
 * const response = await Fetchy.fetch("https://api.example.com/endpoint", {
 *   body: { key: "value" },
 *   timeout: 5
 * });
 *
 * // Safe mode - returns null on error instead of throwing
 * const result = await Fetchy.sjson("https://api.example.com/data");
 * if (result !== null) {
 *   // Handle successful response
 * }
 * ```
 */
class fy implements FetchyOptions {
  /** Request URL. Used if call fetchy with null. */
  url?: string | URL;
  /** Request body content. Automatically serializes JSON objects. */
  body?: FetchyBody;
  /** Request timeout in seconds. Default is 15 seconds. */
  timeout?: number;
  /** Retry configuration. Set to false to disable retry functionality. */
  retry?: false | RetryOptions;
  /** Bearer token for Authorization header. Automatically adds "Bearer " prefix. */
  bearer?: string;
  /** Initial jitter delay in seconds before sending the request. Adds randomness to prevent thundering herd. */
  delay?: number;
  /** If receive response, does not throw error same with native fetch. */
  native?: true;
  constructor(options?: FetchyOptions) {
    Object.assign(this, options);
  }
  /** Call fetchy with instance options. */
  async fetch(url?: Input | null): Promise<Response> {
    return await fetchy(url ?? null, this);
  }
  /** Call fetchy with instance options and parsing as text. */
  async text(url?: Input | null): Promise<string> {
    return await fetchy(url ?? null, this, "text");
  }
  /** Call fetchy with instance options and parsing as json. */
  async json<T>(url?: Input | null): Promise<T> {
    return await fetchy(url ?? null, this, "json");
  }
  /** Call fetchy with instance options and parsing as Uint8Array. */
  async bytes(url?: Input | null): Promise<Uint8Array<ArrayBuffer>> {
    return await fetchy(url ?? null, this, "bytes");
  }
  /** Call fetchy with instance options and parsing as Blob. */
  async blob(url?: Input | null): Promise<Blob> {
    return await fetchy(url ?? null, this, "blob");
  }
  /** Call fetchy with instance options and parsing as ArrayBuffer. */
  async buffer(url?: Input | null): Promise<ArrayBuffer> {
    return await fetchy(url ?? null, this, "buffer");
  }
  /** Call fetchy with instance options and parsing as FormData. */
  async form(url?: Input | null): Promise<FormData> {
    return await fetchy(url ?? null, this, "form");
  }
  /** Call sfetchy with instance options. */
  async safe(url?: Input | null): Promise<Response | null> {
    return await sfetchy(url ?? null, this);
  }
  /** Call sfetchy with instance options and parsing as text. */
  async stext(url?: Input | null): Promise<string | null> {
    return await fetchy(url ?? null, this, "text");
  }
  /** Call sfetchy with instance options and parsing as json. */
  async sjson<T>(url?: Input | null): Promise<T | null> {
    return await fetchy(url ?? null, this, "json");
  }
  /** Call sfetchy with instance options and parsing as Uint8Array. */
  async sbytes(url?: Input | null): Promise<Uint8Array<ArrayBuffer> | null> {
    return await fetchy(url ?? null, this, "bytes");
  }
  /** Call sfetchy with instance options and parsing as Blob. */
  async sblob(url?: Input | null): Promise<Blob | null> {
    return await fetchy(url ?? null, this, "blob");
  }
  /** Call sfetchy with instance options and parsing as ArrayBuffer. */
  async sbuffer(url?: Input | null): Promise<ArrayBuffer | null> {
    return await fetchy(url ?? null, this, "buffer");
  }
  /** Call fetchy with instance options and parsing as FormData. */
  async sform(url?: Input | null): Promise<FormData | null> {
    return await sfetchy(url ?? null, this, "form");
  }

  /** Call fetchy. */
  static async fetch(url: Input | null, options?: FetchyOptions): Promise<Response> {
    return await fetchy(url, options);
  }
  /** Call fetchy with parsing as text. */
  static async text(url: Input | null, options?: FetchyOptions): Promise<string> {
    return await fetchy(url, options, "text");
  }
  /** Call fetchy with parsing as json. */
  static async json<T>(url: Input | null, options?: FetchyOptions): Promise<T> {
    return await fetchy(url, options, "json");
  }
  /** Call fetchy with parsing as Uint8Array. */
  static async bytes(url: Input | null, options?: FetchyOptions): Promise<Uint8Array<ArrayBuffer>> {
    return await fetchy(url, options, "bytes");
  }
  /** Call fetchy with parsing as Blob. */
  static async blob(url: Input | null, options?: FetchyOptions): Promise<Blob> {
    return await fetchy(url, options, "blob");
  }
  /** Call fetchy with parsing as ArrayBuffer. */
  static async buffer(url: Input | null, options?: FetchyOptions): Promise<ArrayBuffer> {
    return await fetchy(url, options, "buffer");
  }
  /** Call fetchy with parsing as FormData. */
  static async form(url: Input | null, options?: FetchyOptions): Promise<FormData> {
    return await fetchy(url, options, "form");
  }
  /** Call sfetchy. */
  static async safe(url: Input | null, options?: FetchyOptions): Promise<Response | null> {
    return await sfetchy(url, options);
  }
  /** Call sfetchy with parsing as text. */
  static async stext(url: Input | null, options?: FetchyOptions): Promise<string | null> {
    return await sfetchy(url, options, "text");
  }
  /** Call sfetchy with parsing as json. */
  static async sjson<T>(url: Input | null, options?: FetchyOptions): Promise<T | null> {
    return await sfetchy(url, options, "json");
  }
  /** Call sfetchy with parsing as Uint8Array. */
  static async sbytes(url: Input | null, options?: FetchyOptions): Promise<Uint8Array<ArrayBuffer> | null> {
    return await sfetchy(url, options, "bytes");
  }
  /** Call sfetchy with parsing as Blob. */
  static async sblob(url: Input | null, options?: FetchyOptions): Promise<Blob | null> {
    return await sfetchy(url, options, "blob");
  }
  /** Call sfetchy with parsing as ArrayBuffer. */
  static async sbuffer(url: Input | null, options?: FetchyOptions): Promise<ArrayBuffer | null> {
    return await sfetchy(url, options, "buffer");
  }
  /** Call fetchy with parsing as FormData. */
  static async sform(url: Input | null, options?: FetchyOptions): Promise<FormData | null> {
    return await sfetchy(url, options, "form");
  }
}
/**
 * Performs an HTTP request with safe error handling that returns null on failure.
 * Automatically parses the response body based on the specified parse method.
 * Unlike `fetchy`, this function never throws errors - it returns null for any failure.
 *
 * This is useful when you want to handle errors gracefully without try-catch blocks,
 * or when a failed request should be treated as "no data" rather than an error condition.
 *
 * @param url - The URL to fetch. Can be a string, URL object, Request object, or null (uses options.url).
 * @param options - Configuration options for the request (timeout, retry, headers, etc.).
 * @param parse - Optional response body parsing method. If omitted, returns Response object.
 *                Supported values: "json", "text", "bytes", "blob", "buffer".
 * @returns Parsed response body, Response object, or null if request fails or response is not OK.
 *
 * @example
 * ```ts
 * import { sfetchy } from "@scirexs/fetchy";
 *
 * // Returns null instead of throwing on error
 * const data = await sfetchy("https://api.example.com/user", {}, "json");
 * if (data === null) {
 *   console.log("Request failed, using default data");
 *   // Handle failure case
 * }
 *
 * // Explicit type assertion with JSON parsing
 * interface User { id: number; name: string; }
 * const user = await sfetchy<User>("https://api.example.com/user", {}, "json");
 *
 * // Text response - returns null on any error
 * const text = await sfetchy("https://example.com/page", {}, "text");
 *
 * // Binary data with safe error handling
 * const bytes = await sfetchy("https://example.com/image.png", {}, "bytes");
 * if (bytes !== null) {
 *   // Process binary data
 * }
 *
 * // Raw Response object (no parsing)
 * const response = await sfetchy("https://api.example.com/data");
 * if (response !== null && response.ok) {
 *   // Handle response
 * }
 * ```
 */
async function sfetchy(url: Input | null, options?: FetchyOptions, parse?: undefined): Promise<Response | null>;
async function sfetchy<T>(url: Input | null, options: FetchyOptions | undefined, parse: "json"): Promise<T | null>;
async function sfetchy(url: Input | null, options: FetchyOptions | undefined, parse: "text"): Promise<string | null>;
async function sfetchy(url: Input | null, options: FetchyOptions | undefined, parse: "bytes"): Promise<Uint8Array<ArrayBuffer> | null>;
async function sfetchy(url: Input | null, options: FetchyOptions | undefined, parse: "blob"): Promise<Blob | null>;
async function sfetchy(url: Input | null, options: FetchyOptions | undefined, parse: "buffer"): Promise<ArrayBuffer | null>;
async function sfetchy(url: Input | null, options: FetchyOptions | undefined, parse: "form"): Promise<FormData | null>;
async function sfetchy<T>(url: Input | null, options?: FetchyOptions, parse?: ParseMethod): Promise<FetchyReturn<T> | null> {
  try {
    return await _main<T>(url, options, parse);
  } catch (e) {
    return null;
  }
}

/**
 * Performs an HTTP request with enhanced features like timeout, retry, and automatic header management.
 * Throws errors on failure unless configured otherwise via the `native` option.
 * Automatically parses the response body based on the specified parse method.
 *
 * @param url - The URL to fetch. Can be a string, URL object, Request object, or null (uses options.url).
 * @param options - Configuration options for the request (timeout, retry, headers, body, etc.).
 * @param parse - Optional response body parsing method. If omitted, returns Response object.
 *                Supported values: "json", "text", "bytes", "blob", "buffer".
 * @returns Parsed response body or Response object.
 * @throws {HTTPStatusError} When response status is not OK (4xx, 5xx) - default behavior.
 * @throws {RedirectError} When redirect is encountered and redirect option is set to "error".
 * @throws {TypeError} When network error occurs (e.g., DNS resolution failure, connection refused).
 * @throws {DOMException} When request is aborted via timeout or AbortSignal.
 *
 * @example
 * ```ts
 * import { fetchy } from "@scirexs/fetchy";
 *
 * // Simple GET request returning Response object
 * const response = await fetchy("https://api.example.com/data");
 * if (response.ok) {
 *   const data = await response.json();
 * }
 *
 * // Direct JSON parsing with type assertion
 * interface User { id: number; name: string; }
 * const user = await fetchy<User>("https://api.example.com/user", {}, "json");
 *
 * // POST request with JSON body and authentication
 * const result = await fetchy("https://api.example.com/create", {
 *   body: { name: "John", age: 30 },
 *   bearer: "your-token-here"
 * }, "json");
 *
 * // With retry, timeout, and error handling
 * try {
 *   const data = await fetchy("https://api.example.com/data", {
 *     timeout: 10,
 *     retry: { max: 5, interval: 2, maxInterval: 30 }
 *   }, "json");
 * } catch (error) {
 *   if (error instanceof HTTPStatusError) {
 *     console.error(`HTTP ${error.status}: ${error.body}`);
 *   }
 * }
 *
 * // Native error mode - throws native fetch errors without HTTPStatusError
 * const response = await fetchy("https://api.example.com/data", {
 *   native: true
 * });
 * ```
 */
async function fetchy(url: Input | null, options?: FetchyOptions, parse?: undefined): Promise<Response>;
async function fetchy<T>(url: Input | null, options: FetchyOptions | undefined, parse: "json"): Promise<T>;
async function fetchy(url: Input | null, options: FetchyOptions | undefined, parse: "text"): Promise<string>;
async function fetchy(url: Input | null, options: FetchyOptions | undefined, parse: "bytes"): Promise<Uint8Array<ArrayBuffer>>;
async function fetchy(url: Input | null, options: FetchyOptions | undefined, parse: "blob"): Promise<Blob>;
async function fetchy(url: Input | null, options: FetchyOptions | undefined, parse: "buffer"): Promise<ArrayBuffer>;
async function fetchy(url: Input | null, options: FetchyOptions | undefined, parse: "form"): Promise<FormData>;
async function fetchy<T>(url: Input | null, options?: FetchyOptions, parse?: ParseMethod): Promise<FetchyReturn<T>> {
  try {
    return await _main<T>(url, options, parse);
  } catch (e) {
    throw e;
  }
}

/** Main procedure of fetchy and sfetchy. */
async function _main<T>(url: Input | null, options?: FetchyOptions, parse?: ParseMethod): Promise<FetchyReturn<T>> {
  if (!url) url = options?.url ?? "";
  const opts = _getOptions(options);
  const resp = await _fetchWithRetry(url, _getRequestInit(url, opts, options), opts);
  if (!resp.ok && !opts.native) throw await HTTPStatusError.fromResponse(resp);
  return parse ? _parseBody(resp, parse) : resp;
}

/*=============== Helper Codes ==================*/
/** Checks if a value is a string. */
function _isString(v: unknown): v is string {
  return typeof v == "string";
}
/** Checks if a value is a number. */
function _isNumber(v: unknown): v is number {
  return typeof v == "number";
}
/** Checks if a value is a boolean. */
function _isBool(v: unknown): v is boolean {
  return typeof v == "boolean";
}
/** Checks if a value is a plain object (not array, null, or other object types). */
function _isPlainObject(v: unknown): v is object {
  return Boolean(v && typeof v == "object" && Object.getPrototypeOf(v) === Object.prototype);
}
/** Corrects a number to be non-negative, using default if invalid. */
function _correctNumber(dflt: number, num?: number, integer: boolean = false): number {
  if (num === void 0 || num < 0) return dflt;
  return integer ? Math.trunc(num) : num;
}
/** Gets retry option value from configuration with fallback to default. */
function _getRetryOption(prop: keyof RetryOptions, off: number, options?: RetryOptions | false): number;
function _getRetryOption(prop: keyof RetryOptions, off: boolean, options?: RetryOptions | false): boolean;
function _getRetryOption(prop: keyof RetryOptions, off: number | boolean, options?: RetryOptions | false): number | boolean {
  if (_isBool(options)) return off;
  if (options === void 0 || options[prop] === void 0) return _DEFAULT[prop];
  if (_isNumber(options[prop])) return _correctNumber(_DEFAULT[prop] as number, options[prop], prop === "maxAttempts");
  return options[prop];
}
/** Converts FetchyOptions to internal Options format with validated values. */
function _getOptions(options?: FetchyOptions): Options {
  return {
    timeout: _correctNumber(_DEFAULT.timeout, options?.timeout),
    delay: _correctNumber(_DEFAULT.delay, options?.delay),
    interval: _getRetryOption("interval", 0, options?.retry),
    maxInterval: _getRetryOption("maxInterval", 0, options?.retry),
    maxAttempts: _getRetryOption("maxAttempts", 0, options?.retry),
    retryAfter: _getRetryOption("retryAfter", false, options?.retry),
    native: options?.native ?? _DEFAULT.native,
    redirect: options?.redirect ?? _DEFAULT.redirect,
  };
}
/** Converts FetchyOptions to standard RequestInit format. */
function _getRequestInit(url: Input, opts: Options, options?: FetchyOptions): RequestInit {
  const { method, body, timeout, retry, bearer, native, delay, redirect, signal, ...rest } = options ?? {};
  return {
    headers: _getHeaders(options),
    method: method ? method : url instanceof Request ? url.method : body == void 0 ? "GET" : "POST",
    signal: _combineSignal(url, opts.timeout, options?.signal),
    ...(redirect && { redirect: redirect == "error" ? "manual" : redirect }),
    ...(body && { body: _getBody(body) }),
    ...rest,
  };
}
/** Converts FetchyBody to standard BodyInit format. */
function _getBody(body: FetchyBody): BodyInit | undefined {
  return _isJSONObject(body) ? JSON.stringify(body) : body as BodyInit;
}
/** Checks if a value should be treated as JSON object for serialization. */
function _isJSONObject(arg?: FetchyBody): boolean {
  return Boolean(arg === null || _isNumber(arg) || _isBool(arg) || Array.isArray(arg) || _isPlainObject(arg));
}
/** Constructs request headers with automatic Content-Type and Authorization. */
function _getHeaders(options?: FetchyOptions): Headers {
  const headers = new Headers(options?.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json, text/plain");
  if (!headers.has("Content-Type")) {
    const type = _getContentType(options?.body);
    if (type) headers.append("Content-Type", type);
  }
  if (options?.bearer) headers.set("Authorization", `Bearer ${options.bearer}`);
  return headers;
}
/** Determines Content-Type header based on body type. */
function _getContentType(body?: FetchyBody): string | undefined {
  if (body == void 0 || _isString(body) || body instanceof FormData || body instanceof URLSearchParams) return;
  if (body instanceof Blob && body.type) return;
  if (_isJSONObject(body)) return "application/json";
  return "application/octet-stream";
}
/** Combine abort signals. */
function _combineSignal(url: Input, timeout: number, signal?: AbortSignal | null): AbortSignal | undefined {
  const signals: AbortSignal[] = [];
  if (url instanceof Request && url.signal) signals.push(url.signal);
  if (signal) signals.push(signal);
  if (timeout > 0) signals.push(AbortSignal.timeout(timeout * 1000 + 1));
  return signals.length ? AbortSignal.any(signals) : undefined;
}
/** Parse response body. */
async function _parseBody<T>(resp: Response, method: ParseMethod): Promise<Exclude<FetchyReturn<T>, Response>> {
  // deno-fmt-ignore
  switch (method) {
    case "json": return await resp.json();
    case "text": return await resp.text();
    case "bytes": return await resp.bytes();
    case "blob": return await resp.blob();
    case "buffer": return await resp.arrayBuffer();
    case "form": return await resp.formData();
  }
}

/** Waits for specified seconds with optional randomization. */
async function _wait(sec: number, random: boolean = true) {
  if (sec <= 0) return;
  const delay = Math.trunc((random ? Math.random() : 1) * sec * 1000);
  await new Promise((resolve) => setTimeout(resolve, delay));
}
/** Checks if response is a redirect (3xx status). */
function _shouldRedirect(resp: Response): boolean {
  return resp.status < 400 && resp.status >= 300;
}
/** Checks if response is a client error (4xx status). */
function _shouldCorrectRequest(resp: Response): boolean {
  return resp.status < 500 && resp.status >= 400;
}
/** Determines if retry should stop based on conditions and waits if continuing. */
async function _shouldNotRetry(count: number, init: RequestInit, opts: Options, resp?: Response): Promise<boolean> {
  if (count >= opts.maxAttempts - 1 || init.signal?.aborted) return true;
  if (resp) {
    if (resp.ok || _shouldCorrectRequest(resp) || opts.native) return true;
    if (_shouldRedirect(resp)) {
      if (opts.redirect == "manual") return true;
      if (opts.redirect == "error") {
        opts.maxAttempts = 0;
        throw RedirectError.fromResponse(resp);
      }
    }
  }
  const interval = _getNextInterval(count, opts, resp);
  if (interval > opts.maxInterval) return true;

  await _wait(interval, false);
  return false;
}
/** Calculates next retry interval using exponential backoff or Retry-After header. */
function _getNextInterval(count: number, opts: Options, resp?: Response): number {
  return opts.retryAfter && resp?.headers.has("Retry-After")
    ? Math.max(_parseRetryAfter(resp.headers.get("Retry-After")?.trim() ?? ""), opts.interval)
    : Math.min(Math.pow(Math.max(1, opts.interval), count), opts.maxInterval);
}
/** Parses Retry-After header value to seconds. */
function _parseRetryAfter(value: string): number {
  if (!value) return Infinity;
  const sec1 = Number.parseInt(value, 10);
  if (!Number.isNaN(sec1)) return sec1;
  const sec2 = Math.ceil((new Date(value).getTime() - Date.now()) / 1000);
  if (!Number.isNaN(sec2)) return sec2;
  return Infinity;
}
/** Updates URL and method for redirect responses. */
function _handleRedirectResponse(url: Input, init: RequestInit, resp: Response): Input {
  if (!resp.redirected) return url;
  if (resp.status == 303) init.method = "GET";
  return url instanceof Request ? new Request(resp.url, url) : resp.url;
}
/** Clone input if required. */
function _cloneInput(url: Input, required: boolean): Input {
  return url instanceof Request && required ? url.clone() : url;
}
/** Executes fetch with retry logic and exponential backoff. */
async function _fetchWithRetry(url: Input, init: RequestInit, opts: Options): Promise<Response> {
  for (let i = 0; i < opts.maxAttempts; i++) {
    try {
      const input = _cloneInput(url, i < opts.maxAttempts - 1); // no clone if end of retry
      const resp = await _fetchWithJitter(input, init, opts);
      if (await _shouldNotRetry(i, init, opts, resp)) return resp;
      url = _handleRedirectResponse(url, init, resp);
      continue;
    } catch (e) {
      if (e instanceof Error && e.message == NO_RETRY_ERROR) throw e;
      if (await _shouldNotRetry(i, init, opts)) throw e;
      continue;
    }
  }
  return await _fetchWithJitter(url, init, opts);
}
/** Executes fetch with initial jitter delay. */
async function _fetchWithJitter(url: Input, init: RequestInit, opts: Options): Promise<Response> {
  await _wait(opts.delay);
  return await fetch(url, init);
}
