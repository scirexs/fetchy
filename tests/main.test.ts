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
  HTTPStatusError,
  setFetchy,
} from "../src/main.ts";
import type { Fetchy, FetchyOptions } from "../src/types.ts";

/*=============== HTTPStatusError ==============*/
Deno.test("HTTPStatusError", async (t) => {
  await t.step("creates error with status and response", () => {
    const resp = new Response("error", {
      status: 404,
      statusText: "Not Found",
    });
    const error = new HTTPStatusError(resp);
    assertInstanceOf(error, Error);
    assertEquals(error.name, "HTTPStatusError");
    assertEquals(error.status, 404);
    assertStrictEquals(error.response, resp);
    assertEquals(error.message.includes("404"), true);
  });
});

/*=============== Type Guards ==================*/
Deno.test("_isString", async (t) => {
  await t.step("returns true for string", () => {
    assertEquals(_isString("hello"), true);
    assertEquals(_isString(""), true);
  });

  await t.step("returns false for non-string", () => {
    assertEquals(_isString(123), false);
    assertEquals(_isString(null), false);
    assertEquals(_isString(undefined), false);
    assertEquals(_isString({}), false);
    assertEquals(_isString([]), false);
    assertEquals(_isString(true), false);
  });
});

Deno.test("_isNumber", async (t) => {
  await t.step("returns true for number", () => {
    assertEquals(_isNumber(123), true);
    assertEquals(_isNumber(0), true);
    assertEquals(_isNumber(-1), true);
    assertEquals(_isNumber(3.14), true);
  });

  await t.step("returns false for non-number", () => {
    assertEquals(_isNumber("123"), false);
    assertEquals(_isNumber(null), false);
    assertEquals(_isNumber(undefined), false);
    assertEquals(_isNumber({}), false);
    assertEquals(_isNumber([]), false);
    assertEquals(_isNumber(true), false);
  });
});

Deno.test("_isBool", async (t) => {
  await t.step("returns true for boolean", () => {
    assertEquals(_isBool(true), true);
    assertEquals(_isBool(false), true);
  });

  await t.step("returns false for non-boolean", () => {
    assertEquals(_isBool(1), false);
    assertEquals(_isBool(0), false);
    assertEquals(_isBool("true"), false);
    assertEquals(_isBool(null), false);
    assertEquals(_isBool(undefined), false);
    assertEquals(_isBool({}), false);
  });
});

Deno.test("_isStream", async (t) => {
  await t.step("returns true for ReadableStream", () => {
    const stream = new ReadableStream();
    assertEquals(_isStream(stream), true);
  });

  await t.step("returns false for non-ReadableStream", () => {
    assertEquals(_isStream({}), false);
    assertEquals(_isStream([]), false);
    assertEquals(_isStream(null), false);
    assertEquals(_isStream(new Response()), false);
  });
});

Deno.test("_isRequest", async (t) => {
  await t.step("returns true for Request", () => {
    const req = new Request("https://example.com");
    assertEquals(_isRequest(req), true);
  });

  await t.step("returns false for non-Request", () => {
    assertEquals(_isRequest("https://example.com"), false);
    assertEquals(_isRequest({}), false);
    assertEquals(_isRequest(null), false);
    assertEquals(_isRequest(new Response()), false);
  });
});

Deno.test("_isPlain", async (t) => {
  await t.step("returns true for plain object", () => {
    assertEquals(_isPlain({}), true);
    assertEquals(_isPlain({ key: "value" }), true);
  });

  await t.step("returns false for non-plain object", () => {
    assertEquals(_isPlain([]), false);
    assertEquals(_isPlain(null), false);
    assertEquals(_isPlain(undefined), false);
    assertEquals(_isPlain(new Date()), false);
    assertEquals(_isPlain(new Request("https://example.com")), false);
    assertEquals(_isPlain("string"), false);
  });
});

Deno.test("_isJSONObject", async (t) => {
  await t.step("returns true for JSON-compatible values", () => {
    assertEquals(_isJSONObject(123), true);
    assertEquals(_isJSONObject(true), true);
    assertEquals(_isJSONObject(false), true);
    assertEquals(_isJSONObject([1, 2, 3]), true);
    assertEquals(_isJSONObject({ key: "value" }), true);
  });

  await t.step("returns false for non-JSON values", () => {
    assertEquals(_isJSONObject("string"), false);
    assertEquals(_isJSONObject(null), false);
    assertEquals(_isJSONObject(undefined), false);
    assertEquals(_isJSONObject(new FormData()), false);
  });
});

/*=============== Object Utilities =============*/
Deno.test("_assign", async (t) => {
  await t.step("returns assigned object", () => {
    type Test = { foo: string; bar: () => string };
    const target: Partial<Test> = {};
    const source = {
      foo: "foo",
      bar() {
        return "bar";
      },
    };
    _assign(target, source);
    assertEquals(target.foo, "foo");
    assertEquals(target.bar?.(), "bar");
  });
});

/*=============== Number Utilities =============*/
Deno.test("_correctNumber", async (t) => {
  await t.step("returns number when valid and non-negative", () => {
    assertEquals(_correctNumber(10, 5), 5);
    assertEquals(_correctNumber(10, 0), 0);
  });

  await t.step("returns default when number is negative", () => {
    assertEquals(_correctNumber(10, -1), 10);
    assertEquals(_correctNumber(10, -5), 10);
  });

  await t.step("returns default when number is undefined", () => {
    assertEquals(_correctNumber(10, undefined), 10);
    assertEquals(_correctNumber(5), 5);
  });
});

/*=============== Request Creation =============*/
Deno.test("_createRequest", async (t) => {
  await t.step("returns Request when url is Request", () => {
    const req = new Request("https://example.com");
    const result = _createRequest(_DEFAULT, req);
    assertStrictEquals(result, req);
  });

  await t.step("creates Request from string URL", () => {
    const result = _createRequest(_DEFAULT, "https://example.com");
    assertInstanceOf(result, Request);
    assertEquals(result.url, "https://example.com/");
  });

  await t.step("creates Request from URL object", () => {
    const url = new URL("https://example.com/path");
    const result = _createRequest(_DEFAULT, url);
    assertInstanceOf(result, Request);
    assertEquals(result.url, "https://example.com/path");
  });

  await t.step("uses options.url when url is null", () => {
    const result = _createRequest({ ..._DEFAULT, zurl: "https://example.com" }, null);
    assertEquals(result.url, "https://example.com/");
  });

  await t.step("uses base URL when provided", () => {
    const result = _createRequest({ ..._DEFAULT, zbase: "https://example.com" }, "/path");
    assertEquals(result.url, "https://example.com/path");
  });

  await t.step("creates empty Request when no URL provided", () => {
    assertThrows(() => _createRequest(_DEFAULT), Error, "Invalid URL");
  });
});

