## Why

React host apps need a React-mountable embed for the read-only static-HTML spreadsheet viewer, but `@onlyoffice/document-editor-react` is DocsAPI-coupled: it loads the ONLYOFFICE editor from `documentServerUrl/web-apps/.../api.js` and runs a JWT/co-editing handshake. It cannot point at the lightweight viewer without rebuilding that whole asset surface. We need a thin React shim that hosts `/view/:id` in an iframe — no editor JS, no DocsAPI — to stay under the 512 MB ceiling.

## What Changes

- Add workspace package `@typework/react-viewer` (`packages/react-viewer/`).
- Export `SpreadsheetViewer`, a React component rendering a single `<iframe>` whose `src` is a `/view/:id` URL on the typework viewer service.
- Forward all standard `<iframe>` attributes; require `src` (sole source of truth).
- **NOT breaking**: additive package; no existing API changes. `@onlyoffice/document-editor-react` is untouched.
- **NOT DocsAPI-wire-compatible** — see design.md. Props `documentServerUrl`/`config`/`shardkey`/`onLoadComponentError`/`id` do not map 1:1; this shim has one relevant prop: `src`.

## Capabilities

- `react-iframe-shim` (new): spec-level capability to embed the static viewer in a React tree via iframe.

## Impact

- New package `packages/react-viewer` (devDeps: `typescript`, `@types/react`; peer: `react`).
- Host React apps import from `@typework/react-viewer` and pass `src="http://<viewer>/view/<id>"`.
- Viewer service (static HTML, excelrs backend) is unchanged.
- No effect on `@levu304/excelrs`, root tooling, or the `onlyoffice-spreadsheet-viewer` change.
