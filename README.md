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

## Installation

```bash
# npm
npm install @scirexs/fetchy

# JSR (Deno)
deno add jsr:@scirexs/fetchy
```

## Quick Start

```ts
import { fetchy, fetchyb } from "@scirexs/fetchy";

// Simple GET request with timeout
const response = await fetchy("https://api.example.com/data", {
  timeout: 10
});

// Auto-parsed JSON response
interface User {
  id: number;
  name: string;
}

const user = await fetchyb<User>("https://api.example.com/user/1", "json");
console.log(user?.name);
```

## API Reference

### `fetchy(url, options?)`

Performs an HTTP request and returns the raw Response object.

#### Parameters

- `url`: `string | URL | Request | null` - The request URL
- `options`: `FetchyOptions` (optional) - Configuration options

#### Returns

`Promise<Response>`; If `onError.onNative` is configured as `false`, returns `Promise<Response | null>`

#### Example

```ts
const response = await fetchy("https://api.example.com/data", {
  method: "POST",
  body: { key: "value" },
  timeout: 10,
  retry: { maxAttempts: 3, interval: 2 },
  bearer: "your-token-here"
});

if (response?.ok) {
  const data = await response.json();
}
```

### `fetchyb(url, type?, options?)`

Performs an HTTP request and automatically parses the response body.

#### Parameters

- `url`: `string | URL | Request | null` - The request URL
- `type`: `"text" | "json" | "bytes" | "auto"` (default: `"auto"`) - Response parsing type
- `options`: `FetchyOptions` (optional) - Configuration options

#### Returns

`Promise<T | string | Uint8Array>`; If `onError.onNative` is configured as `false`, returns `Promise<T | string | Uint8Array | null>`

#### Example

```ts
// Automatic type detection from Content-Type header
const data = await fetchyb("https://api.example.com/data");

// Explicit JSON parsing with type assertion
interface Product {
  id: number;
  name: string;
  price: number;
}
const product = await fetchyb<Product>("https://api.example.com/product/1", "json");

// Text content
const html = await fetchyb("https://example.com", "text");

// Binary data
const image = await fetchyb("https://example.com/image.png", "bytes");
```

## Configuration

### API Options

#### `FetchyOptions`

```ts
interface FetchyOptions extends RequestInit {
  // Standard fetch options (method, headers, etc.)
  method?: string;
  headers?: HeadersInit;
  
  // Request body (auto-serializes JSON; ReadableStream is NOT supported)
  // type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };
  body?: JSONValue | FormData | URLSearchParams | Blob | ArrayBuffer | string;
  
  // Timeout in seconds (default: 15)
  timeout?: number;  // Set to 0 to disable timeout
  
  // Retry configuration
  retry?: {
    maxAttempts?: number;  // Maximum retry attempts (default: 3)
    interval?: number;     // Base interval in seconds (default: 3)
    maxInterval?: number;  // Maximum interval cap in seconds (default: 30)
    retryAfter?: boolean;  // Respect Retry-After header (default: true)
  } | false;  // Set to false to disable retry
  
  // Bearer token (automatically adds "Bearer " prefix)
  bearer?: string;
  
  // Error throwing behavior
  onError?: {
    onNative?: boolean;  // Throw on native errors (default: true)
    onStatus?: boolean;  // Throw on 4xx/5xx status (default: false)
  } | boolean;  // Set to true to throw on all errors
  
  // Initial jitter delay in seconds
  delay?: number;

  // URL for fetch (allows reusing FetchyOptions as preset configuration)
  url?: string | URL;
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
  onError: {
    onNative: true,   // Throw native errors
    onStatus: false   // Don't throw on HTTP errors
  },
}
```

### Automatic Configuration

#### Method

If a body is provided without specifying a method, the method defaults to `"POST"`. When a Request object is passed as the `url` argument, its method is used.

#### Headers

The following headers are automatically set if not specified:

