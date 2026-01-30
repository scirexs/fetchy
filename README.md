# fetchy

[![npm version](https://img.shields.io/npm/v/@scirexs/fetchy)](https://www.npmjs.com/package/@scirexs/fetchy)
[![JSR](https://img.shields.io/jsr/v/@scirexs/fetchy)](https://jsr.io/@scirexs/fetchy)
[![license](https://img.shields.io/github/license/scirexs/fetchy)](https://github.com/scirexs/fetchy/blob/main/LICENSE)
[![size](https://deno.bundlejs.com/badge?q=@scirexs/fetchy)](https://bundlejs.com/?q=@scirexs/fetchy)

A lightweight thin fetch wrapper with built-in retry logic, timeout handling, and automatic body parsing. Works in Deno, Node.js, and modern browsers.

## Features

- **Simple API** - Drop-in replacement for native fetch with enhanced capabilities
- **Lightweight** - Bundle size is ~5KB uncompressed, ~2KB gzipped, zero dependencies
- **Native Fetch Compatible** - Thin abstraction layer, easy migration back to native fetch
- **Promise-like Interface** - Chain parsing methods directly on fetch results
- **Timeout Support** - Configurable request timeouts with automatic cancellation
- **Retry Logic** - Exponential backoff with Retry-After header support
- **Type-Safe** - Full TypeScript support with generic type inference
- **Bearer Token Helper** - Built-in Authorization header management
- **Jitter Support** - Prevent thundering herd with randomized delays
- **Fluent Interface** - Class-based API with both instance and static methods
- **HTTP Method Shortcuts** - Convenient methods for GET, POST, PUT, PATCH, DELETE

## Installation
```bash
# npm
npm install @scirexs/fetchy

# JSR (Deno)
deno add jsr:@scirexs/fetchy
```

## Quick Start
```ts
import { fetchy, sfetchy, fy } from "@scirexs/fetchy";

// Simple GET request with automatic JSON parsing
const user = await fetchy("https://api.example.com/user/1").json<User>();

// Safe error handling - returns null on failure
const data = await sfetchy("https://api.example.com/data").json<Data>();
if (data !== null) {
  console.log(data);
}

// Fluent API with reusable configuration
const client = fy({
  bearer: "token",
  timeout: 10,
  retry: { maxAttempts: 5 }
});
const posts = await client.get("/posts").json<Post[]>();
```

## API Reference

### `fetchy(url?, options?)`

Performs an HTTP request with enhanced features. Returns a promise-like object that can be awaited directly or chained with parsing methods.

#### Parameters

- `url`: `string | URL | Request | null` - The request URL (can be null if `options.url` is provided)
- `options`: `FetchyOptions` (optional) - Configuration options

#### Returns

`FetchyResponse` - A promise-like object that extends `Promise<Response>` with the following methods:

- `text()` → `Promise<string>` - Parse response as text
- `json<T>()` → `Promise<T>` - Parse response as JSON
- `bytes()` → `Promise<Uint8Array>` - Parse response as byte array
- `blob()` → `Promise<Blob>` - Parse response as Blob
- `arrayBuffer()` → `Promise<ArrayBuffer>` - Parse response as ArrayBuffer
- `formData()` → `Promise<FormData>` - Parse response as FormData

#### Example
```ts
// Get Response object
const response = await fetchy("https://api.example.com/data");

// Chain JSON parsing
const user = await fetchy("https://api.example.com/user").json<User>();

// POST with automatic body serialization
const result = await fetchy("https://api.example.com/create", {
  method: "POST",
  body: { name: "John", age: 30 },
  bearer: "token"
}).json();

// Binary data
const image = await fetchy("https://api.example.com/image.png").bytes();
```

### `sfetchy(url?, options?)`

Performs an HTTP request with safe error handling. Returns `null` on any failure instead of throwing.

#### Parameters

Same as `fetchy()`.

#### Returns

`FetchySafeResponse` - A promise-like object that extends `Promise<Response | null>` with the same parsing methods as `FetchyResponse`.

- `text()` → `Promise<string | null>` - Safe text parsing (returns null on error)
- `json<T>()` → `Promise<T | null>` - Safe JSON parsing (returns null on error)
- `bytes()` → `Promise<Uint8Array | null>` - Safe bytes parsing (returns null on error)
- `blob()` → `Promise<Blob | null>` - Safe blob parsing (returns null on error)
- `arrayBuffer()` → `Promise<ArrayBuffer | null>` - Safe buffer parsing (returns null on error)
- `formData()` → `Promise<FormData | null>` - Safe form data parsing (returns null on error)

#### Example
```ts
// Returns null instead of throwing on error
const response = await sfetchy("https://api.example.com/data");
if (response === null) {
  console.log("Request failed gracefully");
} else {
  const data = await response.json();
}

// Safe parsing still available
const data = await sfetchy("https://api.example.com/data").json<Data>();
if (data !== null) {
  // Handle successful response
}
```

### `fy(options?)`

Creates a fluent HTTP client with pre-configured options that provides HTTP method shortcuts.

#### Client Methods
```ts
const client = fy(options);

// Main fetch method
await client.fetch(url?, options?)    // Returns FetchyResponse

// HTTP method shortcuts
await client.get(url?, options?)      // GET request, returns FetchyResponse
await client.post(url?, options?)     // POST request, returns FetchyResponse
await client.put(url?, options?)      // PUT request, returns FetchyResponse
await client.patch(url?, options?)    // PATCH request, returns FetchyResponse
await client.delete(url?, options?)   // DELETE request, returns FetchyResponse
await client.head(url?, options?)     // HEAD request, returns Promise<Response>

// Safe mode methods
await client.sfetch(url?, options?)   // Returns FetchySafeResponse
await client.sget(url?, options?)     // Safe GET, returns FetchySafeResponse
await client.spost(url?, options?)    // Safe POST, returns FetchySafeResponse
await client.sput(url?, options?)     // Safe PUT, returns FetchySafeResponse
await client.spatch(url?, options?)   // Safe PATCH, returns FetchySafeResponse
await client.sdelete(url?, options?)  // Safe DELETE, returns FetchySafeResponse
await client.shead(url?, options?)    // Safe HEAD, returns Promise<Response | null>
```

All methods can be chained with parsing methods:
```ts
await client.get("/users").json<User[]>();
await client.post("/create").json<Result>();
await client.sfetch("/data").text();
```

#### Example
```ts
// Instance usage - reuse configuration
const client = fy({
  base: "https://api.example.com",
  bearer: "token123",
  timeout: 10,
  retry: { maxAttempts: 3 }
});

const user = await client.get("/user").json<User>();
const posts = await client.get("/posts").json<Post[]>();

// POST with body
const result = await client.post("/create", {
  body: { name: "John" }
}).json();

// Safe mode
const data = await client.sget("/data").json<Data>();
if (data !== null) {
  // Handle successful response
}
```

### `setFetchy(options)`

Sets global default options for all fetchy instances.

#### Example
```ts
import { setFetchy, fetchy } from "@scirexs/fetchy";

// Set global defaults
setFetchy({
  timeout: 30,
  retry: { maxAttempts: 5 },
  bearer: "global-token"
});

// All subsequent requests use these defaults
await fetchy("https://api.example.com/data");
```

## Configuration

### `FetchyOptions`
```ts
interface FetchyOptions extends Omit<RequestInit, "body"> {
  // Request URL (allows null url parameter with this option)
  url?: string | URL | Request;
  
  // Base URL prepended to request URL (only for string/URL, not Request)
  base?: string | URL;
  
  // Request body (auto-serializes JSON objects)
  body?: JSONValue | BodyInit;
  
  // Timeout in seconds (default: 15)
  timeout?: number;
  
  // Retry configuration (set to false to disable)
  retry?: RetryOptions | false;
  
  // Bearer token (automatically adds "Bearer " prefix)
  bearer?: string;
  
  // Maximum jitter delay in seconds before request (default: 0)
  jitter?: number;
  
  // Use native fetch error behavior (no HTTPStatusError on 4xx/5xx)
  native?: boolean;
}

interface RetryOptions {
  maxAttempts?: number;       // Maximum retry attempts (default: 3)
  interval?: number;          // Base interval in seconds (default: 3)
  maxInterval?: number;       // Maximum interval cap (default: 30)
  retryOnTimeout?: boolean;   // Retry on timeout (default: true)
  idempotentOnly?: boolean;   // Only retry idempotent methods (default: false)
  statusCodes?: number[];     // Status codes to retry (default: [500, 502, 503, 504, 408, 429])
  respectHeaders?: string[];  // Headers to respect for retry timing
}                             // (default: ["retry-after", "ratelimit-reset", "x-ratelimit-reset"])
```

#### Default Values
```ts
{
  timeout: 15,        // 15 seconds
  jitter: 0,          // No jitter delay
  native: false,      // Throws HTTPStatusError on non-OK status
  retry: {
    maxAttempts: 3,   // 3 retry attempts
    interval: 3,      // 3 seconds base interval
    maxInterval: 30,  // 30 seconds maximum interval
    retryOnTimeout: true,     // Retry on timeout
    idempotentOnly: false,    // Retry all methods
    statusCodes: [500, 502, 503, 504, 408, 429],
    respectHeaders: ["retry-after", "ratelimit-reset", "x-ratelimit-reset"]
  }
}
```

### Automatic Configuration

#### Method

- If body is provided without method: defaults to `"POST"`
- If Request object is passed: uses its method
- Otherwise: defaults to `"GET"`

#### Headers

The following headers are automatically set if not specified:

- **Accept**: `application/json, text/plain`
- **Content-Type**: Automatically determined based on body type:
  - `string`, `URLSearchParams`, `FormData`, `Blob` with type: Not set (native fetch handles it)
  - `JSONValue` (objects, arrays, numbers, booleans): `application/json`
  - `Blob` without type, `ArrayBuffer`: `application/octet-stream`
- **Authorization**: `Bearer ${options.bearer}` if bearer is provided

**Note:** Headers from Request objects are preserved and merged with option headers.

## Error Handling

### HTTPStatusError

Thrown when response status is not OK (4xx, 5xx) unless `native: true` is set.
```ts
import { fetchy, HTTPStatusError } from "@scirexs/fetchy";

try {
  await fetchy("https://api.example.com/data");
} catch (error) {
  if (error instanceof HTTPStatusError) {
    console.error(error.status);    // 404
    console.error(error.response);  // Response object
    console.error(error.message);   // "404 https://api.example.com/data"
  }
}
```

### Native Errors

Other errors (network failures, timeout, abort) are thrown as standard errors:
- `TypeError`: Network error, DNS resolution failure
- `DOMException`: Timeout or abort via AbortSignal

### Safe Error Handling

Use `sfetchy()` or safe methods to return `null` instead of throwing:
```ts
// Safe fetch - returns null on any error
const response = await sfetchy("https://api.example.com/data");
if (response === null) {
  // Handle error gracefully
}

// Safe parsing methods - return null on error
const data = await sfetchy("https://api.example.com/data").json<Data>();
if (data !== null) {
  // Process data
}
```

### Native Mode

Set `native: true` to disable HTTPStatusError and get native fetch behavior:
```ts
const response = await fetchy("https://api.example.com/data", {
  native: true
});
// Returns Response even for 4xx/5xx status codes
if (!response.ok) {
  console.error("Request failed");
}
```

## Compatibility with Native Fetch

Designed for easy migration back to native `fetch` if needed, minimizing maintenance risk.
```ts
// If this library is discontinued, simply delete these declarations
// to fall back to native fetch with minimal code changes.
// import { fetchy as fetch, setFetchy } from "@scirexs/fetchy";
// setFetchy({ native: true });

const options: RequestInit = { method: "POST", body: "hello" };
const response = await fetch("https://api.example.com/data", options);
```

## Usage Examples

### Basic Requests
```ts
import { fetchy, sfetchy } from "@scirexs/fetchy";

// GET with automatic JSON parsing
const users = await fetchy("https://api.example.com/users").json<User[]>();

// POST with JSON body
const result = await fetchy("https://api.example.com/create", {
  method: "POST",
  body: { name: "John", email: "john@example.com" }
}).json();

// Custom headers
const response = await fetchy("https://api.example.com/data", {
  headers: { "X-Custom-Header": "value" }
});

// Using base URL
const data = await fetchy("/users", {
  base: "https://api.example.com"
}).json();
```

### Authentication
```ts
// Bearer token authentication
const user = await fetchy("https://api.example.com/me", {
  bearer: "your-access-token"
}).json<User>();

// Custom authorization
const data = await fetchy("https://api.example.com/data", {
  headers: { "Authorization": "Basic " + btoa("user:pass") }
}).json();
```

### Timeout and Retry
```ts
// Custom timeout
const response = await fetchy("https://slow-api.example.com", {
  timeout: 30  // 30 seconds
});

// Retry with exponential backoff
// Intervals: 3s, 6s, 12s, 24s (capped at maxInterval)
const data = await fetchy("https://api.example.com/data", {
  retry: {
    maxAttempts: 5,
    interval: 3,
    maxInterval: 60
  }
}).json();

// Retry only idempotent methods (GET, HEAD, PUT, DELETE, OPTIONS, TRACE)
const result = await fetchy("https://api.example.com/update", {
  method: "POST",
  retry: { idempotentOnly: true }  // Won't retry POST
}).json();

// Disable retry
const response = await fetchy("https://api.example.com/data", {
  retry: false
});
```

### Error Handling Patterns
```ts
import { fetchy, sfetchy, HTTPStatusError } from "@scirexs/fetchy";

// Default: throws on error
try {
  const data = await fetchy("https://api.example.com/data").json();
} catch (error) {
  if (error instanceof HTTPStatusError) {
    console.error(`HTTP ${error.status}:`, error.response);
  }
}

// Safe mode: returns null
const data = await sfetchy("https://api.example.com/data").json();
if (data === null) {
  console.log("Request failed, using default");
}

// Native mode: no HTTPStatusError
const response = await fetchy("https://api.example.com/data", {
  native: true
});
if (!response.ok) {
  console.error("Request failed with status", response.status);
}
```

### Fluent API with HTTP Methods
```ts
import { Fetchy, fy } from "@scirexs/fetchy";

// Create reusable client
const api = fy({
  base: "https://api.example.com",
  bearer: "token",
  timeout: 10,
  retry: { maxAttempts: 3 }
});

// HTTP method shortcuts
const users = await api.get("/users").json<User[]>();
const post = await api.get("/posts/1").json<Post>();
const created = await api.post("/posts", {
  body: { title: "New Post" }
}).json();
const updated = await api.put("/posts/1", {
  body: { title: "Updated" }
}).json();
const patched = await api.patch("/posts/1", {
  body: { views: 100 }
}).json();
await api.delete("/posts/1");

// Safe methods
const data = await api.sget("/maybe-fails").json();
if (data !== null) {
  // Process data
}

// Override instance options per request
const text = await api.get("/readme.txt", {
  timeout: 5
}).text();
```

### Advanced Usage

#### Jitter for Load Distribution
```ts
// Add randomized delay to prevent thundering herd
const response = await fetchy("https://api.example.com/data", {
  jitter: 2,  // Random delay up to 2 seconds before each request
  retry: { maxAttempts: 3 }
});
```

#### Abort Signals
```ts
// Manual abort control
const controller = new AbortController();
const promise = fetchy("https://api.example.com/data", {
  signal: controller.signal
});

setTimeout(() => controller.abort(), 5000);

try {
  await promise;
} catch (error) {
  // Aborted after 5 seconds
}

// Combining timeout with manual abort
const controller = new AbortController();
await fetchy("https://api.example.com/data", {
  timeout: 10,
  signal: controller.signal
});
// Request will abort after 10 seconds OR when controller.abort() is called
```

#### Form Data and File Uploads
```ts
// Form data upload
const formData = new FormData();
formData.append("file", blob, "filename.png");
formData.append("name", "example");

await fetchy("https://api.example.com/upload", {
  method: "POST",
  body: formData
});

// URL-encoded form
const params = new URLSearchParams({ key: "value", foo: "bar" });
await fetchy("https://api.example.com/form", {
  method: "POST",
  body: params
});
```

#### Streaming with ReadableStream
```ts
// ReadableStream can be used via Request object
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode("chunk 1\n"));
    controller.enqueue(new TextEncoder().encode("chunk 2\n"));
    controller.close();
  }
});

const response = await fetchy("https://api.example.com/stream", {
  method: "POST",
  body: stream
});
```

#### Retry-After Header Respect
```ts
// Automatically respects Retry-After, RateLimit-Reset, X-RateLimit-Reset headers
const data = await fetchy("https://api.example.com/rate-limited", {
  retry: {
    maxAttempts: 5,
    interval: 1,  // Minimum interval if header not present
    respectHeaders: ["retry-after", "ratelimit-reset", "x-rateLimit-reset", "x-my-retry-after"]
  }
}).json();
// If response has "X-My-Retry-After: 10", will wait 10 seconds before retry
```

### Type-Safe API Responses
```ts
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

interface Todo {
  id: number;
  title: string;
  completed: boolean;
}

const response = await fetchy("https://api.example.com/todos/1")
  .json<ApiResponse<Todo>>();

if (response.success) {
  console.log(response.data.title);  // Fully typed
}

// With safe parsing
const result = await sfetchy("https://api.example.com/todos/1")
  .json<ApiResponse<Todo>>();

if (result !== null && result.success) {
  console.log(result.data.completed);
}
```

## License

MIT
