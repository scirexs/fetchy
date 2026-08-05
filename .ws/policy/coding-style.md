# Coding Style

> Project-specific coding conventions for **fetchy** (`@scirexs/fetchy`), read by
> the cowork `impl` / `review` agents. This is the **single source of truth** for
> code style — update here, not in copies.
> **Gold-standard files:** `src/main.ts` (implementation), `src/types.ts` (public
> type surface), `tests/main.test.ts` (tests). When a rule below is silent or
> ambiguous, match the nearest construct in these files.

## 0. Orientation

> Stack, layout, public API, and the build / test / validation commands live in
> [`.ws/architecture/overview.md`](../architecture/overview.md). This document
> covers **code style** only.

**Change discipline (project-specific):**

- The library's selling point is that it is *thin and removable*. Prefer reusing
  an existing helper over adding a code path; prefer widening an existing option
  over adding a new one. Bundle size (~6KB uncompressed) is a product feature.
- `src/` must stay zero-dependency and Web-standard-only. No `npm:` / `jsr:`
  runtime imports, no `Deno.*` / `node:*` APIs, no runtime feature detection.
  (Tooling files — `build_npm.ts`, `tests/` — are exempt.)
- Any change to the public surface (`src/mod.ts` exports, `src/types.ts`
  signatures, option names, defaults) must update `README.md` in the same change.

## Rule precedence

When rules appear to conflict, resolve in this order:

1. The current task request (`request.md` / the active `request-fixN.md`), when
   it explicitly authorizes a deviation.
2. This document.
3. `deno fmt` / `deno lint` / `deno check` output.
4. Gold-standard files (see above).
5. Consistency with nearby existing code.

When a deviation is unavoidable, keep it local and record the reason — in the
implementation feedback, or in a short code comment when a future reader needs
the context.

---

## 1. Module organization & exports

**Rule — `src/main.ts` opens with one flat `export { … }` block, placed *above*
the imports.** Every module-level binding, internal helpers included, is listed
there, sorted case-insensitively (so `_`-prefixed names come first). Declarations
themselves carry no `export` keyword.

**Why:** the `_`-prefixed helpers are exported *only* so `tests/main.test.ts` can
unit-test them. The npm build (`build_npm.ts` → `removeInternals()`) rewrites
exactly that first line to the five public names, so it must stay a single line
holding the complete list.

- Adding an internal helper ⇒ add it to the `main.ts` export block **and** leave
  `src/mod.ts` untouched.
- Adding a public export ⇒ add it to `main.ts`, to `src/mod.ts`, **and** to the
  literal string inside `removeInternals()` in `build_npm.ts`.

**Rule — `src/mod.ts` is the only public entry point.** It re-exports runtime
values from `./main.ts` and types from `./types.ts` via a separate
`export type { … }`, each list sorted case-insensitively.

**Rule — types are imported type-only, with explicit `.ts` specifiers.**

```ts
import type { Fetchy, FetchyOptions } from "./types.ts";   // good
import { type Fetchy, fetchy } from "./types.ts";          // bad — mixed
```

**Rule — `src/types.ts` contains no runtime code.** Only `export interface` /
`export type`, exported inline at the declaration.

## 2. File skeleton & section banners

**Rule — section banners are `/*=============== Title ===============*/`,
opening with exactly 15 `=` and right-padded with `=` so every banner in the file
ends at the same column (51 chars in `src/main.ts` and `tests/main.test.ts`).**

`src/main.ts` uses this fixed order; keep new code inside the matching section
rather than inventing a new one:

```
export { … }                    // single sorted line
import type { … }               // type-only imports
/*=============== Constant Values ===============*/
/*=============== Internal Types ================*/
/*=============== Main Codes ====================*/   // module state, HTTPStatusError, public functions, _main
/*=============== Helper Codes ==================*/
```

**Rule — helpers in the *Helper Codes* section are ordered by the pipeline, not
alphabetically:** the order in which `_main` reaches them, with each helper's own
sub-helpers immediately after it (`_getRequestInit` → `_getBody` →
`_isJSONObject` → `_getHeaders` → `_getContentType`). Hoisting is relied upon;
never reorder into dependency order.

## 3. Naming

| Kind | Convention | Examples |
|---|---|---|
| Module-level constant | `_` + UPPER_SNAKE | `_DEFAULT`, `_NO_IDEM`, `_METHODS`, `_FETCHY` |
| Internal function / type | `_` + camelCase / PascalCase | `_getRetryOption`, `_makeFetchyResponse` |
| Public function | camelCase, no prefix | `fetchy`, `setFetchy`, `fy` |
| Safe (never-throwing) variant | public name prefixed `s` | `sfetchy`, `sget`, `spost` |
| Type / interface / class | PascalCase | `FetchyOptions`, `HTTPStatusError` |
| Type guard | `_is<Type>` | `_isRequest`, `_isPlain`, `_isJSONObject` |

