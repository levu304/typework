# @typework/react-viewer

Thin React `<iframe>` shim for the static-HTML typework spreadsheet viewer. Drop-in
for a React host app; the frame itself is server-rendered (excelrs -> HTML), so
this component ships **no editor, no JS bundle, no DocsAPI/JWT/co-editing
handshake**.

> This is a small convenience wrapper — not a replica of
> `@onlyoffice/document-editor-react`, which embeds OnlyOffice's editor UI from
> `documentServerUrl/web-apps/.../api.js`. Swapping that package's
> `documentServerUrl` to this viewer will **not** work.

## Install (host React app)

```bash
pnpm add @typework/react-viewer
```

## Use

```tsx
import { SpreadsheetViewer } from "@typework/react-viewer";

export default function Sheet() {
  return (
    <SpreadsheetViewer
      src="http://localhost:4000/view/123"
      title="Budget.xlsx"
      width="100%"
      height="80vh"
    />
  );
}
```

All standard `<iframe>` attributes (`width`, `height`, `onLoad`, `sandbox`,
…`) are forwarded via rest props.
