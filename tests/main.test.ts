import { assertEquals, assertExists, assertInstanceOf, assertNotStrictEquals, assertRejects, assertStrictEquals } from "@std/assert";
import { assertSpyCalls, stub } from "@std/testing/mock";
import {
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
  _parseRetryAfter,
  _shouldNotRetry,
  _shouldRedirect,
  _throwError,
  _wait,
  fetchy,
  fetchyb,
  HTTPStatusError,
  RedirectError,
} from "../src/main.ts";

class MockResponse extends Response {
  override redirected: boolean;
  override url: string;
  constructor(redirected: boolean, url: string, body?: BodyInit | null, init?: ResponseInit) {
    super(body, init);
    this.redirected = redirected;
    this.url = url;
  }
}

Deno.test("HTTPStatusError", async (t) => {
  await t.step("creates error with correct properties", () => {
    const error = new HTTPStatusError("404 Not Found: Page missing", 404, "Page missing");
    assertEquals(error.name, "HTTPStatusError");
    assertEquals(error.message, "404 Not Found: Page missing");
    assertEquals(error.status, 404);
    assertEquals(error.body, "Page missing");
    assertEquals(error instanceof Error, true);
  });

  await t.step("handles empty body in constructor", () => {
    const error = new HTTPStatusError("500 Internal Server Error", 500, "");
    assertEquals(error.message, "500 Internal Server Error");
    assertEquals(error.status, 500);
    assertEquals(error.body, "");
  });

  await t.step("fromResponse creates error with normal body", async () => {
    const mockResponse = new Response("Resource not found", {
      status: 404,
      statusText: "Not Found",
    });

    const error = await HTTPStatusError.fromResponse(mockResponse);
    assertEquals(error.name, "HTTPStatusError");
    assertEquals(error.message, "404 Not Found: Resource not found");
    assertEquals(error.status, 404);
    assertEquals(error.body, "Resource not found");
  });

  await t.step("fromResponse handles empty response body", async () => {
    const mockResponse = new Response("", {
      status: 500,
      statusText: "Internal Server Error",
    });

    const error = await HTTPStatusError.fromResponse(mockResponse);
    assertEquals(error.message, "500 Internal Server Error: (no response body)");
    assertEquals(error.status, 500);
    assertEquals(error.body, "");
  });

  await t.step("fromResponse truncates long response body in message", async () => {
    const longBody = "x".repeat(280);
    const mockResponse = new Response(longBody, {
      status: 400,
      statusText: "Bad Request",
    });

    const error = await HTTPStatusError.fromResponse(mockResponse);
    assertEquals(error.status, 400);
    assertEquals(error.body, longBody); // Full body preserved
    assertEquals(error.message.startsWith("400 Bad Request: " + "x".repeat(80)), true);
    assertEquals(error.message.includes("... (more 200 chars)"), true);
  });

  await t.step("fromResponse does not truncate body at exactly MAX_BODY_LEN", async () => {
    const exactBody = "y".repeat(80);
    const mockResponse = new Response(exactBody, {
      status: 403,
      statusText: "Forbidden",
    });

    const error = await HTTPStatusError.fromResponse(mockResponse);
    assertEquals(error.message, `403 Forbidden: ${exactBody}`);
    assertEquals(error.body, exactBody);
  });

  await t.step("fromResponse truncates body at MAX_BODY_LEN + 1", async () => {
    const slightlyLongBody = "z".repeat(81);
    const mockResponse = new Response(slightlyLongBody, {
      status: 413,
      statusText: "Payload Too Large",
    });

    const error = await HTTPStatusError.fromResponse(mockResponse);
    assertEquals(error.body, slightlyLongBody); // Full body preserved
    assertEquals(error.message.startsWith("413 Payload Too Large: " + "z".repeat(80)), true);
    assertEquals(error.message.includes("... (more 1 chars)"), true);
  });
});

Deno.test("RedirectError", async (t) => {
  await t.step("creates error with correct properties", () => {
    const error = new RedirectError("301 Moved Permanently", 301);
    assertEquals(error.name, "RedirectError");
    assertEquals(error.message, "301 Moved Permanently");
    assertEquals(error.status, 301);
    assertEquals(error instanceof Error, true);
  });

  await t.step("fromResponse creates error with normal body", () => {
    const mockResponse = new Response(null, {
      status: 301,
      statusText: "Moved Permanently",
    });

    const error = RedirectError.fromResponse(mockResponse);
    assertEquals(error.name, "RedirectError");
    assertEquals(error.message, "301 Moved Permanently");
    assertEquals(error.status, 301);
  });
});

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
    assertEquals(_isNumber(NaN), true);
    assertEquals(_isNumber(Infinity), true);
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
    assertEquals(_isBool(0), false);
    assertEquals(_isBool(1), false);
    assertEquals(_isBool("true"), false);
    assertEquals(_isBool(null), false);
    assertEquals(_isBool(undefined), false);
    assertEquals(_isBool({}), false);
    assertEquals(_isBool([]), false);
  });
});

Deno.test("_isPlainObject", async (t) => {
  await t.step("returns true for plain object", () => {
    assertEquals(_isPlainObject({}), true);
    assertEquals(_isPlainObject({ key: "value" }), true);
  });

  await t.step("returns false for non-plain object", () => {
    assertEquals(_isPlainObject([]), false);
    assertEquals(_isPlainObject(null), false);
    assertEquals(_isPlainObject(undefined), false);
    assertEquals(_isPlainObject("string"), false);
    assertEquals(_isPlainObject(123), false);
    assertEquals(_isPlainObject(new Date()), false);
    assertEquals(_isPlainObject(new Map()), false);
    assertEquals(_isPlainObject(new Set()), false);
    assertEquals(_isPlainObject(Object.create(null)), false); // Not plain object
  });
});

