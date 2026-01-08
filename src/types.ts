/**
 * Represents a JSON-compatible value that can be serialized and deserialized.
 * This type includes primitives, arrays, and plain objects with string keys.
 */
export type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };

/**
 * Represents the body content that can be sent in a fetch request.
 * Includes JSON-compatible values and standard BodyInit types except ReadableStream.
 */
export type FetchyBody = JSONValue | Exclude<BodyInit, ReadableStream>;

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
 *   retry: { max: 3, interval: 2 },
 *   bearerToken: "your-token-here"
 * });
 * ```
 */
export interface FetchyOptions extends Omit<RequestInit, "body"> {
  /** Request URL. Used if call fetchy with null. */
  url?: string | URL;
  /** Request body content. Automatically serializes JSON objects. */
  body?: FetchyBody;
  /** Request timeout in seconds. Default is 15 seconds. */
  timeout?: number;
  /** Retry configuration. Set to false to disable retry functionality. */
  retry?: RetryOptions | false;
  /** Bearer token for Authorization header. Automatically adds "Bearer " prefix. */
  bearerToken?: string;
  /** Error throwing behavior configuration. Set to true to throw all errors. */
  throwError?: ErrorOptions | boolean;
  /** Initial jitter delay in seconds before sending the request. Adds randomness to prevent thundering herd. */
  jitter?: number;
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
 *   max: 5,
 *   byHeader: true
 * };
 * ```
 */
export interface RetryOptions {
  /** Base interval in seconds between retries. Used for exponential backoff calculation. Default is 3 seconds. */
  interval?: number;
  /** Maximum interval in seconds between retries. Caps the exponential backoff. Default is 30 seconds. */
  maxInterval?: number;
  /** Maximum number of retry attempts. Default is 3. */
  max?: number;
  /** Whether to respect Retry-After header from response. Default is true. */
  byHeader?: boolean;
}

/**
 * Configuration options for error throwing behavior.
 * Allows fine-grained control over which errors should be thrown vs. returned as null.
 */
export interface ErrorOptions {
  /** Whether to throw errors during response parsing (e.g., JSON parsing errors). Default is true. */
  onError?: boolean;
  /** Whether to throw HTTPStatusError for non-OK status codes (4xx, 5xx). Default is false. */
  onErrorStatus?: boolean;
}
