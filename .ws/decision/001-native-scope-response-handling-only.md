# 001. `native` scopes to response handling only

**Status:** Accepted
**Supersedes:** none
**Date:** 2026-08-05
**Affects:** public option `FetchyOptions.native`; retry behavior in `_shouldRetry` / `_fetchWithRetry`

## Context

`native: true` is documented as "does not throw `HTTPStatusError` on a non-OK
status, behaving like native fetch". The implementation additionally used it as a
feature switch: `_shouldRetry` returned `false` for every `Response` when
`native` was set, so status-code-based retry never ran in that mode. The
suppression was partial and undocumented — jitter, the timeout signal, and
timeout-triggered retry all stayed active under `native: true` — so the option's
scope was ambiguous: is `native` an error-shape switch, or a "turn the wrapper
off" switch?

The answer constrains every future feature: each added behavior would otherwise
have to decide, case by case, whether `native` disables it.

## Decision

`native` scopes strictly to response/error handling — whether a non-OK status is
raised as `HTTPStatusError` or returned as a plain `Response`. It disables
nothing else. Retry (including retries triggered by `retry.statusCodes`),
backoff, `respectHeaders` timing, `timeout`, and `jitter` behave identically
whether `native` is `true` or `false`. When retries are exhausted under
`native: true`, the last received `Response` is returned as-is.

## Consequences

- Retry semantics are the same in both modes: one fewer interaction to document,
  test, and reason about.
- Behavior change for existing users: `native: true` plus a retryable status now
  issues up to `maxAttempts` requests where it previously issued one. Callers who
  want a single request must say so — `retry: false` or `retry: { maxAttempts: 1 }`.
- "Behave exactly like bare `fetch`" is not expressible by `native: true` alone;
  it is `native: true` + `retry: false` + `timeout: 0`. README states this.
- Any feature added later must not gate itself on `native`.

## Rejected alternatives

- **Keep suppressing status retry under `native` (the prior behavior).** Rejected:
  it makes `native` a hidden feature switch, it was already inconsistent (timeout,
  jitter, and timeout-triggered retry kept running), and a caller who wants native
  error shape loses retry resilience with no way to opt back in.
- **Make `native` disable every added feature (full passthrough).** Rejected: it
  turns the option into "bypass this library", which is better expressed by not
  calling it — and it would silently remove the timeout that `native: true`
  callers rely on today.
- **Add a separate option (e.g. `retryOnNative`).** Rejected: it buys a
  distinction we do not want at the cost of public surface, documentation, and
  bundle size, all of which are product concerns for this library.
