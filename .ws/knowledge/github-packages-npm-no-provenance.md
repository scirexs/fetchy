# GitHub Packages' npm registry rejects `--provenance`

**Applies to:** `npm publish` against `https://npm.pkg.github.com`, as of npm CLI
shipped with `actions/setup-node@v4` (observed in this repo 2026-08).

## Finding
GitHub Packages requires a scoped npm registry setup (the package scope must
match the owning GitHub user/org, and the registry is set per-scope via
`.npmrc`/`setup-node`'s `scope` input) and, unlike `registry.npmjs.org`, does
not accept npm's `--provenance` attestation option — passing it fails the
publish.

## Why it matters / how to apply
When publishing the same artifact to both npmjs and GitHub Packages in one CI
job, keep `--provenance` on the npmjs step only; omit it entirely from the
GitHub Packages step. Do not "restore consistency" between the two publish
steps by adding it back.

## References
Surfaced while adding GitHub Packages as a third release target in
`.github/workflows/release.yaml`.
