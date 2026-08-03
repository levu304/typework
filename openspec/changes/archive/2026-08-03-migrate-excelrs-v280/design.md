# Design: migrate-excelrs-v280

## Context

See `proposal.md` → Why for motivation. In short: project pins
`@levu304/excelrs@2.6.0`; 2.7/2.8 published same day as the scaffold. The renderer
already holds a dead cached-value branch (`src/renderer.ts` ~281-289): on 2.6.0 a
formula cell's `cell.value` is the object `{ valueType:'Formula', …, formula:'SUM(A1:A2)' }`
and `cell.cachedValue` exists but returns `null`, so the branch never fires and every
formula renders `=SUM(...)`. The baseline `spreadsheet-view` spec already *promised*
cached-value rendering; this change makes it real.

## Goals / Non-Goals

**Goals:**
- Formula cells with an Excel-embedded cached value render that value (via excelrs
  `Cell.cachedValue` on ≥2.7).
- Formula cells with **no** cached value still render `=formula` text (preserve 2.6
  behaviour — existing test asserts `=SUM(B2:C2)`).
- `pnpm test` + `scripts/probe.cjs` green on 2.8.0; perf budget (<512 MB / <5 s) unchanged.
- No new HTTP surface, no editor/assets, no new dependencies.

**Non-Goals:**
- In-memory formula recalculation (`Worksheet::recalculate()` is Rust-only; JS exposure
  deferred by the author — see D1).
- Authoring a cached value into XLSX via the write path.
- Porting to linux-arm64 (v2.8.0's only addition).
- The column-widths gap (excelrs read path exposes no widths) — retained, not regressed.

## Decisions

### D1 — read embedded cached values, never recompute
Source of truth for a formula cell's value = `Cell.cachedValue` (excelrs ≥2.7). Do **not**
attempt `Workbook::recalculate()` / `FormulaEvaluator`: the changelog states these are
Rust-only ("JS exposure deferred"). Consequence (accepted ceiling): a file Excel saved
without "calc before save" carries no embedded cache and renders `=formula`. This is the
correct fallback, not a bug — we never claim to recompute.

### D2 — keep the `=formula` fallback as the regression guard
When `cachedValue` is `null`, render `=formula`. This matches the 2.6.0 behaviour the
existing `renderer.test.ts` fixture (`buildStyledBuffer`, D2 `=SUM(B2:C2)`) encodes, so
the no-cache path is locked by an existing assertion.

### D3 — bump to 2.8.0 (latest), not 2.7.0
2.8.0 adds only a `linux-arm64-gnu` binary (irrelevant here), but it is the latest stable
and a minor bump from 2.6. `optionalDependencies` on the platform packages
(`excelrs-darwin-arm64`, `excelrs-linux-x64-gnu`, …) must all advance in lock-step. ABI
compat assumed (exceljs semver); if model walkers break, fall back to 2.7.0 (D4 bail-out).

### D4 — leave the streaming read seam alone
excelrs 2.7 adds `formula-eval` (incl. `xlstream-parse`/`xlstream-core`). We do not use it
on the read path: the renderer needs the full model (styles/merges/freeze), which the
streaming reader explicitly does *not* carry (per the onlyoffice design record).
Full-model `WorkbookXlsx.read` already meets the perf ceiling (10k rows, 19 MB heap).

## Risks / Trade-offs

- **cachedValue is read-only** (confirmed by spike on 2.8.0): excelrs's *write* API does
  not embed an Excel cached `<v>` — authoring `cell.cachedValue` (and value-object
  shapes) round-trips to `null` on read-back. The getter is real and surfaces
  Excel-embedded caches (files saved by Excel with "calc before save"), but we
  cannot produce one from the test write path. No regression: cells with no cache
  render `=formula` (D2). The cached-value render path is therefore unit-tested via
  `formatCellValue` with a crafted `cachedValue`, matching `fixtures.ts`'s documented
  convention.
- **ABI break 2.6 → 2.8** — surface only via `pnpm install` + full `vitest` run; bail to
  2.7.0 if the model walkers (`getCell` / `views` / `mergeCells` / `columns`) change shape.
- **No XLSX fixture can carry a cached value** (excelrs write won't author one, see
  above). The cached-value happy path is locked by the `formatCellValue` unit test
  (crafted `cachedValue`), not by an end-to-end XLSX. `buildStyledBuffer` keeps
  `D2 = SUM(B2:C2)` (no cache) as the no-cache `=formula` regression guard — it cannot
  be repurposed as a cached-value case.
- **Column-widths** still unmet (excelrs read path). Documented retained limitation; not
  re-opened here.

## Affected code

- `packages/viewer/package.json` — dep + optional-dep versions 2.6.0 → 2.8.0.
- `src/renderer.ts` — `CellLike` gains `cachedValue`; `cellText()` reads the runtime
  getter (via a local `Cell & { cachedValue?: unknown }` cast, since 2.8.0 types omit it);
  formula branch now consults `cachedValue` first, falling back to `=formula`.
- `__test__/fixtures.ts` — **unchanged**: excelrs can't author a cached-value XLSX cell, so
  no new fixture cell is added; `D2` (no cache) stays the `=SUM(B2:C2)` regression guard.
- `__test__/renderer.test.ts` — assert cached number / cached `Date`(numFmt) / cached
  `Error` render via `formatCellValue`; keep `=SUM(B2:C2)` no-cache assertion.