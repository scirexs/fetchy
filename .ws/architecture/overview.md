<!--
TEMPLATE — system overview of the product.
Maintained as part of a change: `design` includes the overview update in
`request.md`, the implementer applies it, the reviewer checks it; a
maintainer-triggered `cowork-audit` pass periodically audits it against the ADRs
and the actual code, updating it on the maintainer's approval. Update ONLY when
the system's "shape"
changes; each section below maps 1:1 to one update trigger, so a change either
touches a section here (→ update it) or it does not (→ leave the file
untouched). Triggers: component add/delete · directory layout · public API /
entry points · build-test-toolchain · an architecture-level decision/.
Replace each `> guidance` block and the bracketed placeholders with real
content; keep the headings stable so the staleness check stays mechanical.
Keep it concise: link to decision/ for the "why"; do not restate what the code
already makes obvious.
Convention: mark build-generated paths and exports with a `(generated)` tag, so
a change to generated output is distinguishable from a hand-authored one and the
update trigger stays unambiguous.
-->

# Project Overview — fetchy (`@scirexs/fetchy`)

A lightweight, zero-dependency thin wrapper around the platform `fetch`, adding
timeout, retry with exponential backoff, automatic body/header handling, and
chainable body parsing. Published to both JSR and npm and runs on Deno, Node.js,
and modern browsers.

## Purpose

Native `fetch` leaves timeout, retry, body serialization, status-code error
handling, and body parsing to every caller. fetchy supplies those as a thin
layer while keeping the native shape (`Request` / `Response` / `RequestInit`)
intact, so migration back to native `fetch` stays cheap — this "easy to remove"
property is a stated design goal, not an afterthought.

Consumers are application/library authors on any of the three runtimes. The
primary use case is calling JSON HTTP APIs with sane defaults.

Non-goals:

- Not a full HTTP client framework — no interceptor pipeline, cookie jar,
  caching layer, or request/response middleware stack. Custom behavior is
  injected through the `fetcher` option instead.
- No runtime dependencies, and no runtime-specific code paths (no Node/Deno
  shims); only Web-standard APIs are used.
- No schema validation of its own — validation is delegated to the caller via
  `JSONParseOptions.refine`.

## System Summary

One request flows through a single linear pipeline in `src/main.ts`:

```
fetchy() / sfetchy() / fy().get() …
  └─ _main()
       ├─ _buildOption()       merge global (setFetchy) ← instance (fy) ← per-call options
       ├─ _createRequest()     normalize string | URL | Request (+ base) into a Request
       ├─ _getRequestInit()    resolve method / headers / body → RequestInit
       ├─ _getOptions()        normalize+validate internal Options (timeout, retry, signal, fetcher)
       ├─ _fetchWithRetry()    retry loop: clone request, jitter, timeout signal, backoff, HTTPStatusError
       └─ _makeFetchyResponse()  wrap Response → FetchyResponse (safe parse methods + FetchyHeaders)
  └─ _makeFetchyPromise()      wrap the Promise so parse methods can be chained without awaiting
```

Two orthogonal axes shape the return types, and both are part of the public
contract:

- **Failure layer**: request-layer failures (network / HTTP status / timeout)
  become `null` in safe mode (`sfetchy`, `s*` methods); body-parse-layer
  failures become `undefined` (`safe: true` on a parse method). The type of the
  failure value therefore identifies where the failure happened.
- **Call style**: chained on the promise (`FetchyPromise` / `FetchySafePromise`)
  or on the awaited response (`FetchyResponse`). The promise-like objects merely
  forward parse calls to the resolved response.

## Components / Modules