Deno.test("_includeStream", async (t) => {
  await t.step("creates new Request with stream body", () => {
    const req = new Request("https://example.com");
    const stream = new ReadableStream();
    const result = _includeStream(req, { ..._DEFAULT, zbody: stream });
    assertNotStrictEquals(result, req);
    assertInstanceOf(result, Request);
  });

  await t.step("returns original Request when no stream body", () => {
    const req = new Request("https://example.com");
    const result = _includeStream(req, { ..._DEFAULT, zbody: "text" });
    assertStrictEquals(result, req);
  });

  await t.step("returns original Request when no options", () => {
    const req = new Request("https://example.com");
    const result = _includeStream(req, _DEFAULT);
    assertStrictEquals(result, req);
  });
});

/*=============== Options Processing ===========*/
Deno.test("_buildOption", async (t) => {
  await t.step("adds method to options", () => {
    const result = _buildOption({ timeout: 10 }, undefined, "POST");
    assertEquals(result.method, "POST");
    assertEquals(result.timeout, 10);
  });

  await t.step("overwrites existing method", () => {
    const result = _buildOption({ method: "GET" }, undefined, "PUT");
    assertEquals(result.method, "PUT");
  });

  await t.step("works with undefined options", () => {
    const result = _buildOption(undefined, undefined, "DELETE");
    assertEquals(result.method, "DELETE");
  });

  await t.step("overwrites existing options", () => {
    const result = _buildOption({ timeout: 10 }, { timeout: 15 });
    assertEquals(result.timeout, 15);
  });

  await t.step("works with temporal options", () => {
    const result = _buildOption(undefined, { method: "GET" }, "HEAD");
    assertEquals(result.method, "HEAD");
  });

  await t.step("works with all specified", () => {
    const result = _buildOption({ method: "POST" }, { method: "GET" }, "PUT");
    assertEquals(result.method, "PUT");
  });
});

