# fetchy

[![npm version](https://img.shields.io/npm/v/%40scirexs%2Ffetchy)](https://www.npmjs.com/package/@scirexs/fetchy)
[![JSR](https://img.shields.io/jsr/v/%40scirexs/fetchy)](https://jsr.io/@scirexs/fetchy)
[![license](https://img.shields.io/github/license/scirexs/fetchy)](https://github.com/scirexs/fetchy/blob/main/LICENSE)

A lightweight, type-safe fetch wrapper with built-in retry logic, timeout handling, and automatic body parsing.

## Features

- **Lightweight** - Zero dependencies, works in Deno, Node.js, and browsers
- **Simple API** - Drop-in replacement for native fetch with enhanced capabilities
- **Timeout Support** - Configurable request timeouts with automatic cancellation
- **Retry Logic** - Exponential backoff with Retry-After header support
- **Type-Safe** - Full TypeScript support with generic type inference
- **Bearer Token Helper** - Built-in Authorization header management
- **Jitter Support** - Prevent thundering herd with randomized delays
- **Automatic Body Parsing** - Automatic JSON serialization and Content-Type detection
- **Fluent Interface** - Class-based API with both instance and static methods

## Installation

```bash
# npm
npm install @scirexs/fetchy

# JSR (Deno)
deno add jsr:@scirexs/fetchy
```

## Quick Start

```ts
import { fetchy, sfetchy, Fetchy } from "@scirexs/fetchy";

// Simple GET request with timeout and retry
const response = await fetchy("https://api.example.com/data");

// Auto-parsed JSON response with safe error handling
interface User {
  id: number;
  name: string;
}

const user = await sfetchy<User>("https://api.example.com/user/1", { timeout: 10 }, "json");
console.log(user.name);

// Fluent API with reusable configuration
const client = new Fetchy({
  bearer: "token",
  timeout: 10,
  retry: { maxAttempts: 5 }
});
const data = await client.json<User>("https://api.example.com/user/1");
```

## API Reference

### `fetchy(url, options?, parse?)`

Performs an HTTP request with enhanced features. Throws errors on failure by default.

#### Parameters

- `url`: `string | URL | Request | null` - The request URL
- `options`: `FetchyOptions` (optional) - Configuration options
- `parse`: `"json" | "text" | "bytes" | "blob" | "buffer"` (optional) - Response parsing method

#### Returns

- Without `parse`: `Promise<Response>`
- With `parse="json"`: `Promise<T>`
- With `parse="text"`: `Promise<string>`
- With `parse="bytes"`: `Promise<Uint8Array>`
- With `parse="blob"`: `Promise<Blob>`
- With `parse="buffer"`: `Promise<ArrayBuffer>`

#### Example

```ts
// Get Response object
const response = await fetchy("https://api.example.com/data");

// Direct JSON parsing
const user = await fetchy<User>("https://api.example.com/user", {}, "json");

// POST with automatic body serialization
const result = await fetchy("https://api.example.com/create", {
  body: { name: "John", age: 30 },
  bearer: "token"
}, "json");

// Binary data
const image = await fetchy("https://api.example.com/image.png", {}, "bytes");
```

### `sfetchy(url, options?, parse?)`

Performs an HTTP request with safe error handling. Returns `null` on any failure instead of throwing.

#### Parameters

Same as `fetchy()`.

#### Returns

Same as `fetchy()` but with `| null` added to each return type.

#### Example

```ts
// Returns null instead of throwing
const data = await sfetchy("https://api.example.com/data", {}, "json");
if (data === null) {
  console.log("Request failed gracefully");
}

// Safe Response retrieval
const response = await sfetchy("https://api.example.com/data");
if (response?.ok) {
  const json = await response.json();
}
```

### `Fetchy` Class

A fluent HTTP client class that provides both instance and static methods.

#### Instance Methods

```ts
const client = new Fetchy(options);

// Parsing methods
await client.fetch(url?)     // Returns Response
await client.json<T>(url?)   // Returns T
await client.text(url?)      // Returns string
await client.bytes(url?)     // Returns Uint8Array
await client.blob(url?)      // Returns Blob
await client.buffer(url?)    // Returns ArrayBuffer
await client.safe(url?)      // Returns Response | null
await client.sjson<T>(url?)  // Returns T | null
await client.stext(url?)     // Returns string | null
await client.sbytes(url?)    // Returns Uint8Array | null
await client.sblob(url?)     // Returns Blob | null
await client.sbuffer(url?)   // Returns ArrayBuffer | null
```

#### Static Methods

```ts
// Same methods available as static
await Fetchy.fetch(url, options?)
await Fetchy.json<T>(url, options?)
await Fetchy.text(url, options?)
await Fetchy.bytes(url, options?)
await Fetchy.blob(url, options?)
await Fetchy.buffer(url, options?)
await Fetchy.safe(url, options?)
await Fetchy.sjson<T>(url, options?)
await Fetchy.stext(url, options?)
await Fetchy.sbytes(url, options?)
await Fetchy.sblob(url, options?)
await Fetchy.sbuffer(url, options?)
```

#### Example

```ts
// Instance usage - reuse configuration
const client = new Fetchy({
  bearer: "token123",
  timeout: 10,
  retry: { maxAttempts: 3 }
});

const user = await client.json<User>("https://api.example.com/user");
const posts = await client.json<Post[]>("https://api.example.com/posts");

// Static usage - one-off requests
const data = await Fetchy.json("https://api.example.com/data");

// Safe mode
const result = await Fetchy.sjson("https://api.example.com/data");
```

## Configuration

### `FetchyOptions`

```ts
interface FetchyOptions extends Omit<RequestInit, "body"> {
  // Request URL (allows null url parameter with this option)
  url?: string | URL;
  
  // Request body (auto-serializes JSON; ReadableStream is NOT supported)
  body?: JSONValue | FormData | URLSearchParams | Blob | ArrayBuffer | string;
  
  // Timeout in seconds (default: 15, set to 0 to disable)
  timeout?: number;
  
  // Retry configuration (set to false to disable)
  retry?: {
    interval?: number;      // Base interval in seconds (default: 3)
    maxInterval?: number;   // Maximum interval cap (default: 30)
    maxAttempts?: number;   // Maximum retry attempts (default: 3)
    retryAfter?: boolean;   // Respect Retry-After header (default: true)
  } | false;
  
  // Bearer token (automatically adds "Bearer " prefix)
  bearer?: string;
  
  // Initial jitter delay in seconds before request (default: 0)
  delay?: number;
  
  // Use native fetch error behavior (no HTTPStatusError on 4xx/5xx)
  native?: true;
}
```

#### Default Values

```ts
{
  timeout: 15,        // 15 seconds
  delay: 0,           // No jitter delay
  retry: {
    maxAttempts: 3,   // 3 retry attempts
    interval: 3,      // 3 seconds base interval
    maxInterval: 30,  // 30 seconds maximum interval
    retryAfter: true  // Respect Retry-After header
  },
  native: undefined   // Throws HTTPStatusError on non-OK status (4xx, 5xx)
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
  - `JSONValue`: `application/json`
  - `Blob` without type, `ArrayBuffer`: `application/octet-stream`
- **Authorization**: `Bearer ${options.bearer}` if bearer is provided

**Note:** If you pass a body through a Request object, Content-Type is NOT set automatically by this package.

## Error Handling

### HTTPStatusError

Thrown when response status is not OK (4xx, 5xx) unless `native: true` is set.

```ts
try {
  await fetchy("https://api.example.com/data");
} catch (error) {
  if (error instanceof HTTPStatusError) {
    console.error(error.status);   // 404
    console.error(error.body);     // Response body text
    console.error(error.message);  // "404 Not Found: (no response body)"
  }
}
```

### RedirectError

Thrown when `redirect: "error"` is set and a redirect response (3xx) is received.

```ts
try {
  await fetchy("https://example.com/redirect", {
    redirect: "error"
  });
} catch (error) {
  if (error instanceof RedirectError) {
    console.error(error.status);   // 301
    console.error(error.message);  // "301 Moved Permanently"
  }
}
```

### Native Errors

Other errors (network failures, timeout, abort) are thrown as standard errors:
- `TypeError`: Network error, DNS resolution failure
- `DOMException`: Timeout or abort via AbortSignal

### Safe Error Handling

Use `sfetchy()` or `Fetchy.safe()` to return `null` instead of throwing:

```ts
const data = await sfetchy("https://api.example.com/data", {}, "json");
if (data === null) {
  // Handle error gracefully
}
```

### Native Mode

Set `native: true` to disable HTTPStatusError and get native fetch behavior:

```ts
const response = await fetchy("https://api.example.com/data", {
  native: true
});
// Returns Response even for 4xx/5xx status codes
```

## Usage Examples

### Basic Requests

```ts
import { fetchy, sfetchy } from "@scirexs/fetchy";

// GET with automatic JSON parsing
const data = await fetchy<User[]>("https://api.example.com/users", {}, "json");

// POST with JSON body
const result = await fetchy("https://api.example.com/create", {
  body: { name: "John", email: "john@example.com" }
}, "json");

// Custom headers
const response = await fetchy("https://api.example.com/data", {
  headers: { "X-Custom-Header": "value" }
});

// Reuse options as preset configuration
const options: FetchyOptions = {
  url: "https://api.example.com/data",
  retry: false
};
await fetchy(null, options);
await fetchy(null, options);
```

### Authentication

```ts
// Bearer token authentication
const user = await fetchy<User>("https://api.example.com/me", {
  bearer: "your-access-token"
}, "json");

// Custom authorization
const data = await fetchy("https://api.example.com/data", {
  headers: { "Authorization": "Basic " + btoa("user:pass") }
}, "json");
```

### Timeout and Retry

```ts
// Custom timeout
const response = await fetchy("https://slow-api.example.com", {
  timeout: 30  // 30 seconds
});

// Retry with exponential backoff
// Intervals: 1s (3^0), 3s (3^1), 9s (3^2), 27s (3^3), capped at maxInterval
const data = await fetchy("https://api.example.com/data", {
  retry: {
    maxAttempts: 5,
    interval: 3,
    maxInterval: 60,
    retryAfter: true
  }
}, "json");

// Disable retry
const response = await fetchy("https://api.example.com/data", {
  retry: false
});
```

### Error Handling Patterns

```ts
import { fetchy, sfetchy, HTTPStatusError, RedirectError } from "@scirexs/fetchy";

// Default: throws on error
try {
  const data = await fetchy("https://api.example.com/data", {}, "json");
} catch (error) {
  if (error instanceof HTTPStatusError) {
    console.error(`HTTP ${error.status}: ${error.body}`);
  }
}

// Safe mode: returns null
const data = await sfetchy("https://api.example.com/data", {}, "json");
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

### Fluent API

```ts
// Create reusable client
const api = new Fetchy({
  url: "https://api.example.com",
  bearer: "token",
  timeout: 10,
  retry: { maxAttempts: 3 }
});

// Instance methods
const users = await api.json<User[]>("/users");
const post = await api.json<Post>("/posts/1");
const text = await api.text("/readme.txt");

// Safe methods
const data = await api.sjson("/maybe-fails");
if (data !== null) {
  // Process data
}

// Static methods for one-off requests
const response = await Fetchy.fetch("https://example.com");
const json = await Fetchy.json("https://api.example.com/data");
```

### Advanced Usage

#### Jitter and Delays
```ts
// Jitter to prevent thundering herd
const response = await fetchy("https://api.example.com/data", {
  delay: 2,  // Random delay up to 2 seconds
  retry: { maxAttempts: 3 }
});
```

#### Abort Signals
```ts
// Combined abort signals
const controller = new AbortController();
const request = new Request("https://api.example.com/data", {
  signal: controller.signal
});

setTimeout(() => controller.abort(), 5000);

const response = await fetchy(request, {
  signal: AbortSignal.timeout(10000)
});
```

#### Form Data
```ts
// Form data upload
const formData = new FormData();
formData.append("file", blob);
formData.append("name", "example");

await fetchy("https://api.example.com/upload", {
  body: formData
});

// URL-encoded form
const params = new URLSearchParams({ key: "value" });
await fetchy("https://api.example.com/form", {
  body: params
});
```

#### Testing Utilities

When writing tests for code that uses `fetchy`, you may need to simulate immediate failures without triggering retry logic. Use the `NO_RETRY_ERROR` constant to bypass all retry attempts:
```ts
import { fetchy, NO_RETRY_ERROR } from "@scirexs/fetchy";

const originalFetch = globalThis.fetch;
globalThis.fetch = () => Promise.reject(new Error(NO_RETRY_ERROR));

try {
  await fetchy("https://api.example.com/data");
} catch (error) {
  // Error is thrown immediately without retries
  console.error(error);
} finally {
  globalThis.fetch = originalFetch;
}
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

const response = await fetchy<ApiResponse<Todo>>(
  "https://api.example.com/todos/1",
  {},
  "json"
);

if (response.success) {
  console.log(response.data.title);  // Fully typed
}
```

## Limitations

### Content-Type Header with Request Objects

When a body is set in a Request object, the Content-Type header is NOT set automatically by this package. Use the `url` property in `FetchyOptions` instead to benefit from automatic header configuration:

```ts
// Instead of this:
const request = new Request("https://api.example.com", { body: jsonData });
await fetchy(request);

// Do this:
await fetchy(null, {
  url: "https://api.example.com",
  body: jsonData
});
```

### ReadableStream as Body

`FetchyOptions` does not accept ReadableStream as a body. If you need to use ReadableStream, create a Request object with the stream and pass it to `fetchy()`.

### Redirect Error Handling

When `redirect` is set to `"error"`, this package throws a custom `RedirectError` (instead of native TypeError) to enable proper retry handling for redirect responses.

## License

MIT