**Rule — a `_` prefix means "not public API".** It is the signal the npm build,
the tests, and reviewers all key off. Never `_`-prefix something intended for
consumers, and never expose a non-prefixed binding that `mod.ts` does not
re-export.

**Rule — short locals are fine in short helpers.** `v`, `k`, `x`, `m`, `res`,
`req`, `init`, `opt`, `s1`/`s2` are idiomatic here; a 3-line helper does not need
descriptive names. Use full words once a function has real branching
(`interval`, `attempts`, `headers`).

## 4. Formatting & lint

**Rule — never hand-format; `deno fmt` (`lineWidth: 140`) is authoritative.**
`deno lint` runs the `recommended` tag set minus `no-unused-vars` / `no-window`
(see `deno.json`). Run the validation commands listed in `overview.md`.

**Rule — `// deno-lint-ignore no-explicit-any` is the only sanctioned lint
escape.** Put it on the line immediately above, and only in the two situations
that already exist: forwarding variadic arguments through a generated method, and
accepting a user-supplied parser's input. Everywhere else use `unknown`.

## 5. Language idioms

- **`const` by default.** `let` is for genuine mutation only: module state
  (`_baseOption`), loop accumulators, closure caches (`next` in `_cloneRequestF`).
- **Prefer `function` declarations at module level**; arrow functions for inline
  callbacks and returned closures only.
- **Guard clauses are single-line early returns without braces:**
  `if (options.timeout <= 0) return options.signal;`. Multi-line bodies get
  braces. Keep nesting at two levels or fewer — extract a `_`-helper instead.
- **Prefer a single expression-bodied `return`** (ternary, `??`, `||`, `Math.max`)
  over an if/else ladder, as long as it stays inside 140 columns and stays
  readable.
- **Merge with object spread**, including conditional spread:
  `{ ...options, ...req, ...(method && { method }) }`.
- **Extend native objects in place with `Object.assign`, never by wrapping or
  proxying** — see §7.
- **No new classes.** `HTTPStatusError` is the only class; it exists because it
  must be an `Error`. The fluent client (`fy`) is a plain object with methods
  installed via `Object.defineProperty`.
- **Never swallow an error** except at the two designated safe-mode boundaries
  (§6), where the form is exactly `.catch(() => null)` / `.catch(() => undefined)`.

## 6. Failure-layer convention (do not blur)

**Rule — the type of a failure value identifies the layer that failed:**

| Value | Layer | Produced by |
|---|---|---|
| `null` | request layer — network, HTTP status, timeout, abort | `sfetchy`, `fy().s*()` |
| `undefined` | body-parse layer — `JSON.parse`, `reviver`, `refine`, body read | `safe: true` / `safe` flag on a parse method |
| thrown | strict mode | `fetchy`, `fy()` non-`s` methods |

**Why:** this is a documented part of the public contract (README →
"Failure-Layer Convention"), and it is what lets a caller distinguish a
legitimate JSON `null` from a parse failure.

- Never introduce a third sentinel, and never let one layer's failure surface as
  the other's value.
- A legitimate JSON `null` payload must survive parsing untouched.

## 7. Types & type safety

**Rule — public types live in `src/types.ts`; types used only by the
implementation live in the *Internal Types* banner of `main.ts`** (`Options`,
`InputArg`, `InternalRetry`).

**Rule — derive types instead of restating them:** `Pick<Options, …>`,
`Omit<Options, …>`, `Omit<RequestInit, "body">`, `Parameters<typeof JSON.parse>[1]`.
A duplicated field list will drift.

**Rule — every parse-style method is declared as an overload pair encoding the
safe flag**, so the return type narrows without a cast:

```ts
text(safe?: false): Promise<string>;
text(safe: boolean): Promise<string | undefined>;

json<T>(options?: JSONParseOptions<T> & { safe?: false }): Promise<T>;
json<T>(options: JSONParseOptions<T>): Promise<T | undefined>;
```

Any method added to `FetchyResponse` / `FetchyPromise` must follow this exact
shape, and must be mirrored in `FetchySafePromise` as the `| null` single
signature.

**Rule — `as` assertions are allowed only to re-type a native object that was
just augmented via `Object.assign`** (`return Object.assign(res, ext) as FetchyResponse`),
i.e. where TypeScript cannot express the augmentation. They are not a way to
silence a modelling mistake. `!` is allowed only immediately after a check that
guarantees non-null (`_correctNumber`, `_getNextInterval`).