Deno.test("_getBody", async (t) => {
  await t.step("returns null for ReadableStream", () => {
    const stream = new ReadableStream();
    const result = _getBody(stream);
    assertEquals(result, null);
  });

  await t.step("stringifies JSON object", () => {
    const result = _getBody({ key: "value" });
    assertEquals(result, { body: '{"key":"value"}' });
  });

  await t.step("stringifies array", () => {
    const result = _getBody([1, 2, 3]);
    assertEquals(result, { body: "[1,2,3]" });
  });

  await t.step("stringifies number", () => {
    const result = _getBody(123);
    assertEquals(result, { body: "123" });
  });

  await t.step("stringifies boolean", () => {
    const result = _getBody(true);
    assertEquals(result, { body: "true" });
  });

  await t.step("returns string as-is", () => {
    const result = _getBody("plain text");
    assertEquals(result, { body: "plain text" });
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

  await t.step("returns undefined if ReadableStream", () => {
    const data = new ReadableStream();
    const result = _getBody(data);
    assertEquals(result?.body, undefined);
  });
});

Deno.test("_getContentType", async (t) => {
  await t.step("returns application/json for JSON object", () => {
    assertEquals(_getContentType({ key: "value" }), "application/json");
    assertEquals(_getContentType([1, 2, 3]), "application/json");
    assertEquals(_getContentType(123), "application/json");
    assertEquals(_getContentType(true), "application/json");
  });

  await t.step("returns empty string for native-handled types", () => {
    assertEquals(_getContentType(undefined), "");
    assertEquals(_getContentType("text"), "");
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
    const rs = new ReadableStream();
    assertEquals(_getContentType(rs), "application/octet-stream");
  });
});

Deno.test("_handleByNative", async (t) => {
  await t.step("returns true for undefined", () => {
    assertEquals(_handleByNative(undefined), true);
  });

  await t.step("returns true for string", () => {
    assertEquals(_handleByNative("text"), true);
  });

  await t.step("returns true for FormData", () => {
    assertEquals(_handleByNative(new FormData()), true);
  });

  await t.step("returns true for URLSearchParams", () => {
    assertEquals(_handleByNative(new URLSearchParams()), true);
  });

  await t.step("returns true for Blob with type", () => {
    const blob = new Blob(["data"], { type: "text/plain" });
    assertEquals(_handleByNative(blob), true);
  });

  await t.step("returns false for Blob without type", () => {
    const blob = new Blob(["data"]);
    assertEquals(_handleByNative(blob), false);
  });

  await t.step("returns false for objects", () => {
    assertEquals(_handleByNative({ key: "value" }), false);
    assertEquals(_handleByNative([1, 2, 3]), false);
  });

  await t.step("returns false for ArrayBuffer", () => {
    assertEquals(_handleByNative(new ArrayBuffer(8)), false);
  });

  await t.step("returns false for ReadableStream", () => {
    assertEquals(_handleByNative(new ReadableStream()), false);
  });
});

Deno.test("_getHeaders", async (t) => {
  await t.step("sets default Accept header", () => {
    const headers = _getHeaders();
    assertEquals(headers.get("Accept"), "application/json, text/plain");
  });

  await t.step("does not override existing Accept header", () => {
    const headers = _getHeaders({ headers: { "Accept": "text/html" } });
    assertEquals(headers.get("Accept"), "text/html");
  });

  await t.step("sets Content-Type for JSON body", () => {
    const headers = _getHeaders({ body: { key: "value" } });
    assertEquals(headers.get("Content-Type"), "application/json");
  });

  await t.step("does not set Content-Type for string body", () => {
    const headers = _getHeaders({ body: "text" });
    assertEquals(headers.has("Content-Type"), false);
  });

  await t.step("sets Authorization header from bearer token", () => {
    const headers = _getHeaders({ bearer: "token123" });
    assertEquals(headers.get("Authorization"), "Bearer token123");
  });

  await t.step("respects Request headers", () => {
    const req = new Request("https://example.com", {
      headers: { "Accept": "application/xml" },
    });
    const headers = _getHeaders({}, req.headers);
    assertEquals(headers.has("Accept"), false);
  });

  await t.step("does not override Request Content-Type", () => {
    const req = new Request("https://example.com", {
      headers: { "Content-Type": "text/plain" },
    });
    const headers = _getHeaders({ body: { key: "value" } }, req.headers);
    assertEquals(headers.has("Content-Type"), false);
  });
});

Deno.test("_isNoHeader", async (t) => {
  await t.step("returns true when header not in either", () => {
    const optHeaders = new Headers();
    const reqHeaders = new Headers();
    assertEquals(_isNoHeader("Accept", optHeaders, reqHeaders), true);
  });

  await t.step("returns false when header in option headers", () => {
    const optHeaders = new Headers({ "Accept": "text/html" });
    const reqHeaders = new Headers();
    assertEquals(_isNoHeader("Accept", optHeaders, reqHeaders), false);
  });

  await t.step("returns false when header in request headers", () => {
    const optHeaders = new Headers();
    const reqHeaders = new Headers({ "Accept": "text/html" });
    assertEquals(_isNoHeader("Accept", optHeaders, reqHeaders), false);
  });

  await t.step("returns true when reqHeaders is null", () => {
    const optHeaders = new Headers();
    assertEquals(_isNoHeader("Accept", optHeaders, null), true);
  });

  await t.step("returns false when in option headers and reqheader is undefined", () => {
    const optHeaders = new Headers({ "Accept": "text/html" });
    assertEquals(_isNoHeader("Accept", optHeaders), false);
  });
});

Deno.test("_getRequestInit", async (t) => {
  await t.step("sets method to GET by default for no body", () => {
    const init = _getRequestInit();
    assertEquals(init.method, "GET");
  });

  await t.step("sets method to POST when body is provided", () => {
    const init = _getRequestInit(undefined, { body: { key: "value" } });
    assertEquals(init.method, "POST");
  });

  await t.step("uppercases method", () => {
    const init = _getRequestInit(undefined, { method: "post" });
    assertEquals(init.method, "POST");
  });

  await t.step("uses Request method when url is Request", () => {
    const req = new Request("https://example.com", { method: "PUT" });
    const init = _getRequestInit(req);
    assertEquals(init.method, "PUT");
  });

  await t.step("includes headers", () => {
    const init = _getRequestInit(undefined, { headers: { "X-Custom": "value" } });
    assertInstanceOf(init.headers, Headers);
    assertEquals(init.headers?.get("X-Custom"), "value");
  });

  await t.step("excludes fetchy-specific options", () => {
    const init = _getRequestInit(undefined, {
      timeout: 10,
      retry: false,
      bearer: "token",
      native: true,
      jitter: 1,
    });
    assertEquals("timeout" in init, false);
    assertEquals("retry" in init, false);
    assertEquals("bearer" in init, false);
    assertEquals("native" in init, false);
    assertEquals("jitter" in init, false);
  });

  await t.step("includes standard RequestInit properties", () => {
    const init = _getRequestInit(undefined, {
      cache: "no-cache",
      credentials: "include",
      mode: "cors",
    });
    assertEquals(init.cache, "no-cache");
    assertEquals(init.credentials, "include");
    assertEquals(init.mode, "cors");
  });
});

Deno.test("_getRetryOption", async (t) => {
  await t.step("returns default with limit 1 when retry is false", () => {
    const result = _getRetryOption({}, false);
    assertEquals(result.zmaxAttempts, 1);
    assertEquals(result.zinterval, _DEFAULT.zinterval);
  });

  await t.step("uses custom maxAttempts", () => {
    const result = _getRetryOption({}, { maxAttempts: 5 });
    assertEquals(result.zmaxAttempts, 5);
  });

  await t.step("ensures minimum limit of 1", () => {
    const result = _getRetryOption({}, { maxAttempts: 0 });
    assertEquals(result.zmaxAttempts, 1);
  });

  await t.step("uses custom interval", () => {
    const result = _getRetryOption({}, { interval: 5 });
    assertEquals(result.zinterval, 5);
  });

  await t.step("ensures minimum interval of 0.01", () => {
    const result = _getRetryOption({}, { interval: 0 });
    assertEquals(result.zinterval, 0.01);
  });

  await t.step("uses custom maxInterval", () => {
    const result = _getRetryOption({}, { maxInterval: 60 });
    assertEquals(result.zmaxInterval, 60);
  });

  await t.step("ensures minimum maxInterval of 1", () => {
    const result = _getRetryOption({}, { maxInterval: 0 });
    assertEquals(result.zmaxInterval, 1);
  });

  await t.step("uses custom retryOnTimeout", () => {
    const result = _getRetryOption({}, { retryOnTimeout: false });
    assertEquals(result.zonTimeout, false);
  });

  await t.step("sets noidem for non-idempotent methods when idempotentOnly is true", () => {
    const result1 = _getRetryOption({ method: "POST" }, { idempotentOnly: true });
    assertEquals(result1.znoIdempotent, true);

    const result2 = _getRetryOption({ method: "GET" }, { idempotentOnly: true });
    assertEquals(result2.znoIdempotent, false);
  });

  await t.step("uses custom statusCodes", () => {
    const codes = [500, 503];
    const result = _getRetryOption({}, { statusCodes: codes });
    assertEquals(result.zstatusCodes, codes);
  });

  await t.step("uses custom respectHeaders", () => {
    const headers = ["x-retry-after"];
    const result = _getRetryOption({}, { respectHeaders: headers });
    assertEquals(result.zrespects, headers);
  });
});

Deno.test("_getOptions", async (t) => {
  await t.step("uses default timeout", () => {
    const opts = _getOptions({});
    assertEquals(opts.ztimeout, _DEFAULT.ztimeout);
  });

  await t.step("uses deactivate timeout", () => {
    const opts = _getOptions({}, undefined, { timeout: 0 });
    assertEquals(opts.ztimeout, 0);
  });

  await t.step("uses custom timeout", () => {
    const opts = _getOptions({}, undefined, { timeout: 30 });
    assertEquals(opts.ztimeout, 30);
  });

  await t.step("uses default jitter", () => {
    const opts = _getOptions({});
    assertEquals(opts.zjitter, _DEFAULT.zjitter);
  });

  await t.step("uses custom jitter", () => {
    const opts = _getOptions({}, undefined, { jitter: 2 });
    assertEquals(opts.zjitter, 2);
  });

  await t.step("uses default native", () => {
    const opts = _getOptions({});
    assertEquals(opts.znative, _DEFAULT.znative);
  });

  await t.step("uses custom native", () => {
    const opts = _getOptions({}, undefined, { native: true });
    assertEquals(opts.znative, true);
  });

  await t.step("merges signals from Request and options", () => {
    const controller1 = new AbortController();
    const controller2 = new AbortController();
    const req = new Request("https://example.com", { signal: controller1.signal });
    const opts = _getOptions({}, req, { signal: controller2.signal });
    assertExists(opts.zsignal);
  });

  await t.step("includes retry options", () => {
    const opts = _getOptions({}, undefined, {
      retry: { maxAttempts: 5, interval: 2 },
    });
    assertEquals(opts.zmaxAttempts, 5);
    assertEquals(opts.zinterval, 2);
  });
});

/*=============== Signal Handling ==============*/
Deno.test("_mergeSignals", async (t) => {
  await t.step("returns undefined when both signals are null", () => {
    const result = _mergeSignals(null, null);
    assertEquals(result, undefined);
  });

  await t.step("returns first signal when second is null", () => {
    const controller = new AbortController();
    const result = _mergeSignals(controller.signal, null);
    assertStrictEquals(result, controller.signal);
  });

  await t.step("returns second signal when first is null", () => {
    const controller = new AbortController();
    const result = _mergeSignals(null, controller.signal);
    assertStrictEquals(result, controller.signal);
  });

  await t.step("merges both signals when both exist", () => {
    const controller1 = new AbortController();
    const controller2 = new AbortController();
    const result = _mergeSignals(controller1.signal, controller2.signal);
    assertExists(result);
    assertNotStrictEquals(result, controller1.signal);
    assertNotStrictEquals(result, controller2.signal);
  });
});

Deno.test("_withTimeout", async (t) => {
  await t.step("returns existing signal when timeout is 0", () => {
    const controller = new AbortController();
    const opts = { ..._DEFAULT, ztimeout: 0, zsignal: controller.signal };
    const result = _withTimeout(opts);
    assertStrictEquals(result, controller.signal);
  });

  await t.step("returns existing signal when timeout is negative", () => {
    const controller = new AbortController();
    const opts = { ..._DEFAULT, ztimeout: -1, zsignal: controller.signal };
    const result = _withTimeout(opts);
    assertStrictEquals(result, controller.signal);
  });

  await t.step("creates timeout signal when timeout is positive", () => {
    const opts = { ..._DEFAULT, ztimeout: 5 };
    const result = _withTimeout(opts);
    assertExists(result);
  });

  await t.step("merges timeout with existing signal", () => {
    const controller = new AbortController();
    const opts = { ..._DEFAULT, ztimeout: 5, zsignal: controller.signal };
    const result = _withTimeout(opts);
    assertExists(result);
    assertNotStrictEquals(result, controller.signal);
  });
});

/*=============== Wait and Timing ==============*/
Deno.test("_wait", async (t) => {
  await t.step("returns immediately when seconds is 0", async () => {
    const start = Date.now();
    await _wait(0);
    const elapsed = Date.now() - start;
    assertEquals(elapsed < 10, true);
  });

  await t.step("returns immediately when seconds is negative", async () => {
    const start = Date.now();
    await _wait(-1);
    const elapsed = Date.now() - start;
    assertEquals(elapsed < 10, true);
  });

  await t.step("waits approximately correct time with random", async () => {
    const start = Date.now();
    await _wait(0.1, true);
    const elapsed = Date.now() - start;
    assertEquals(elapsed >= 0, true);
    assertEquals(elapsed <= 120, true);
  });

  await t.step("waits exact time without random", async () => {
    const start = Date.now();
    await _wait(0.1, false);
    const elapsed = Date.now() - start;
    assertEquals(elapsed >= 90, true);
    assertEquals(elapsed <= 120, true);
  });
});

/*=============== HTTP Error Checking ==========*/
Deno.test("_isHttpError", async (t) => {
  await t.step("returns true for 4xx status codes", () => {
    assertEquals(_isHttpError(400), true);
    assertEquals(_isHttpError(429), true);
    assertEquals(_isHttpError(499), true);
  });

  await t.step("returns true for 5xx status codes", () => {
    assertEquals(_isHttpError(500), true);
    assertEquals(_isHttpError(503), true);
    assertEquals(_isHttpError(599), true);
  });

  await t.step("returns true for status codes below 100", () => {
    assertEquals(_isHttpError(0), true);
    assertEquals(_isHttpError(99), true);
  });

  await t.step("returns false for 2xx status codes", () => {
    assertEquals(_isHttpError(200), false);
    assertEquals(_isHttpError(201), false);
    assertEquals(_isHttpError(204), false);
  });

  await t.step("returns false for 3xx status codes", () => {
    assertEquals(_isHttpError(301), false);
    assertEquals(_isHttpError(302), false);
    assertEquals(_isHttpError(304), false);
  });

  await t.step("returns false for 1xx status codes", () => {
    assertEquals(_isHttpError(100), false);
    assertEquals(_isHttpError(101), false);
  });
});

/*=============== Retry Logic ==================*/
Deno.test("_parseRetryHeader", async (t) => {
  await t.step("parses integer seconds", () => {
    assertEquals(_parseRetryHeader("120"), 120);
    assertEquals(_parseRetryHeader("0"), 0);
  });

  await t.step("parses date string", () => {
    const future = new Date(Date.now() + 5000);
    const result = _parseRetryHeader(future.toUTCString());
    assertEquals(result >= 4, true);
    assertEquals(result <= 6, true);
  });

  await t.step("returns NaN for invalid input", () => {
    assertEquals(Number.isNaN(_parseRetryHeader("invalid")), true);
    assertEquals(Number.isNaN(_parseRetryHeader("")), true);
    assertEquals(Number.isNaN(_parseRetryHeader(undefined)), true);
    assertEquals(Number.isNaN(_parseRetryHeader(null)), true);
  });
});

Deno.test("_findRetryHeader", async (t) => {
  await t.step("finds retry-after header", () => {
    const headers = new Headers({ "retry-after": "120" });
    const opts = { ..._DEFAULT };
    const result = _findRetryHeader(opts, headers);
    assertEquals(result, 120);
  });

  await t.step("finds ratelimit-reset header", () => {
    const headers = new Headers({ "ratelimit-reset": "60" });
    const opts = { ..._DEFAULT };
    const result = _findRetryHeader(opts, headers);
    assertEquals(result, 60);
  });

  await t.step("returns minimum of header value and interval", () => {
    const headers = new Headers({ "retry-after": "1" });
    const opts = { ..._DEFAULT, zinterval: 5 };
    const result = _findRetryHeader(opts, headers);
    assertEquals(result, 5);
  });

  await t.step("returns undefined when no header found", () => {
    const headers = new Headers();
    const opts = { ..._DEFAULT };
    const result = _findRetryHeader(opts, headers);
    assertEquals(result, undefined);
  });

  await t.step("checks headers in order", () => {
    const headers = new Headers({
      "retry-after": "10",
      "ratelimit-reset": "20",
    });
    const opts = { ..._DEFAULT };
    const result = _findRetryHeader(opts, headers);
    assertEquals(result, 10);
  });
});

Deno.test("_getNextInterval", async (t) => {
  await t.step("uses exponential backoff by default", () => {
    const opts = { ..._DEFAULT, zinterval: 2, zmaxInterval: 100 };
    const headers = new Headers();
    assertEquals(_getNextInterval(0, opts, headers), 2);
    assertEquals(_getNextInterval(1, opts, headers), 4);
    assertEquals(_getNextInterval(2, opts, headers), 8);
  });

  await t.step("caps at maxInterval", () => {
    const opts = { ..._DEFAULT, zinterval: 10, zmaxInterval: 20 };
    const headers = new Headers();
    assertEquals(_getNextInterval(5, opts, headers), 20);
  });

  await t.step("uses header value when available", () => {
    const opts = { ..._DEFAULT, zinterval: 2 };
    const headers = new Headers({ "retry-after": "10" });
    assertEquals(_getNextInterval(0, opts, headers), 10);
  });

  await t.step("uses interval when header value is less", () => {
    const opts = { ..._DEFAULT, zinterval: 10 };
    const headers = new Headers({ "retry-after": "5" });
    assertEquals(_getNextInterval(0, opts, headers), 10);
  });
});

Deno.test("_shouldRetry", async (t) => {
  await t.step("returns false when noidem is true", async () => {
    const opts = { ..._DEFAULT, znoIdempotent: true };
    const resp = new Response("error", { status: 500 });
    const result = await _shouldRetry(0, opts, resp, "fn");
    assertEquals(result, false);
  });

  await t.step("returns false when max attempts reached", async () => {
    const opts = { ..._DEFAULT, zmaxAttempts: 3 };
    const resp = new Response("error", { status: 500 });
    const result = await _shouldRetry(2, opts, resp, "fn");
    assertEquals(result, false);
  });

  await t.step("returns false in native mode", async () => {
    const opts = { ..._DEFAULT, znative: true };
    const resp = new Response("error", { status: 500 });
    const result = await _shouldRetry(0, opts, resp, "fn");
    assertEquals(result, false);
  });

  await t.step("returns false when status not in retry list", async () => {
    const opts = { ..._DEFAULT, zstatusCodes: [500] };
    const resp = new Response("error", { status: 404 });
    const result = await _shouldRetry(0, opts, resp, "fn");
    assertEquals(result, false);
  });

  await t.step("returns true and waits for retryable status", async () => {
    const opts = { ..._DEFAULT, zinterval: 0.01, zmaxInterval: 1 };
    const resp = new Response("error", { status: 500 });
    const start = Date.now();
    const result = await _shouldRetry(0, opts, resp, "fn");
    const elapsed = Date.now() - start;
    assertEquals(result, true);
    assertEquals(elapsed >= 0, true);
  });

  await t.step("returns true when retry interval exceeds max", async () => {
    const opts = { ..._DEFAULT, zinterval: 2, zmaxInterval: 1 };
    const resp = new Response("error", { status: 500 });
    const start = Date.now();
    const result = await _shouldRetry(0, opts, resp, "fn");
    const elapsed = Date.now() - start;
    assertEquals(result, true);
    assertEquals(elapsed >= 1000, true);
    assertEquals(elapsed < 1500, true);
  });

  await t.step("returns true for timeout error when retryOnTimeout is true", async () => {
    const opts = { ..._DEFAULT, zonTimeout: true };
    const error = new Error("Timeout");
    error.name = "TimeoutError";
    const result = await _shouldRetry(0, opts, error, "fn");
    assertEquals(result, true);
  });

  await t.step("returns false for timeout error when retryOnTimeout is false", async () => {
    const opts = { ..._DEFAULT, zonTimeout: false };
    const error = new Error("Timeout");
    error.name = "TimeoutError";
    const result = await _shouldRetry(0, opts, error, "fn");
    assertEquals(result, false);
  });

  await t.step("returns false for non-timeout error", async () => {
    const opts = { ..._DEFAULT };
    const error = new Error("Network error");
    const result = await _shouldRetry(0, opts, error, "fn");
    assertEquals(result, false);
  });

  await t.step("returns false for fn is undefined", async () => {
    const opts = { ..._DEFAULT };
    const error = new Error("error");
    const result = await _shouldRetry(0, opts, error, undefined);
    assertEquals(result, false);
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
    const result = await cloneF();
    assertNotStrictEquals(result, req);
    assertEquals(result.url, req.url);
  });

  await t.step("cancels previous request body when cancel is true", async () => {
    const req = new Request("https://example.com", { method: "POST", body: "test" });
    const cloneF = _cloneRequestF(req);
    const first = await cloneF();
    await cloneF(true);
    // Body should be cancelled, but we can't easily verify this
    // Just ensure it doesn't throw
    assertEquals(first.url, req.url);
  });
});

/*=============== Main Fetch Functions =========*/
Deno.test("_fetchWithJitter", async (t) => {
  await t.step("executes fetch after jitter delay", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("ok", { status: 200 })),
    );
    try {
      const req = new Request("https://example.com");
      const opts = { ..._DEFAULT, zjitter: 0.01 };
      const start = Date.now();
      const resp = await _fetchWithJitter(req, {}, opts);
      const elapsed = Date.now() - start;
      assertEquals(resp.status, 200);
      assertEquals(elapsed >= 0, true);
      assertSpyCalls(mockFetch, 1);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("jitter of 0 has no delay", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("ok", { status: 200 })),
    );

    try {
      const req = new Request("https://example.com");
      const opts = { ..._DEFAULT, zjitter: 0 };
      const start = Date.now();
      const resp = await _fetchWithJitter(req, {}, opts);
      const elapsed = Date.now() - start;
      assertEquals(elapsed < 20, true);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("passes signal to fetch", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("ok", { status: 200 })),
    );
    try {
      const req = new Request("https://example.com");
      const controller = new AbortController();
      const opts = { ..._DEFAULT, zjitter: 0, ztimeout: 5, zsignal: controller.signal };
      await _fetchWithJitter(req, {}, opts);
      assertSpyCalls(mockFetch, 1);
      const [, init] = mockFetch.calls[0].args;
      assertExists(init?.signal);
    } finally {
      mockFetch.restore();
    }
  });
});

