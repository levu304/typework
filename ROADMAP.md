# ROADMAP — typework: lightweight OnlyOffice Docs Server alternative

Goal: collaborative-online-office suite alternative. Stock OnlyOffice Docs Server =
Apache-2 Docker, 5 services (editing/command/conversion/builder/storage),
**>2 GB idle**. Target: **≤512 MB resident**, a *services monorepo* that grows
one package per service. `@levu304/excelrs` supplies xlsx **parse + typed model

+ styles only**; layout/rendering is fresh server-side code.

## Universal constraints (every milestone)

+ **C1 memory:** process heap resident ≤512 MB, measured p95 of a `stress` smoke
  (see each milestone's exit criteria; smoke lives at `packages/viewer/__test__/perf.test.ts`).
+ **C2 embeddable:** `<iframe src=.../>` renders with **JS disabled** in the
  client. No host-side JS coupling. Output is static HTML + CSS.
+ **C3 no editor-clone:** **NOT** DocsAPI/`@onlyoffice/document-editor-react`
  compatible. That React component only embeds an `<iframe>` whose editor UI is
  *served by the docs server* at `/web-apps/.../api.js`; matching it means
  reimplementing the editor client **+** the ws co-editing **+** JWT **+**
  shard-key protocol — the 2 GB part. We ship our own minimal viewer.
+ **C4 fail loud:** malformed/bad input → HTTP 4xx/5xx, never silent garbage.

Non-goals unless you pivot: real-time co-editing (M6), OAuth/SSO, full Office
format parity in v1, editor-side theme parity.

## Milestones

| ID | Name          | Ships                                                                  | Scope drop (keeps ceiling small)            | Exit criteria                                              |
|----|---------------|------------------------------------------------------------------------|---------------------------------------------|------------------------------------------------------------|
| M0 | foundation    | monorepo scaffold + openspec change (proposal/specs/design/tasks) +    | none                                        | `pnpm install` clean; excelrs probe passes; `openspec validate` ✓ |
|    |               | excelrs read-path probe on a fixture                                   |                                             |                                                            |
| M1 | **viewer**    | `packages/viewer`: xlsx → static HTML `<table>`, iframe-embeddable;    | no JS bundle, no editor, no co-editing,     | 5 fixture renders <5 s; heap <512 MB; HTTP 418 on bad      |
|    | **(v1)**      | core renders per `specs/spreadsheet-view/spec.md`: values, basic       | no JWT                                        | input; iframe renders JS-off; change archived after        |
|    |               | styles, merges, frozen panes, column widths                            |                                             |                                                          |
| M2 | xlsx coverage | expanded xlsx: cached formula values, cell comments, >10k-row sheets   | read-only, still no edit                     | fixtures + formula suite pass; probe <512 MB               |
|    |               | via streaming (excelrs v2.0)                                           |                                            |                                                            |
| M3 | conversion    | `packages/converter`: xlsx→pdf/png export (print-layout), headless     | no edit backend                              | export fixture; output valid; probe <512 MB               |
|    | svc           | layout; reuses excelrs model                                           |                                             |                                                            |
| M4 | builder svc   | `packages/builder`: programmatic doc generation (xlsx in, xlsx+pdf)    | no auth/authz service                        | gen script → byte-stable doc; 1 MB input <2 s            |
| M5 | command svc   | `packages/command`: save-status / force-save semantics, sqlite job     | not read-only-only                          | callback-contract smoke test; sqlite state only            |
|    |               | state, IF M3/M4 need coordinated persistence                          |                                            |                                                            |
| M6 | *(optional)*  | **EXPLICIT GO REQUIRED.** Re-enables co-editing + JWT + shard-key —     | re-opens ws protocol / editor clone path    | co-edit smoke (2 clients); latency <300 ms; **not default**|
|    | edit / collab | the full editor protocol.                                               |                                             |                                                            |

## Growth rule

New service = `packages/<svc>`; **no stub package before >5K loc or an
independent versioning need** (per grill, mirrors author's excelrs convention).
M3/M4/M5 admit cleanly because the workspace root (pnpm workspaces + root
`tsconfig.json`) is already scaffolded — each package added only with real code,
not empty shells.

## OpenSpec mapping
+ M1 ↔ `openspec/changes/onlyoffice-spreadsheet-viewer` (proposal/specs/design/tasks).
+ M2+ get **their own change proposals** before applying (proposal → tasks → implement) to keep scope/ADR discipline.

## Current state
+ M0 complete: scaffold ✓, OpenSpec change artifacts ✓, probe `PROBE_OK`
  (engine 2.6.0, 4 ms read, 4.2 MB heap on excelrs `custom-theme.xlsx`).
+ M1 complete: `packages/viewer` HTTP service + renderer shipped and tested
  (values/styles/merges/freeze; fail-loud 404/400/500; iframe-embeddable;
  `<512 MB` + `<5 s` perf smoke ✓).
+ M2 (xlsx coverage) pending future: relies on excelrs v2.0 streaming reader
  for >10k-row sheets + cached formula values.
+ `packages/react-viewer` shipped as a host-integration package — a thin React
  `<iframe>` shim hosting `/view/:id` (no viewer backend changes). NOTE: the
  git commit dubs this 'M2 React iframe shim', which collides with this table's
  M2 (xlsx coverage); this shim is a host SDK, not a numbered service milestone
  (per the growth rule), so it is documented here, not inserted as a milestone.
+ excelrs seam: `WorkbookXlsx.read` (full-model, async-contract gate in
  `workbookFromBuffer`) is used, not the `StreamReader`/`WorkbookStreamXlsx`
  streaming path — those yield values only (no styles/merges/freeze) and cannot
  back the styled renderer. Full-model read still meets C1: the 10 000-row perf
  smoke renders < 512 MB.
+ excelrs read-path gaps (known constraints, not work items): column widths are
  not exposed on read (`ws.columns` empty on parsed XLSX) → renderer auto-fits
  from content + default; formula cached results are not authored on write →
  read-back cells render `=formula` text (cached-result path unit-tested via
  `formatCellValue` only).