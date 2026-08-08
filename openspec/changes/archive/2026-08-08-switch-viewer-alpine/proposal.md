# Proposal: switch-viewer-alpine

## Why
The viewer's ROC deploy uses a Debian/glibc base (bookworm-slim builder + distroless
`nodejs24-debian12` runtime), ~150 MB. ROADMAP originally called for `node:22-alpine`, but
Alpine was deferred because `@levu304/excelrs` ≤2.8.0 shipped only a glibc binary. excelrs
2.8.1 now publishes a musl binary (`-linux-x64-musl`), so the originally-intended Alpine base
was finally thought viable — adopting it (a) realizes the ROADMAP intent and (b) cuts the base
image from ~150 MB to ~40 MB.

## What Changes
- Runtime base image: `gcr.io/distroless/nodejs24-debian12` (glibc) → `node:24-alpine` (musl).
- Builder base image: `node:24-bookworm-slim` (glibc) → `node:24-alpine` (musl).
- Keep `--platform=linux/amd64` (the musl wheel is `linux-x64-musl` = amd64).
- Update the D3 base-rationale header comment in the Dockerfile (it currently says Alpine is deferred).
- Runtime `CMD` becomes explicit `CMD ["node", "dist/index.js"]` (alpine's entrypoint is `node`).

## Capabilities
None. This is an infrastructure-only change to the container base image; no `spreadsheet-view`
requirement changes (rendering behavior is identical — the excelrs N-API addon is ABI-stable
across libc). Specs are legitimately skipped (see `.openspec.yaml` `skip_specs: true`),
matching the archived `upgrade-viewer-dockerfile` change.

## Impact
- `packages/viewer/Dockerfile` only. No application source changes.
- `@levu304/excelrs` stays at `^2.8.1` (already in `package.json` + lock from the prior change);
  the lock already contains the `-linux-x64-musl` platform package, so no dependency bump.
- `npm install` in the builder now resolves the musl binary on Alpine automatically (npm libc
  detection); no recompile (N-API ABI-stable).
- Tradeoff: runtime gains a shell (loses distroless no-shell attack-surface reduction). Size win
  ~150 MB → ~40 MB, comfortably under the 200 MB target.

## Out of Scope
- No `linux/arm64` target (still amd64 only).
- No distroless-on-Alpine (e.g. chainguard) variant — that would re-introduce no-shell at the
  cost of a new registry; out of scope here.
- No behavior/feature change.

## Outcome (2026-08-08) — NOT PURSUED, REVERTED

The size premise was false, disproved by measurement before merge:

- `node:24-alpine` (amd64) = **167 MB**, not ~40 MB. The "~40 MB" figure was the bare
  `alpine:3` OS image (~8 MB), which contains no Node and cannot run the viewer. The proposal
  (and `upgrade-viewer-dockerfile` design.md) conflated `alpine` (the OS) with `node:alpine`
  (Node + OS).
- The Node binary alone is **~125 MB uncompressed** — the floor on every base. distroless wins
  the size contest because it strips npm/yarn/build-deps; `node:24-alpine` keeps them, so the
  built image is **178 MB** — 21 MB *larger* than the current distroless build (157 MB) and it
  loses the no-shell hardening.
- musl buys zero functional benefit: the excelrs N-API addon is libc-agnostic, already proven
  `PROBE_OK` on the glibc distroless build. ROADMAP "Alpine" intent was a proxy for *smallness*,
  which distroless already satisfies best.

**Decision:** keep `gcr.io/distroless/nodejs24-debian12` (smallest + no-shell). Dockerfile was
edited to alpine and then reverted to HEAD; net application change is zero. Investigated via
tasks below; change closed as superseded by measurement.

**Action item carried forward:** the false "~40 MB" claim in the archived
`upgrade-viewer-dockerfile` design.md (line noting "swap FROM node:24-alpine, ~150 MB →
~40 MB") is the source of this misconception and should be corrected in place.