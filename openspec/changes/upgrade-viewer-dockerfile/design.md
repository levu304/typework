## Goals / Non-Goals
**Goals:**
- Move the deploy container to a maintained Node LTS base (24) with a continuing security-patch runway.
- Preserve the D3 architecture (glibc `bookworm-slim` builder + distroless `nodejsNN-debian12` runtime on `linux/amd64`) that the `@levu304/excelrs` `linux-x64-gnu` native addon requires.
- Keep runtime footprint under the 200 MB target (~150 MB distroless base + ~8 MB prod deps).
- Align `@levu304/excelrs` to the latest minor `2.8.1` (adds `-musl` platform packages; the `linux-x64-gnu` surface used by the image is ABI-identical).

**Non-Goals:**
- Switching the builder from `npm install` to `pnpm` (repo is pnpm-managed; Dockerfile uses `npm` per D3). Deferred — a distinct change.
- Image slimming or multi-stage rework beyond the base-image version bump.
- Adding SBOM / dependency-scanning layers.

## Decisions
- **Node 24 LTS over Node 26 and over staying on 22.** Node 22 is in maintenance (EOL April 2027); 24 is the current stable LTS with the longest remaining patch window. Odd releases (23/25) and the non-LTS 26-track are excluded.
- **Keep `bookworm-slim` builder + `nodejs24-debian12` distroless runtime.** Distroless `nodejs`-tags follow the `nodejs<NN>-debian<codename>` scheme; Debian 12 (bookworm) is the distroless base for Node 24. This keeps the glibc runtime the `excelrs` binary is compiled for.
- **Stay on glibc/Debian for this change; Alpine is deferred, not blocked.** When this was scoped, `@excelrs` ≤2.8.0 exposed only glibc `-linux-x64-gnu` / `-linux-arm64-gnu` (no musl), so an Alpine base could not load the addon. **v2.8.1 added musl** (`-linux-x64-musl` / `-linux-arm64-musl`); this change bumps the lock to 2.8.1 so the musl variant is actually present, making the future Alpine switch a pure `FROM` swap — Alpine is now viable. It is deferred to a separate change (swap `FROM` to `node:24-alpine`, ~150 MB → ~40 MB, losing distroless's no-shell hardening for a musl runtime excelrs has not yet exercised). This change keeps the proven glibc distroless path.
- **N-API addon is safe across the bump.** `@levu304/excelrs` 2.8.x ships a prebuilt `linux-x64-gnu` binary via N-API (ABI-stable, not pinned to a Node-ABI), so a Node major bump requires no native recompile.
- **Bump `@levu304/excelrs` to 2.8.1 in this change.** v2.8.1 only adds platform packages (`-linux-x64-musl`, `-linux-arm64-musl`) over 2.8.0 — the same glibc binary the image builds, same ABI as the already-installed native. Cheap to take now, and it materializes the musl binary in the lock so the later Alpine switch is a `FROM` swap rather than a bigger dependency change.

## Risks / Trade-Offs
- [Distroless tag drift] → verify `gcr.io/distroless/nodejs24-debian12` exists before merge; if absent, fall back to `gcr.io/distroless/nodejs24` and pin by digest.
- [EOL / tag removal] → base tag is pinned to the LTS major line only; schedule an annual review of the Node LTS calendar.
- [Node 24 runtime behavior change] → mitigated by running `scripts/probe.cjs` (excelrs load check) and a smoke render (`GET /view?url=…/custom-theme.xlsx`) during build verification.

## Migration Plan
- CI `docker/build-push` rebuilds on `linux/amd64`; tag the new image `viewer:<next>`.
- Rollback = revert the two `FROM` tags (instant, no data migration — the service is stateless).

## Open Questions
- Confirm Node 24 LTS is the desired target (vs. staying on 22 or another LTS line).
- Confirm `gcr.io/distroless/nodejs24-debian12` exists at apply time.