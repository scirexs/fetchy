import {
  assertEquals,
  assertExists,
  assertInstanceOf,
  assertNotStrictEquals,
  assertRejects,
  assertStrictEquals,
  assertThrows,
} from "jsr:@std/assert@^1.0.16";
import { assertSpyCalls, stub } from "jsr:@std/testing@^1.0.16/mock";
import {
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
  _makeFetchyHeaders,
  _makeFetchyPromise,
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
} from "../src/main.ts";
import type { Fetchy, FetchyOptions } from "../src/types.ts";

/*=============== Test Helpers =================*/
// deno-lint-ignore no-explicit-any
type AnyOptions = any;

/** Build an Options-shaped object for internal helpers requiring full Options. */
function makeOptions(overrides: Record<string, unknown> = {}): AnyOptions {
  return { ..._DEFAULT, signal: new AbortController().signal, ...overrides };
}

/** Build a FetchyOptions with headers always set (invariant after _buildOption). */
function makeFetchyOptions(overrides: Partial<FetchyOptions> = {}): FetchyOptions {
  return { headers: new Headers(), ...overrides };
}

/*=============== _DEFAULT =====================*/
Deno.test("_DEFAULT", async (t) => {
  await t.step("has expected default values", () => {
    assertEquals(_DEFAULT.timeout, 15);
    assertEquals(_DEFAULT.jitter, 0);
    assertEquals(_DEFAULT.interval, 3);
    assertEquals(_DEFAULT.maxInterval, 30);
    assertEquals(_DEFAULT.maxAttempts, 3);
    assertEquals(_DEFAULT.onTimeout, true);
    assertEquals(_DEFAULT.noIdempotent, false);
    assertEquals(_DEFAULT.native, false);
    assertEquals(_DEFAULT.statusCodes, [500, 502, 503, 504, 408, 429]);
    assertEquals(_DEFAULT.respects, ["retry-after", "ratelimit-reset", "x-ratelimit-reset"]);
  });

  await t.step("statusCodes and respects are frozen", () => {
    assertThrows(() => (_DEFAULT.statusCodes as number[]).push(401));
    assertThrows(() => (_DEFAULT.respects as string[]).push("x"));
  });
});

/*=============== HTTPStatusError ==============*/
Deno.test("HTTPStatusError", async (t) => {
  await t.step("creates error with status, response, and name", () => {
    const resp = new Response("error", { status: 404, statusText: "Not Found" });
    const error = new HTTPStatusError(resp);
    assertInstanceOf(error, Error);
    assertEquals(error.name, "HTTPStatusError");
    assertEquals(error.status, 404);
    assertStrictEquals(error.response, resp);
    assertEquals(error.message.includes("404"), true);
  });

  await t.step("preserves status from response", () => {
    const resp = new Response(null, { status: 500 });
    const error = new HTTPStatusError(resp);
    assertEquals(error.status, 500);
  });
});

/*=============== Type Guards ==================*/
Deno.test("_isString", async (t) => {
  await t.step("returns true for strings", () => {
    assertEquals(_isString("hello"), true);
    assertEquals(_isString(""), true);
  });

  await t.step("returns false for non-strings", () => {
    assertEquals(_isString(123), false);
    assertEquals(_isString(null), false);
    assertEquals(_isString(undefined), false);
    assertEquals(_isString({}), false);
    assertEquals(_isString([]), false);
    assertEquals(_isString(true), false);
    assertEquals(_isString(new String("x")), false);
  });
});

Deno.test("_isRequest", async (t) => {
  await t.step("returns true for Request instances", () => {
    const req = new Request("https://example.com");
    assertEquals(_isRequest(req), true);
  });

  await t.step("returns false for non-Request values", () => {
    assertEquals(_isRequest("https://example.com"), false);
    assertEquals(_isRequest(new URL("https://example.com")), false);
    assertEquals(_isRequest(new Response()), false);
    assertEquals(_isRequest({}), false);
    assertEquals(_isRequest(null), false);
    assertEquals(_isRequest(undefined), false);
  });
});

Deno.test("_isPlain", async (t) => {
  await t.step("returns true for plain objects", () => {
    assertEquals(_isPlain({}), true);
    assertEquals(_isPlain({ key: "value" }), true);
    assertEquals(_isPlain(Object.create(Object.prototype)), true);
  });

  await t.step("returns false for non-plain objects", () => {
    assertEquals(_isPlain([]), false);
    assertEquals(_isPlain(null), false);
    assertEquals(_isPlain(undefined), false);
    assertEquals(_isPlain(new Date()), false);
    assertEquals(_isPlain(new Request("https://example.com")), false);
    assertEquals(_isPlain(new Headers()), false);
    assertEquals(_isPlain(Object.create(null)), false);
    assertEquals(_isPlain("string"), false);
    assertEquals(_isPlain(123), false);
    assertEquals(_isPlain(true), false);
  });
});

Deno.test("_isJSONObject", async (t) => {
  await t.step("returns true for JSON-serializable values", () => {
    assertEquals(_isJSONObject(null), true);
    assertEquals(_isJSONObject(123), true);
    assertEquals(_isJSONObject(0), true);
    assertEquals(_isJSONObject(-3.14), true);
    assertEquals(_isJSONObject(true), true);
    assertEquals(_isJSONObject(false), true);
    assertEquals(_isJSONObject([1, 2, 3]), true);
    assertEquals(_isJSONObject([]), true);
    assertEquals(_isJSONObject({ key: "value" }), true);
    assertEquals(_isJSONObject({}), true);
  });

  await t.step("returns false for non-JSON values", () => {
    assertEquals(_isJSONObject("string"), false);
    assertEquals(_isJSONObject(""), false);
    assertEquals(_isJSONObject(undefined), false);
    assertEquals(_isJSONObject(new FormData()), false);
    assertEquals(_isJSONObject(new URLSearchParams()), false);
    assertEquals(_isJSONObject(new Blob(["x"])), false);
    assertEquals(_isJSONObject(new ReadableStream()), false);
  });
});

/*=============== Number Utilities =============*/
Deno.test("_correctNumber", async (t) => {
  await t.step("returns valid non-negative number", () => {
    assertEquals(_correctNumber(10, 5), 5);
    assertEquals(_correctNumber(10, 0), 0);
    assertEquals(_correctNumber(10, 3.14), 3.14);
  });

  await t.step("returns default for negative numbers", () => {
    assertEquals(_correctNumber(10, -1), 10);
    assertEquals(_correctNumber(10, -0.5), 10);
  });

  await t.step("returns default for undefined", () => {
    assertEquals(_correctNumber(10, undefined), 10);
    assertEquals(_correctNumber(5), 5);
  });

  await t.step("returns default for non-finite values", () => {
    assertEquals(_correctNumber(10, Number.NaN), 10);
    assertEquals(_correctNumber(10, Number.POSITIVE_INFINITY), 10);
    assertEquals(_correctNumber(10, Number.NEGATIVE_INFINITY), 10);
  });
});

/*=============== Header Utilities =============*/
Deno.test("_mergeHeaders", async (t) => {
  await t.step("merges init values into base headers", () => {
    const base = new Headers({ "X-A": "1" });
    const init = new Headers({ "X-B": "2" });
    const result = _mergeHeaders(base, init);
    assertStrictEquals(result, base);
    assertEquals(base.get("X-A"), "1");
    assertEquals(base.get("X-B"), "2");
  });

  await t.step("overwrites duplicate keys with init values", () => {
    const base = new Headers({ "X-A": "old" });
    const init = new Headers({ "X-A": "new" });
    _mergeHeaders(base, init);
    assertEquals(base.get("X-A"), "new");
  });

  await t.step("returns the base Headers reference", () => {
    const base = new Headers();
    const init = new Headers();
    const result = _mergeHeaders(base, init);
    assertStrictEquals(result, base);
  });
});

Deno.test("_getContentType", async (t) => {
  await t.step("returns application/json for JSON-serializable values", () => {
    assertEquals(_getContentType({ key: "value" }), "application/json");
    assertEquals(_getContentType([1, 2, 3]), "application/json");
    assertEquals(_getContentType(123), "application/json");
    assertEquals(_getContentType(true), "application/json");
    assertEquals(_getContentType(null), "application/json");
  });

  await t.step("returns empty string for natively-typed bodies", () => {
    assertEquals(_getContentType(undefined), "");
    assertEquals(_getContentType("text"), "");
    assertEquals(_getContentType(""), "");
    assertEquals(_getContentType(new FormData()), "");
    assertEquals(_getContentType(new URLSearchParams()), "");
  });

  await t.step("returns empty string for Blob with type", () => {
    const blob = new Blob(["data"], { type: "text/plain" });
    assertEquals(_getContentType(blob), "");
  });

  await t.step("returns application/octet-stream for Blob without type", () => {
    const blob = new Blob(["data"]);
    assertEquals(_getContentType(blob), "application/octet-stream");
  });

  await t.step("returns application/octet-stream for ReadableStream", () => {
    assertEquals(_getContentType(new ReadableStream()), "application/octet-stream");
  });
});

Deno.test("_getHeaders", async (t) => {
  await t.step("sets default Accept header when missing", () => {
    const headers = new Headers();
    _getHeaders(headers);
    assertEquals(headers.get("Accept"), "application/json, text/plain");
  });

  await t.step("does not overwrite existing Accept header", () => {
    const headers = new Headers({ "Accept": "text/html" });
    _getHeaders(headers);
    assertEquals(headers.get("Accept"), "text/html");
  });

  await t.step("sets Content-Type for JSON body", () => {
    const headers = new Headers();
    _getHeaders(headers, { body: { key: "value" } });
    assertEquals(headers.get("Content-Type"), "application/json");
  });

  await t.step("sets Content-Type to application/json for null body", () => {
    const headers = new Headers();
    _getHeaders(headers, { body: null });
    assertEquals(headers.get("Content-Type"), "application/json");
  });

  await t.step("does not set Content-Type for string body", () => {
    const headers = new Headers();
    _getHeaders(headers, { body: "text" });
    assertEquals(headers.has("Content-Type"), false);
  });

  await t.step("does not overwrite existing Content-Type", () => {
    const headers = new Headers({ "Content-Type": "text/plain" });
    _getHeaders(headers, { body: { key: "value" } });
    assertEquals(headers.get("Content-Type"), "text/plain");
  });

  await t.step("does not set Content-Type for Blob with type", () => {
    const headers = new Headers();
    _getHeaders(headers, { body: new Blob(["x"], { type: "image/png" }) });
    assertEquals(headers.has("Content-Type"), false);
  });

  await t.step("sets Content-Type application/octet-stream for typeless Blob", () => {
    const headers = new Headers();
    _getHeaders(headers, { body: new Blob(["x"]) });
    assertEquals(headers.get("Content-Type"), "application/octet-stream");
  });

  await t.step("sets Authorization header from bearer", () => {
    const headers = new Headers();
    _getHeaders(headers, { bearer: "token123" });
    assertEquals(headers.get("Authorization"), "Bearer token123");
  });

  await t.step("overwrites existing Authorization when bearer is given", () => {
    const headers = new Headers({ "Authorization": "Basic xxx" });
    _getHeaders(headers, { bearer: "tok" });
    assertEquals(headers.get("Authorization"), "Bearer tok");
  });

  await t.step("returns the mutated headers reference", () => {
    const headers = new Headers();
    const result = _getHeaders(headers);
    assertStrictEquals(result, headers);
  });
});