Deno.test("_correctNumber", async (t) => {
  await t.step("returns provided number when valid", () => {
    assertEquals(_correctNumber(10, 5), 5);
    assertEquals(_correctNumber(10, 0), 0);
    assertEquals(_correctNumber(10, 100), 100);
    assertEquals(_correctNumber(10, 5.7), 5.7);
    assertEquals(_correctNumber(10, 9.9), 9.9);
  });

  await t.step("returns default when number is undefined", () => {
    assertEquals(_correctNumber(10, undefined), 10);
  });

  await t.step("returns default when number is negative", () => {
    assertEquals(_correctNumber(10, -5), 10);
    assertEquals(_correctNumber(10, -1), 10);
  });

  await t.step("returns truncated number when indicates integer", () => {
    assertEquals(_correctNumber(10, 5.7, true), 5);
    assertEquals(_correctNumber(10, 9.9, true), 9);
  });
});

Deno.test("_throwError", async (t) => {
  await t.step("returns default when onError is undefined", () => {
    assertEquals(_throwError("onNative", undefined), _DEFAULT.onNative);
    assertEquals(_throwError("onStatus", undefined), _DEFAULT.onStatus);
  });

  await t.step("returns onError boolean value", () => {
    assertEquals(_throwError("onNative", true), true);
    assertEquals(_throwError("onNative", false), false);
    assertEquals(_throwError("onStatus", true), true);
    assertEquals(_throwError("onStatus", false), false);
  });

  await t.step("returns onError object property", () => {
    assertEquals(_throwError("onNative", { onNative: true }), true);
    assertEquals(_throwError("onNative", { onNative: false }), false);
    assertEquals(_throwError("onStatus", { onStatus: true }), true);
    assertEquals(_throwError("onStatus", { onStatus: false }), false);
  });

  await t.step("returns default when property is undefined in object", () => {
    assertEquals(_throwError("onNative", {}), _DEFAULT.onNative);
    assertEquals(_throwError("onStatus", {}), _DEFAULT.onStatus);
  });
});

Deno.test("_getRetryOption", async (t) => {
  await t.step("returns default value when options is undefined", () => {
    assertEquals(_getRetryOption("interval", 0, undefined), _DEFAULT.interval);
    assertEquals(_getRetryOption("maxInterval", 0, undefined), _DEFAULT.maxInterval);
    assertEquals(_getRetryOption("maxAttempts", 0, undefined), _DEFAULT.maxAttempts);
    assertEquals(_getRetryOption("retryAfter", false, undefined), _DEFAULT.retryAfter);
  });

  await t.step("returns off value when options is false", () => {
    assertEquals(_getRetryOption("interval", 0, false), 0);
    assertEquals(_getRetryOption("maxInterval", 99, false), 99);
    assertEquals(_getRetryOption("retryAfter", false, false), false);
  });

  await t.step("returns provided value when valid", () => {
    assertEquals(_getRetryOption("interval", 0, { interval: 5 }), 5);
    assertEquals(_getRetryOption("maxAttempts", 0, { maxAttempts: 10 }), 10);
    assertEquals(_getRetryOption("retryAfter", false, { retryAfter: false }), false);
  });

  await t.step("returns default when property is undefined", () => {
    assertEquals(_getRetryOption("interval", 0, {}), _DEFAULT.interval);
    assertEquals(_getRetryOption("maxInterval", 0, {}), _DEFAULT.maxInterval);
  });

  await t.step("corrects negative numbers", () => {
    assertEquals(_getRetryOption("interval", 0, { interval: -5 }), _DEFAULT.interval);
    assertEquals(_getRetryOption("maxAttempts", 0, { maxAttempts: -1 }), _DEFAULT.maxAttempts);
  });
});

Deno.test("_getOptions", async (t) => {
  await t.step("returns default options when no options provided", () => {
    const opts = _getOptions(undefined);
    assertEquals(opts.timeout, _DEFAULT.timeout);
    assertEquals(opts.delay, _DEFAULT.delay);
    assertEquals(opts.interval, _DEFAULT.interval);
    assertEquals(opts.maxInterval, _DEFAULT.maxInterval);
    assertEquals(opts.maxAttempts, _DEFAULT.maxAttempts);
    assertEquals(opts.retryAfter, _DEFAULT.retryAfter);
    assertEquals(opts.onStatus, _DEFAULT.onStatus);
    assertEquals(opts.redirect, _DEFAULT.redirect);
  });

  await t.step("overrides timeout", () => {
    const opts = _getOptions({ timeout: 30 });
    assertEquals(opts.timeout, 30);
  });

  await t.step("overrides delay", () => {
    const opts = _getOptions({ delay: 5 });
    assertEquals(opts.delay, 5);
  });

  await t.step("overrides retry options", () => {
    const opts = _getOptions({
      retry: { interval: 5, maxInterval: 60, maxAttempts: 10, retryAfter: false },
    });
    assertEquals(opts.interval, 5);
    assertEquals(opts.maxInterval, 60);
    assertEquals(opts.maxAttempts, 10);
    assertEquals(opts.retryAfter, false);
  });

  await t.step("disables retry when retry is false", () => {
    const opts = _getOptions({ retry: false });
    assertEquals(opts.interval, 0);
    assertEquals(opts.maxInterval, 0);
    assertEquals(opts.maxAttempts, 0);
    assertEquals(opts.retryAfter, false);
  });

  await t.step("enables onStatus with onError option", () => {
    const opts = _getOptions({ onError: { onStatus: true } });
    assertEquals(opts.onStatus, true);
  });
});

