## Context

The v1 viewer is static HTML served at `/view/:id` (excelrs parses xlsx server-side -> `<table>` + CSS). We must not pull in the ONLYOFFICE editor surface (api.js / config / JWT / co-editing): that is the multi-GB path we are avoiding. React hosts, though, embed via a component, not raw `<iframe>` markup. Constraint: ≤512 MB resident, iframe-embeddable, JS-off in frame.

## Goals / Non-Goals

**Goals:**
- One importable React component to mount `/view/:id`.
- Zero editor JS; iframe-only boundary; src is caller-supplied.

**Non-Goals:**
- DocsAPI wire-compatibility with `@onlyoffice/document-editor-react` (rejected; see Decisions).
- Co-editing, JWT/tokening, save callbacks, edit mode, or any client-side rendering.
- Re-implementing the editor asset surface.

## Decisions

- **iframe over portal / shadow-DOM / DOM-injection:** iframe is the native cross-origin/sandboxed boundary and matches the static-HTML viewer. One element, isolated, no style bleed. (Rejected portal/shadow: extra surface for an empty component.)
- **Extend `React.IframeHTMLAttributes`, require `src`:** smallest surface; inherits width/height/onLoad/sandbox/etc. deliberately does NOT mirror `@onlyoffice/document-editor-react` props (`documentServerUrl`/`config`/`shardkey`/`onLoadComponentError`/`id`) — those belong to a DocsAPI editor we are not building (v1 decision, proposal D1).
- **Static HTML table chosen over alternatives (D2):** rejected JSON + minimal client canvas (client JS raises memory and attack surface above the 512 MB ceiling) and per-sheet SVG (font/span bloat, no text selection). Static `<table>` keeps the ceiling and surface minimal.

## Risks / Trade-offs

- [Risk] iframe sandbox can block the viewer if misconfigured → [Mitigation] caller controls `sandbox`; component sets none by default.
- [Risk] caller must supply the correct `/view/:id` URL; no auth/JWT in v1 → [Mitigation] read-only; fail-loud at TypeScript level (src required); auth layered only if a future phase needs it.
- [Risk] not a drop-in for `<DocumentEditor documentServerUrl=...>` → [Mitigation] documented as a separate embed contract; see README.

## Migration Plan

N/A — additive package. Existing hosts using `@onlyoffice/document-editor-react` are unaffected.

## Open Questions

None. The embed contract is fully server-driven; no client behavior deferred.
