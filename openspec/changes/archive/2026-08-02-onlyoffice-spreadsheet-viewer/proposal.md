# Proposal: onlyoffice-spreadsheet-viewer

## Why

ONLYOFFICE Document Server is Apache-2 Docker, but its full office stack idle footprint
exceeds the host ceiling for this project (grill target: **512 MB**; stock Docs Server
idles ≳2 GB with the editor + conversion + command + builder services and fonts).

Need: a self-contained, embeddable document viewer that renders **XLSX as read-only HTML**
at `< 512MB`, compatible enough with the OnlyOffice *experience* to be dropped into the same
`<iframe>` slot.

> Not a DocsAPI wire-compatible replacement. See design.md decision D1.
> The `@onlyoffice/document-editor-react` component loads editor assets from
> `documentServerUrl`, so a true drop-in would require reimplementing the whole editor
> client+backend — rejected for v1. This delivers a read-only viewer in the same place.

## What Changes

A new Document Server alternative: an HTTP service that takes an XLSX (local path id or
remote URL), parses it with `@levu304/excelrs` (Rust core, parser + data model only), and
returns a static, read-only HTML page (table + inline styles). No client JS bundle.

- GET `/view/:id` → resolved document
- GET `/view?url=<url>` → fetch remote XLSX
- `?sheet=<name>` to pick sheet (default first)

excelrs supplies parsing + styles model; the renderer (this project) maps model → HTML.

## Capabilities

### New Capabilities

- `spreadsheet-view` — Render an XLSX as a read-only HTML page: values, basic styles,
  merged cells, frozen panes, column widths, sheet navigation. 512MB ceiling, static HTML.

### Modified Capabilities

(none)

## Non-Goals

- Editing (full CRUD), formulas recalc, DocsAPI compatibility, CSV/ODS input,
  conversion services, real-time collaboration. Those are explicit later milestones.

## Assumptions

- excelrs is parser/model only (no rendering). Renderer is new, server-side static HTML.
- Target: single Node process, native addon, no editor JS assets, 512MB ceiling.
- Static HTML (no JS) rendering chosen to minimize footprint and attack surface (D2).

## Constraints

- Footprint: `< 512MB` resident for documents up to 1 MB XLSX.
- Fail loud: malformed/missing XLSX → HTTP 4xx/5xx with message (excelrs fail-loud).
- Must be iframe-embeddable (same `<iframe src="..."> /view/:id` slot as docs server).

## Roadmap (monorepo growth)

The project is a service-growing monorepo anchored on the `onlyoffice-spreadsheet-viewer`
change, mirroring the future-document-server-alternative roadmap:

- v1 — `packages/viewer` — read-only spreadsheet-as-HTML viewer (this change).
- v2+ — grow `packages/{converter,command,builder}` as the document-server alternative
  matures; `packages/types` added when a second package consumes shared interfaces.

Decision recorded (grill): excelrs author keeps libs monolithic until >5K loc or
independent versioning. v1 viewer <5K loc, so `packages/viewer` is one package now;
monorepo layout exists to admit future services without re-rooting the repo.

## Impact

- New project `openspec/` scaffold + new Node/rust-addon service.
- No public API beyond `GET /view/:id` and `GET /view?url=...`.
- Depends on `@levu304/exceljs` excelrs for XLSX read.