Deno.test("_isJSONObject", async (t) => {
  await t.step("returns true for null", () => {
    assertEquals(_isJSONObject(null), true);
  });

  await t.step("returns true for number", () => {
    assertEquals(_isJSONObject(123), true);
    assertEquals(_isJSONObject(0), true);
  });

  await t.step("returns true for boolean", () => {
    assertEquals(_isJSONObject(true), true);
    assertEquals(_isJSONObject(false), true);
  });

  await t.step("returns true for array", () => {
    assertEquals(_isJSONObject([]), true);
    assertEquals(_isJSONObject([1, 2, 3]), true);
  });

  await t.step("returns true for plain object", () => {
    assertEquals(_isJSONObject({}), true);
    assertEquals(_isJSONObject({ key: "value" }), true);
  });

  await t.step("returns false for string", () => {
    assertEquals(_isJSONObject("text"), false);
  });

  await t.step("returns false for undefined", () => {
    assertEquals(_isJSONObject(undefined), false);
  });

  await t.step("returns false for FormData", () => {
    assertEquals(_isJSONObject(new FormData()), false);
  });

  await t.step("returns false for URLSearchParams", () => {
    assertEquals(_isJSONObject(new URLSearchParams()), false);
  });
});

Deno.test("_getBody", async (t) => {
  await t.step("returns JSON string for JSON object", () => {
    assertEquals(_getBody({ key: "value" }), '{"key":"value"}');
    assertEquals(_getBody([1, 2, 3]), "[1,2,3]");
    assertEquals(_getBody(null), "null");
    assertEquals(_getBody(true), "true");
    assertEquals(_getBody(123), "123");
  });

  await t.step("returns body as-is for non-JSON", () => {
    const formData = new FormData();
    assertStrictEquals(_getBody(formData), formData);

    const params = new URLSearchParams();
    assertStrictEquals(_getBody(params), params);

    const text = "plain text";
    assertStrictEquals(_getBody(text), text);

    const blob = new Blob(["data"]);
    assertStrictEquals(_getBody(blob), blob);
  });
});

Deno.test("_getContentType", async (t) => {
  await t.step("undefined body", () => {
    assertEquals(_getContentType(undefined), undefined);
  });

  await t.step("FormData body", () => { // fetch will be set `multipart/form-data; boundary=`
    assertEquals(_getContentType(new FormData()), undefined);
  });

  await t.step("string body", () => { // fetch will be set `text/plain;charset=UTF-8`
    assertEquals(_getContentType("text"), undefined);
  });

  await t.step("URLSearchParams body", () => { // fetch will be set `application/x-www-form-urlencoded;charset=UTF-8`
    assertEquals(_getContentType(new URLSearchParams()), undefined);
  });

  await t.step("JSON object body", () => {
    assertEquals(_getContentType({ key: "value" }), "application/json");
    assertEquals(_getContentType([1, 2, 3]), "application/json");
    assertEquals(_getContentType(null), "application/json");
    assertEquals(_getContentType(true), "application/json");
    assertEquals(_getContentType(123), "application/json");
  });

  await t.step("Blob body", () => { // fetch will be set it's type, if exists
    assertEquals(_getContentType(new Blob(["data"])), "application/octet-stream");
    assertEquals(_getContentType(new Blob(["data"], { type: "image/avif" })), undefined);
  });

  await t.step("ArrayBuffer body", () => {
    assertEquals(_getContentType(new ArrayBuffer(8)), "application/octet-stream");
  });
});

Deno.test("_getHeaders", async (t) => {
  const defaultAccept = "application/json, text/plain";
  await t.step("default headers", () => {
    const headers = Object.fromEntries(_getHeaders(undefined).entries());
    const expected = {
      "accept": defaultAccept,
    };
    assertEquals(headers, expected);
  });

  await t.step("adds Content-Type for body", () => {
    const headers = Object.fromEntries(_getHeaders({ body: new Uint8Array([1, 2, 3]) }).entries());
    const expected = {
      "accept": defaultAccept,
      "content-type": "application/octet-stream",
    };
    assertEquals(headers, expected);
  });

  await t.step("adds Authorization for bearer", () => {
    const headers = Object.fromEntries(_getHeaders({ bearer: "token123" }).entries());
    const expected = {
      "accept": defaultAccept,
      "authorization": "Bearer token123",
    };
    assertEquals(headers, expected);
  });

  await t.step("merges custom headers", () => {
    const headers = Object.fromEntries(
      _getHeaders({
        headers: { "x-custom": "value" },
      }).entries(),
    );
    const expected = {
      "accept": defaultAccept,
      "x-custom": "value",
    };
    assertEquals(headers, expected);
  });

  await t.step("custom headers override defaults", () => {
    const headers = Object.fromEntries(
      _getHeaders({
        headers: { "Accept": "text/html" },
      }).entries(),
    );
    const expected = {
      "accept": "text/html",
    };
    assertEquals(headers, expected);
  });

  await t.step("all options combined", () => {
    const headers = Object.fromEntries(
      _getHeaders({
        body: { key: "value" },
        bearer: "token123",
        headers: { "X-Custom": "value" },
      }).entries(),
    );
    const expected = {
      "accept": defaultAccept,
      "content-type": "application/json",
      "authorization": "Bearer token123",
      "x-custom": "value",
    };
    assertEquals(headers, expected);
  });
});

