## Why
`packages/viewer/Dockerfile` pins Node 22 — builder `node:22-bookworm-slim`, runtime
`gcr.io/distroless/nodejs22-debian12`. Node 22 is now in maintenance (EOL April 2027),
leaving no security-patch runway for the deploy container. Bumping the base image to the
current Node LTS keeps the container patched **with zero change to the viewer's rendered
output** and **zero change to the `@levu304/excelrs` native addon** (it ships a prebuilt
`linux-x64-gnu` binary via N-API, which is ABI-stable across Node majors — already proven
by `scripts/probe.cjs` on 2.8.0, re-verified on 2.8.1 at apply).

## What Changes
- Builder stage `FROM --platform=linux/amd64 node:22-bookworm-slim AS builder` → `node:24-bookworm-slim`.
- Runtime stage `FROM gcr.io/distroless/nodejs22-debian12` → `gcr.io/distroless/nodejs24-debian12`.
- Inline design comments referencing `22` → `24`.
- Bump `@levu304/excelrs` `^2.8.0` → `^2.8.1` in `packages/viewer/package.json` and refresh `pnpm-lock.yaml` (adds the new `-linux-x64-musl` / `-linux-arm64-musl` platform entries; the `linux-x64-gnu` binary used by the image is unchanged).

No change to viewer source or specs — the renderer is untouched, and the `linux/amd64` + glibc distroless architecture that `excelrs` requires is **preserved** (D3 rationale from `onlyoffice-spreadsheet-viewer` change).

**Assumption (confirm at apply, not a spec change):** target Node 24 LTS. Alternatives:
stay on 22 until EOL, or jump to an even-numbered LTS. Odd releases (23/25) are non-LTS
and not considered.

## Capabilities
None. This is an infra/build-image change — **no spec-level behavior change** (the
spreadsheet HTML output is identical; only the container base image moves). Per schema
rules, this declares no capabilities and sets `skip_specs: true` in `.openspec.yaml`; no
requirement is invented to satisfy validation.

## Impact
- `packages/viewer/Dockerfile` (two `FROM` lines + comment wording).
- Runtime footprint unchanged (~150 MB glibc distroless base + ~8 MB prod deps, still
  under the 200 MB D3 target; builder stays `bookworm-slim` which has a shell for `tsc`).
- `@levu304/excelrs` binary: unaffected (N-API, `linux-x64-gnu`, Node-major-agnostic); 2.8.1 adds `linux-x64-musl`/`linux-arm64-musl` — unused by the glibc base, but locked now to unblock the deferred Alpine switch.
- `packages/viewer/package.json` + `pnpm-lock.yaml`: bumped `^2.8.0` → `^2.8.1`; builder still uses `npm install` per D3 (`npm`→`pnpm` alignment remains a separate change).
- CI: rebuild+push `viewer` image; no data migration (stateless service; rollback = revert tags).

## Out of Scope (separate changes)
- Switching the builder from `npm install` → `pnpm install` (repo is pnpm-managed).
- Image slimming / multi-stage rework beyond the version bump.
- Adding SBOM or dependency-scanning layers.