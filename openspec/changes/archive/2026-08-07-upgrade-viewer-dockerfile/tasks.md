## 1. Verify baseline
- [x] 1.1 Boot a `node:24-bookworm-slim` builder and run `packages/viewer/scripts/probe.cjs`; expect a fresh `PROBE_OK` line (excelrs N-API binary loads under Node 24). — verified: Node v24.19.0, engine 2.8.1, `PROBE_OK`.
- [x] 1.2 Confirm `gcr.io/distroless/nodejs24-debian12` exists in the distroless registry. — verified via `buildx imagetools inspect` (digest present).

## 2. Bump @levu304/excelrs to 2.8.1
- [x] 2.1 Edit `packages/viewer/package.json`: `@levu304/excelrs` `^2.8.0` → `^2.8.1`.
- [x] 2.2 Refresh the lock (`pnpm install`); confirm `pnpm-lock.yaml` lists `@levu304/excelrs@2.8.1` plus the new `-linux-x64-musl` / `-linux-arm64-musl` platform entries.
- [x] 2.3 Regression: `pnpm -r test` green (27/27) and `scripts/probe.cjs` reports `engine: 2.8.1` — cached-formula rendering unchanged.

## 3. Bump Dockerfile base images
- [x] 3.1 Edit builder stage: `node:22-bookworm-slim` → `node:24-bookworm-slim`; update `22` references in inline comments.
- [x] 3.2 Edit runtime stage: `gcr.io/distroless/nodejs22-debian12` → `gcr.io/distroless/nodejs24-debian12`; update `22` references in ENV/comments.

## 4. Build + smoke render
- [x] 4.1 Build the image for `linux/amd64` (`docker buildx build --platform linux/amd64`). — built as `typework-viewer:upgrade24`; pre-existing `FromPlatformFlagConstDisallowed` warning is the intentional amd64 pin (D3).
- [x] 4.2 Run the container; `GET /view/custom-theme` returns 200 with rendered HTML (confirms the excelrs addon loads under Node 24 with 2.8.1). — 200, 1263 B, `<table>` + "Custom Theme" rendered. Note: `GET /view?url=…` is the *remote-fetch* route; the collocated fixture resolves via `/view/custom-theme` (Dockerfile comment + `index.ts`).

## 5. Finalize
- [x] 5.1 If the Node target differs from 24, update the assumption notes in `proposal.md` + `design.md` Decisions. — target confirmed 24; proposal/design already state 24, no change needed.
- [x] 5.2 Commit + push `feat(viewer): upgrade Dockerfile Node 22 -> 24 LTS base and excelrs 2.8.1`.