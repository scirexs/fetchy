# dnt-built npm output is registry-agnostic

**Applies to:** `deno_dnt` (`build_npm.ts` producing `./npm`), observed in this
repo 2026-08.

## Finding
The npm package tree produced by dnt (`./npm`) carries no registry-specific
data; the same build can be `npm publish`ed unchanged to multiple npm-compatible
registries (e.g. `registry.npmjs.org` and `https://npm.pkg.github.com`). Only
the active registry pointer (via `setup-node`'s `registry-url`/`scope` or
`.npmrc`) and the auth token differ between targets.

## Why it matters / how to apply
When adding another npm-compatible publish target to a CI job, reuse the
existing dnt output as-is — do not rebuild it or split the job. Re-point the
registry (a second `actions/setup-node@v4` call is sufficient) and re-run
`npm publish` with `working-directory` set to the existing output directory.

## References
Surfaced while adding GitHub Packages as a third release target in
`.github/workflows/release.yaml`.
