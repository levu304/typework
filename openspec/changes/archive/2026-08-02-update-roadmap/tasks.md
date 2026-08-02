# Tasks: update-roadmap

## 1. Reconcile M0/M1 status

- [x] 1.1 Mark M0 "complete" — scaffold ✓, OpenSpec artifacts ✓, probe `PROBE_OK`.
- [x] 1.2 Remove the stale "Next: run excelrs probe (todo #2)" line from Current State.
- [x] 1.3 Mark M1 (viewer) "complete" — service + renderer + fail-loud + nav + memory smoke shipped.

## 2. Reconcile react-viewer vs. the existing M2 milestone

- [x] 2.1 Do NOT insert an M2 row for react-viewer (collides with the existing
      'xlsx coverage' M2).
- [x] 2.2 Document `packages/react-viewer` as a shipped host-integration package
      (iframe shim) in Current State.
- [x] 2.3 Reconcile the naming collision in prose: git commit calls it 'M2',
      roadM2 is 'xlsx coverage'; state they are distinct.

## 3. Fix the smoke-test reference

- [x] 3.1 Replace `scripts/stress.mjs` with `packages/viewer/__test__/perf.test.ts` in the C1 exit criteria.
- [x] 3.2 Confirm `scripts/stress.mjs` is not introduced (it must remain absent).

## 4. Update Current State to match git reality

- [x] 4.1 Record the exact probe output: engine 2.6.0, ~4 ms read, ~4.2 MB heap.
- [x] 4.2 Add the full-model-read tradeoff note: excelrs `StreamReader` lacks styles/merges/freeze, so `wb.xlsx.read` (async-contract gate in `workbookFromBuffer`) is used; perf smoke stays < 512 MB.
- [x] 4.3 Add the two excelrs read-path gaps as known constraints: (a) column widths not exposed on read → renderer auto-fit, (b) formula cached results not authored on write → render `=formula` text, cached-result path unit-tested only via `formatCellValue`.

## 5. Leave M3–M6 untouched

- [x] 5.1 Verify M3/M4/M5/M6 rows are byte-identical to the prior revision (diff only the M0/M1/M2/C1/current-state regions).

## 6. Validate

- [x] 6.1 `openspec validate --change update-roadmap` passes (0 failures).
- [x] 6.2 `node packages/viewer/scripts/probe.cjs` prints `PROBE_OK`.
- [x] 6.3 `ls scripts/stress.mjs` fails; `ls packages/viewer/__test__/perf.test.ts` succeeds.