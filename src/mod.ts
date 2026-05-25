/**
 * Exports main functions and types for external.
 * @module
 */

export { fetchy, fy, HTTPStatusError, setFetchy, sfetchy } from "./main.ts";
export type {
  Fetchy,
  FetchyBody,
  FetchyHeaders,
  FetchyOptions,
  FetchyPromise,
  FetchyResponse,
  FetchySafePromise,
  JSONParseOptions,
  JSONReviver,
  JSONValue,
  RetryOptions,
} from "./types.ts";