Deno.test("_combineSignal", async (t) => {
  await t.step("returns undefined when no signals provided", () => {
    const result = _combineSignal("https://example.com", 0);
    assertEquals(result, undefined);
  });

  await t.step("returns signal from Request object", () => {
    const controller = new AbortController();
    const request = new Request("https://example.com", { signal: controller.signal });
    const result = _combineSignal(request, 0);

    assertExists(result);
    assertEquals(result.aborted, false);

    controller.abort();
    assertEquals(result.aborted, true);
  });

  await t.step("returns signal from options", () => {
    const controller = new AbortController();
    const result = _combineSignal("https://example.com", 0, controller.signal);

    assertExists(result);
    assertEquals(result.aborted, false);

    controller.abort();
    assertEquals(result.aborted, true);
  });

  await t.step("returns timeout signal when timeout is specified", () => {
    const result = _combineSignal("https://example.com", 0.001);

    assertExists(result);
    assertEquals(result.aborted, false);
  });

  await t.step("combines Request signal and options signal", () => {
    const controller1 = new AbortController();
    const controller2 = new AbortController();
    const request = new Request("https://example.com", { signal: controller1.signal });
    const result = _combineSignal(request, 0, controller2.signal);

    assertExists(result);
    assertEquals(result.aborted, false);

    controller1.abort();
    assertEquals(result.aborted, true);
  });

  await t.step("combines all signals including timeout", () => {
    const controller = new AbortController();
    const request = new Request("https://example.com", { signal: controller.signal });
    const result = _combineSignal(request, 1, controller.signal);

    assertExists(result);
    assertEquals(result.aborted, false);

    controller.abort();
    assertEquals(result.aborted, true);
  });

  await t.step("aborts when any signal is aborted", () => {
    const controller1 = new AbortController();
    const controller2 = new AbortController();
    const result = _combineSignal("https://example.com", 0, controller1.signal);

    // Add second signal manually for testing
    const signals = [controller1.signal, controller2.signal];
    const combined = AbortSignal.any(signals);

    assertExists(combined);
    assertEquals(combined.aborted, false);

    controller2.abort();
    assertEquals(combined.aborted, true);
  });

  await t.step("handles already aborted signal", () => {
    const controller = new AbortController();
    controller.abort();
    const result = _combineSignal("https://example.com", 0, controller.signal);

    assertExists(result);
    assertEquals(result.aborted, true);
  });

  await t.step("ignores null signal", () => {
    const result = _combineSignal("https://example.com", 0, null);
    assertEquals(result, undefined);
  });

  await t.step("handles URL object as input", () => {
    const controller = new AbortController();
    const url = new URL("https://example.com");
    const result = _combineSignal(url, 0, controller.signal);

    assertExists(result);
    assertEquals(result.aborted, false);
  });

  await t.step("applies timeout with +1ms buffer", async () => {
    const startTime = Date.now();
    const result = _combineSignal("https://example.com", 0.05); // 50ms + 1ms

    assertExists(result);

    await new Promise((resolve) => {
      result.addEventListener("abort", resolve);
    });

    const elapsed = Date.now() - startTime;
    // Should abort around 51ms, allow some tolerance
    assertEquals(elapsed >= 50 && elapsed < 100, true);
  });

  await t.step("handles zero timeout", () => {
    const result = _combineSignal("https://example.com", 0);
    assertEquals(result, undefined);
  });

  await t.step("handles negative timeout", () => {
    const result = _combineSignal("https://example.com", -1);
    assertEquals(result, undefined);
  });
});

Deno.test("_getRequestInit", async (t) => {
  await t.step("default GET request", () => {
    const init = _getRequestInit("", _DEFAULT, undefined);
    assertEquals(init.method, "GET");
    assertEquals(init.headers instanceof Headers, true);
    const headers = Object.fromEntries((init.headers as Headers).entries());
    assertEquals(headers, {
      "accept": "application/json, text/plain",
    });
    assertExists(init.signal);
    assertEquals(init.body, undefined);
  });

  await t.step("POST request with body", () => {
    const init = _getRequestInit("", _DEFAULT, { body: "text" });
    assertEquals(init.method, "POST");
    assertEquals(init.body, "text");
  });

  await t.step("method of Request obj is respected", () => {
    const req = new Request("https://example.com", { method: "PUT" });
    const init = _getRequestInit(req, _DEFAULT, { body: "text" });
    assertEquals(init.method, "PUT");
    assertEquals(init.body, "text");
  });

  await t.step("method of option is most respected", () => {
    const req = new Request("https://example.com", { method: "PUT" });
    const init = _getRequestInit(req, _DEFAULT, { method: "POST", body: "text" });
    assertEquals(init.method, "POST");
    assertEquals(init.body, "text");
  });

  await t.step("no abort signal if no-provided and no-timeout", () => {
    const opts = {
      ..._DEFAULT,
      timeout: 0,
    };
    const init = _getRequestInit("", opts, undefined);
    assertEquals(init.signal, undefined);
  });

  await t.step("includes abort signal when provided by options", () => {
    const controller = new AbortController();
    const opts = {
      ..._DEFAULT,
      timeout: 0,
    };
    const init = _getRequestInit("", opts, { signal: controller.signal });
    controller.abort();
    assertEquals(init.signal?.aborted, true);
  });

  await t.step("includes abort signal when provided by request", () => {
    const controller = new AbortController();
    const req = new Request("https://example.com", { signal: controller.signal });
    const opts = {
      ..._DEFAULT,
      timeout: 0,
    };
    const init = _getRequestInit(req, opts, undefined);
    controller.abort();
    assertEquals(init.signal?.aborted, true);
  });

  await t.step("includes abort signal when set timeout", async () => {
    const opts = {
      ..._DEFAULT,
      timeout: 1,
    };
    const init = _getRequestInit("", opts, undefined);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    assertEquals(init.signal?.aborted, true);
  });

  await t.step("includes additional options", () => {
    const init = _getRequestInit("", _DEFAULT, { mode: "cors", credentials: "include" });
    assertEquals(init.mode, "cors");
    assertEquals(init.credentials, "include");
  });

  await t.step("body is processed correctly", () => {
    const init = _getRequestInit("", _DEFAULT, { body: { key: "value" } });
    assertEquals(init.body, '{"key":"value"}');
  });

  await t.step("converts redirect error to manual", () => {
    const init = _getRequestInit("", _DEFAULT, { redirect: "error" });
    assertEquals(init.redirect, "manual");
  });
});