| Component | Responsibility | Depends on |
|---|---|---|
| `src/mod.ts` | Public entry point; re-exports the public functions and types. Nothing else is part of the contract. | `src/main.ts`, `src/types.ts` |
| `src/main.ts` | Whole implementation: the request pipeline, retry/timeout/jitter logic, `HTTPStatusError`, and the `FetchyResponse` / `FetchyPromise` / `Fetchy` factories. | `src/types.ts` (type-only) |
| `src/types.ts` | Public type surface only (`FetchyOptions`, `RetryOptions`, `FetchyResponse`, `Fetchy`, …). No runtime code. | — |
| `tests/main.test.ts` | Unit tests, incl. internals. Reaches the `_`-prefixed helpers exported from `main.ts`. | `src/main.ts` |
| `build_npm.ts` | dnt-based npm build: transpiles `src/mod.ts`, then strips the internal exports and minifies the ESM output. | `src/mod.ts`, `deno.json` |

Note: `src/main.ts` exports every internal helper under a leading `_` solely so
`tests/main.test.ts` can unit-test them. They are **not** public API — the npm
build's `removeInternals()` rewrites the export line to the five public names,
and JSR consumers only see `src/mod.ts`. Adding a helper therefore means adding
it to the `main.ts` export list, not to `mod.ts`.

## Directory Layout

```
src/            library source (the published unit)
tests/          Deno unit tests
.github/workflows/  release.yaml — publishes to JSR then npm on push to main
npm/            (generated) dnt output, gitignored
node_modules/   (generated) gitignored
.ws/            workspace documentation (this file's home)
.ref/           maintainer-facing material, gitignored
build_npm.ts    npm build script
deno.json       package manifest, lint/fmt config, tasks
README.md       user-facing API documentation
```

## Public API / Entry Points

Single entry point: `src/mod.ts` (`deno.json` → `exports`). The npm package
exposes the same surface as ESM with separate declarations (generated).

Runtime exports:

- `fetchy(url?, options?)` → `FetchyPromise` — strict mode; throws on failure.
- `sfetchy(url?, options?)` → `FetchySafePromise` — safe mode; `null` on failure.
- `fy(options?)` → `Fetchy` — fluent client with per-method shortcuts
  (`get`/`head`/`post`/`put`/`patch`/`delete` and their `s`-prefixed safe twins).
- `setFetchy(options)` — replaces (does not merge) the global default options.
- `HTTPStatusError` — thrown on non-OK status unless `native: true`.

Type exports: `Fetchy`, `FetchyBody`, `FetchyHeaders`, `FetchyOptions`,
`FetchyPromise`, `FetchyResponse`, `FetchySafePromise`, `JSONParseOptions`,
`JSONReviver`, `JSONValue`, `RetryOptions`.

Behavioral contract worth stating here because it is not obvious from a
signature: the two failure layers (`null` = request, `undefined` = parse)
described in *System Summary* are part of the public API. See README
"Failure-Layer Convention".

## Build / Test / Toolchain

Deno is the toolchain; npm output is produced by dnt (`jsr:@deno/dnt`) plus
`npm:esbuild` for minification. No prerequisites (no dev server, env var, or
codegen) — every command below runs from the repository root as-is.

Validation, narrowest → widest:

```bash
deno check src/mod.ts        # typecheck
deno lint                    # lint (src/, tests/)
deno fmt --check             # format check (src/, tests/; lineWidth 140)
deno test                    # unit tests (no permission flags needed)
deno run -A ./build_npm.ts   # full npm build → ./npm (generated); only when the build path is touched
```

`deno task test` is an alias for `deno test`. Release is automated: pushing to
`main` runs `.github/workflows/release.yaml`, which publishes to JSR first
(`deno publish`) and then builds and publishes to npm — JSR must go first
because the dnt build leaves the working tree dirty.

## Key Decisions

No ADRs exist under `.ws/decision/` yet. Until they do, the design intent lives
in `README.md`:

- "Failure-Layer Convention" — why `null` and `undefined` mean different things.
- "Compatibility with Native Fetch" — the removability constraint that keeps the
  wrapper thin.
- "Advanced Usage → Custom Fetch Implementation" — the `fetcher` option as the
  designated extension point in place of middleware.
