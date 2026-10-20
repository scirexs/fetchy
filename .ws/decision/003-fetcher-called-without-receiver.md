# 003. Call the fetcher without a receiver; never bind it, and strip fetchy-only keys from its init

**Status:** Accepted
**Supersedes:** none
**Date:** 2026-10-20
**Affects:** public option `FetchyOptions.fetcher` (invocation contract); internal `_fetchWithJitter`, `_getRequestInit`

## Context

fetchy invoked the fetcher as `options.fetcher(req, init)`, so `this` was the internal `Options`
object, and `_getRequestInit` spread every unrecognised option key into the `RequestInit`, so
`fetcher`, `base` and `url` reached the fetcher. Bun and Deno ignore both, but workerd and browsers
do not: a WebIDL `fetch` (global or a Cloudflare Service binding's) throws `Illegal invocation`
when `this` is a foreign object, and workerd's `RequestInit` has its own non-standard `fetcher`
field (a `Fetcher` object), so a function there throws a type error even when the caller passes a
correctly bound fetcher. fetchy must stay runtime-agnostic and thin (no runtime detection, no
interceptor layer).

## Decision

- The fetcher is invoked as a plain function: `this` is `undefined` (strict-mode module code).
  fetchy never binds, wraps, or `.call`s it with any receiver.
- A caller whose function needs a receiver (Service binding `fetch`, class method) binds it or
  wraps it in an arrow function. This is documented in the `fetcher` JSDoc and the README.
- The `RequestInit` fetchy builds contains only `RequestInit` members: every fetchy-only key
  (`url`, `base`, `timeout`, `retry`, `bearer`, `jitter`, `native`, `fetcher`) is excluded in
  `_getRequestInit`. Unknown keys still pass through, so runtime extensions such as `cf` keep
  working.
- The default stays `options?.fetcher ?? fetch`, resolved lazily at call time.

## Consequences

- The default global `fetch` works on workerd and in browsers, because a WebIDL operation accepts
  `undefined` as `this`.
- Passing a receiver-dependent method unbound (e.g. `env.SVC.fetch`) fails with `Illegal
  invocation`; that is the caller's responsibility. The error is a `TypeError`, so under ADR 002
  it is retried like a network error before surfacing.
- Every new fetchy-only option must be added to the exclusion list in `_getRequestInit`
  (recorded in coding-style §8).

## Rejected alternatives

- **Bind the fetcher to `globalThis` (`fetcher.call(globalThis, …)`).** Fixes the default `fetch`
  but breaks a Service binding's `fetch`, whose receiver must be the binding object; it also
  hides the receiver contract instead of stating it.
- **Auto-bind / accept a `{ fetch }` object as the fetcher.** New API surface and a second code
  path for a problem one `.bind` at the call site already solves; contrary to the thin, removable
  design.
- **Detect workerd and adapt.** Runtime detection is forbidden in `src/`; the receiver-less call
  is correct on every runtime.
- **Delete `fetcher` from the init only on workerd / filter by an allow-list of `RequestInit`
  keys.** An allow-list would drop runtime extensions (`cf`) and drift with the spec; excluding
  fetchy's own keys is exact and local.