/*=============== Request Creation =============*/
Deno.test("_createRequest", async (t) => {
  await t.step("clones a passed Request", () => {
    const req = new Request("https://example.com");
    const result = _createRequest({}, req);
    assertInstanceOf(result, Request);
    assertEquals(result.url, "https://example.com/");
  });

  await t.step("creates Request from string URL", () => {
    const result = _createRequest({}, "https://example.com");
    assertInstanceOf(result, Request);
    assertEquals(result.url, "https://example.com/");
  });

  await t.step("creates Request from URL object", () => {
    const url = new URL("https://example.com/path");
    const result = _createRequest({}, url);
    assertEquals(result.url, "https://example.com/path");
  });

  await t.step("uses options.url when url is null", () => {
    const result = _createRequest({ url: "https://example.com" }, null);
    assertEquals(result.url, "https://example.com/");
  });

  await t.step("uses options.url when url is undefined", () => {
    const result = _createRequest({ url: "https://example.com" });
    assertEquals(result.url, "https://example.com/");
  });

  await t.step("uses options.url when url is empty string", () => {
    const result = _createRequest({ url: "https://example.com" }, "");
    assertEquals(result.url, "https://example.com/");
  });

  await t.step("applies base URL for relative path", () => {
    const result = _createRequest({ base: "https://example.com" }, "/path");
    assertEquals(result.url, "https://example.com/path");
  });

  await t.step("ignores base URL when input is Request", () => {
    const req = new Request("https://other.com/");
    const result = _createRequest({ base: "https://example.com" }, req);
    assertEquals(result.url, "https://other.com/");
  });

  await t.step("throws Invalid URL when nothing resolvable is given", () => {
    assertThrows(() => _createRequest({}), TypeError);
  });
});

Deno.test("_includeStream", async (t) => {
  await t.step("returns original Request when body is not a stream", () => {
    const req = new Request("https://example.com");
    const result = _includeStream(req, makeOptions({ body: "text" }));
    assertStrictEquals(result, req);
  });

  await t.step("returns original Request when body is undefined", () => {
    const req = new Request("https://example.com");
    const result = _includeStream(req, makeOptions());
    assertStrictEquals(result, req);
  });

  await t.step("creates new Request with stream body for GET", () => {
    const req = new Request("https://example.com");
    const stream = new ReadableStream();
    const result = _includeStream(req, makeOptions({ body: stream }));
    assertNotStrictEquals(result, req);
    assertEquals(result.method, "POST");
    assertExists(result.body);
  });

  await t.step("creates new Request with stream body for HEAD (upgraded to POST)", () => {
    const req = new Request("https://example.com", { method: "HEAD" });
    const stream = new ReadableStream();
    const result = _includeStream(req, makeOptions({ body: stream }));
    assertEquals(result.method, "POST");
  });

  await t.step("preserves non-GET/HEAD method when attaching stream", () => {
    const req = new Request("https://example.com", { method: "PUT" });
    const stream = new ReadableStream();
    const result = _includeStream(req, makeOptions({ body: stream }));
    assertEquals(result.method, "PUT");
  });
});

Deno.test("_getBody", async (t) => {
  await t.step("returns null for ReadableStream", () => {
    assertEquals(_getBody(new ReadableStream()), null);
  });

  await t.step("stringifies plain object", () => {
    assertEquals(_getBody({ key: "value" }), { body: '{"key":"value"}' });
  });

  await t.step("stringifies array", () => {
    assertEquals(_getBody([1, 2, 3]), { body: "[1,2,3]" });
  });

  await t.step("stringifies number", () => {
    assertEquals(_getBody(123), { body: "123" });
  });

  await t.step("stringifies boolean", () => {
    assertEquals(_getBody(true), { body: "true" });
  });

  await t.step("stringifies null", () => {
    assertEquals(_getBody(null), { body: "null" });
  });

  await t.step("returns string as-is", () => {
    assertEquals(_getBody("plain text"), { body: "plain text" });
  });

  await t.step("returns FormData as-is", () => {
    const data = new FormData();
    const result = _getBody(data);
    assertStrictEquals(result?.body, data);
  });

  await t.step("returns URLSearchParams as-is", () => {
    const data = new URLSearchParams();
    const result = _getBody(data);
    assertStrictEquals(result?.body, data);
  });

  await t.step("returns Blob as-is", () => {
    const data = new Blob(["data"]);
    const result = _getBody(data);
    assertStrictEquals(result?.body, data);
  });

  await t.step("returns wrapper with undefined body for undefined input", () => {
    const result = _getBody(undefined);
    assertEquals(result?.body, undefined);
  });
});

Deno.test("_getRequestInit", async (t) => {
  await t.step("defaults to GET when no method and no body", () => {
    const req = new Request("https://example.com");
    const init = _getRequestInit(req, "https://example.com", makeFetchyOptions());
    assertEquals(init.method, "GET");
  });

  await t.step("defaults to POST when no method but body is present", () => {
    const req = new Request("https://example.com");
    const init = _getRequestInit(req, "https://example.com", makeFetchyOptions({ body: { x: 1 } }));
    assertEquals(init.method, "POST");
  });

  await t.step("preserves explicit method as-is (case-sensitive)", () => {
    const req = new Request("https://example.com");
    const init = _getRequestInit(req, "https://example.com", makeFetchyOptions({ method: "post" }));
    assertEquals(init.method, "post");
  });

  await t.step("uses Request.method when url argument is a Request", () => {
    const realReq = new Request("https://example.com", { method: "PUT" });
    const init = _getRequestInit(realReq, realReq, makeFetchyOptions());
    assertEquals(init.method, "PUT");
  });

  await t.step("uses Request.method when options.url is a Request", () => {
    const realReq = new Request("https://example.com", { method: "DELETE" });
    const init = _getRequestInit(realReq, undefined, makeFetchyOptions({ url: realReq }));
    assertEquals(init.method, "DELETE");
  });

  await t.step("serializes JSON body", () => {
    const req = new Request("https://example.com");
    const init = _getRequestInit(req, "https://example.com", makeFetchyOptions({ body: { key: "value" } }));
    assertEquals(init.body, '{"key":"value"}');
  });

  await t.step("omits body key for ReadableStream body", () => {
    const req = new Request("https://example.com");
    const init = _getRequestInit(req, "https://example.com", makeFetchyOptions({ body: new ReadableStream() }));
    assertEquals("body" in init, false);
  });

  await t.step("merges options headers into request headers", () => {
    const req = new Request("https://example.com", { headers: { "X-Req": "req" } });
    const init = _getRequestInit(req, "https://example.com", makeFetchyOptions({ headers: new Headers({ "X-Opt": "opt" }) }));
    assertInstanceOf(init.headers, Headers);
    const h = init.headers as Headers;
    assertEquals(h.get("X-Req"), "req");
    assertEquals(h.get("X-Opt"), "opt");
    assertEquals(h.get("Accept"), "application/json, text/plain");
  });

  await t.step("strips fetchy-specific options", () => {
    const req = new Request("https://example.com");
    const init = _getRequestInit(req, "https://example.com", makeFetchyOptions({
      timeout: 10,
      retry: false,
      bearer: "token",
      native: true,
      jitter: 1,
    }));
    assertEquals("timeout" in init, false);
    assertEquals("retry" in init, false);
    assertEquals("bearer" in init, false);
    assertEquals("native" in init, false);
    assertEquals("jitter" in init, false);
  });

  await t.step("strips signal from rest (delegated to retry layer)", () => {
    const req = new Request("https://example.com");
    const controller = new AbortController();
    const init = _getRequestInit(req, "https://example.com", makeFetchyOptions({ signal: controller.signal }));
    assertEquals(init.signal, undefined);
  });

  await t.step("preserves standard RequestInit properties via rest spread", () => {
    const req = new Request("https://example.com");
    const init = _getRequestInit(req, "https://example.com", makeFetchyOptions({
      cache: "no-cache",
      credentials: "include",
      mode: "cors",
      redirect: "manual",
    }));
    assertEquals(init.cache, "no-cache");
    assertEquals(init.credentials, "include");
    assertEquals(init.mode, "cors");
    assertEquals(init.redirect, "manual");
  });
});

/*=============== Options Processing ===========*/
Deno.test("_buildOption", async (t) => {
  await t.step("returns FetchyOptions with headers as Headers (invariant)", () => {
    const result = _buildOption();
    assertInstanceOf(result.headers, Headers);
  });

  await t.step("merges base and request options (request wins)", () => {
    const result = _buildOption({ timeout: 10 }, { timeout: 30 });
    assertEquals(result.timeout, 30);
  });

  await t.step("adds method override", () => {
    const result = _buildOption({ timeout: 10 }, undefined, "POST");
    assertEquals(result.method, "POST");
    assertEquals(result.timeout, 10);
  });

  await t.step("method override wins over both base and request method", () => {
    const result = _buildOption({ method: "GET" }, { method: "PATCH" }, "PUT");
    assertEquals(result.method, "PUT");
  });

  await t.step("falsy method param is ignored (uses request method)", () => {
    const result = _buildOption({ method: "GET" }, { method: "PUT" }, "");
    assertEquals(result.method, "PUT");
  });

  await t.step("deep-merges retry when both are plain objects", () => {
    const result = _buildOption(
      { retry: { interval: 5, maxAttempts: 2 } },
      { retry: { maxAttempts: 7 } },
    );
    assertEquals(result.retry, { interval: 5, maxAttempts: 7 });
  });

  await t.step("does not merge retry when base retry is false", () => {
    const result = _buildOption({ retry: false }, { retry: { maxAttempts: 5 } });
    assertEquals(result.retry, { maxAttempts: 5 });
  });

  await t.step("request retry: false overrides base retry object", () => {
    const result = _buildOption({ retry: { maxAttempts: 5 } }, { retry: false });
    assertEquals(result.retry, false);
  });

  await t.step("merges headers from base and request (request overwrites)", () => {
    const result = _buildOption(
      { headers: { "X-A": "base", "X-B": "base" } },
      { headers: { "X-B": "req", "X-C": "req" } },
    );
    const h = result.headers as Headers;
    assertEquals(h.get("X-A"), "base");
    assertEquals(h.get("X-B"), "req");
    assertEquals(h.get("X-C"), "req");
  });

  await t.step("works with all arguments undefined", () => {
    const result = _buildOption();
    assertInstanceOf(result.headers, Headers);
  });

  await t.step("does not mutate input options", () => {
    const base: FetchyOptions = { headers: { "X-A": "1" } };
    const req: FetchyOptions = { headers: { "X-B": "2" } };
    _buildOption(base, req);
    assertEquals(base.headers, { "X-A": "1" });
    assertEquals(req.headers, { "X-B": "2" });
  });
});

