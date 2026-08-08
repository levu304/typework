# Design: switch-viewer-alpine

## Context
The viewer Dockerfile (see `packages/viewer/Dockerfile`) currently builds on Debian/glibc: a
`node:24-bookworm-slim` builder runs `npm install` + `npx tsc` + `npm prune`, and the runtime
stage copies the pruned `node_modules` onto `gcr.io/distroless/nodejs24-debian12`.

`@levu304/excelrs` (the native XLSX reader) is an N-API addon. It previously shipped only a
glibc build, forcing glibc bases. The `upgrade-viewer-dockerfile` change noted Alpine as a
deliberate follow-up once musl support shipped; excelrs 2.8.1 now publishes `-linux-x64-musl`
(+ `-linux-arm64-musl`), so this change was drafted to realize that follow-up.

See proposal.md — Why.

## Goals
- Adopt the originally-intended Alpine/musl base (ROADMAP intent) and shrink the image.
- Keep the existing build pipeline shape (npm install → tsc → prune → copy).

## Non-Goals
- No arm64 target.
- No no-shell/minimal-musl runtime (chainguard) — keeps the change to a pure `FROM` swap.
- No application code change.

## Decisions
1. **Both stages → `node:24-alpine`.** Builder keeps npm + shell for `tsc`; runtime is the same
   image (musl, has a shell). This is the simple, registry-free Alpine path.
2. **Keep `--platform=linux/amd64`.** The musl wheel we deploy is `linux-x64-musl` = amd64;
   arm64 is not a deploy target.
3. **No lock/package.json change.** The repo `pnpm-lock.yaml` already contains excelrs 2.8.1
   with `-linux-x64-musl` (added by the prior change). The image builder uses `npm install`
   against `package.json`, which resolves `^2.8.1` → 2.8.1 and, on Alpine/musl, selects the
   `-linux-x64-musl` optional dependency automatically (npm detects musl). No recompile.
4. **Runtime CMD → `CMD ["node", "dist/index.js"]`.** Distroless used an implicit `node`
   entrypoint passing the script as an arg; alpine's entrypoint is `node`, so make the command
   explicit. (`EXPOSE 3000` unchanged.)
5. **Update the D3 header comment** to state Alpine is now the chosen base (not deferred), and
   fix the builder/runtime comment block (glibc/distroless → musl/alpine).

## Risks / Tradeoffs
- **Loss of no-shell hardening.** Distroless gave a no-shell runtime; alpine has a shell.
  Acceptable for this internal read-only viewer; documented as the known cost of the ~110 MB
  size win.
- **Emulated builds on arm64 hosts.** Building `--platform=linux/amd64` alpine on an arm64 dev
  box runs under emulation; smoke still passes (verified in tasks).
- **musl vs glibc** has no effect on the excelrs addon (self-contained N-API binary,
  ABI-stable); the rendered HTML is byte-identical to the glibc build.

## Open Questions
None.

## Outcome (2026-08-08) — REVERTED, NOT PURSUED

All five decisions above were validated as *technically correct* (the swap builds and runs),
but the change's headline justification — shrinking ~150 MB → ~40 MB — was false:

| image (amd64)                         | size       |
|---------------------------------------|------------|
| `alpine:3.21` (OS only, no node)      | 7.8 MB     |
| `node:24-alpine` (base)               | 167 MB     |
| `gcr.io/distroless/nodejs24-debian12` | 146 MB     |
| built glibc image (HEAD)              | 157 MB     |
| built `node:24-alpine` image          | 178 MB     |

The ~125 MB Node binary is the dominant layer on every base. `node:24-alpine` is *larger* than
distroless because it also ships npm + yarn. A minimal-musl runtime is only achievable by
hand-copying the Node binary onto `alpine:3` (~141 MB, still a shell) or via chainguard — both
out of scope and neither beat distroless on size.

**Decision:** keep distroless glibc (157 MB, no-shell). The Dockerfile was temporarily edited
to `node:24-alpine` and then reverted to HEAD; this change is archived as superseded by
measurement, with zero application delta.