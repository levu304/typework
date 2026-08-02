# Proposal: update-roadmap

## Why

`ROADMAP.md` has drifted from the committed repository state and now misleads
contributors about what is done and what comes next. The gap is concrete, not
narrative:

1. **M0 is described "in progress"** with "Next: run excelrs probe (todo #2)"
   — but `feat(viewer)` and `feat(react-viewer)` are already committed, and the
   probe passes (`PROBE_OK`: engine 2.6.0, 4 ms, 4.2 MB heap on the
   `custom-theme.xlsx` fixture). The probe gate is already cleared.
2. **The commit label 'M2' collides with the roadmap's existing M2.** The
   milestone table already HAS an `M2` row, but it is titled 'xlsx coverage'
   (streaming excelrs v2.0) — *not* the react-viewer. `packages/react-viewer`
   is committed ('add M2 React iframe shim wrapper') but has **no row** in the
   roadmap at all. So the shim is shipped yet undocumented, AND its 'M2' label
   collides with the table's M2 (xlsx coverage). Contributors cannot tell
   whether 'M2' means the shim or the streaming-coverage milestone.
3. **The stress smoke path is wrong.** ROADMAP points at
   `scripts/stress.mjs` for the C1 memory/perf exit criteria ("measured p95 of
   `stress` smoke"). No such script exists. The real gate lives in
   `packages/viewer/__test__/perf.test.ts` (10 000-row in-memory workbook,
   asserts `heapUsed < 512 MB` and `< 5s`). A contributor chasing exit
   criteria chases a ghost file.
4. **The excelrs streaming tradeoff is undocumented in roadmap context.** The
   archived design (D3/D4) notes excelrs's `StreamReader`/`WorkbookStreamXlsx`
   yields *values only* with no styles/merges/freeze, so the full-model
   `WorkbookXlsx.read` is used instead — which is what makes task 3.2's
   `workbookFromBuffer` an async-contract gate. ROADMAP's C1/C2 constraints
   and "excelrs streaming read" comment in the archived design are coherent,
   but the relationship between "full-model read" and "≤512 MB ceiling" is not
   captured in the current-state section, so the risk profile is understated.

Net: the roadmap still reads as a planning document for an empty repo, but the
repo is past M1 (with a passing engine probe) and ships a `react-viewer` shim
that is neither in the milestone table nor reconciled against the table's
existing M2 (xlsx coverage). Contributors will either redundantly re-run an
already-cleared probe, chase a non-existent smoke script, or conflate the two
'M2' labels.

## What Changes

Rewrite `ROADMAP.md` **in place** (no source changes, no package changes) so
the single source of truth for milestones, constraints, and current state
matches committed reality:

- M0: mark **complete** — scaffold ✓, change artifacts ✓, **probe PROBE_OK**
  (engine 2.6.0, 4 ms read, 4.2 MB heap). Remove the stale "Next: run
  excelrs probe" todo.
- M1: mark **complete** — `packages/viewer` HTTP service + renderer +
  fail-loud paths + sheet nav + memory smoke all shipped and tested.
- react-viewer: **document as a shipped host-integration package** in Current
  State (committed, but absent from the roadmap). Do **not** clobber the
  existing numeric `M2` (`xlsx coverage`) — `react-viewer` is a non-service
  package (growth rule: 'New service = packages/<svc>'); the commit label
  'M2' and the table's 'M2' are a collision to reconcile in prose, not a
  milestone to insert. M2 (xlsx coverage) stays.
- M3–M6: unchanged.
- Fix the C1 exit-criteria reference: `scripts/stress.mjs` →
  `packages/viewer/__test__/perf.test.ts` (the real heap/<5 s gate).
- Current-state section: record (a) probe result, (b) the full-model-read
  tradeoff and why it still satisfies the 512 MB ceiling on the perf smoke,
  (c) excelrs read-path gaps (column widths, formula cached results) as known
  constraints surfaced by the renderer, so future readers don't re-treat them
  as todos.

## Non-Goals

- Not an implementation change. No `*.ts`, no Dockerfile edits, no new
  packages, no dependency churn.
- Not a spec/design rewrite for M3–M6. Those milestones retain their own
  future proposals; this change only reconciles prose vs. git.
- Not a process mandate (e.g., does not require per-commit ROADMAP CI gates).
  A future change may add that; this one just makes the file truthful once.

## Capabilities

- `project-knowledge` (modified): `ROADMAP.md` is the project's milestone and
  constraint register; this change brings it into sync with committed state.

(No domain capability is added, removed, or modified — this is a knowledge
asset, not a product feature.)

## Constraints

- Footprint (C1), embeddable (C2), fail-loud (C4) remain the binding
  constraints for all milestones; this change restates, not relaxes, them.
- The 512 MB ceiling is asserted by `perf.test.ts` (10 000-row fixture), not by
  a `scripts/stress.mjs` harness — the corrected gate stays within C1.

## Assumptions

- Commit history is the source of truth for what shipped (`feat(viewer)`,
  `feat(react-viewer)`). The probe's PROBE_OK is the gate outcome.
- The numeric `M2` (xlsx coverage) is a *viewer-capability* milestone and stays
  in place; `react-viewer` is a non-service host-SDK package and is documented
  as such (not inserted as a numbered milestone). If the author instead intends
  the react-viewer to *be* M2, that renumbers xlsx-coverage — a decision this
  change leaves to the author (see design.md D2).
- Future milestones (M3–M6) are intentionally left as-is; each will land its
  own OpenSpec change before applying.

## Impact

- Single file: `ROADMAP.md` rewritten to reflect M0/M1 complete, react-viewer
  documented as a shipped host-SDK package, M2 (xlsx coverage) left intact,
  M3–M6 pending, with the corrected smoke-test reference and an honest
  current-state section.
- No code, no packages, no CI, no public API surface.
- Reduces contributor confusion: the probe todo and the phantom `stress.mjs`
  path are removed; the react-viewer/M2 naming collision is reconciled in
  prose rather than by clobbering the existing milestone.
- Sets up the next proposal (whichever of M3/M4/M5/M6 is chosen next) with a
  truthful baseline instead of a backlog of phantom "next" steps.