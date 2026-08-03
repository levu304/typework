## Purpose

Provide a React component that embeds the read-only, static-HTML spreadsheet viewer (served at `/view/:id`) into a React host, without depending on ONLYOFFICE DocsAPI editor assets or JS.

## Requirements

### Requirement: SpreadsheetViewer renders a single iframe
`SpreadsheetViewer` MUST render exactly one `<iframe>` element. There MUST be no other DOM nodes, no editor JS bundle, and no DocsAPI script.

#### Scenario: Mount the viewer
- **WHEN** `SpreadsheetViewer` is rendered with `src` pointing at `/view/:id`
- **THEN** the DOM contains one `<iframe>` element whose `src` equals that URL

#### Scenario: Fail loud on missing source
- **WHEN** `SpreadsheetViewer` is used without a `src` argument
- **THEN** TypeScript rejects the call site (src is required; the component never fabricates a URL)

### Requirement: iframe attributes are forwarded
`SpreadsheetViewer` MUST forward all standard `<iframe>` attributes (`width`, `height`, `title`, `onLoad`, `sandbox`, ...). The viewer's `title` defaults to `"Spreadsheet"`.

#### Scenario: Caller controls sizing and callbacks
- **WHEN** the caller passes `width`, `height`, and `onLoad`
- **THEN** those attributes are present on the iframe element and the callback fires on load

### Requirement: No DocsAPI handshake
The component MUST NOT fetch `documentServerUrl/web-apps/.../api.js`, MUST NOT send a `config` object, and MUST NOT perform JWT/co-editing. It MUST be embeddable with JS disabled in the iframe (static HTML viewer).

#### Scenario: iframe content is server-rendered only
- **WHEN** the viewer page at `/view/:id` loads
- **THEN** no client-side JS bundle is downloaded as part of the embed contract
