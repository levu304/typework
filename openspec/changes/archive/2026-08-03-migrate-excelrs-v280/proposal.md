# Proposal: migrate-excelrs-v280

## Why

Project pins `@levu304/excelrs@2.6.0`. excelrs **2.7.0** and **2.8.0** shipped 2026-08-02 — the
same release-day as this project's scaffold — and we are one minor behind.

The upgrade is not about v2.8's contents: v2.8.0's **only** change is a
`linux-arm64-gnu` prebuilt native binary. That helps Graviton/arm64-Linux containers, **not**
our current targets (dev = darwin-arm64, deploy = linux-x64 via `node:22-bookworm`).

The motivation is **v2.7.0** transitively reaching us by targeting v2.8.0:

- **`Cell.cachedValue` JS getter** (added 2.7.0) returns the cached computed value Excel
  stores alongside a formula (`<f>…</f><v>…</v>`).
- **`formula-eval` Cargo feature** (built into release binaries since 2.7.0) — not needed
  now, but the gate is compiled in for a future spike (in-memory recalc stays Rust-only;
  JS exposure deferred by the author).

Today our renderer already contains a cached-value branch that is **dead on 2.6.0**.
Verified empirically: on 2.6.0 a round-tripped formula cell surfaces
`cell.value` = `{ valueType:'Formula', …, formula:'SUM(A1:A2)' }` — an **object**, never a
primitive — so `typeof v !== 'object'` never holds and every formula renders as `=SUM(...)`
text. `cell.cachedValue` exists as a property but returns `null`. The
`specs/spreadsheet-view/spec.md` "formula cell → cached result" requirement is therefore
spec'd but un-implemented. Bumping to ≥2.7 lets the existing branch fire for real.

## What Changes

- **Bump** `@levu304/excelrs` `2.6.0` → `2.8.0` in `packages/viewer/package.json` (and align
  the per-platform optional-deps `excelrs-darwin-arm64` / linux-x64). `pnpm install`
  rebuilds the native addon.
- **Renderer** (`src/renderer.ts` formula branch, lines ~281–289): read `cell.cachedValue`
  for formula cells when the XLSX embeds a cached `<v>`; keep the `=formula` text fallback
  when no cached value is present (excelrs-authored fixtures and any file Excel saved
  without "calc before save").

That is the entire surface. No new HTTP routes, no new package, no public API change beyond
the existing `/view/:id` and `/view?url=…`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- **`spreadsheet-view`** (delta): formula-cell rendering now surfaces excelrs `Cell.cachedValue`
  when the XLSX embeds a cached value, satisfying the already-present `render-cell-values`
  "formula cell → cached result" scenario. A new scenario covers files with **no** cached
  value (renders `=formula` text). **Column-widths conflict retained as a known limitation** —
  excelrs read path still exposes no column widths on either 2.6 or ≥2.7; auto-fit-from-content
  behaviour is unchanged.

## Non-Goals

- In-memory formula recalculation: the author's `Worksheet::recalculate()` is Rust-only
  ("JS exposure deferred"), so we read **only** Excel-embedded cached values, never compute.
- Author a cached value into the XLSX via the write path.
- Port to linux-arm64 deployment (v2.8.0's binary) — not a current target.
- Fix the column-widths gap — out of scope; excelrs exposes nothing on the read path.

## Assumptions

- `Cell.cachedValue` on ≥2.7 returns Excel-embedded cached `<v>` for formula cells.
  **Empirical confirm required after the bump** (see tasks): a fixture with an embedded
  cached value must read back the number, not `null`.
- excelrs ≥2.7 binaries are ABI/back-compat for our existing model walkers
  (`Worksheet`, `getCell`, `views`, `mergeCells`, `columns`) — no field renames expected.
  Will surface as a compile/test break if wrong.

## Constraints

- Memory/perf budget holds: render 1 MB XLSX < 512 MB heap, < 5 s. Re-run the v2.6 baseline
  perf smoke (`__test__/perf.test.ts`) on the bumped engine.
- Stay static-HTML, no-editor (D1/D2) — the upgrade must not pull editor assets.

## Impact

- `packages/viewer/package.json` — dep + optional-dep version bump; `pnpm install`.
- `src/renderer.ts` — formula branch becomes reachable; `=formula` fallback retained.
- `__test__/fixtures.ts` — add a formula-cell-with-cached-value fixture; existing fixture
  (no cached value) locks the fallback path.
- `__test__/renderer.test.ts` — assert cached number renders for the new fixture; assert
  `=SUM(B2:C2)` still renders for the no-cached fixture (regression guard on 2.6 behaviour).
- No change to `packages/react-viewer` or `openspec/` main specs.