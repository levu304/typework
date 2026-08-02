## Purpose

Keeps `ROADMAP.md` truthful as the project's milestone, constraint, and
current-state register by asserting what the document must state so that it
matches committed repository state.

## ADDED Requirements

### Requirement: M0 milestone marked complete with probe evidence

The roadmap SHALL state that M0 (foundation) is **complete**: monorepo
scaffold, `openspec` change artifacts validated, and the excelrs probe passes.

#### Scenario: probe outcome is recorded

- **WHEN** a contributor reads the M0 "Current state" entry
- **THEN** the document states `PROBE_OK` with engine version, read latency,
  and heap figure (e.g. engine 2.6.0, ~4 ms, ~4.2 MB) — not a pending "run the
  probe" todo

#### Scenario: no stale next step for the probe

- **WHEN** the M0 section is inspected
- **THEN** it does NOT say "Next: run excelrs probe" as an open todo

### Requirement: M2 milestone exists in the milestone table

The roadmap SHALL include an M2 row for the `@typework/react-viewer` React
`<iframe>` shim placed between M1 and M3.

#### Scenario: M2 row present

- **WHEN** the milestone table is read
- **THEN** a row exists with ID `M2`, name `react-viewer`, and a scope noting
  it is a thin React wrapper hosting the static viewer service in an iframe

### Requirement: smoke-test gate references the real test file

The roadmap SHALL point the C1 exit criteria at
`packages/viewer/__test__/perf.test.ts`, not `scripts/stress.mjs`.

#### Scenario: no phantom stress script path

- **WHEN** the C1 exit-criteria lines are inspected
- **THEN** the path referenced is `packages/viewer/__test__/perf.test.ts`
- **AND WHEN** `scripts/stress.mjs` is searched
- **THEN** it does NOT exist in the repository

### Requirement: excelrs read-path tradeoffs are surfaced in current state

The roadmap's current-state section SHALL record that excelrs's
`StreamReader`/`WorkbookStreamXlsx` exposes values only (no styles/merges/
freeze), so the full-model `wb.xlsx.read` is used, and this still satisfies
the 512 MB ceiling via the perf smoke.

#### Scenario: streaming tradeoff documented

- **WHEN** a contributor evaluates whether parsing streams or buffers the full
  workbook
- **THEN** the roadmap states the full-model read is chosen because the
  streaming reader omits styles, and that the 10 000-row perf smoke stays
  under the 512 MB ceiling

### Requirement: excelrs read-path gaps are listed as known constraints

The roadmap SHALL list the excelrs read-path gaps the renderer works around as
known, accepted limitations rather than pending todos.

#### Scenario: column-width gap is documented

- **WHEN** the excelrs read-path limitations are listed
- **THEN** the document states excelrs does not expose column widths on read
  (`ws.columns` empty on parsed XLSX), so the renderer auto-fits from content
  with a default

#### Scenario: formula cached-result gap is documented

- **WHEN** the excelrs read-path limitations are listed
- **THEN** the document states excelrs does not author formula cached results
  on write, so read-back formula cells render as `=formula` text and the
  cached-result scenario is exercised only at the unit level

### Requirement: M3 through M6 are unchanged

The roadmap SHALL leave milestones M3 (conversion), M4 (builder), M5
(command), and M6 (edit/collab, optional) identical to the previous revision.

#### Scenario: milestones preserved

- **WHEN** the M3–M6 rows are read
- **THEN** their IDs, names, scope drops, and exit criteria match the prior
  revision exactly

## REMOVED Requirements

(none — no capability is removed; this change only reconciles `ROADMAP.md`
prose with committed state.)