**Rule — type guards return `v is T` and take `unknown`** (or the narrow union
they refine, as `_isJSONObject` does).

## 8. Options handling

**Rule — every default lives in `_DEFAULT`, once.** Do not repeat a literal
default at a use site.

**Rule — every user-supplied numeric option is normalized through
`_correctNumber(dflt, value)` and then clamped with `Math.max(…)`** to its
documented floor. Invalid input (negative, `NaN`, `Infinity`) silently falls back
to the default — the library never throws on option validation.

**Rule — a new option must be added in all four places:** `_DEFAULT` (if it has a
default), the internal `Options` interface, the public `FetchyOptions` /
`RetryOptions` in `types.ts` with a `/** … @default … */` doc comment, and the
`README.md` option table.

**Rule — merge precedence is global (`setFetchy`) ← instance (`fy`) ← per-call**,
implemented by `_buildOption`. `retry` is merged one level deep; `headers` are
merged key-by-key via `_mergeHeaders`. Preserve both behaviours.

## 9. Native-shape compatibility

**Rule — the wrapper must remain removable.** Concretely:

- `FetchyOptions` extends `RequestInit`; unknown keys pass through to `fetch` via
  `...rest` in `_getRequestInit`.
- Returned objects keep their native identity: `instanceof Response`,
  `instanceof Headers`, `instanceof Promise` must all stay true. This is why
  extensions are applied with `Object.assign` on the real instance rather than a
  wrapper class or `Proxy`.
- The `fetcher` option is the designated extension point. Do not add an
  interceptor / middleware layer.
- A custom `fetcher` may return a `Response` synchronously — always `await` its
  result rather than assuming a promise.

## 10. Comments & documentation

**Rule — every public export carries a full JSDoc block:** one-or-two-line
summary, then `@param` / `@returns` / `@throws` as applicable, then an
` ```ts ` `@example`. Examples use realistic URLs (`https://api.example.com/...`)
and show both the plain and the safe/advanced form.

**Rule — every member of a public interface carries a `/** … */`**, and every
optional member with a default carries `@default`.

**Rule — every internal helper carries exactly one JSDoc line ending in
`@internal`:** `/** Merges multiple headers into one. @internal */`.

**Rule — no inline "what" comments.** Explain *why* only where the code cannot.
Do not add newly commented-out code; the two existing commented blocks
(`_makeFetchyResponse`'s `defineProperty` variant, `replaceInternalName` in
`build_npm.ts`) are grandfathered records of alternatives that were tried.

## 11. Tests

**Rule — one test file per source module, `tests/<module>.test.ts`.**

**Rule — one top-level `Deno.test` per exported binding, named exactly after it,
with each behaviour as a `t.step`; group them under the same banner style as
§2 and keep them in `main.ts`'s declaration order.**

```ts
Deno.test("_correctNumber", async (t) => {
  await t.step("returns the value when non-negative and finite", () => { … });
  await t.step("falls back to the default on NaN", () => { … });
});
```

Step names are lowercase phrases describing observable behaviour ("returns
response on first successful fetch"), not "should …".

**Rule — tests never perform real I/O.** `deno test` runs with no permission
flags. Stub the network with `stub(globalThis, "fetch", …)` and restore it in a
`finally`:

```ts
const mockFetch = stub(globalThis, "fetch", () => Promise.resolve(new Response("ok", { status: 200 })));
try {
  …
} finally {
  mockFetch.restore();
}
```

When the case is about the `fetcher` option, still stub `globalThis.fetch` to
reject, and assert `assertSpyCalls(mockFetch, 0)` — that is how "the global fetch
was bypassed" is proven.

**Rule — dependencies are pinned in the import specifier** (`jsr:@std/assert@^1.0.16`,
`jsr:@std/testing@^1.0.16/mock`); there is no import map.

**Rule — shared fixtures go under the `Test Helpers` banner at the top of the
file** (`makeOptions`, `makeFetchyOptions`). The `AnyOptions` alias declared there
is the sanctioned `any` escape for constructing internal `Options` shapes; do not
scatter fresh `deno-lint-ignore` comments through the test body.

**Rule — timing-sensitive tests use tiny intervals** (`interval: 0.01`,
`maxInterval: 1`) and assert loose bounds; never assert an exact elapsed time.

**Rule — internals are tested directly** through their `_`-prefixed exports.
A new `_`-helper is expected to arrive with its own `Deno.test` block; a change to
the public contract is expected to also be covered end-to-end through `fetchy` /
`sfetchy` / `fy`.
