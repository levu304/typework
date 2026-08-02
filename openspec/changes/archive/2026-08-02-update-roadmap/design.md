# Design: update-roadmap

## Decisions

### D1. Edit ROADMAP.md in place, do not rename or split

Rejected: creating `ROADMAP-v2.md` or splitting into `MILESTONES.md` +
`CONSTRAINTS.md`. ROADMAP.md is the named source of truth referenced by the
project; a parallel file doubles confusion. One file, updated section by
section, with the stale bits replaced rather than appended.

### D2. `react-viewer` is a host-SDK package, not the numeric M2 milestone

Decision: do **not** overwrite the roadmap's existing `M2` row (titled
'xlsx coverage via streaming'). `react-viewer` is a thin React wrapper host
SDK, not a document-server service — the growth rule ('New service =
packages/<svc>') scopes numbered milestones to services, and OnlyOffice's own
5-service split is what M0–M6 models. `react-iframe-shim` is an archived
standalone change (not a milestone), which confirms the shim is host
integration, not a numbered service milestone.

Instead: document `react-viewer` in Current State as a shipped package, and
reconcile the naming collision (the git commit calls it 'M2', the table's M2
is 'xlsx coverage') in prose so contributors stop conflating them.

If the author later decides the react-viewer *is* the M2 milestone, that is
a renumbering decision (shift xlsx-coverage to M3+) owned separately — out
of scope for this sync.

### D3. Mark M0/M1 complete, not "in progress"

Decision: set M0 and M1 status to **complete** with the probe result as the
gate evidence block, and remove the open "Next: run excelrs probe" line. The
probe already returned `PROBE_OK` (engine 2.6.0, 4 ms, 4.2 MB heap). Keeping
either as "in progress" forces a contributor to re-run a passing gate.

### D4. Replace the phantom `scripts/stress.mjs` reference

Decision: point the C1 exit criteria at
`packages/viewer/__test__/perf.test.ts`. The perf test is the real gate:
it authors a 10 000-row workbook in-memory with excelrs, renders it, and
asserts `heapUsed < 512 * 1024 * 1024` and `ms < 5000`. `scripts/stress.mjs`
never existed; the ROADMAP prose referenced it by intent, not by artifact.

### D5. Document the full-model-read tradeoff (not streaming) in current state

Decision: surface, in the Current State section, that excelrs's
`StreamReader`/`WorkbookStreamXlsx` yields values only (no styles, merges,
or freeze info), so `packages/viewer` uses the full-model
`wb.xlsx.read(buffer)` (an async-contract gate in `workbookFromBuffer`)
rather than a streaming parse. This is why `cell.style`, `mergeCells`, and
`views` are available to the renderer. The perf smoke still satisfies C1
because 10 000 rows fit well under 512 MB — but this is a *measured*,
not theoretical, ceiling, so the caveat stays attached.

### D6. List excelrs read-path gaps as known constraints

Decision: record the two renderer-side gaps the code already marks as
"CONFLICT (surfaced)" as **accepted limitations** in Current State, with the
upgrade path noted:
- column widths: excelrs does not expose `<col width>` on read
  (`ws.columns` empty on parsed XLSX); renderer auto-fits from cell content
  with `DEFAULT_COL_WIDTH_PX`. Upgrade path: if excelrs adds read-path width
  parsing, restore the `widths[c-1] * CHAR_TO_PX` branch.
- formula cached results: excelrs's write API does not author cached results,
  so read-back formula cells surface `type=Null + formula` and render as
  `=SUM(...)`. The cached-result scenario is exercised only at the unit level
  via `formatCellValue` on plain `CellLike` objects.

These are NOT new todos — they are pre-existing engine boundaries.

## Structure

ROADMAP.md is reorganized into the same top-level sections it already has,
with Current State corrected and the milestone table extended:

```
┌──────────────────────────────────────────────────────┐
│  Title + Goal + Target footprint                      │
│  (unchanged)                                          │
├──────────────────────────────────────────────────────┤
│  Universal constraints C1 / C2 / C3 / C4 / C5        │
│  C1 exit criteria: scripts/stress.mjs  ───▶  perf.test.ts  ← D4  │
├──────────────────────────────────────────────────┤
│  Milestone table:                                   │
│  M0 … M1 … M2(xlsx coverage) … M3 … M4/M5 … M6      │ ← M2 stays (D2) │
├──────────────────────────────────────────────────┤
│  Growth rule (unchanged)                            │
├──────────────────────────────────────────────────┤
│  OpenSpec mapping: M1 ↔ change; M2 ↔ react-iframe-shim;  │
│  M3+ get own change before applying (unchanged text)      │
├──────────────────────────────────────────────────┤
│  Current state:                                     │
│  • M0 complete, probe PROBE_OK (D3)                │
│  • M1 complete (viewer shipped + tested)           │
│  • react-viewer shipped; M2(xlsx coverage) pending │
│  • full-model read tradeoff (D5)                   │
│  • excelrs gaps as known constraints (D6)          │
└──────────────────────────────────────────────────┘
```

The milestone table's `Scope drop` and `Exit criteria` columns for M3–M6 are
left byte-for-byte intact (D1 — no split).

## Stack / artifacts touched

- **Touched:** `ROADMAP.md` (repo root).
- **Not touched:** `packages/*` source, Dockerfiles, CI, dependency manifests,
  any `*.ts`/`.tsx`.
- **No new packages**, no version bumps, no lockfile changes.
- The change's own artifacts (`openspec/changes/update-roadmap/`) document
  the reasoning; `openspec/specs/spreadsheet-view/spec.md` (the product spec)
  is unaffected and should NOT be modified here.

## Verification

A reviewer confirms the change by reading `ROADMAP.md` against git reality:
- `git log --oneline` shows `feat(viewer)` and `feat(react-viewer)`.
- `node packages/viewer/scripts/probe.cjs` prints `PROBE_OK`.
- `ls packages/viewer/__test__/perf.test.ts` exists; `ls scripts/stress.mjs`
  does not.
- `openspec validate --change update-roadmap` passes (the change's spec
  delta is internally consistent).