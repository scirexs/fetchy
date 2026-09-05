# 002. Retry generic network errors by default

**Status:** Accepted
**Supersedes:** none
**Date:** 2026-09-05
**Affects:** public option `RetryOptions.retryOnNetwork`; internal `Options.onNetwork`, `_DEFAULT`, `_getRetryOption`, `_shouldRetry`

## Context

`fetch` rejects with a `TypeError` on a network error (DNS failure, connection refused, TLS
failure, etc.) and with a `DOMException` (`TimeoutError` / `AbortError`) on timeout / abort.
Before this change, `_shouldRetry` retried only `TimeoutError` (gated by `retryOnTimeout`)
among thrown values; every other thrown error — including transient network `TypeError`s —
was surfaced on the first attempt with no retry, and callers had no way to opt into retrying
them.

Two forces shaped the choice: (1) how to identify a "network error" reliably without
catching a deliberate user abort or a deterministic programming mistake, and (2) whether
retrying such errors should be the default or opt-in.

## Decision

Add a retry option `retryOnNetwork` (internal `onNetwork`), defaulting to **true**,
mirroring `retryOnTimeout`. A thrown value is treated as a retryable network error iff
`value instanceof TypeError`. When enabled and the attempt / idempotency budget allows, such
errors retry with the same exponential backoff as status-code retries.

Detection is `instanceof TypeError` precisely because the fetch spec throws `TypeError` for
network errors while timeout / abort throw `DOMException`; `AbortError` (a deliberate user
cancel) and `TimeoutError` (owned by `retryOnTimeout`) are therefore excluded and never
retried under this flag.

## Consequences

- Behavior change: a network `TypeError` now issues up to `maxAttempts` requests by default
  where it previously issued one. Callers who want the old single-attempt behavior set
  `retry: { retryOnNetwork: false }` (or `retry: false`).
- Network-error retry obeys the shared gates: `maxAttempts`, `idempotentOnly`, and the
  backoff / `maxInterval` cap. It does not consult `respectHeaders` — there is no response.
- Consistent with ADR 001: the flag does not gate on `native`; retry semantics stay
  identical across modes.
- A custom `fetcher` that signals a network failure with a non-`TypeError` will not be
  retried under this flag; it must throw a `TypeError` to opt in.

## Rejected alternatives

- **Default false (opt-in).** Rejected: transient network errors are the paradigm case for
  retry, and `retryOnTimeout` already defaults to `true`; making the sibling opt-in would be
  inconsistent and leave the common case unprotected.
- **Retry any thrown `Error` except `AbortError` / `TimeoutError`.** Rejected: it requires
  explicitly excluding `AbortError`, and risks retrying deterministic programming errors
  (bad init, invalid header) that will only fail again. `instanceof TypeError` matches the
  spec and is precise.
- **A separate top-level `FetchyOptions` flag instead of a `RetryOptions` member.** Rejected:
  it is a retry concern and belongs beside `retryOnTimeout`, merged with the one-level `retry`
  precedence.