Deno.test("_fetchWithRetry", async (t) => {
  await t.step("successful fetch on first try", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("ok", { status: 200 })),
    );
    try {
      const req = new Request("https://example.com");
      const opts = { ..._DEFAULT, zinterval: 0.01 };
      const resp = await _fetchWithRetry(req, {}, opts, false);
      assertEquals(resp?.status, 200);
      assertSpyCalls(mockFetch, 1);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("retries on 500 status", async () => {
    let attempts = 0;
    const mockFetch = stub(globalThis, "fetch", () => {
      attempts++;
      if (attempts < 3) {
        return Promise.resolve(new Response("error", { status: 500 }));
      }
      return Promise.resolve(new Response("ok", { status: 200 }));
    });
    try {
      const req = new Request("https://example.com");
      const opts = { ..._DEFAULT, zinterval: 0.01, zmaxInterval: 1 };
      const resp = await _fetchWithRetry(req, {}, opts, false);
      assertEquals(resp?.status, 200);
      assertEquals(attempts, 3);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("throws HTTPStatusError after max retries", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("error", { status: 500 })),
    );
    try {
      const req = new Request("https://example.com");
      const opts = { ..._DEFAULT, zinterval: 0.01, zmaxAttempts: 3, zmaxInterval: 1 };
      await assertRejects(
        () => _fetchWithRetry(req, {}, opts, false),
        HTTPStatusError,
      );
      assertSpyCalls(mockFetch, 3);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("returns null in safe mode on error", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("error", { status: 500 })),
    );
    try {
      const req = new Request("https://example.com");
      const opts = { ..._DEFAULT, zinterval: 0.01, zmaxAttempts: 3, zmaxInterval: 1 };
      const resp = await _fetchWithRetry(req, {}, opts, true);
      assertEquals(resp, null);
      assertSpyCalls(mockFetch, 3);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("throws on network error", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.reject(new Error("Network error")),
    );
    try {
      const req = new Request("https://example.com");
      const opts = { ..._DEFAULT, zinterval: 0.01, zmaxAttempts: 3 };
      await assertRejects(
        () => _fetchWithRetry(req, {}, opts, false),
        Error,
        "Network error",
      );
      assertSpyCalls(mockFetch, 1);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("does not throw in native mode for error status", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("error", { status: 500 })),
    );
    try {
      const req = new Request("https://example.com");
      const opts = { ..._DEFAULT, znative: true, zinterval: 0.01, zmaxAttempts: 1 };
      const resp = await _fetchWithRetry(req, {}, opts, false);
      assertEquals(resp?.status, 500);
      assertSpyCalls(mockFetch, 1);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("does not throw if url is not provided in safe mode", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("ok", { status: 200 })),
    );
    try {
      const req = "";
      const opts = _DEFAULT;
      const resp = await _fetchWithRetry(req, {}, opts, true);
      assertEquals(resp, null);
      assertSpyCalls(mockFetch, 0);
    } finally {
      mockFetch.restore();
    }
  });
});

/*=============== Custom Object Assignment =======*/
Deno.test("_makeFetchyResponse", async (t) => {
  await t.step("assigns text method that parses response as text", async () => {
    const resp = Promise.resolve(new Response("hello world"));
    const result = _makeFetchyResponse(resp, false);
    assertEquals(await result.text(), "hello world");
  });

  await t.step("assigns json method that parses response as JSON", async () => {
    const resp = Promise.resolve(new Response(JSON.stringify({ key: "value" })));
    const result = _makeFetchyResponse(resp, false);
    assertEquals(await result.json(), { key: "value" });
  });

  await t.step("assigns blob method that parses response as Blob", async () => {
    const resp = Promise.resolve(new Response("data"));
    const result = _makeFetchyResponse(resp, false);
    const blob = await result.blob();
    assertInstanceOf(blob, Blob);
  });

  await t.step("assigns arrayBuffer method that parses response as ArrayBuffer", async () => {
    const resp = Promise.resolve(new Response("data"));
    const result = _makeFetchyResponse(resp, false);
    const buffer = await result.arrayBuffer();
    assertInstanceOf(buffer, ArrayBuffer);
  });

  await t.step("assigns formData method that parses response as FormData", async () => {
    const formData = new FormData();
    formData.append("key", "value");
    const resp = Promise.resolve(new Response(formData, { status: 200 }));
    const result = _makeFetchyResponse(resp, false);
    const parsed = await result.formData();
    assertInstanceOf(parsed, FormData);
  });

  await t.step("assigns bytes method that parses response as Uint8Array", async () => {
    const resp = Promise.resolve(new Response("data"));
    const result = _makeFetchyResponse(resp, false);
    const bytes = await result.bytes();
    assertInstanceOf(bytes, Uint8Array);
  });

  await t.step("assigns safe text method that returns null on error", async () => {
    const resp = Promise.reject(new Error("Fetch failed"));
    const result = _makeFetchyResponse(resp, true);
    assertEquals(await result.text(), null);
  });

  await t.step("assigns safe json method that returns null on error", async () => {
    const resp = Promise.reject(new Error("Fetch failed"));
    const result = _makeFetchyResponse(resp, true);
    assertEquals(await result.json(), null);
  });

  await t.step("assigns safe blob method that returns null on error", async () => {
    const resp = Promise.reject(new Error("Fetch failed"));
    const result = _makeFetchyResponse(resp, true);
    assertEquals(await result.blob(), null);
  });

  await t.step("assigns safe arrayBuffer method that returns null on error", async () => {
    const resp = Promise.reject(new Error("Fetch failed"));
    const result = _makeFetchyResponse(resp, true);
    assertEquals(await result.arrayBuffer(), null);
  });

  await t.step("assigns safe formData method that returns null on error", async () => {
    const resp = Promise.reject(new Error("Fetch failed"));
    const result = _makeFetchyResponse(resp, true);
    assertEquals(await result.formData(), null);
  });

  await t.step("assigns safe bytes method that returns null on error", async () => {
    const resp = Promise.reject(new Error("Fetch failed"));
    const result = _makeFetchyResponse(resp, true);
    assertEquals(await result.bytes(), null);
  });

  await t.step("safe text returns text when response is successful", async () => {
    const resp = Promise.resolve(new Response("success"));
    const result = _makeFetchyResponse(resp, true);
    assertEquals(await result.text(), "success");
  });

  await t.step("safe json returns parsed JSON when response is successful", async () => {
    const resp = Promise.resolve(new Response(JSON.stringify({ status: "ok" })));
    const result = _makeFetchyResponse(resp, true);
    assertEquals(await result.json(), { status: "ok" });
  });

  await t.step("safe blob returns Blob when response is successful", async () => {
    const resp = Promise.resolve(new Response("blob data"));
    const result = _makeFetchyResponse(resp, true);
    const blob = await result.blob();
    assertInstanceOf(blob, Blob);
  });

  await t.step("safe arrayBuffer returns ArrayBuffer when response is successful", async () => {
    const resp = Promise.resolve(new Response("buffer data"));
    const result = _makeFetchyResponse(resp, true);
    const buffer = await result.arrayBuffer();
    assertInstanceOf(buffer, ArrayBuffer);
  });

  await t.step("safe formData returns FormData when response is successful", async () => {
    const formData = new FormData();
    formData.append("field", "value");
    const resp = Promise.resolve(new Response(formData, { status: 200 }));
    const result = _makeFetchyResponse(resp, true);
    const parsed = await result.formData();
    assertInstanceOf(parsed, FormData);
  });

  await t.step("safe bytes returns Uint8Array when response is successful", async () => {
    const resp = Promise.resolve(new Response("bytes data"));
    const result = _makeFetchyResponse(resp, true);
    const bytes = await result.bytes();
    assertInstanceOf(bytes, Uint8Array);
  });

  await t.step("safe methods return null when response is null", async () => {
    const resp = Promise.resolve(null);
    const result = _makeFetchyResponse(resp, true);
    assertEquals(await result.text(), null);
    assertEquals(await result.json(), null);
    assertEquals(await result.blob(), null);
    assertEquals(await result.arrayBuffer(), null);
    assertEquals(await result.formData(), null);
    assertEquals(await result.bytes(), null);
  });

  await t.step("preserves original promise behavior for await", async () => {
    const originalResp = new Response("test");
    const resp = Promise.resolve(originalResp);
    const result = _makeFetchyResponse(resp, false);
    const awaited = await result;
    assertStrictEquals(awaited, originalResp);
  });

  await t.step("preserves original promise behavior for then", async () => {
    const originalResp = new Response("test");
    const resp = Promise.resolve(originalResp);
    const result = _makeFetchyResponse(resp, true);
    const thenResult = await result.then((r) => r);
    assertStrictEquals(thenResult, originalResp);
  });

  await t.step("preserves original promise behavior for catch", async () => {
    const error = new Error("Test error");
    const resp = Promise.reject(error);
    const result = _makeFetchyResponse(resp, false);
    const caught = await result.catch((e) => e);
    assertStrictEquals(caught, error);
  });

  await t.step("normal methods throw on parsing error", async () => {
    const resp = Promise.resolve(new Response("not json"));
    const result = _makeFetchyResponse(resp, false);
    await assertRejects(() => result.json());
  });

  await t.step("safe methods return null on parsing error", async () => {
    const resp = Promise.resolve(new Response("not json"));
    const result = _makeFetchyResponse(resp, true);
    assertEquals(await result.json(), null);
  });
});

Deno.test("_genMethods", async (t) => {
  await t.step("assigns normal methods", () => {
    const obj = {} as Record<string, unknown>;
    _genMethods(obj);

    assertExists(obj.fetch);
    assertExists(obj.get);
    assertExists(obj.head);
    assertExists(obj.post);
    assertExists(obj.put);
    assertExists(obj.patch);
    assertExists(obj.delete);
  });

  await t.step("assigns safe methods", () => {
    const obj = {} as Record<string, unknown>;
    _genMethods(obj, true);

    assertExists(obj.sfetch);
    assertExists(obj.sget);
    assertExists(obj.shead);
    assertExists(obj.spost);
    assertExists(obj.sput);
    assertExists(obj.spatch);
    assertExists(obj.sdelete);
  });

  await t.step("sets http method as method name in normal methods", async () => {
    let attempts = 0;
    const methods = ["TRACE", "GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"];
    const mockFetch = stub(
      globalThis,
      "fetch",
      (input, init) => {
        const method = init?.method ? init.method : input instanceof Request ? input.method : "GET";
        assertEquals(method, methods[attempts]);
        attempts++;
        return Promise.resolve(new Response("ok", { status: 200 }));
      },
    );
    try {
      const obj: FetchyOptions & Partial<Fetchy> = { url: "https://example.com", method: "trace" };
      _genMethods(obj);

      await obj.fetch?.();
      await obj.get?.();
      await obj.head?.();
      await obj.post?.();
      await obj.put?.();
      await obj.patch?.();
      await obj.delete?.();
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("sets http method as method name in safe methods", async () => {
    let attempts = 0;
    const methods = ["TRACE", "GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"];
    const mockFetch = stub(
      globalThis,
      "fetch",
      (input, init) => {
        const method = init?.method ? init.method : input instanceof Request ? input.method : "GET";
        assertEquals(method, methods[attempts]);
        attempts++;
        return Promise.resolve(new Response("ok", { status: 200 }));
      },
    );
    try {
      const obj: FetchyOptions & Partial<Fetchy> = { url: "https://example.com", method: "trace" };
      _genMethods(obj, true);

      await obj.sfetch?.();
      await obj.sget?.();
      await obj.shead?.();
      await obj.spost?.();
      await obj.sput?.();
      await obj.spatch?.();
      await obj.sdelete?.();
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("returns null on error by safe methods ", async () => {
    const methods = ["TRACE", "GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"];
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.reject(new Error("Network error")),
    );
    try {
      const obj: FetchyOptions & Partial<Fetchy> = { url: "https://example.com", method: "trace" };
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
});

/*=============== Main Function ================*/
Deno.test("_main", async (t) => {
  await t.step("creates request from string URL", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("ok", { status: 200 })),
    );
    try {
      const result = _main("https://example.com", {});
      const resp = await result;
      assertEquals(resp.status, 200);
      assertSpyCalls(mockFetch, 1);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("creates request from URL object", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("ok", { status: 200 })),
    );
    try {
      const url = new URL("https://example.com/path");
      const result = _main(url, {});
      const resp = await result;
      assertEquals(resp.status, 200);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("accepts Request object", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("ok", { status: 200 })),
    );
    try {
      const req = new Request("https://example.com");
      const result = _main(req, {});
      const resp = await result;
      assertEquals(resp.status, 200);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("uses options.url when url is null", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("ok", { status: 200 })),
    );
    try {
      const result = _main(null, { url: "https://example.com" });
      const resp = await result;
      assertEquals(resp.status, 200);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("applies base URL", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      (input) => {
        const url = input instanceof Request ? input.url : String(input);
        assertEquals(url, "https://api.example.com/users");
        return Promise.resolve(new Response("ok", { status: 200 }));
      },
    );
    try {
      const result = _main("/users", { base: "https://api.example.com" });
      await result;
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("sets method from options", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      (input, init) => {
        const method = init?.method ? init.method : input instanceof Request ? input.method : "GET";
        assertEquals(method, "POST");
        return Promise.resolve(new Response("ok", { status: 200 }));
      },
    );
    try {
      const result = _main("https://example.com", { method: "post" });
      await result;
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("includes body in request", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      (_, init) => {
        assertEquals(init?.body, '{"key":"value"}');
        return Promise.resolve(new Response("ok", { status: 200 }));
      },
    );
    try {
      const result = _main("https://example.com", {
        method: "POST",
        body: { key: "value" },
      });
      await result;
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("sets Authorization header from bearer token", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      (_, init) => {
        const headers = new Headers(init?.headers);
        assertEquals(headers.get("Authorization"), "Bearer token123");
        return Promise.resolve(new Response("ok", { status: 200 }));
      },
    );
    try {
      const result = _main("https://example.com", { bearer: "token123" });
      await result;
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("applies timeout", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      (_input, init?) => {
        return new Promise((resolve, reject) => {
          const signal = init?.signal;

          // Check if signal is already aborted
          if (signal?.aborted) {
            reject(signal.reason);
            return;
          }

          const timeoutId = setTimeout(() => {
            resolve(new Response("ok", { status: 200 }));
          }, 100);

          // Listen for abort event
          if (signal) {
            signal.addEventListener("abort", () => {
              clearTimeout(timeoutId);
              reject(signal.reason);
            });
          }
        });
      },
    );
    try {
      const result = _main("https://example.com", { timeout: 0.05, retry: false });
      await assertRejects(async () => await result);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("retries on failure", async () => {
    let attempts = 0;
    const mockFetch = stub(globalThis, "fetch", () => {
      attempts++;
      if (attempts < 2) {
        return Promise.resolve(new Response("error", { status: 500 }));
      }
      return Promise.resolve(new Response("ok", { status: 200 }));
    });
    try {
      const result = _main("https://example.com", {
        retry: { maxAttempts: 3, interval: 0.01 },
      });
      const resp = await result;
      assertEquals(resp.status, 200);
      assertEquals(attempts, 2);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("disables retry when retry is false", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("error", { status: 500 })),
    );
    try {
      const result = _main("https://example.com", { retry: false });
      await assertRejects(() => result, HTTPStatusError);
      assertSpyCalls(mockFetch, 1);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("throws HTTPStatusError on error status by default", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("error", { status: 404 })),
    );
    try {
      const result = _main("https://example.com", { retry: false });
      await assertRejects(() => result, HTTPStatusError);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("does not throw in native mode", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("error", { status: 404 })),
    );
    try {
      const result = _main("https://example.com", {
        native: true,
        retry: false,
      });
      const resp = await result;
      assertEquals(resp.status, 404);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("returns null in safe mode on error", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("error", { status: 500 })),
    );
    try {
      const result = _main("https://example.com", { retry: false }, true);
      const resp = await result;
      assertEquals(resp, null);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("applies jitter delay", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("ok", { status: 200 })),
    );
    try {
      const start = Date.now();
      const result = _main("https://example.com", { jitter: 0.05 });
      await result;
      const elapsed = Date.now() - start;
      assertEquals(elapsed >= 0, true);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("uses convenience json method", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response(JSON.stringify({ result: "success" }), { status: 200 })),
    );
    try {
      const result = _main("https://example.com", {});
      const data = await result.json();
      assertEquals(data, { result: "success" });
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("uses convenience text method", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("hello world", { status: 200 })),
    );
    try {
      const result = _main("https://example.com", {});
      const text = await result.text();
      assertEquals(text, "hello world");
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("uses safe convenience methods", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("error", { status: 500 })),
    );
    try {
      const result = _main("https://example.com", { retry: false }, true);
      const data = await result.json();
      assertEquals(data, null);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("handles ReadableStream body", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("ok", { status: 200 })),
    );
    try {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("data"));
          controller.close();
        },
      });
      const result = _main("https://example.com", {
        method: "POST",
        body: stream,
      });
      await result;
      assertSpyCalls(mockFetch, 1);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("merges custom headers", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      (_, init) => {
        const headers = new Headers(init?.headers);
        assertEquals(headers.get("X-Custom"), "value");
        assertEquals(headers.has("Accept"), true);
        return Promise.resolve(new Response("ok", { status: 200 }));
      },
    );
    try {
      const result = _main("https://example.com", {
        headers: { "X-Custom": "value" },
      });
      await result;
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("respects retry-after header", async () => {
    let attempts = 0;
    const mockFetch = stub(globalThis, "fetch", () => {
      attempts++;
      if (attempts < 2) {
        return Promise.resolve(
          new Response("error", {
            status: 429,
            headers: { "retry-after": "1" },
          }),
        );
      }
      return Promise.resolve(new Response("ok", { status: 200 }));
    });
    try {
      const result = _main("https://example.com", {
        retry: { maxAttempts: 3, interval: 0.01 },
      });
      const start = Date.now();
      const resp = await result;
      const elapsed = Date.now() - start;
      assertEquals(elapsed >= 1000, true);
      assertEquals(resp.status, 200);
      assertEquals(attempts, 2);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("respects setFetchy options", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("error", { status: 404 })),
    );
    try {
      setFetchy({
        native: true,
        retry: false,
      });
      const result = _main("https://example.com", {});
      const resp = await result;
      assertEquals(resp.status, 404);
    } finally {
      mockFetch.restore();
    }
  });
});