Deno.test("_getRetryOption", async (t) => {
  await t.step("returns defaults with maxAttempts=1 when retry is false", () => {
    const result = _getRetryOption({}, false);
    assertEquals(result.maxAttempts, 1);
    assertEquals(result.interval, _DEFAULT.interval);
    assertEquals(result.maxInterval, _DEFAULT.maxInterval);
  });

  await t.step("uses custom maxAttempts", () => {
    assertEquals(_getRetryOption({}, { maxAttempts: 5 }).maxAttempts, 5);
  });

  await t.step("clamps zero maxAttempts up to 1", () => {
    assertEquals(_getRetryOption({}, { maxAttempts: 0 }).maxAttempts, 1);
  });

  await t.step("falls back to default for negative maxAttempts", () => {
    assertEquals(_getRetryOption({}, { maxAttempts: -3 }).maxAttempts, _DEFAULT.maxAttempts);
  });

  await t.step("uses custom interval", () => {
    assertEquals(_getRetryOption({}, { interval: 5 }).interval, 5);
  });

  await t.step("clamps zero interval up to 0.01", () => {
    assertEquals(_getRetryOption({}, { interval: 0 }).interval, 0.01);
  });

  await t.step("falls back to default for negative interval", () => {
    assertEquals(_getRetryOption({}, { interval: -1 }).interval, _DEFAULT.interval);
  });

  await t.step("uses custom maxInterval", () => {
    assertEquals(_getRetryOption({}, { maxInterval: 60 }).maxInterval, 60);
  });

  await t.step("clamps zero maxInterval up to 1", () => {
    assertEquals(_getRetryOption({}, { maxInterval: 0 }).maxInterval, 1);
  });

  await t.step("falls back to default for negative maxInterval", () => {
    assertEquals(_getRetryOption({}, { maxInterval: -1 }).maxInterval, _DEFAULT.maxInterval);
  });

  await t.step("uses custom retryOnTimeout", () => {
    assertEquals(_getRetryOption({}, { retryOnTimeout: false }).onTimeout, false);
    assertEquals(_getRetryOption({}, { retryOnTimeout: true }).onTimeout, true);
  });

  await t.step("default onTimeout when retry is undefined", () => {
    assertEquals(_getRetryOption({}).onTimeout, _DEFAULT.onTimeout);
  });

  await t.step("idempotentOnly: true sets noIdempotent for POST/PATCH/CONNECT", () => {
    assertEquals(_getRetryOption({ method: "POST" }, { idempotentOnly: true }).noIdempotent, true);
    assertEquals(_getRetryOption({ method: "PATCH" }, { idempotentOnly: true }).noIdempotent, true);
    assertEquals(_getRetryOption({ method: "CONNECT" }, { idempotentOnly: true }).noIdempotent, true);
  });

  await t.step("idempotentOnly: true keeps noIdempotent false for idempotent methods", () => {
    assertEquals(_getRetryOption({ method: "GET" }, { idempotentOnly: true }).noIdempotent, false);
    assertEquals(_getRetryOption({ method: "PUT" }, { idempotentOnly: true }).noIdempotent, false);
    assertEquals(_getRetryOption({ method: "DELETE" }, { idempotentOnly: true }).noIdempotent, false);
    assertEquals(_getRetryOption({ method: "HEAD" }, { idempotentOnly: true }).noIdempotent, false);
  });

  await t.step("idempotentOnly: true is case-insensitive on method", () => {
    assertEquals(_getRetryOption({ method: "post" }, { idempotentOnly: true }).noIdempotent, true);
    assertEquals(_getRetryOption({ method: "Patch" }, { idempotentOnly: true }).noIdempotent, true);
  });

  await t.step("idempotentOnly: false (default) keeps noIdempotent false", () => {
    assertEquals(_getRetryOption({ method: "POST" }, {}).noIdempotent, false);
  });

  await t.step("missing method is treated as empty string and considered idempotent", () => {
    assertEquals(_getRetryOption({}, { idempotentOnly: true }).noIdempotent, false);
  });

  await t.step("uses custom statusCodes and respectHeaders", () => {
    const codes = [500, 503];
    const respect = ["x-retry"];
    const result = _getRetryOption({}, { statusCodes: codes, respectHeaders: respect });
    assertStrictEquals(result.statusCodes, codes);
    assertStrictEquals(result.respects, respect);
  });

  await t.step("falls back to default statusCodes and respects", () => {
    const result = _getRetryOption({});
    assertStrictEquals(result.statusCodes, _DEFAULT.statusCodes);
    assertStrictEquals(result.respects, _DEFAULT.respects);
  });
});

Deno.test("_getOptions", async (t) => {
  const req = new Request("https://example.com");

  await t.step("uses default timeout/jitter/native when none given", () => {
    const opts = _getOptions(req, {});
    assertEquals(opts.timeout, _DEFAULT.timeout);
    assertEquals(opts.jitter, _DEFAULT.jitter);
    assertEquals(opts.native, _DEFAULT.native);
  });

  await t.step("uses custom timeout (including 0)", () => {
    assertEquals(_getOptions(req, {}, { timeout: 30 }).timeout, 30);
    assertEquals(_getOptions(req, {}, { timeout: 0 }).timeout, 0);
  });

  await t.step("falls back to default timeout for negative values", () => {
    assertEquals(_getOptions(req, {}, { timeout: -5 }).timeout, _DEFAULT.timeout);
  });

  await t.step("uses custom jitter", () => {
    assertEquals(_getOptions(req, {}, { jitter: 2 }).jitter, 2);
  });

  await t.step("uses custom native flag", () => {
    assertEquals(_getOptions(req, {}, { native: true }).native, true);
    assertEquals(_getOptions(req, {}, { native: false }).native, false);
  });

  await t.step("passes through request body to internal options", () => {
    const opts = _getOptions(req, {}, { body: "hello" });
    assertEquals(opts.body, "hello");
  });

  await t.step("merges request signal with options.signal", () => {
    const c1 = new AbortController();
    const c2 = new AbortController();
    const reqWithSig = new Request("https://example.com", { signal: c1.signal });
    const opts = _getOptions(reqWithSig, {}, { signal: c2.signal });
    assertInstanceOf(opts.signal, AbortSignal);
    assertNotStrictEquals(opts.signal, c1.signal);
    assertNotStrictEquals(opts.signal, c2.signal);
  });

  await t.step("uses request signal alone when options.signal absent", () => {
    const c = new AbortController();
    const reqWithSig = new Request("https://example.com", { signal: c.signal });
    const opts = _getOptions(reqWithSig, {}, {});
    // Request internally wraps the passed signal, so req.signal !== c.signal;
    // _mergeSignals should pass req.signal through untouched when no options.signal.
    assertStrictEquals(opts.signal, reqWithSig.signal);
  });

  await t.step("includes retry-derived options", () => {
    const opts = _getOptions(req, {}, { retry: { maxAttempts: 5, interval: 2 } });
    assertEquals(opts.maxAttempts, 5);
    assertEquals(opts.interval, 2);
  });
});

/*=============== Signal Handling ==============*/
Deno.test("_mergeSignals", async (t) => {
  await t.step("returns first signal when second is null", () => {
    const c = new AbortController();
    assertStrictEquals(_mergeSignals(c.signal, null), c.signal);
  });

  await t.step("returns first signal when second is undefined", () => {
    const c = new AbortController();
    assertStrictEquals(_mergeSignals(c.signal), c.signal);
  });

  await t.step("merges both signals when both exist", () => {
    const c1 = new AbortController();
    const c2 = new AbortController();
    const merged = _mergeSignals(c1.signal, c2.signal);
    assertInstanceOf(merged, AbortSignal);
    assertNotStrictEquals(merged, c1.signal);
    assertNotStrictEquals(merged, c2.signal);
  });

  await t.step("merged signal aborts when either source aborts", () => {
    const c1 = new AbortController();
    const c2 = new AbortController();
    const merged = _mergeSignals(c1.signal, c2.signal);
    assertEquals(merged.aborted, false);
    c1.abort();
    assertEquals(merged.aborted, true);
  });
});

Deno.test("_withTimeout", async (t) => {
  await t.step("returns existing signal when timeout is 0", () => {
    const c = new AbortController();
    const opts = makeOptions({ timeout: 0, signal: c.signal });
    assertStrictEquals(_withTimeout(opts), c.signal);
  });

  await t.step("returns existing signal when timeout is negative", () => {
    const c = new AbortController();
    const opts = makeOptions({ timeout: -1, signal: c.signal });
    assertStrictEquals(_withTimeout(opts), c.signal);
  });

  await t.step("merges timeout signal with existing signal", () => {
    const c = new AbortController();
    const opts = makeOptions({ timeout: 5, signal: c.signal });
    const result = _withTimeout(opts);
    assertNotStrictEquals(result, c.signal);
    assertInstanceOf(result, AbortSignal);
  });

  await t.step("timeout signal aborts after timeout elapses", async () => {
    const c = new AbortController();
    const opts = makeOptions({ timeout: 0.05, signal: c.signal });
    const result = _withTimeout(opts);
    await new Promise((r) => setTimeout(r, 100));
    assertEquals(result.aborted, true);
  });
});

/*=============== Wait and Timing ==============*/
Deno.test("_wait", async (t) => {
  await t.step("returns immediately when seconds is 0", async () => {
    const start = Date.now();
    await _wait(0);
    assertEquals(Date.now() - start < 10, true);
  });

  await t.step("returns immediately for negative seconds", async () => {
    const start = Date.now();
    await _wait(-1);
    assertEquals(Date.now() - start < 10, true);
  });

  await t.step("waits roughly the requested time without random flag", async () => {
    const start = Date.now();
    await _wait(0.1, false);
    const elapsed = Date.now() - start;
    assertEquals(elapsed >= 90, true);
    assertEquals(elapsed <= 200, true);
  });

  await t.step("randomized wait does not exceed the upper bound", async () => {
    const start = Date.now();
    await _wait(0.1, true);
    const elapsed = Date.now() - start;
    assertEquals(elapsed >= 0, true);
    assertEquals(elapsed <= 200, true);
  });
});

