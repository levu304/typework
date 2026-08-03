# Tasks: migrate-excelrs-v280

Bump `@levu304/excelrs` 2.6.0 → 2.8.0 and make the renderer's cached-value branch fire
for formula cells (excelrs ≥2.7 `Cell.cachedValue`), keeping `=formula` fallback for
files with no embedded cache.

## 1. Bump engine
- [x] 1.1 Bump `@levu304/excelrs` `^2.6.0` → `^2.8.0` in `packages/viewer/package.json`
      (simplified — no `optionalDependencies` block in this repo; platform binaries are
      declared inside excelrs itself; the single dep bump pulls the matching
      darwin-arm64 / linux-x64-gnu binary via pnpm resolution).
- [x] 1.2 `pnpm install` — `+2 -2` swapped platform binary packages; addon rebuilt.
- [x] 1.3 `node packages/viewer/scripts/probe.cjs` → `PROBE_OK`; engine 2.8.0, 3 ms /
      4.1 MB (well under 5 s / 512 MB).

## 2. Verify the cached-value contract (gate before rendering)
- [x] 2.1 Spike (excelrs 2.8.0): author a formula cell with an embedded cached value via
      `cell.formula`+`cell.cachedValue` and via value-object shapes — read back all →
      `cachedValue` **null** every time. CONFIRMED read-only: excelrs write does not persist
      an Excel cached `<v>`. Gates D1: cached rendering serves Excel-authored files only;
      test-coverage moves to unit level.
- [x] 2.2 Decision: NOT a stop. `cachedValue` branch still ships real capability (reads
      Excel-embedded caches); since excelrs can't author one, the cached path is unit-tested
      via `formatCellValue(cachedValue)` (matches `fixtures.ts` convention). No-cache XLSX
      fixtures render `=formula` (kept as regression guard).

## 3. Renderer edit (depends on 2.1)
- [x] 3.1 Extend `CellLike` with `cachedValue: unknown`; `cellText()` reads `cell.cachedValue`
      via a local `Cell & { cachedValue?: unknown }` cast (excelrs 2.8.0 TS types omit the getter).
- [x] 3.2 Rewrote the `formatCellValue` formula branch: cachedValue-first (number → formatNumber+numFmt;
      Date → formatDate+numFmt; Boolean → TRUE/FALSE; string → as-is; Error value-type → ERROR_MAP;
      else String(cv)), `=formula` fallback when null.
- [x] 3.3 `tsc --noEmit` (viewer) clean → exit 0.

## 4. Tests (depends on 3)
- [x] 4.1 `buildStyledBuffer` left as no-cache case (`D2 = SUM(B2:C2)` → `=SUM(B2:C2)`); no
      cached-value XLSX cell added (excelrs can't author one — see 2.1).
- [x] 4.2 `renderer.test.ts`: +3 scenarios — cachedValue=30 → `30`; cached Date + numFmt →
      `2024-06-01`; cached Error Div0 → `#DIV/0!`; no-cache → `=SUM(B2:C2)` retained.
- [x] 4.3 `perf.test.ts` re-run → 231 ms / 19 MB on 10k rows (ceil <5 s / <512 MB).

## 5. Validate
- [x] 5.1 `openspec validate migrate-excelrs-v280` → change is valid (exit 0).
- [x] 5.2 `pnpm -r test` → 27 passed across `packages/viewer` (2 of 3 packages have a
      test script; the third — `react-viewer` — is a pure shim, no tests).

## Implementation Complete

Run `/opsx-archive` to finalize and archive `migrate-excelrs-v280`.