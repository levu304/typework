# Read-only spreadsheet viewer service (OpenSpec change: onlyoffice-spreadsheet-viewer)
#
# Base rationale (design D3 — deviated from ROADMAP "node:22-alpine"):
#   @levu304/excelrs ships a glibc native binary (`linux-x64-gnu`) only — there is
#   NO `linux-x64-musl` release, NO `-gnu`-on-musl fallback in its native.js, AND
#   NO linux/arm64 binary at all. So:
#     - glibc base (NOT alpine/musl — addon won't load there).
#     - --platform=linux/amd64 so the linux-x64-gnu addon matches (no arm64 wheel).
#     - distroless runtime: glibc node + no shell = ~150 MB base + ~8 MB prod deps,
#       comfortably under the 200 MB target.
#
# Builder: bookworm-slim (needs npm + shell for tsc). Runtime: distroless
# (glibc, entrypoint=/nodejs/bin/node, no package manager — just node + our files).
# npm install runs in the builder with `--no-cache`; the runtime stage COPYs the
# already-pruned production node_modules, so no pnpm/npm store bloat ships.

FROM --platform=linux/amd64 node:22-bookworm-slim AS builder
WORKDIR /build
# Viewer package manifest + source, plus the shared root tsconfig (the viewer
# tsconfig.json `extends ../../tsconfig.json`, which resolves to /tsconfig.json).
COPY packages/viewer/package.json packages/viewer/tsconfig.json ./
COPY packages/viewer/src ./src
COPY tsconfig.json /tsconfig.json
# Full install: devDeps (typescript) needed for the build below.
RUN npm install --no-audit --no-fund --no-cache
RUN npx tsc -p .
# Strip devDeps so only the production tree (excelrs native binary + deps) ships.
RUN npm prune --omit=dev --no-audit --no-fund --no-cache && npm cache clean --force
RUN mkdir -p /build/documents

FROM gcr.io/distroless/nodejs22-debian12
# distroless entrypoint is /nodejs/bin/node; CMD args are passed to node.
WORKDIR /app
COPY --from=builder /build/dist /app/dist
COPY --from=builder /build/node_modules /app/node_modules
COPY --from=builder /build/documents /app/documents
# Pinned fixture so `GET /view/custom-theme` (task 6.2) returns a rendered sheet:
# 9.7 KB — negligible image cost, and exercises the full parse→render→HTML path.
COPY packages/viewer/fixtures/custom-theme.xlsx /app/documents/custom-theme.xlsx
ENV NODE_ENV=production
EXPOSE 3000
CMD ["dist/index.js"]