Deno.test("_parseRetryHeader", async (t) => {
  await t.step("parses small integer as seconds-to-wait", () => {
    assertEquals(_parseRetryHeader("120"), 120);
    assertEquals(_parseRetryHeader("0"), 0);
  });

  await t.step("parses large future unix timestamp as remaining seconds", () => {
    const future = Math.floor(Date.now() / 1000) + 30;
    const result = _parseRetryHeader(String(future));
    assertEquals(result >= 25, true);
    assertEquals(result <= 35, true);
  });

  await t.step("parses HTTP date string", () => {
    const future = new Date(Date.now() + 5000);
    const result = _parseRetryHeader(future.toUTCString());
    assertEquals(result >= 3, true);
    assertEquals(result <= 7, true);
  });

  await t.step("returns NaN for empty / null / undefined", () => {
    assertEquals(Number.isNaN(_parseRetryHeader("")), true);
    assertEquals(Number.isNaN(_parseRetryHeader(null)), true);
    assertEquals(Number.isNaN(_parseRetryHeader(undefined)), true);
  });

  await t.step("returns NaN for non-numeric, non-date string", () => {
    assertEquals(Number.isNaN(_parseRetryHeader("invalid")), true);
  });
});

Deno.test("_findRetryHeader", async (t) => {
  await t.step("returns the parsed value when greater than interval", () => {
    const headers = new Headers({ "retry-after": "120" });
    assertEquals(_findRetryHeader(makeOptions(), headers), 120);
  });

  await t.step("falls back to interval when header value is smaller", () => {
    const headers = new Headers({ "retry-after": "1" });
    assertEquals(_findRetryHeader(makeOptions({ interval: 5 }), headers), 5);
  });

  await t.step("respects ratelimit-reset header", () => {
    const headers = new Headers({ "ratelimit-reset": "60" });
    assertEquals(_findRetryHeader(makeOptions(), headers), 60);
  });

  await t.step("respects x-ratelimit-reset header", () => {
    const headers = new Headers({ "x-ratelimit-reset": "45" });
    assertEquals(_findRetryHeader(makeOptions(), headers), 45);
  });

  await t.step("checks headers in order defined by respects", () => {
    const headers = new Headers({ "retry-after": "10", "ratelimit-reset": "20" });
    assertEquals(_findRetryHeader(makeOptions(), headers), 10);
  });

  await t.step("returns undefined when none of the respected headers exist", () => {
    assertEquals(_findRetryHeader(makeOptions(), new Headers()), undefined);
  });

  await t.step("returns undefined when header value is invalid", () => {
    const headers = new Headers({ "retry-after": "garbage" });
    assertEquals(_findRetryHeader(makeOptions(), headers), undefined);
  });

  await t.step("trims surrounding whitespace before parsing", () => {
    const headers = new Headers({ "retry-after": "  120  " });
    assertEquals(_findRetryHeader(makeOptions(), headers), 120);
  });
});

Deno.test("_getNextInterval", async (t) => {
  await t.step("returns exponential backoff when no respected header", () => {
    const opts = makeOptions({ interval: 2, maxInterval: 100 });
    assertEquals(_getNextInterval(0, opts, new Headers()), 2);
    assertEquals(_getNextInterval(1, opts, new Headers()), 4);
    assertEquals(_getNextInterval(2, opts, new Headers()), 8);
  });

  await t.step("caps exponential backoff at maxInterval", () => {
    const opts = makeOptions({ interval: 10, maxInterval: 20 });
    assertEquals(_getNextInterval(5, opts, new Headers()), 20);
  });

  await t.step("uses header value when available", () => {
    const opts = makeOptions({ interval: 2 });
    const headers = new Headers({ "retry-after": "10" });
    assertEquals(_getNextInterval(0, opts, headers), 10);
  });

  await t.step("falls back to interval if header is shorter than interval", () => {
    const opts = makeOptions({ interval: 10 });
    const headers = new Headers({ "retry-after": "1" });
    assertEquals(_getNextInterval(0, opts, headers), 10);
  });

  await t.step("falls back to interval when header exists but is unparseable", () => {
    const opts = makeOptions({ interval: 7 });
    const headers = new Headers({ "retry-after": "bad" });
    assertEquals(_getNextInterval(0, opts, headers), 7);
  });
});

Deno.test("_waitInterval", async (t) => {
  await t.step("returns true and waits when interval is within bound", async () => {
    const opts = makeOptions({ interval: 0.05, maxInterval: 1 });
    const start = Date.now();
    const ok = await _waitInterval(0, opts);
    const elapsed = Date.now() - start;
    assertEquals(ok, true);
    assertEquals(elapsed >= 40, true);
  });

  await t.step("returns false without waiting when interval exceeds maxInterval", async () => {
    const opts = makeOptions({ interval: 100, maxInterval: 1 });
    const headers = new Headers({ "retry-after": "1000" });
    const start = Date.now();
    const ok = await _waitInterval(0, opts, headers);
    const elapsed = Date.now() - start;
    assertEquals(ok, false);
    assertEquals(elapsed < 50, true);
  });
});

/*=============== Retry Logic ==================*/
Deno.test("_shouldRetry", async (t) => {
  await t.step("returns false when noIdempotent is true", async () => {
    const opts = makeOptions({ noIdempotent: true });
    const resp = new Response("error", { status: 500 });
    assertEquals(await _shouldRetry(0, opts, resp), false);
  });

  await t.step("returns false when attempts reached the limit (count = max-1)", async () => {
    const opts = makeOptions({ maxAttempts: 3 });
    const resp = new Response("error", { status: 500 });
    assertEquals(await _shouldRetry(2, opts, resp), false);
  });

  await t.step("returns false in native mode for retryable status", async () => {
    const opts = makeOptions({ native: true });
    const resp = new Response("error", { status: 500 });
    assertEquals(await _shouldRetry(0, opts, resp), false);
  });

  await t.step("returns false when status is not in statusCodes", async () => {
    const opts = makeOptions({ statusCodes: [500] });
    const resp = new Response("error", { status: 404 });
    assertEquals(await _shouldRetry(0, opts, resp), false);
  });

  await t.step("returns true for retryable status and waits", async () => {
    const opts = makeOptions({ interval: 0.01, maxInterval: 1 });
    const resp = new Response("error", { status: 500 });
    const start = Date.now();
    const result = await _shouldRetry(0, opts, resp);
    assertEquals(result, true);
    assertEquals(Date.now() - start >= 0, true);
  });

  await t.step("returns false when retry-after exceeds maxInterval", async () => {
    const opts = makeOptions({ interval: 1, maxInterval: 5 });
    const resp = new Response("error", {
      status: 429,
      headers: { "retry-after": "1000" },
    });
    assertEquals(await _shouldRetry(0, opts, resp), false);
  });

  await t.step("returns true for TimeoutError when onTimeout is true", async () => {
    const opts = makeOptions({ onTimeout: true, interval: 0.01 });
    const err = new Error("Timeout");
    err.name = "TimeoutError";
    assertEquals(await _shouldRetry(0, opts, err), true);
  });

  await t.step("returns false for TimeoutError when onTimeout is false", async () => {
    const opts = makeOptions({ onTimeout: false });
    const err = new Error("Timeout");
    err.name = "TimeoutError";
    assertEquals(await _shouldRetry(0, opts, err), false);
  });

  await t.step("returns false for non-timeout errors", async () => {
    const opts = makeOptions();
    assertEquals(await _shouldRetry(0, opts, new Error("Network error")), false);
  });

  await t.step("returns false for non-Response, non-Error values", async () => {
    const opts = makeOptions();
    assertEquals(await _shouldRetry(0, opts, "string error"), false);
    assertEquals(await _shouldRetry(0, opts, undefined), false);
    assertEquals(await _shouldRetry(0, opts, null), false);
  });
});

/*=============== Request Cloning ==============*/
Deno.test("_cloneRequestF", async (t) => {
  await t.step("returns original request on first call", async () => {
    const req = new Request("https://example.com");
    const cloneF = _cloneRequestF(req);
    const result = await cloneF();
    assertStrictEquals(result, req);
  });

  await t.step("returns cloned request on subsequent calls", async () => {
    const req = new Request("https://example.com");
    const cloneF = _cloneRequestF(req);
    await cloneF();
    const second = await cloneF();
    assertNotStrictEquals(second, req);
    assertEquals(second.url, req.url);
  });

  await t.step("each subsequent call returns a distinct clone", async () => {
    const req = new Request("https://example.com");
    const cloneF = _cloneRequestF(req);
    await cloneF();
    const second = await cloneF();
    const third = await cloneF();
    assertNotStrictEquals(second, third);
    assertEquals(second.url, third.url);
  });

  await t.step("cancel=true does not throw and returns last prepared request", async () => {
    const req = new Request("https://example.com", { method: "POST", body: "test" });
    const cloneF = _cloneRequestF(req);
    const first = await cloneF();
    const cancelled = await cloneF(true);
    assertEquals(first.url, cancelled.url);
  });

  await t.step("cancel=true before any non-cancel call returns original request", async () => {
    const req = new Request("https://example.com");
    const cloneF = _cloneRequestF(req);
    const result = await cloneF(true);
    assertStrictEquals(result, req);
  });
});