Deno.test("_wait", async (t) => {
  await t.step("wait for random positive seconds", async () => {
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      await _wait(0.05); // 50ms maxAttempts
      const elapsed = Date.now() - start;
      assertEquals(elapsed >= 0, true);
      assertEquals(elapsed <= 55, true); // Should be less than 100ms
    }
  });

  await t.step("wait for exact positive seconds", async () => {
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      await _wait(0.05, false); // 50ms maxAttempts
      const elapsed = Date.now() - start;
      assertEquals(elapsed >= 50, true);
      assertEquals(elapsed <= 55, true); // Should be less than 100ms
    }
  });

  await t.step("does not wait for zero seconds", async () => {
    const start = Date.now();
    await _wait(0);
    const elapsed = Date.now() - start;
    assertEquals(elapsed < 5, true);
  });

  await t.step("does not wait for negative seconds", async () => {
    const start = Date.now();
    await _wait(-5);
    const elapsed = Date.now() - start;
    assertEquals(elapsed < 5, true);
  });
});

Deno.test("_parseRetryAfter", async (t) => {
  await t.step("empty string returns Infinity", () => {
    assertEquals(_parseRetryAfter(""), Infinity);
  });

  await t.step("valid integer seconds", () => {
    assertEquals(_parseRetryAfter("60"), 60);
    assertEquals(_parseRetryAfter("0"), 0);
    assertEquals(_parseRetryAfter("120"), 120);
  });

  await t.step("valid date string", () => {
    const future = new Date(Date.now() + 60000).toUTCString();
    const result = _parseRetryAfter(future);
    assertEquals(result >= 59, true);
    assertEquals(result <= 61, true);
  });

  await t.step("invalid date returns Infinity", () => {
    assertEquals(_parseRetryAfter("invalid-date"), Infinity);
  });

  await t.step("past date returns negative or zero", () => {
    const past = new Date(Date.now() - 60000).toUTCString();
    const result = _parseRetryAfter(past);
    assertEquals(result <= 0, true);
  });
});

Deno.test("_shouldRedirect", async (t) => {
  await t.step("returns true when status range is 300-399", () => {
    const resp1 = new Response("", { status: 301 });
    assertEquals(_shouldRedirect(resp1), true);
    const resp2 = new Response("", { status: 389 });
    assertEquals(_shouldRedirect(resp2), true);
  });

  await t.step("returns false when status is others", () => {
    const resp1 = new Response("", { status: 200 });
    assertEquals(_shouldRedirect(resp1), false);
    const resp2 = new Response("", { status: 400 });
    assertEquals(_shouldRedirect(resp2), false);
  });
});

Deno.test("_handleRedirectResponse", async (t) => {
  const init = { method: "POST" };
  const redirect = "https://redirect.com";
  const urlstr = "https://example.com";
  await t.step("returns original URL when no redirected", () => {
    const resp = new Response("", { status: 200 });
    assertEquals(_handleRedirectResponse(urlstr, init, resp), urlstr);
  });

  await t.step("overwrite init method to GET when response status is 303", () => {
    const init = { method: "POST" };
    const resp = new MockResponse(true, redirect, "", { status: 303 });
    _handleRedirectResponse(urlstr, init, resp);
    assertEquals(init.method, "GET");
  });

  await t.step("returns string url when redirected for string url", () => {
    const resp = new MockResponse(true, redirect);
    assertEquals(_handleRedirectResponse(urlstr, init, resp), redirect);
  });

  await t.step("returns string url when redirected for URL object", () => {
    const resp = new MockResponse(true, redirect);
    const url = new URL(urlstr);
    assertEquals(_handleRedirectResponse(url, init, resp), redirect);
  });

  await t.step("returns new Request with response url for Request input", () => {
    const resp = new MockResponse(true, redirect);
    const req = new Request(urlstr);
    const result = _handleRedirectResponse(req, init, resp);
    assertEquals(result instanceof Request, true);
    assertEquals((result as Request).url.startsWith(resp.url), true); // ends with slash, or not
  });

  await t.step("preserves Request properties when redirecting", () => {
    const resp = new MockResponse(true, redirect);
    const req = new Request(urlstr, {
      method: "POST",
      headers: { "X-Custom": "value" },
    });
    const result = _handleRedirectResponse(req, init, resp) as Request;
    assertEquals(result.method, "POST");
    assertEquals(result.headers.get("X-Custom"), "value");
  });
});

Deno.test("_getNextInterval", async (t) => {
  await t.step("returns false and waits for exponential backoff", () => {
    const opts = {
      ..._DEFAULT,
      interval: 3,
      maxAttempts: 5,
      retryAfter: false,
    };
    const interval = _getNextInterval(3, opts);
    assertEquals(interval === 27, true);
  });

  await t.step("uses Retry-After header when retryAfter is true", () => {
    const opts = {
      ..._DEFAULT,
      interval: 3,
      maxAttempts: 5,
    };
    const resp = new Response("", {
      status: 429,
      headers: { "Retry-After": "20" },
    });
    const interval = _getNextInterval(1, opts, resp);
    assertEquals(interval === 20, true);
  });

  await t.step("uses interval if Retry-After header is smaller than interval when retryAfter is true", () => {
    const opts = {
      ..._DEFAULT,
      interval: 3,
      maxInterval: 30,
      maxAttempts: 5,
    };
    const resp = new Response("", {
      status: 429,
      headers: { "Retry-After": "1" },
    });
    const interval = _getNextInterval(1, opts, resp);
    assertEquals(interval === 3, true);
  });

  await t.step("ignores Retry-After header when retryAfter is false", () => {
    const opts = {
      ..._DEFAULT,
      interval: 3,
      maxAttempts: 5,
      retryAfter: false,
    };
    const resp = new Response("", {
      status: 429,
      headers: { "Retry-After": "100" },
    });
    const interval = _getNextInterval(1, opts, resp);
    assertEquals(interval === 3, true); // Uses exponential backoff, not Retry-After
  });
});

