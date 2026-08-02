# Design: onlyoffice-spreadsheet-viewer

## Decisions

### D1. NOT DocsAPI wire-compatible (accepted risk)

Rejected: a drop-in replacement for `@onlyoffice/document-editor-react`, because that
component loads editor assets from `documentServerUrl` — making it require reimplementing
the entire OnlyOffice editor client+backend. Out of v1 scope.

Instead: a self-contained read-only viewer served at `/view/:id`, iframe-embeddable in
the *same slot* a docs server would occupy. The "compatibility" is experiential (an
`<iframe>` showing the spreadsheet), not protocol-level.

### D2. Static HTML, no client JS bundle (accepted risk)

Renderer runs server-side; response is static `<table>` + inline CSS. No JS runtime on
the client. Chosen to hold the 512 MB ceiling and shrink attack surface/footprint.
Consequences: interactive features (zoom, sheet switch) are server-driven via query
params, not client state.

## Architecture

```
Client <iframe src="/view/:id">  ──HTTP──  Node service (512MB)
                                   │
                                   │ resolve :id  |  fetch ?url=
                                   ▼
                        excelrs: new Workbook()
                        wb.xlsx.read(buf)  →  await (async contract)
                                   │
                                   ▼
                         Model: worksheets / rows / cells
                         + CellValue, style (Font/Fill/Border/Align/numFmt)
                         + mergeCells, views (freeze)
                                   │
                                   ▼
                      Renderer: Workbook → HTML table + CSS
                                   │
                                   ▼
                        HTTP response (full HTML page)
```

## Stack

- Runtime: Node 22 (LTS), native addon loads in-process.
- Core engine: `@levu304/excelrs` (napi-rs) — parsing + typed model only.
- HTTP: minimal handler (Node `http` or micro-frameworks avoided → prefer `http`).
- Lint/format/test: mirror excelrs conventions (biome, tsc --noEmit; tests in
  `__test__/`, Vitest) so the repo stays in the same toolchain family.
- No build step for the renderer (server-side TS → JS via `tsx`/`tsc` at dev; node
  direct ESM in prod).

## excelrs seam (read path)

- `new Workbook()` then `await wb.xlsx.read(buffer)` (Promise). **Async-contract gate:**
  no model access before the Promise resolves (excelrs swaps state on resolve).
- Traverse: `wb.worksheets[i]`, `ws.getCell(row,col)` / `ws.getRow(n)`, `ws.columns`,
  `ws.mergeCells` (read existing merges), `ws.views` for freeze panes, `ws.columnCount`/
  `rowCount`.
- `cell.value` typed (number/string/boolean/error/formula). `cell.style` carries
  Font/Fill/Border/Alignment/Alignment/numFmt. Colors are ARGB hex (8 or 6 chars).
- excelrs v2.0.0 ships streaming XLSX (SAX). Use streaming read for the parse path to
  keep peak memory low under the 512 MB ceiling (see perf budget below).

## Renderer

- Output: one `<table>` per sheet. Row = `tr`, Cell = `td`.
- Column widths: excelrs width (char units) × ~7 px, min sensible default.
- Merged cells: `colspan`/`rowspan` from `worksheet.mergeCells` ranges.
- Frozen panes: read sheet-view freeze; top N rows → `position:sticky; top:<offset>`;
  left M cols → `position:sticky; left:<offset>`.
- Styles: inline `style=` on `td` (font-weight, font-style, text-decoration, color,
  background, text-align, vertical-align) + `<style>` block for sticky rules.
- numFmt: render the displayed string; rely on excelrs-cached value for formulas.
- Sheet nav: `<select>` (server-rendered) posting `?sheet=` — minimal, JS-free.

## Memory & perf budget (D2-supporting)

- Single Node process. excelrs streaming read bounds allocation; render walks model once
  and emits HTML string. No DOM on server (no jsdom).
- Smoke test: 1 MB XLSX (excelrs `fixtures/custom-theme.xlsx` is 9.9 KB; synthetic
  larger fixture generated) must render resident `< 512 MB`, `< 5s`.

## Test plan

- Fixtures: reuse excelrs `fixtures/*.xlsx` (`custom-theme.xlsx` for styles, a frozen-pane
  workbook, a merged-cell workbook).
- Assertions: cell value text, inline style presence, `colspan`/`rowspan` emitted,
  `position:sticky` present on frozen rows/cols, column width mapping.
- Golden-file: snapshot rendered HTML for `custom-theme.xlsx`; diff on change.
- Failure: bad path → 404, non-XLSX body → 500, missing params → 400.
- Memory: assert `process.memoryUsage().heapUsed < 512MB` after rendering large fixture.

## Deployment

- Single container image; Dockerfile from node:22-alpine, copy addon + TS. No separate
  services (contrast stock Docs Server: 5 services). Footprint target: image < 200 MB.
