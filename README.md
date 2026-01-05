# fetchy

A lightweight, type-safe fetch wrapper with built-in retry logic, timeout handling, and automatic body parsing.

[![npm version](https://img.shields.io/npm/v/%40scirexs%2Ffetchy)](https://www.npmjs.com/package/@scirexs/fetchy)
[![JSR](https://img.shields.io/jsr/v/%40scirexs/fetchy)](https://jsr.io/@scirexs/fetchy)
[![license](https://img.shields.io/github/license/scirexs/fetchy)](https://github.com/scirexs/fetchy/blob/main/LICENSE)

## Features

- **Lightweight** - Zero dependencies, works in Deno, Node.js, and browsers
- **Simple API** - Drop-in replacement for native fetch with enhanced capabilities
- **Timeout Support** - Configurable request timeouts with automatic cancellation
- **Smart Retry Logic** - Exponential backoff with Retry-After header support
- **Type-Safe** - Full TypeScript support with generic type inference
- **Bearer Token Helper** - Built-in Authorization header management
- **Jitter Support** - Prevent thundering herd with randomized delays
- **Auto Body Parsing** - Automatic JSON serialization and Content-Type detection

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
- `url`: string | URL | Request - The request URL
- `options`: FetchyOptions (optional) - Configuration options

#### Returns
`Promise<Response | null>`

#### Example
```ts
const response = await fetchy("https://api.example.com/data", {
  method: "POST",
  body: { key: "value" },
  timeout: 10,
  retry: { max: 3, interval: 2 },
  bearerToken: "your-token-here"
});

if (response?.ok) {
  const data = await response.json();
}
```

### `fetchyb(url, type?, options?)`

Performs an HTTP request and automatically parses the response body.

#### Parameters
- `url`: string | URL | Request - The request URL
- `type`: "text" | "json" | "bytes" | "auto" (default: "auto") - Response parsing type
- `options`: FetchyOptions (optional) - Configuration options

#### Returns
`Promise<T | string | Uint8Array | null>`

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

## Configuration Options

### FetchyOptions
```ts
interface FetchyOptions {
  // Standard fetch options (method, headers, etc.)
  method?: string;
  headers?: HeadersInit;
  
  // Request body (auto-serializes JSON)
  body?: JSONValue | FormData | URLSearchParams | Blob | ArrayBuffer | string;
  
  // Timeout in seconds (default: 15)
  timeout?: number;
  
  // Retry configuration
  retry?: {
    max?: number;           // Max retry attempts (default: 3)
    interval?: number;      // Base interval in seconds (default: 3)
    maxInterval?: number;   // Max interval cap (default: 30)
    byHeader?: boolean;     // Respect Retry-After header (default: true)
  } | false;  // Set to false to disable retry
  
  // Bearer token (auto-adds "Bearer " prefix)
  bearerToken?: string;
  
  // Error throwing behavior
  throwError?: {
    onError?: boolean;        // Throw on native errors (default: true)
    onErrorStatus?: boolean;  // Throw on 4xx/5xx status (default: false)
  } | boolean;  // Set to true to throw all errors
  
  // Initial jitter delay in seconds
  jitter?: number;
  
  // Manual abort controller (if timeout occur, reason is set to "timeout")
  abort?: AbortController;
  
  // Redirect behavior
  redirect?: "follow" | "error" | "manual";
}
```

### Default Values
```ts
{
  timeout: 15,           // 15 seconds
  jitter: 0,             // No jitter
  retry: {
    max: 3,              // 3 retry attempts
    interval: 3,         // 3 seconds base interval
    maxInterval: 30,     // 30 seconds max interval
    byHeader: true       // Respect Retry-After header
  },
  throwError: {
    onError: true,       // Throw parsing errors
    onErrorStatus: false // Don't throw on HTTP errors
  },
  redirect: "follow"     // Follow redirects
}
```

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
```

### Authentication
```ts
// Bearer token authentication
const user = await fetchyb<User>("https://api.example.com/me", "json", {
  bearerToken: "your-access-token"
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
const data = await fetchyb("https://api.example.com/data", "json", {
  retry: {
    max: 5,           // Retry up to 5 times
    interval: 2,      // Start with 2 seconds
    maxInterval: 60,  // Cap at 60 seconds
    byHeader: true    // Respect Retry-After header
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

// Return null on error (default)
const data = await fetchyb("https://api.example.com/data", "json");
if (data === null) {
  console.log("Request failed");
}

// Throw on error
try {
  const data = await fetchyb("https://api.example.com/data", "json", {
    throwError: true
  });
} catch (error) {
  console.error("Request failed:", error);
}

// Throw only on HTTP errors
try {
  const data = await fetchyb("https://api.example.com/data", "json", {
    throwError: { onErrorStatus: true }
  });
} catch (error) {
  if (error instanceof HTTPStatusError) {
    console.error("HTTP error:", error.message);  // e.g., "404 Not Found"
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
  }
}
```

### Advanced Usage
```ts
// Jitter to prevent thundering herd
const response = await fetchy("https://api.example.com/data", {
  jitter: 2,  // Random delay up to 2 seconds before request
  retry: { max: 3 }
});

// Manual abort control
const controller = new AbortController();

setTimeout(() => controller.abort(), 5000);  // Abort after 5 seconds

const response = await fetchy("https://api.example.com/data", {
  abort: controller
});

// Form data
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

if (response?.success) {
  console.log(response.data.title);  // Fully typed
}
```

## License

MIT