/*=============== Fetch Execution ==============*/
Deno.test("_fetchWithJitter", async (t) => {
  await t.step("executes fetch and forwards signal", async () => {
    const mockFetch = stub(globalThis, "fetch", () => Promise.resolve(new Response("ok", { status: 200 })));
    try {
      const req = new Request("https://example.com");
      const opts = makeOptions({ jitter: 0, timeout: 5 });
      const resp = await _fetchWithJitter(req, {}, opts);
      assertEquals(resp.status, 200);
      assertSpyCalls(mockFetch, 1);
      const [, init] = mockFetch.calls[0].args;
      assertExists(init?.signal);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("no jitter means negligible delay", async () => {
    const mockFetch = stub(globalThis, "fetch", () => Promise.resolve(new Response("ok", { status: 200 })));
    try {
      const start = Date.now();
      await _fetchWithJitter(new Request("https://example.com"), {}, makeOptions({ jitter: 0 }));
      assertEquals(Date.now() - start < 30, true);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("propagates fetch errors", async () => {
    const mockFetch = stub(globalThis, "fetch", () => Promise.reject(new Error("boom")));
    try {
      await assertRejects(
        () => _fetchWithJitter(new Request("https://example.com"), {}, makeOptions({ jitter: 0 })),
        Error,
        "boom",
      );
    } finally {
      mockFetch.restore();
    }
  });
});

Deno.test("_fetchWithRetry", async (t) => {
  await t.step("returns response on first successful fetch", async () => {
    const mockFetch = stub(globalThis, "fetch", () => Promise.resolve(new Response("ok", { status: 200 })));
    try {
      const opts = makeOptions({ interval: 0.01 });
      const resp = await _fetchWithRetry(new Request("https://example.com"), {}, opts);
      assertEquals(resp.status, 200);
      assertSpyCalls(mockFetch, 1);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("retries on retryable status until success", async () => {
    let attempts = 0;
    const mockFetch = stub(globalThis, "fetch", () => {
      attempts++;
      if (attempts < 3) return Promise.resolve(new Response("err", { status: 500 }));
      return Promise.resolve(new Response("ok", { status: 200 }));
    });
    try {
      const opts = makeOptions({ interval: 0.01, maxInterval: 1, maxAttempts: 5 });
      const resp = await _fetchWithRetry(new Request("https://example.com"), {}, opts);
      assertEquals(resp.status, 200);
      assertEquals(attempts, 3);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("throws HTTPStatusError after exhausting retries", async () => {
    const mockFetch = stub(globalThis, "fetch", () => Promise.resolve(new Response("err", { status: 500 })));
    try {
      const opts = makeOptions({ interval: 0.01, maxAttempts: 3, maxInterval: 1 });
      await assertRejects(
        () => _fetchWithRetry(new Request("https://example.com"), {}, opts),
        HTTPStatusError,
      );
      assertSpyCalls(mockFetch, 3);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("throws on network error (no retry by default)", async () => {
    const mockFetch = stub(globalThis, "fetch", () => Promise.reject(new Error("network")));
    try {
      const opts = makeOptions({ interval: 0.01, maxAttempts: 3 });
      await assertRejects(
        () => _fetchWithRetry(new Request("https://example.com"), {}, opts),
        Error,
        "network",
      );
      assertSpyCalls(mockFetch, 1);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("retries TimeoutError when onTimeout is true", async () => {
    let attempts = 0;
    const mockFetch = stub(globalThis, "fetch", () => {
      attempts++;
      if (attempts < 2) {
        const e = new Error("timeout");
        e.name = "TimeoutError";
        return Promise.reject(e);
      }
      return Promise.resolve(new Response("ok", { status: 200 }));
    });
    try {
      const opts = makeOptions({ interval: 0.01, onTimeout: true, maxAttempts: 3 });
      const resp = await _fetchWithRetry(new Request("https://example.com"), {}, opts);
      assertEquals(resp.status, 200);
      assertEquals(attempts, 2);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("does not throw in native mode for error status", async () => {
    const mockFetch = stub(globalThis, "fetch", () => Promise.resolve(new Response("err", { status: 500 })));
    try {
      const opts = makeOptions({ native: true, interval: 0.01, maxAttempts: 1 });
      const resp = await _fetchWithRetry(new Request("https://example.com"), {}, opts);
      assertEquals(resp.status, 500);
      assertSpyCalls(mockFetch, 1);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("throws HTTPStatusError on 4xx (non-retryable status) by default", async () => {
    const mockFetch = stub(globalThis, "fetch", () => Promise.resolve(new Response("err", { status: 404 })));
    try {
      const opts = makeOptions({ interval: 0.01, maxAttempts: 3, maxInterval: 1 });
      await assertRejects(
        () => _fetchWithRetry(new Request("https://example.com"), {}, opts),
        HTTPStatusError,
      );
      assertSpyCalls(mockFetch, 1);
    } finally {
      mockFetch.restore();
    }
  });
});

/*=============== Headers Wrapping =============*/
Deno.test("_makeFetchyHeaders", async (t) => {
  await t.step("returns the same Headers reference (mutates in place)", () => {
    const h = new Headers({ "X-Limit": "10" });
    const fh = _makeFetchyHeaders(h);
    assertStrictEquals(fh, h);
  });

  await t.step("result is still instanceof Headers", () => {
    const fh = _makeFetchyHeaders(new Headers());
    assertInstanceOf(fh, Headers);
  });

  await t.step("adds a parse method", () => {
    const fh = _makeFetchyHeaders(new Headers());
    assertEquals(typeof fh.parse, "function");
  });

  await t.step("parse(key, parser, dflt) returns dflt when header missing", () => {
    const fh = _makeFetchyHeaders(new Headers());
    assertEquals(fh.parse("missing", Number, 0), 0);
    assertEquals(fh.parse("missing", (v) => v ?? "x", "fallback"), "fallback");
  });

  await t.step("parse(key, parser, dflt) does not call parser when header is missing", () => {
    const fh = _makeFetchyHeaders(new Headers());
    let called = false;
    const result = fh.parse("missing", (v) => {
      called = true;
      return v;
    }, "default");
    assertEquals(called, false);
    assertEquals(result, "default");
  });

  await t.step("parse(key, parser, dflt) calls parser with string value when header is present", () => {
    const fh = _makeFetchyHeaders(new Headers({ "X-Limit": "42" }));
    assertEquals(fh.parse("X-Limit", Number, 0), 42);
  });

  await t.step("parse(key, parser, dflt) calls parser with value even when dflt is provided", () => {
    const fh = _makeFetchyHeaders(new Headers({ "X-V": "hello" }));
    let received: unknown;
    fh.parse("X-V", (v) => {
      received = v;
      return v;
    }, "default");
    assertStrictEquals(received, "hello");
  });

  await t.step("parse(key, parser, dflt) supports falsy defaults: 0, '', false", () => {
    const fh = _makeFetchyHeaders(new Headers());
    assertStrictEquals(fh.parse("missing", Number, 0), 0);
    assertStrictEquals(fh.parse("missing", String, ""), "");
    assertStrictEquals(fh.parse<boolean>("missing", Boolean, false), false);
  });

  await t.step("parse(key, parser, dflt) treats null dflt as a valid default (parser not called)", () => {
    const fh = _makeFetchyHeaders(new Headers());
    let called = false;
    const result = fh.parse<string | null>("missing", () => {
      called = true;
      return "x";
    }, null);
    assertEquals(called, false);
    assertStrictEquals(result, null);
  });

  await t.step("parse(key, parser) calls parser with null when header is missing", () => {
    const fh = _makeFetchyHeaders(new Headers());
    let received: unknown = "unset";
    const result = fh.parse("missing", (v) => {
      received = v;
      return v;
    });
    assertStrictEquals(received, null);
    assertStrictEquals(result, null);
  });

  await t.step("parse(key, parser) calls parser with string value when header is present", () => {
    const fh = _makeFetchyHeaders(new Headers({ "date": "2026-01-01" }));
    const result = fh.parse("date", (v) => v ? new Date(v) : null);
    assertInstanceOf(result, Date);
    assertEquals((result as Date).getUTCFullYear(), 2026);
  });

  await t.step("parse calls parser with empty string when header value is empty", () => {
    const fh = _makeFetchyHeaders(new Headers({ "X-Empty": "" }));
    let received: unknown;
    fh.parse("X-Empty", (v) => {
      received = v;
      return v;
    }, "dflt-fallback");
    assertStrictEquals(received, "");
  });

  await t.step("parse uses case-insensitive header lookup", () => {
    const fh = _makeFetchyHeaders(new Headers({ "X-Custom": "value" }));
    assertEquals(fh.parse("x-custom", (v) => v, ""), "value");
    assertEquals(fh.parse("X-CUSTOM", (v) => v, ""), "value");
  });

  await t.step("parser return type is preserved across overloads", () => {
    const fh = _makeFetchyHeaders(new Headers({ "X-Count": "3" }));
    const n: number = fh.parse("X-Count", Number, 0);
    assertEquals(n, 3);
    const s: string = fh.parse("X-Count", (v) => `[${v}]`, "");
    assertEquals(s, "[3]");
  });

  await t.step("parser exceptions propagate (no internal catch)", () => {
    const fh = _makeFetchyHeaders(new Headers({ "X-V": "v" }));
    assertThrows(
      () =>
        fh.parse("X-V", () => {
          throw new Error("boom");
        }, ""),
      Error,
      "boom",
    );
  });

  await t.step("standard Headers methods still work after augmentation", () => {
    const fh = _makeFetchyHeaders(new Headers({ "X-A": "1" }));
    assertEquals(fh.get("X-A"), "1");
    fh.set("X-B", "2");
    assertEquals(fh.get("X-B"), "2");
    assertEquals(fh.has("X-A"), true);
    fh.delete("X-A");
    assertEquals(fh.has("X-A"), false);
  });
});

/*=============== Response Wrapping ============*/
Deno.test("_makeFetchyResponse", async (t) => {
  await t.step("returns the same Response reference (mutates in place)", () => {
    const res = new Response("hello");
    const fres = _makeFetchyResponse(res);
    assertStrictEquals(fres, res);
  });

  await t.step("result is still instanceof Response", () => {
    const fres = _makeFetchyResponse(new Response("hello"));
    assertInstanceOf(fres, Response);
  });

  await t.step("preserves status, statusText, and url", () => {
    const fres = _makeFetchyResponse(new Response("x", { status: 201, statusText: "Created" }));
    assertEquals(fres.status, 201);
    assertEquals(fres.statusText, "Created");
  });

  await t.step("headers gain a parse method (FetchyHeaders) with same instance", () => {
    const original = new Response("x", { headers: { "X-A": "1" } });
    const before = original.headers;
    const fres = _makeFetchyResponse(original);
    assertStrictEquals(fres.headers, before);
    assertInstanceOf(fres.headers, Headers);
    assertEquals(typeof fres.headers.parse, "function");
    assertEquals(fres.headers.parse("X-A", Number, 0), 1);
  });

  /* --- text() --- */
  await t.step("text() returns the body string", async () => {
    const fres = _makeFetchyResponse(new Response("hello"));
    assertEquals(await fres.text(), "hello");
  });

  await t.step("text(false) returns the body string", async () => {
    const fres = _makeFetchyResponse(new Response("hello"));
    assertEquals(await fres.text(false), "hello");
  });

  await t.step("text() rejects when body already consumed", async () => {
    const fres = _makeFetchyResponse(new Response("hello"));
    await fres.text();
    await assertRejects(() => fres.text());
  });

  await t.step("text(false) (explicit false) rejects when body already consumed", async () => {
    const fres = _makeFetchyResponse(new Response("hello"));
    await fres.text();
    await assertRejects(() => fres.text(false));
  });

  await t.step("text(true) returns null when body cannot be read", async () => {
    const fres = _makeFetchyResponse(new Response("hello"));
    await fres.text();
    assertEquals(await fres.text(true), null);
  });

  /* --- json() --- */
  await t.step("json() parses JSON body", async () => {
    const fres = _makeFetchyResponse(new Response(JSON.stringify({ k: "v" })));
    assertEquals(await fres.json(), { k: "v" });
  });

  await t.step("json() with type parameter returns typed result", async () => {
    const fres = _makeFetchyResponse(new Response(JSON.stringify({ n: 1 })));
    const result = await fres.json<{ n: number }>();
    assertEquals(result.n, 1);
  });

  await t.step("json() rejects on parse error", async () => {
    const fres = _makeFetchyResponse(new Response("not json"));
    await assertRejects(() => fres.json());
  });

  await t.step("json({safe: true}) returns null on parse error", async () => {
    const fres = _makeFetchyResponse(new Response("not json"));
    assertEquals(await fres.json({ safe: true }), null);
  });

  await t.step("json({safe: false}) rejects on parse error", async () => {
    const fres = _makeFetchyResponse(new Response("not json"));
    await assertRejects(() => fres.json({ safe: false }));
  });

  await t.step("json({safe: true}) returns the parsed value on success", async () => {
    const fres = _makeFetchyResponse(new Response(JSON.stringify({ k: "v" })));
    assertEquals(await fres.json({ safe: true }), { k: "v" });
  });

  await t.step("json({reviver}) applies reviver during parse", async () => {
    const fres = _makeFetchyResponse(new Response(JSON.stringify({ n: 1, m: 2 })));
    const result = await fres.json<Record<string, number>>({
      reviver: (_k, v) => typeof v === "number" ? v * 10 : v,
    });
    assertEquals(result, { n: 10, m: 20 });
  });

  await t.step("json({refine}) applies refine to parsed value", async () => {
    const fres = _makeFetchyResponse(new Response(JSON.stringify({ a: 1 })));
    const result = await fres.json<{ a: number; b: number }>({
      refine: (v) => ({ ...(v as { a: number }), b: 2 }),
    });
    assertEquals(result, { a: 1, b: 2 });
  });

  await t.step("json({refine}) supports async refine", async () => {
    const fres = _makeFetchyResponse(new Response(JSON.stringify("x")));
    const result = await fres.json<string>({
      refine: (v) => Promise.resolve(`async:${v}`),
    });
    assertEquals(result, "async:x");
  });

  await t.step("json({refine}) without safe rejects when refine throws", async () => {
    const fres = _makeFetchyResponse(new Response(JSON.stringify({})));
    await assertRejects(() =>
      fres.json({
        refine: () => {
          throw new Error("invalid");
        },
      })
    );
  });

  await t.step("json({refine, safe: true}) returns null when refine throws", async () => {
    const fres = _makeFetchyResponse(new Response(JSON.stringify({})));
    const result = await fres.json({
      safe: true,
      refine: () => {
        throw new Error("invalid");
      },
    });
    assertEquals(result, null);
  });

  await t.step("json({refine, safe: true}) returns null when async refine rejects", async () => {
    const fres = _makeFetchyResponse(new Response(JSON.stringify({})));
    const result = await fres.json({
      safe: true,
      refine: () => Promise.reject(new Error("async invalid")),
    });
    assertEquals(result, null);
  });

  await t.step("json({reviver, refine}) chains reviver then refine", async () => {
    const fres = _makeFetchyResponse(new Response(JSON.stringify({ n: 1 })));
    const result = await fres.json<number>({
      reviver: (_k, v) => typeof v === "number" ? v * 2 : v,
      refine: (v) => (v as { n: number }).n + 100,
    });
    assertEquals(result, 102);
  });

  await t.step("json({safe: true}) returns null when body cannot be read", async () => {
    const fres = _makeFetchyResponse(new Response("{}"));
    await fres.text();
    assertEquals(await fres.json({ safe: true }), null);
  });

  /* --- blob() --- */
  await t.step("blob() returns Blob", async () => {
    const fres = _makeFetchyResponse(new Response("data"));
    assertInstanceOf(await fres.blob(), Blob);
  });

  await t.step("blob() rejects when body already consumed", async () => {
    const fres = _makeFetchyResponse(new Response("data"));
    await fres.blob();
    await assertRejects(() => fres.blob());
  });

  await t.step("blob(true) returns null when body already consumed", async () => {
    const fres = _makeFetchyResponse(new Response("data"));
    await fres.blob();
    assertEquals(await fres.blob(true), null);
  });

  /* --- arrayBuffer() --- */
  await t.step("arrayBuffer() returns ArrayBuffer", async () => {
    const fres = _makeFetchyResponse(new Response("data"));
    assertInstanceOf(await fres.arrayBuffer(), ArrayBuffer);
  });

  await t.step("arrayBuffer() rejects when body already consumed", async () => {
    const fres = _makeFetchyResponse(new Response("data"));
    await fres.arrayBuffer();
    await assertRejects(() => fres.arrayBuffer());
  });

  await t.step("arrayBuffer(true) returns null when body already consumed", async () => {
    const fres = _makeFetchyResponse(new Response("data"));
    await fres.arrayBuffer();
    assertEquals(await fres.arrayBuffer(true), null);
  });

  /* --- bytes() --- */
  await t.step("bytes() returns Uint8Array", async () => {
    const fres = _makeFetchyResponse(new Response("data"));
    assertInstanceOf(await fres.bytes(), Uint8Array);
  });

  await t.step("bytes() rejects when body already consumed", async () => {
    const fres = _makeFetchyResponse(new Response("data"));
    await fres.bytes();
    await assertRejects(() => fres.bytes());
  });

  await t.step("bytes(true) returns null when body already consumed", async () => {
    const fres = _makeFetchyResponse(new Response("data"));
    await fres.bytes();
    assertEquals(await fres.bytes(true), null);
  });

  /* --- formData() --- */
  await t.step("formData() returns FormData", async () => {
    const fd = new FormData();
    fd.append("k", "v");
    const fres = _makeFetchyResponse(new Response(fd));
    const result = await fres.formData();
    assertInstanceOf(result, FormData);
    assertEquals(result.get("k"), "v");
  });

  await t.step("formData() rejects when body already consumed", async () => {
    const fd = new FormData();
    fd.append("k", "v");
    const fres = _makeFetchyResponse(new Response(fd));
    await fres.formData();
    await assertRejects(() => fres.formData());
  });

  await t.step("formData(true) returns null when body already consumed", async () => {
    const fd = new FormData();
    fd.append("k", "v");
    const fres = _makeFetchyResponse(new Response(fd));
    await fres.formData();
    assertEquals(await fres.formData(true), null);
  });
});

/*=============== Promise Wrapping ============*/
Deno.test("_makeFetchyPromise", async (t) => {
  /** Build a settled promise resolving to a FetchyResponse from a body. */
  function fres(body: BodyInit | null, init?: ResponseInit) {
    return Promise.resolve(_makeFetchyResponse(new Response(body, init)));
  }

  /* --- non-safe basics --- */
  await t.step("non-safe: await yields the resolved FetchyResponse", async () => {
    const inner = _makeFetchyResponse(new Response("x"));
    const wrapped = _makeFetchyPromise(Promise.resolve(inner));
    assertStrictEquals(await wrapped, inner);
  });

  await t.step("non-safe: resolved value is still instanceof Response", async () => {
    const wrapped = _makeFetchyPromise(fres("x"));
    assertInstanceOf(await wrapped, Response);
  });

  await t.step("non-safe: text() returns body", async () => {
    const wrapped = _makeFetchyPromise(fres("hello"));
    assertEquals(await wrapped.text(), "hello");
  });

  await t.step("non-safe: json() returns parsed JSON", async () => {
    const wrapped = _makeFetchyPromise(fres(JSON.stringify({ k: "v" })));
    assertEquals(await wrapped.json(), { k: "v" });
  });

  await t.step("non-safe: blob() returns Blob", async () => {
    const wrapped = _makeFetchyPromise(fres("data"));
    assertInstanceOf(await wrapped.blob(), Blob);
  });

  await t.step("non-safe: arrayBuffer() returns ArrayBuffer", async () => {
    const wrapped = _makeFetchyPromise(fres("data"));
    assertInstanceOf(await wrapped.arrayBuffer(), ArrayBuffer);
  });

  await t.step("non-safe: bytes() returns Uint8Array", async () => {
    const wrapped = _makeFetchyPromise(fres("data"));
    assertInstanceOf(await wrapped.bytes(), Uint8Array);
  });

  await t.step("non-safe: formData() returns FormData", async () => {
    const fd = new FormData();
    fd.append("k", "v");
    const wrapped = _makeFetchyPromise(fres(fd));
    assertInstanceOf(await wrapped.formData(), FormData);
  });

  await t.step("non-safe: json() rejects on parse error", async () => {
    const wrapped = _makeFetchyPromise(fres("not json"));
    await assertRejects(() => wrapped.json());
  });

  await t.step("non-safe: then chain preserves the resolved value", async () => {
    const inner = _makeFetchyResponse(new Response("x"));
    const wrapped = _makeFetchyPromise(Promise.resolve(inner));
    const result = await wrapped.then((r) => r);
    assertStrictEquals(result, inner);
  });

  await t.step("non-safe: catch chain receives the rejection error", async () => {
    const err = new Error("boom");
    const wrapped = _makeFetchyPromise(Promise.reject(err));
    const caught = await wrapped.catch((e) => e);
    assertStrictEquals(caught, err);
  });

  await t.step("non-safe: defines all expected verb methods", () => {
    const wrapped = _makeFetchyPromise(fres("x"));
    for (const m of ["text", "json", "bytes", "blob", "arrayBuffer", "formData"]) {
      assertEquals(typeof (wrapped as unknown as Record<string, unknown>)[m], "function");
    }
  });

  /* --- non-safe arg forwarding (delegates to FetchyResponse) --- */
  await t.step("non-safe: text(true) forwards to FetchyResponse and returns null on body re-read", async () => {
    const inner = _makeFetchyResponse(new Response("hello"));
    await inner.text();
    const wrapped = _makeFetchyPromise(Promise.resolve(inner));
    assertEquals(await wrapped.text(true), null);
  });

  await t.step("non-safe: text(false) forwards to FetchyResponse and rejects on body re-read", async () => {
    const inner = _makeFetchyResponse(new Response("hello"));
    await inner.text();
    const wrapped = _makeFetchyPromise(Promise.resolve(inner));
    await assertRejects(() => wrapped.text(false));
  });

  await t.step("non-safe: json({safe: true}) forwards and returns null on parse error", async () => {
    const wrapped = _makeFetchyPromise(fres("not json"));
    assertEquals(await wrapped.json({ safe: true }), null);
  });

  await t.step("non-safe: json({reviver, refine}) options are forwarded", async () => {
    const wrapped = _makeFetchyPromise(fres(JSON.stringify({ n: 1 })));
    const result = await wrapped.json<number>({
      reviver: (_k, v) => typeof v === "number" ? v * 2 : v,
      refine: (v) => (v as { n: number }).n + 100,
    });
    assertEquals(result, 102);
  });

  await t.step("non-safe: blob(true) forwards and returns null on re-read", async () => {
    const inner = _makeFetchyResponse(new Response("data"));
    await inner.blob();
    const wrapped = _makeFetchyPromise(Promise.resolve(inner));
    assertEquals(await wrapped.blob(true), null);
  });

  await t.step("non-safe: arrayBuffer(true) forwards and returns null on re-read", async () => {
    const inner = _makeFetchyResponse(new Response("data"));
    await inner.arrayBuffer();
    const wrapped = _makeFetchyPromise(Promise.resolve(inner));
    assertEquals(await wrapped.arrayBuffer(true), null);
  });

  await t.step("non-safe: bytes(true) forwards and returns null on re-read", async () => {
    const inner = _makeFetchyResponse(new Response("data"));
    await inner.bytes();
    const wrapped = _makeFetchyPromise(Promise.resolve(inner));
    assertEquals(await wrapped.bytes(true), null);
  });

  await t.step("non-safe: formData(true) forwards and returns null on re-read", async () => {
    const fd = new FormData();
    fd.append("k", "v");
    const inner = _makeFetchyResponse(new Response(fd));
    await inner.formData();
    const wrapped = _makeFetchyPromise(Promise.resolve(inner));
    assertEquals(await wrapped.formData(true), null);
  });

  /* --- safe basics --- */
  await t.step("safe: await yields the resolved FetchyResponse on success", async () => {
    const inner = _makeFetchyResponse(new Response("x"));
    const wrapped = _makeFetchyPromise(Promise.resolve(inner), true);
    assertStrictEquals(await wrapped, inner);
  });

  await t.step("safe: await yields null when resolved value is null", async () => {
    const wrapped = _makeFetchyPromise(Promise.resolve(null), true);
    assertStrictEquals(await wrapped, null);
  });

  await t.step("safe: text() returns body on success", async () => {
    const wrapped = _makeFetchyPromise(fres("hello"), true);
    assertEquals(await wrapped.text(), "hello");
  });

  await t.step("safe: json() returns parsed value on success", async () => {
    const wrapped = _makeFetchyPromise(fres(JSON.stringify({ k: "v" })), true);
    assertEquals(await wrapped.json(), { k: "v" });
  });

  await t.step("safe: blob() returns Blob on success", async () => {
    const wrapped = _makeFetchyPromise(fres("data"), true);
    assertInstanceOf(await wrapped.blob(), Blob);
  });

  await t.step("safe: arrayBuffer() returns ArrayBuffer on success", async () => {
    const wrapped = _makeFetchyPromise(fres("data"), true);
    assertInstanceOf(await wrapped.arrayBuffer(), ArrayBuffer);
  });

  await t.step("safe: bytes() returns Uint8Array on success", async () => {
    const wrapped = _makeFetchyPromise(fres("data"), true);
    assertInstanceOf(await wrapped.bytes(), Uint8Array);
  });

  await t.step("safe: formData() returns FormData on success", async () => {
    const fd = new FormData();
    fd.append("k", "v");
    const wrapped = _makeFetchyPromise(fres(fd), true);
    assertInstanceOf(await wrapped.formData(), FormData);
  });

  /* --- safe error handling --- */
  await t.step("safe: all methods return null when underlying promise rejects", async () => {
    const make = () => _makeFetchyPromise(Promise.reject(new Error("fail")), true);
    assertEquals(await make().text(), null);
    assertEquals(await make().json(), null);
    assertEquals(await make().blob(), null);
    assertEquals(await make().arrayBuffer(), null);
    assertEquals(await make().bytes(), null);
    assertEquals(await make().formData(), null);
  });

  await t.step("safe: all methods return null when resolved with null", async () => {
    const make = () => _makeFetchyPromise(Promise.resolve(null), true);
    assertEquals(await make().text(), null);
    assertEquals(await make().json(), null);
    assertEquals(await make().blob(), null);
    assertEquals(await make().arrayBuffer(), null);
    assertEquals(await make().bytes(), null);
    assertEquals(await make().formData(), null);
  });

  await t.step("safe: json() returns null on parse error", async () => {
    const wrapped = _makeFetchyPromise(fres("not json"), true);
    assertEquals(await wrapped.json(), null);
  });

  await t.step("safe: text() returns null when body already consumed", async () => {
    const inner = _makeFetchyResponse(new Response("hello"));
    await inner.text();
    const wrapped = _makeFetchyPromise(Promise.resolve(inner), true);
    assertEquals(await wrapped.text(), null);
  });

  await t.step("safe: refine errors are caught and return null", async () => {
    const wrapped = _makeFetchyPromise(fres(JSON.stringify({})), true);
    const result = await wrapped.json({
      refine: () => {
        throw new Error("bad");
      },
    });
    assertEquals(result, null);
  });

  await t.step("safe: async refine rejection returns null", async () => {
    const wrapped = _makeFetchyPromise(fres(JSON.stringify({})), true);
    const result = await wrapped.json({
      refine: () => Promise.reject(new Error("bad async")),
    });
    assertEquals(result, null);
  });

  await t.step("safe: reviver and refine options are still applied on success", async () => {
    const wrapped = _makeFetchyPromise(fres(JSON.stringify({ n: 1 })), true);
    const result = await wrapped.json<number>({
      reviver: (_k, v) => typeof v === "number" ? v * 2 : v,
      refine: (v) => (v as { n: number }).n + 100,
    });
    assertEquals(result, 102);
  });

  await t.step("safe: then chain receives null instead of rejection", async () => {
    const wrapped = _makeFetchyPromise(Promise.resolve(null), true);
    const result = await wrapped.then((r) => r);
    assertStrictEquals(result, null);
  });
});

/*=============== Method Generation ============*/
Deno.test("_genMethods", async (t) => {
  await t.step("defines all standard HTTP methods", () => {
    const obj = {} as Record<string, unknown>;
    _genMethods(obj);
    for (const m of ["fetch", "get", "head", "post", "put", "patch", "delete"]) {
      assertEquals(typeof obj[m], "function");
    }
  });

  await t.step("defines all safe-variant methods when safe=true", () => {
    const obj = {} as Record<string, unknown>;
    _genMethods(obj, true);
    for (const m of ["sfetch", "sget", "shead", "spost", "sput", "spatch", "sdelete"]) {
      assertEquals(typeof obj[m], "function");
    }
  });

  await t.step("non-fetch methods set the HTTP verb on the request", async () => {
    const seen: string[] = [];
    const mockFetch = stub(globalThis, "fetch", (_, init) => {
      seen.push(String(init?.method));
      return Promise.resolve(new Response("ok", { status: 200 }));
    });
    try {
      const obj: FetchyOptions & Partial<Fetchy> = { url: "https://example.com" };
      _genMethods(obj);
      await obj.get?.();
      await obj.head?.();
      await obj.post?.();
      await obj.put?.();
      await obj.patch?.();
      await obj.delete?.();
      assertEquals(seen, ["get", "head", "post", "put", "patch", "delete"]);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("fetch() preserves the instance method (no override)", async () => {
    let observed = "";
    const mockFetch = stub(globalThis, "fetch", (_, init) => {
      observed = String(init?.method);
      return Promise.resolve(new Response("ok", { status: 200 }));
    });
    try {
      const obj: FetchyOptions & Partial<Fetchy> = { url: "https://example.com", method: "trace" };
      _genMethods(obj);
      await obj.fetch?.();
      assertEquals(observed, "trace");
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("safe methods return null on network error", async () => {
    const mockFetch = stub(globalThis, "fetch", () => Promise.reject(new Error("network")));
    try {
      const obj: FetchyOptions & Partial<Fetchy> = { url: "https://example.com", retry: false };
      _genMethods(obj, true);
      assertEquals(await obj.sfetch?.(), null);
      assertEquals(await obj.sget?.(), null);
      assertEquals(await obj.shead?.(), null);
      assertEquals(await obj.spost?.(), null);
      assertEquals(await obj.sput?.(), null);
      assertEquals(await obj.spatch?.(), null);
      assertEquals(await obj.sdelete?.(), null);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("per-call options merge over instance options", async () => {
    let observed: Headers | undefined;
    const mockFetch = stub(globalThis, "fetch", (_, init) => {
      observed = new Headers(init?.headers);
      return Promise.resolve(new Response("ok", { status: 200 }));
    });
    try {
      const obj: FetchyOptions & Partial<Fetchy> = { url: "https://example.com", bearer: "instance" };
      _genMethods(obj);
      await obj.get?.(undefined, { bearer: "per-call" });
      assertEquals(observed?.get("Authorization"), "Bearer per-call");
    } finally {
      mockFetch.restore();
    }
  });
});

/*=============== _main ========================*/
Deno.test("_main", async (t) => {
  await t.step("returns a Response for a successful request", async () => {
    const mockFetch = stub(globalThis, "fetch", () => Promise.resolve(new Response("ok", { status: 200 })));
    try {
      const resp = await _main("https://example.com", {});
      assertEquals(resp.status, 200);
      assertSpyCalls(mockFetch, 1);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("accepts a URL object", async () => {
    const mockFetch = stub(globalThis, "fetch", () => Promise.resolve(new Response("ok", { status: 200 })));
    try {
      const resp = await _main(new URL("https://example.com/path"), {});
      assertEquals(resp.status, 200);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("accepts a Request object", async () => {
    const mockFetch = stub(globalThis, "fetch", () => Promise.resolve(new Response("ok", { status: 200 })));
    try {
      const resp = await _main(new Request("https://example.com"), {});
      assertEquals(resp.status, 200);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("falls back to options.url when url arg is null", async () => {
    let observedUrl = "";
    const mockFetch = stub(globalThis, "fetch", (input) => {
      observedUrl = input instanceof Request ? input.url : String(input);
      return Promise.resolve(new Response("ok", { status: 200 }));
    });
    try {
      await _main(null, { url: "https://example.com" });
      assertEquals(observedUrl, "https://example.com/");
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("applies base URL for relative path", async () => {
    let observedUrl = "";
    const mockFetch = stub(globalThis, "fetch", (input) => {
      observedUrl = input instanceof Request ? input.url : String(input);
      return Promise.resolve(new Response("ok", { status: 200 }));
    });
    try {
      await _main("/users", { base: "https://api.example.com" });
      assertEquals(observedUrl, "https://api.example.com/users");
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("uses options.method as init.method", async () => {
    let observedMethod = "";
    const mockFetch = stub(globalThis, "fetch", (_, init) => {
      observedMethod = String(init?.method);
      return Promise.resolve(new Response("ok", { status: 200 }));
    });
    try {
      await _main("https://example.com", { method: "POST" });
      assertEquals(observedMethod, "POST");
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("serializes JSON body and sets Content-Type", async () => {
    let observedBody: unknown;
    let observedCt: string | null = "";
    const mockFetch = stub(globalThis, "fetch", (_, init) => {
      observedBody = init?.body;
      observedCt = new Headers(init?.headers).get("Content-Type");
      return Promise.resolve(new Response("ok", { status: 200 }));
    });
    try {
      await _main("https://example.com", { method: "POST", body: { key: "value" } });
      assertEquals(observedBody, '{"key":"value"}');
      assertEquals(observedCt, "application/json");
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("sends ReadableStream body via Request constructor (not init.body)", async () => {
    let bodyText = "";
    const mockFetch = stub(globalThis, "fetch", async (req, _) => {
      if (req instanceof Request && req.body) {
        const chunk = await req.body.getReader().read();
        bodyText = new TextDecoder().decode(chunk.value);
      }
      return new Response("ok", { status: 200 });
    });
    try {
      const stream = new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("hello"));
          c.close();
        },
      });
      await _main("https://example.com", { method: "POST", body: stream });
      assertEquals(bodyText, "hello");
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("sets Authorization header from bearer", async () => {
    let observedAuth = "";
    const mockFetch = stub(globalThis, "fetch", (_, init) => {
      observedAuth = new Headers(init?.headers).get("Authorization") ?? "";
      return Promise.resolve(new Response("ok", { status: 200 }));
    });
    try {
      await _main("https://example.com", { bearer: "tok" });
      assertEquals(observedAuth, "Bearer tok");
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("merges custom headers and preserves default Accept", async () => {
    let observed: Headers | undefined;
    const mockFetch = stub(globalThis, "fetch", (_, init) => {
      observed = new Headers(init?.headers);
      return Promise.resolve(new Response("ok", { status: 200 }));
    });
    try {
      await _main("https://example.com", { headers: { "X-Custom": "value" } });
      assertEquals(observed?.get("X-Custom"), "value");
      assertEquals(observed?.get("Accept"), "application/json, text/plain");
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("aborts request when timeout elapses", async () => {
    const mockFetch = stub(globalThis, "fetch", (_input, init) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          reject(signal.reason);
          return;
        }
        signal?.addEventListener("abort", () => reject(signal.reason));
      });
    });
    try {
      await assertRejects(() => _main("https://example.com", { timeout: 0.05, retry: false }));
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("retries on retryable status", async () => {
    let attempts = 0;
    const mockFetch = stub(globalThis, "fetch", () => {
      attempts++;
      if (attempts < 2) return Promise.resolve(new Response("err", { status: 500 }));
      return Promise.resolve(new Response("ok", { status: 200 }));
    });
    try {
      const resp = await _main("https://example.com", { retry: { maxAttempts: 3, interval: 0.01 } });
      assertEquals(resp.status, 200);
      assertEquals(attempts, 2);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("retry=false disables retry", async () => {
    const mockFetch = stub(globalThis, "fetch", () => Promise.resolve(new Response("err", { status: 500 })));
    try {
      await assertRejects(() => _main("https://example.com", { retry: false }), HTTPStatusError);
      assertSpyCalls(mockFetch, 1);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("throws HTTPStatusError on 4xx by default", async () => {
    const mockFetch = stub(globalThis, "fetch", () => Promise.resolve(new Response("err", { status: 404 })));
    try {
      await assertRejects(() => _main("https://example.com", { retry: false }), HTTPStatusError);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("native mode does not throw on error status", async () => {
    const mockFetch = stub(globalThis, "fetch", () => Promise.resolve(new Response("err", { status: 404 })));
    try {
      const resp = await _main("https://example.com", { native: true, retry: false });
      assertEquals(resp.status, 404);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("respects retry-after header timing", async () => {
    let attempts = 0;
    const mockFetch = stub(globalThis, "fetch", () => {
      attempts++;
      if (attempts < 2) {
        return Promise.resolve(new Response("err", { status: 429, headers: { "retry-after": "1" } }));
      }
      return Promise.resolve(new Response("ok", { status: 200 }));
    });
    try {
      const start = Date.now();
      const resp = await _main("https://example.com", { retry: { maxAttempts: 3, interval: 0.01 } });
      const elapsed = Date.now() - start;
      assertEquals(resp.status, 200);
      assertEquals(attempts, 2);
      assertEquals(elapsed >= 900, true);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("respects setFetchy global options", async () => {
    const mockFetch = stub(globalThis, "fetch", () => Promise.resolve(new Response("err", { status: 404 })));
    try {
      setFetchy({ native: true, retry: false });
      const resp = await _main("https://example.com", {});
      assertEquals(resp.status, 404);
    } finally {
      setFetchy({});
      mockFetch.restore();
    }
  });

  await t.step("per-call options override setFetchy globals", async () => {
    const mockFetch = stub(globalThis, "fetch", () => Promise.resolve(new Response("err", { status: 500 })));
    try {
      setFetchy({ native: true, retry: false });
      // per-call native:false brings back HTTPStatusError
      await assertRejects(() => _main("https://example.com", { native: false, retry: false }), HTTPStatusError);
    } finally {
      setFetchy({});
      mockFetch.restore();
    }
  });
});

/*=============== Public API ===================*/
Deno.test("setFetchy", async (t) => {
  await t.step("replaces (not merges) previously set globals", async () => {
    const mockFetch = stub(globalThis, "fetch", (_, init) => {
      const auth = new Headers(init?.headers).get("Authorization");
      return Promise.resolve(new Response(auth ?? "no-auth", { status: 200 }));
    });
    try {
      setFetchy({ bearer: "first" });
      setFetchy({ timeout: 5 }); // new call replaces; no bearer
      const resp = await fetchy("https://example.com");
      assertEquals(await resp.text(), "no-auth");
    } finally {
      setFetchy({});
      mockFetch.restore();
    }
  });
});

Deno.test("fetchy", async (t) => {
  await t.step("returns a FetchyResponse with parsing methods", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    try {
      const data = await fetchy("https://example.com").json<{ ok: boolean }>();
      assertEquals(data, { ok: true });
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("await on the response yields native Response", async () => {
    const mockFetch = stub(globalThis, "fetch", () => Promise.resolve(new Response("hello", { status: 200 })));
    try {
      const resp = await fetchy("https://example.com");
      assertInstanceOf(resp, Response);
      assertEquals(await resp.text(), "hello");
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("throws HTTPStatusError on error status", async () => {
    const mockFetch = stub(globalThis, "fetch", () => Promise.resolve(new Response("err", { status: 500 })));
    try {
      await assertRejects(() => fetchy("https://example.com", { retry: false }), HTTPStatusError);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step(".json() rejects on parsing error", async () => {
    const mockFetch = stub(globalThis, "fetch", () => Promise.resolve(new Response("not json", { status: 200 })));
    try {
      await assertRejects(() => fetchy("https://example.com").json());
    } finally {
      mockFetch.restore();
    }
  });
});

Deno.test("sfetchy", async (t) => {
  await t.step("returns Response on success", async () => {
    const mockFetch = stub(globalThis, "fetch", () => Promise.resolve(new Response("ok", { status: 200 })));
    try {
      const resp = await sfetchy("https://example.com");
      assertInstanceOf(resp, Response);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("returns null on HTTPStatusError", async () => {
    const mockFetch = stub(globalThis, "fetch", () => Promise.resolve(new Response("err", { status: 500 })));
    try {
      const resp = await sfetchy("https://example.com", { retry: false });
      assertEquals(resp, null);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("returns null on network error", async () => {
    const mockFetch = stub(globalThis, "fetch", () => Promise.reject(new Error("network")));
    try {
      const resp = await sfetchy("https://example.com", { retry: false });
      assertEquals(resp, null);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step(".json() returns null on parsing error", async () => {
    const mockFetch = stub(globalThis, "fetch", () => Promise.resolve(new Response("not json", { status: 200 })));
    try {
      const data = await sfetchy("https://example.com").json();
      assertEquals(data, null);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step(".text() returns null when request fails", async () => {
    const mockFetch = stub(globalThis, "fetch", () => Promise.resolve(new Response("err", { status: 500 })));
    try {
      const text = await sfetchy("https://example.com", { retry: false }).text();
      assertEquals(text, null);
    } finally {
      mockFetch.restore();
    }
  });
});

Deno.test("fy", async (t) => {
  await t.step("returns an object with all standard and safe methods", () => {
    const client = fy({ base: "https://example.com" });
    for (const m of ["fetch", "get", "head", "post", "put", "patch", "delete"]) {
      assertEquals(typeof (client as unknown as Record<string, unknown>)[m], "function");
    }
    for (const m of ["sfetch", "sget", "shead", "spost", "sput", "spatch", "sdelete"]) {
      assertEquals(typeof (client as unknown as Record<string, unknown>)[m], "function");
    }
  });

  await t.step("propagates instance options (base URL) to requests", async () => {
    let observedUrl = "";
    const mockFetch = stub(globalThis, "fetch", (input) => {
      observedUrl = input instanceof Request ? input.url : String(input);
      return Promise.resolve(new Response("ok", { status: 200 }));
    });
    try {
      const client = fy({ base: "https://api.example.com" });
      await client.get("/users");
      assertEquals(observedUrl, "https://api.example.com/users");
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("propagates bearer token to requests", async () => {
    let observedAuth = "";
    const mockFetch = stub(globalThis, "fetch", (_, init) => {
      observedAuth = new Headers(init?.headers).get("Authorization") ?? "";
      return Promise.resolve(new Response("ok", { status: 200 }));
    });
    try {
      const client = fy({ bearer: "client-token" });
      await client.get("https://example.com");
      assertEquals(observedAuth, "Bearer client-token");
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("per-call options override instance options", async () => {
    let observedAuth = "";
    const mockFetch = stub(globalThis, "fetch", (_, init) => {
      observedAuth = new Headers(init?.headers).get("Authorization") ?? "";
      return Promise.resolve(new Response("ok", { status: 200 }));
    });
    try {
      const client = fy({ bearer: "instance" });
      await client.get("https://example.com", { bearer: "per-call" });
      assertEquals(observedAuth, "Bearer per-call");
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("HTTP-verb methods set the matching method", async () => {
    const seen: string[] = [];
    const mockFetch = stub(globalThis, "fetch", (_, init) => {
      seen.push(String(init?.method));
      return Promise.resolve(new Response("ok", { status: 200 }));
    });
    try {
      const client = fy({ url: "https://example.com" });
      await client.get();
      await client.post();
      await client.put();
      await client.patch();
      await client.delete();
      await client.head();
      assertEquals(seen, ["get", "post", "put", "patch", "delete", "head"]);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("safe variants return null on failure", async () => {
    const mockFetch = stub(globalThis, "fetch", () => Promise.resolve(new Response("err", { status: 500 })));
    try {
      const client = fy({ retry: false });
      const resp = await client.sget("https://example.com");
      assertEquals(resp, null);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("respects setFetchy globals layered under instance options", async () => {
    let observedAuth = "";
    const mockFetch = stub(globalThis, "fetch", (_, init) => {
      observedAuth = new Headers(init?.headers).get("Authorization") ?? "";
      return Promise.resolve(new Response("ok", { status: 200 }));
    });
    try {
      setFetchy({ bearer: "global" });
      const client = fy({}); // instance has no bearer; global should apply
      await client.get("https://example.com");
      assertEquals(observedAuth, "Bearer global");
    } finally {
      setFetchy({});
      mockFetch.restore();
    }
  });
});
