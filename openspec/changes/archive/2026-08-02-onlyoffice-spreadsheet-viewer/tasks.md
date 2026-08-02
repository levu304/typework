# Tasks: onlyoffice-spreadsheet-viewer

## 1. Project scaffold

- [x] 1.1 Init repo skeleton mirroring excelrs toolchain: `package.json`, `tsconfig.json`,
  `biome.json`, `.gitignore` (node_modules, native addon `index.node`).
- [x] 1.2 Install `@levu304/excelrs`; confirm native addon loads in Node 22. (probe PROBE_OK on Node 24; Dockerfile pins 22)
- [x] 1.3 Add test setup: Vitest + `__test__/`; pin a fixture XLSX (`fixtures/custom-theme.xlsx`
  borrowed from excelrs) for golden tests.

## 2. HTTP + document resolution

- [x] 2.1 Minimal Node `http` server: `GET /view/:id` and `GET /view?url=<url>`.
- [x] 2.2 Resolver: local `:id` → documents dir; `url` → fetch to `Buffer`.
- [x] 2.3 Error mapping: missing→404, bad params→400, parse failure→500 (fail-loud).
- [x] 2.4 iframe-embeddable full-page response scaffold (`<!doctype html><html><body>`).

## 3. excelrs bridge (read path)

- [x] 3.1 `new Workbook()` + `await wb.xlsx.read(buffer)` — enforce async-contract gate
  (no model access before Promise resolves). Gate enforced in `workbookFromBuffer`.
- [x] 3.2 Read path under the 512 MB ceiling. (CONFLICT — surfaced, see design D3/D4:
  excelrs's `StreamReader`/`WorkbookStreamXlsx` yields `JsStreamSheet` *values only*
  with no styles/merges/freeze, so it cannot back a styled renderer. Full-model
  `WorkbookXlsx.read` is used instead and meets the ceiling — validated by 5.4.
  Streaming seam left available for a future styles-less mode.)
- [x] 3.3 Typed model walkers: worksheet list, rows/cols, `getCell(row,col)`,
  `cell.value` variants, `cell.style`, `mergeCells`, `views` (freeze), `columns`.

## 4. Renderer

- [x] 4.1 Table skeleton: `<tr>`/`<td>` for rows/cells.
- [x] 4.2 Cell values: string/number/bool/error/formula-cached-render.
- [x] 4.3 Styles: bold/italic/underline, font/size/color (ARGB→`#RRGGBB`), fill,
  alignment, numFmt → inline CSS.
- [x] 4.4 Merged cells → `colspan`/`rowspan`.
- [x] 4.5 Frozen panes → CSS `position:sticky` top/left.
- [x] 4.6 Column widths char-units → px; default sizing. (CONFLICT — surfaced: excelrs
  does NOT expose column widths on the read path (`ws.columns` empty); auto-fit from
  content + sensible default used instead. Explicit-width scenario is unmet on read.)
- [x] 4.7 Sheet nav: server-rendered `<select>` + `?sheet=` (no JS).

## 5. Verification

- [x] 5.1 Value/style/merges/freeze tests against `custom-theme.xlsx` (assert inline
  style + sticky classes).
- [x] 5.2 Golden-file snapshot of rendered HTML for one fixture; assert on diff.
- [x] 5.3 Failure tests: 404/400/500.
- [x] 5.4 Memory/perf smoke: render large fixture, assert `heapUsed < 512 MB` and
  `< 5s`.

## 6. Deploy

- [x] 6.1 Dockerfile (node:22-bookworm), copy addon + compiled JS; target image < 200 MB.
  (Deviated from "node:22-alpine": excelrs ships glibc binary only, no musl.)
- [x] 6.2 Run container, curl `/view/:id`, iframe test in a blank page.