Deno.test("_shouldNotRetry", async (t) => {
  await t.step("returns true when count exceeds maxAttempts", async () => {
    const opts = {
      ..._DEFAULT,
      interval: 1,
    };
    assertEquals(await _shouldNotRetry(3, {}, opts), true);
    assertEquals(await _shouldNotRetry(4, {}, opts), true);
  });

  await t.step("returns false and waits for exponential backoff", async () => {
    const opts = {
      ..._DEFAULT,
      interval: 1.2,
      maxAttempts: 5,
      retryAfter: false,
    };
    const start = Date.now();
    const result = await _shouldNotRetry(2, {}, opts); // 50ms maxAttempts
    const elapsed = Date.now() - start;
    assertEquals(result, false);
    assertEquals(elapsed > 1400, true);
    assertEquals(elapsed <= 1500, true);
  });

  await t.step("returns true when response is ok", async () => {
    const resp = new Response("", { status: 200 });
    assertEquals(await _shouldNotRetry(1, {}, _DEFAULT, resp), true);
  });

  await t.step("returns true when signal is aborted", async () => {
    const controller = new AbortController();
    const init = { signal: controller.signal };
    controller.abort();
    assertEquals(await _shouldNotRetry(1, init, _DEFAULT), true);
  });

  await t.step("returns true when redirect status and redirect is manual", async () => {
    const opts = {
      ..._DEFAULT,
      redirect: "manual" as const,
    };
    const resp = new Response("", { status: 301 });
    assertEquals(await _shouldNotRetry(1, {}, opts, resp), true);
  });

  await t.step("throw RedirectError when redirect status and redirect is error", async () => {
    const opts = {
      ..._DEFAULT,
      redirect: "error" as const,
    };
    const resp = new Response("", { status: 301 });
    await assertRejects(() => _shouldNotRetry(1, {}, opts, resp), RedirectError);
  });

  await t.step("returns true when interval exceeds maxInterval", async () => {
    const opts = {
      ..._DEFAULT,
      interval: 5,
      maxInterval: 10,
      maxAttempts: 5,
    };
    const resp = new Response("", { status: 500 });
    assertEquals(await _shouldNotRetry(3, {}, opts, resp), true);
  });

  await t.step("stops retry when Retry-After exceeds maxInterval", async () => {
    const opts = {
      ..._DEFAULT,
      interval: 1,
      maxInterval: 5,
      maxAttempts: 5,
    };
    const resp = new Response("", {
      status: 429,
      headers: { "Retry-After": "10" },
    });
    assertEquals(await _shouldNotRetry(1, {}, opts, resp), true);
  });

  await t.step("handles invalid Retry-After header", async () => {
    const opts = {
      ..._DEFAULT,
      interval: 1,
      maxInterval: 5,
      maxAttempts: 5,
    };
    const resp = new Response("", {
      status: 429,
      headers: { "Retry-After": "invalid" },
    });
    assertEquals(await _shouldNotRetry(1, {}, opts, resp), true);
  });
});

Deno.test("_cloneInput", async (t) => {
  await t.step("returns string input as-is when required is false", () => {
    const url = "https://example.com";
    const result = _cloneInput(url, false);
    assertEquals(result, url);
  });

  await t.step("returns string input as-is when required is true", () => {
    const url = "https://example.com";
    const result = _cloneInput(url, true);
    assertEquals(result, url);
  });

  await t.step("returns URL object as-is when required is false", () => {
    const url = new URL("https://example.com");
    const result = _cloneInput(url, false);
    assertStrictEquals(result, url);
  });

  await t.step("returns URL object as-is when required is true", () => {
    const url = new URL("https://example.com");
    const result = _cloneInput(url, true);
    assertStrictEquals(result, url);
  });

  await t.step("returns Request as-is when required is false", () => {
    const request = new Request("https://example.com");
    const result = _cloneInput(request, false);
    assertStrictEquals(result, request);
  });

  await t.step("clones Request when required is true", () => {
    const request = new Request("https://example.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: "data" }),
    });
    const result = _cloneInput(request, true);

    assertInstanceOf(result, Request);
    assertNotStrictEquals(result, request);

    if (result instanceof Request) {
      assertEquals(result.url, request.url);
      assertEquals(result.method, request.method);
      assertEquals(result.headers.get("Content-Type"), "application/json");
    }
  });

  await t.step("cloned Request is independent from original", async () => {
    const request = new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ test: "data" }),
    });
    const cloned = _cloneInput(request, true);

    assertInstanceOf(cloned, Request);

    // Read body from cloned request
    if (cloned instanceof Request) {
      await cloned.text();
      assertEquals(cloned.bodyUsed, true);
    }

    // Original request body should still be readable
    assertEquals(request.bodyUsed, false);
    const originalBody = await request.text();
    assertEquals(originalBody, JSON.stringify({ test: "data" }));
  });

  await t.step("handles Request without body", () => {
    const request = new Request("https://example.com");
    const result = _cloneInput(request, true);

    assertInstanceOf(result, Request);
    assertNotStrictEquals(result, request);

    if (result instanceof Request) {
      assertEquals(result.url, request.url);
      assertEquals(result.bodyUsed, false);
    }
  });

  await t.step("preserves Request headers when cloning", () => {
    const request = new Request("https://example.com", {
      headers: {
        "Authorization": "Bearer token123",
        "X-Custom-Header": "custom-value",
      },
    });
    const result = _cloneInput(request, true);

    if (result instanceof Request) {
      assertEquals(result.headers.get("Authorization"), "Bearer token123");
      assertEquals(result.headers.get("X-Custom-Header"), "custom-value");
    }
  });
});

