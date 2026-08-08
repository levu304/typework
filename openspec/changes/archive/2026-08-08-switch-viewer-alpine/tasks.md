# Tasks — switch-viewer-alpine (retrospective)

> Change investigated and **reverted**: the "~150 MB → ~40 MB" size premise was false. Alpine
> is larger than distroless (178 MB vs 157 MB) and loses no-shell hardening. Dockerfile
> reverted to HEAD (glibc distroless). Zero application delta. Archived as superseded.

## 1. Verify baseline
- [x] 1.1 Boot a `node:24-alpine` builder and run `packages/viewer/scripts/probe.cjs`; expect a fresh `PROBE_OK` line (the `-linux-x64-musl` excelrs binary loads under Node 24 / musl).
  verified: `engine 2.9.1`, `PROBE_OK` (musl loads fine under Node 24 on alpine).
- [x] 1.2 Confirm `node:24-alpine` exists in the Docker registry.
  verified via `docker manifest inspect node:24-alpine` (exists, amd64 digest present).

## 2. Bump Dockerfile base images (spiked, then reverted)
- [x] 2.1 Edit builder stage: `node:24-bookworm-slim` → `node:24-alpine`.
  applied, then reverted.
- [x] 2.2 Edit runtime stage: `gcr.io/distroless/nodejs24-debian12` → `node:24-alpine`; change `CMD ["dist/index.js"]` → `CMD ["node", "dist/index.js"]`.
  applied, then reverted.
- [x] 2.3 Keep `--platform=linux/amd64` (linux-x64-musl = amd64); no arm64.
  unchanged.
- [x] 2.4 Update the D3 base-rationale header comment: state Alpine is now the chosen base (not deferred); fix the builder/runtime comment block (glibc/distroless → musl/alpine).
  applied, then reverted.

## 3. Build + smoke render (spiked, then reverted)
- [x] 3.1 Build the image for `linux/amd64` (`docker buildx build --platform linux/amd64`).
  built `typework-viewer:alpine` (SUCCESS); pre-existing `FromPlatformFlagConstDisallowed` lint warning noted (constant `--platform` in `FROM`).
- [x] 3.2 Run the container; `GET /view/custom-theme` returns 200 with rendered HTML (confirms the musl addon loads under Node 24 on Alpine).
  verified: HTTP 200, 1263-byte rendered HTML.
- [x] 3.3 Confirm image size dropped (~150 MB → ~40 MB) via `docker image inspect --format '{{.Size}}'`.
  measured: **178 MB** — NOT smaller. Disproves the premise; triggers revert.

## 4. Finalize (decision: do not ship)
- [x] 4.1 If the chosen base differs from `node:24-alpine`, update the assumption notes in `proposal.md` + `design.md` Decisions.
  base matches `node:24-alpine`, but the change is abandoned — updated `proposal.md`/`design.md`
  with an Outcome section documenting the disproved premise instead.
- [x] 4.2 Commit + push `feat(viewer): switch Docker base to Alpine/musl (node:24-alpine)`.
  **Not committed.** Change reverted; Dockerfile == HEAD. Artifacts updated to record the
  decision; change archived as superseded (no net code change to push).