- **Accept**: `application/json, text/plain`
- **Content-Type**: Automatically determined based on the body type:
  - `string`, `URLSearchParams`, `FormData`, `Blob` with type: Not set by this package; [`fetch` will set it automatically](https://fetch.spec.whatwg.org/#concept-bodyinit-extract).
  - `JSONValue`: `application/json`
  - `Blob` without type: `application/octet-stream`
  - `ArrayBuffer`: `application/octet-stream` 
- **Authorization**: Set to `Bearer ${options.bearer}` if `options.bearer` is provided.

**Note 1:** If you pass serialized JSON as the body (i.e., a string), Content-Type will be set to `text/plain;charset=UTF-8`. To ensure Content-Type is set to `application/json`, pass the JSON object directly instead of a serialized string.

**Note 2:** If you pass a body through a Request object, Content-Type will NOT be set automatically by this package.

## Error Handling

### Timeout

If the timeout duration specified in the `timeout` option is exceeded, the request is aborted using the standard `AbortSignal.timeout()` method. Note that there is no specific error class for timeout errors; they will be thrown as standard `AbortError`s.

### HTTPStatusError

If `onStatus` is set to `true`, an `HTTPStatusError` will be thrown when the response status is outside the 2xx range. You can access the status and body through this error object. The error message format is: `404 Not Found: (no response body)`.

### RedirectError

If `redirect` is set to `"error"`, a `RedirectError` will be thrown when the response status is in the 3xx range. You can access the status through this error object. The error message format is: `301 Moved Permanently`.

### Other Errors

If the `onNative` option is set to `true`, any other errors that occur will be thrown directly.

## Usage Examples

### Basic Requests

```ts
import { fetchy, fetchyb } from "@scirexs/fetchy";

// GET request
const data = await fetchyb("https://api.example.com/data", "json");

// POST with JSON body
const result = await fetchyb("https://api.example.com/create", "json", {
  body: { name: "John", email: "john@example.com" }
});

// Custom headers
const response = await fetchy("https://api.example.com/data", {
  headers: {
    "X-Custom-Header": "value"
  }
});

// Reuse options as preset configuration (avoids Request object limitations)
const options = { url: "https://api.example.com/data", retry: false };
await fetchy(null, options);
await fetchy(null, options);
```

### Authentication

```ts
// Bearer token authentication
const user = await fetchyb<User>("https://api.example.com/me", "json", {
  bearer: "your-access-token"
});

// Custom authorization
const data = await fetchyb("https://api.example.com/data", "json", {
  headers: {
    "Authorization": "Basic " + btoa("user:pass")
  }
});
```

### Timeout and Retry

```ts
// Custom timeout
const response = await fetchy("https://slow-api.example.com", {
  timeout: 30  // 30 seconds
});

// Retry with exponential backoff
// Retry intervals: 1s, 3s (3^1), 9s (3^2), 27s (3^3), 60s (capped at maxInterval)
const data = await fetchyb("https://api.example.com/data", "json", {
  retry: {
    maxAttempts: 5,   // Retry up to 5 times
    interval: 3,      // Base interval for exponential backoff (interval^n)
    maxInterval: 60,  // Cap at 60 seconds
    retryAfter: true  // Respect Retry-After header
  }
});

// Disable retry
const response = await fetchy("https://api.example.com/data", {
  retry: false
});
```

### Error Handling

```ts
import { fetchy, HTTPStatusError, RedirectError } from "@scirexs/fetchy";

// Throw on error (default behavior, same as native fetch)
try {
  const response = await fetchy("https://api.example.com/data");
} catch (error) {
  console.error("Request failed:", error);
}

// Return null on error
const response = await fetchy("https://api.example.com/data", {
  onError: false,
});
if (response === null) {
  console.log("Request failed");
}

// Throw only on HTTP errors
try {
  const response = await fetchy("https://api.example.com/data", {
    onError: { onNative: false, onStatus: true }
  });
} catch (error) {
  if (error instanceof HTTPStatusError) {
    console.error("HTTP error:", error.message);  // e.g., "404 Not Found: (no response body)"
    console.error("Status:", error.status);
    console.error("Body:", error.body);
  }
}

// Handle redirects
try {
  const response = await fetchy("https://example.com/redirect", {
    redirect: "error"
  });
} catch (error) {
  if (error instanceof RedirectError) {
    console.error("Unexpected redirect:", error.message);
    console.error("Status:", error.status);
  }
}
```

### Advanced Usage

```ts
// Jitter to prevent thundering herd
const response = await fetchy("https://api.example.com/data", {
  delay: 2,  // Random delay up to 2 seconds before request
  retry: { maxAttempts: 3 }
});

// Combined abort signals
const controller1 = new AbortController();
const controller2 = new AbortController();
const request = new Request("https://api.example.com/data", {
  signal: controller1.signal
});

setTimeout(() => controller1.abort(), 5000);  // Abort after 5 seconds

const response = await fetchy(request, {
  signal: controller2.signal
});

// Form data upload
const formData = new FormData();
formData.append("file", blob);
formData.append("name", "example");

const response = await fetchy("https://api.example.com/upload", {
  body: formData
});

// URL-encoded form
const params = new URLSearchParams();
params.append("key", "value");

const response = await fetchy("https://api.example.com/form", {
  body: params
});
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

const response = await fetchyb<ApiResponse<Todo>>(
  "https://api.example.com/todos/1",
  "json"
);

if (response.success) {
  console.log(response.data.title);  // Fully typed
}
```

## Limitations

### Return Type Inference

When setting the `onError` property in `FetchyOptions`, the return type will include `null` even if you set it to `true` or `{ onNative: true }`. To prevent this and ensure a non-nullable return type, add `as const` to the `onError` property value:

```ts
interface User {
  id: number;
  name: string;
}

const options = { timeout: 5, onError: true as const };  // Add `as const`
const response = await fetchy("https://api.example.com/todos/1", "json", options);
// `response` is User (not User | null)
```

### Content-Type Header with Request Objects

When a body is set in a Request object, the Content-Type header is NOT set automatically by this package. Therefore, when using Request objects, you must explicitly set the Content-Type header for any body types other than those automatically handled by the native `fetch` API.

This limitation can be avoided by using the `url` property in `FetchyOptions` instead of Request objects. This approach allows you to benefit from all automatic header configuration features while still maintaining reusable preset configurations. See the "Reuse options as preset configuration" example in the [Basic Requests](#basic-requests) section.

### ReadableStream as Body

`FetchyOptions` does not accept ReadableStream as a body. If you need to use ReadableStream, create a Request object with the stream and pass it to `fetchy()`.

### Redirect Error Handling

When `redirect` is set to `"error"`, this package throws a custom `RedirectError` (instead of the native TypeError) to enable proper retry handling for redirect responses.

## License

MIT