Deno.test("_fetchWithJitter", async (t) => {
  await t.step("adds delay delay before fetch", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("ok", { status: 200 })),
    );

    try {
      const opts = {
        ..._DEFAULT,
        delay: 0.05, // Max 50ms
        interval: 1,
        abort: new AbortController(),
      };
      const start = Date.now();
      const resp = await _fetchWithJitter("https://example.com", {}, opts);
      const elapsed = Date.now() - start;
      assertEquals(resp.status, 200);
      assertEquals(elapsed < 100, true);
    } finally {
      mockFetch.restore();
    }
  });

  await t.step("delay of 0 has no delay", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("ok", { status: 200 })),
    );

    try {
      const opts = {
        ..._DEFAULT,
        interval: 1,
        abort: new AbortController(),
      };
      const start = Date.now();
      await _fetchWithJitter("https://example.com", {}, opts);
      const elapsed = Date.now() - start;
      assertEquals(elapsed < 20, true);
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
      const opts = {
        ..._DEFAULT,
        interval: 0.01,
        abort: new AbortController(),
      };
      const resp = await _fetchWithRetry("https://example.com", {}, opts);
      assertEquals(resp.status, 200);
      assertSpyCalls(mockFetch, 1);
    } finally {
      mockFetch.restore();
    }
  });
  await t.step("retries on failure", async () => {
    let attempts = 0;
    const mockFetch = stub(globalThis, "fetch", () => {
      attempts++;
      if (attempts < 3) {
        return Promise.resolve(new Response("error", { status: 500 }));
      }
      return Promise.resolve(new Response("ok", { status: 200 }));
    });
    try {
      const opts = {
        ..._DEFAULT,
        interval: 0.01,
        retryAfter: false,
        abort: new AbortController(),
      };
      const resp = await _fetchWithRetry("https://example.com", {}, opts);
      assertEquals(resp.status, 200);
      assertEquals(attempts, 3);
    } finally {
      mockFetch.restore();
    }
  });
  await t.step("throws after maxAttempts retries", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.reject(new Error("Network error")),
    );
    try {
      const opts = {
        ..._DEFAULT,
        interval: 0.01,
        retryAfter: false,
        abort: new AbortController(),
      };
      await assertRejects(
        () => _fetchWithRetry("https://example.com", {}, opts),
        Error,
        "Network error",
      );
      assertSpyCalls(mockFetch, 3);
    } finally {
      mockFetch.restore();
    }
  });
  await t.step("no retry when maxAttempts is 0", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("ok", { status: 200 })),
    );
    try {
      const opts = {
        ..._DEFAULT,
        interval: 0.01,
        maxAttempts: 0,
        retryAfter: false,
        abort: new AbortController(),
      };
      const resp = await _fetchWithRetry("https://example.com", {}, opts);
      assertEquals(resp.status, 200);
      assertSpyCalls(mockFetch, 1);
    } finally {
      mockFetch.restore();
    }
  });
  await t.step("uses delay when configured", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("ok", { status: 200 })),
    );
    try {
      const opts = {
        ..._DEFAULT,
        delay: 0.01,
        interval: 0.01,
        maxAttempts: 1,
        retryAfter: false,
        abort: new AbortController(),
      };
      const start = Date.now();
      await _fetchWithRetry("https://example.com", {}, opts);
      const elapsed = Date.now() - start;
      assertEquals(elapsed < 50, true);
    } finally {
      mockFetch.restore();
    }
  });
  await t.step("throw error redirect on when the option is error", async () => {
    const mockFetch = stub(globalThis, "fetch", () => {
      return Promise.resolve(new MockResponse(false, "", "ok", { status: 301, statusText: "Moved Permanently" }));
    });
    try {
      const opts = {
        ..._DEFAULT,
        interval: 0.01,
        retryAfter: false,
        redirect: "error" as const,
        abort: new AbortController(),
      };
      await assertRejects(
        async () => await _fetchWithRetry("https://example.com", { redirect: "manual" }, opts),
        RedirectError,
        "301 Moved Permanently",
      );
    } finally {
      mockFetch.restore();
    }
  });
});
Deno.test("fetchy", async (t) => {
  await t.step("successful GET request", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("ok", { status: 200 })),
    );
    try {
      const resp = await fetchy("https://example.com");
      assertEquals(resp?.status, 200);
      assertEquals(await resp?.text(), "ok");
    } finally {
      mockFetch.restore();
    }
  });
  await t.step("successful GET request with option url", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("ok", { status: 200 })),
    );
    try {
      const options = { url: "https://example.com" };
      const resp = await fetchy(null, options);
      assertEquals(resp?.status, 200);
      assertEquals(await resp?.text(), "ok");
    } finally {
      mockFetch.restore();
    }
  });
  await t.step("throws Error url is null and no option url", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("ok", { status: 200 })),
    );
    try {
      await assertRejects(() => fetchy(null), Error, "Invalid URL");
    } finally {
      mockFetch.restore();
    }
  });
  await t.step("successful POST request with body", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("ok", { status: 200 })),
    );
    try {
      const resp = await fetchy("https://example.com", { body: { key: "value" } });
      assertEquals(resp?.status, 200);

      assertSpyCalls(mockFetch, 1);

      const [url, init] = mockFetch.calls[0].args;

      assertEquals(url, "https://example.com");
      assertEquals(init?.method, "POST");
      assertEquals(init?.body, '{"key":"value"}');
      assertEquals(init?.signal instanceof AbortSignal, true);
      const headers = new Headers(init?.headers);
      assertEquals(headers.get("accept"), "application/json, text/plain");
      assertEquals(headers.get("content-type"), "application/json");
    } finally {
      mockFetch.restore();
    }
  });
  await t.step("throws HTTPStatusError on error status", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("Not Found", { status: 404, statusText: "Not Found" })),
    );
    try {
      await assertRejects(
        () => fetchy("https://example.com", { onError: { onStatus: true }, retry: false }),
        HTTPStatusError,
        "404 Not Found: Not Found",
      );
    } finally {
      mockFetch.restore();
    }
  });
  await t.step("returns null on error when onError is false", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.reject(new Error("Network error")),
    );
    try {
      const resp = await fetchy("https://example.com", { onError: false, retry: false });
      assertEquals(resp, null);
    } finally {
      mockFetch.restore();
    }
  });
  await t.step("throws error when onError is true", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.reject(new Error("Network error")),
    );
    try {
      await assertRejects(
        () => fetchy("https://example.com", { onError: true, retry: false }),
        Error,
        "Network error",
      );
    } finally {
      mockFetch.restore();
    }
  });
  await t.step("works with URL object", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("ok", { status: 200 })),
    );
    try {
      const url = new URL("https://example.com");
      const resp = await fetchy(url);
      assertEquals(resp?.status, 200);
    } finally {
      mockFetch.restore();
    }
  });
  await t.step("works with Request object", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("ok", { status: 200 })),
    );
    try {
      const req = new Request("https://example.com");
      const resp = await fetchy(req);
      assertEquals(resp?.status, 200);
    } finally {
      mockFetch.restore();
    }
  });
  await t.step("uses custom timeout", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      (_input, init) => {
        // Return a promise that respects the abort signal
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => resolve(new Response("ok")), 200);

          if (init?.signal) {
            init.signal.addEventListener("abort", () => {
              clearTimeout(timeoutId);
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          }
        });
      },
    );
    try {
      const resp = await fetchy("https://example.com", { timeout: 0.1, retry: false, onError: false });
      assertEquals(resp, null);
    } finally {
      mockFetch.restore();
    }
  });
  await t.step("uses bearer token", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("ok", { status: 200 })),
    );
    try {
      await fetchy("https://example.com", { bearer: "secret" });

      assertSpyCalls(mockFetch, 1);

      const [url, init] = mockFetch.calls[0].args;

      assertEquals(url, "https://example.com");
      assertEquals(init?.method, "GET");
      assertEquals(init?.signal instanceof AbortSignal, true);
      const headers = new Headers(init?.headers);
      assertEquals(headers.get("accept"), "application/json, text/plain");
      assertEquals(headers.get("authorization"), "Bearer secret");
    } finally {
      mockFetch.restore();
    }
  });
});
Deno.test("fetchyb", async (t) => {
  await t.step("parses text response", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () =>
        Promise.resolve(
          new Response("Hello", {
            status: 200,
            headers: { "Content-Type": "text/plain" },
          }),
        ),
    );
    try {
      const result = await fetchyb("https://example.com", "text");
      assertEquals(result, "Hello");
    } finally {
      mockFetch.restore();
    }
  });
  await t.step("parses JSON response", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () =>
        Promise.resolve(
          new Response('{"key":"value"}', {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
    );
    try {
      const result = await fetchyb<{ key: string }>("https://example.com", "json");
      assertEquals(result, { key: "value" });
    } finally {
      mockFetch.restore();
    }
  });
  await t.step("parses bytes response", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () =>
        Promise.resolve(
          new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
          }),
        ),
    );
    try {
      const result = await fetchyb("https://example.com", "bytes");
      assertEquals(result, new Uint8Array([1, 2, 3]));
    } finally {
      mockFetch.restore();
    }
  });
  await t.step("auto-detects text response", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () =>
        Promise.resolve(
          new Response("Hello", {
            status: 200,
            headers: { "Content-Type": "text/html" },
          }),
        ),
    );
    try {
      const result = await fetchyb("https://example.com", "auto");
      assertEquals(result, "Hello");
    } finally {
      mockFetch.restore();
    }
  });
  await t.step("auto-detects JSON response", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () =>
        Promise.resolve(
          new Response('{"key":"value"}', {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
    );
    try {
      const result = await fetchyb<{ key: string }>("https://example.com", "auto");
      assertEquals(result, { key: "value" });
    } finally {
      mockFetch.restore();
    }
  });
  await t.step("auto-detects bytes response", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () =>
        Promise.resolve(
          new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: { "Content-Type": "application/octet-stream" },
          }),
        ),
    );
    try {
      const result = await fetchyb("https://example.com", "auto");
      assertEquals(result, new Uint8Array([1, 2, 3]));
    } finally {
      mockFetch.restore();
    }
  });
  await t.step("returns null on non-ok response", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(new Response("Error", { status: 404 })),
    );
    try {
      const result = await fetchyb("https://example.com", "text", { retry: false });
      assertEquals(result, null);
    } finally {
      mockFetch.restore();
    }
  });
  await t.step("returns null on parse error", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () =>
        Promise.resolve(
          new Response("invalid json", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
    );
    try {
      const result = await fetchyb("https://example.com", "json", { onError: false });
      assertEquals(result, null);
    } finally {
      mockFetch.restore();
    }
  });
  await t.step("throws on parse error when onError is true", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () =>
        Promise.resolve(
          new Response("invalid json", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
    );
    try {
      await assertRejects(
        () => fetchyb("https://example.com", "json", { onError: true }),
        SyntaxError,
      );
    } finally {
      mockFetch.restore();
    }
  });
  await t.step("returns null when fetchy returns null", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () => Promise.reject(new Error("Network error")),
    );
    try {
      const result = await fetchyb("https://example.com", "text", {
        onError: false,
        retry: false,
      });
      assertEquals(result, null);
    } finally {
      mockFetch.restore();
    }
  });
  await t.step("uses default auto type", async () => {
    const mockFetch = stub(
      globalThis,
      "fetch",
      () =>
        Promise.resolve(
          new Response("Hello", {
            status: 200,
            headers: { "Content-Type": "text/plain" },
          }),
        ),
    );
    try {
      const result = await fetchyb("https://example.com");
      assertEquals(result, "Hello");
    } finally {
      mockFetch.restore();
    }
  });
});
