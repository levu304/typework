# Specification: spreadsheet-view

## Purpose

Render an XLSX spreadsheet as a read-only HTML page so it can be embedded in an
`<iframe>` as a lightweight, sub-512MB alternative to the ONLYOFFICE editor view.
excelrs parses the file; this service maps the parsed model to static HTML.

## ADDED Requirements

### Requirement: render-cell-values

The service MUST render every cell's value using excelrs' representation
(string, number, bool, error, formula-cached result).

#### Scenario: string cell

WHEN `ws.getCell('B2').value` is a string
THEN the rendered table cell for B2 contains that string as text

#### Scenario: number cell

WHEN `ws.getCell('B2').value` is a number
THEN the cell text is the number as excelrs surfaces it

#### Scenario: formula cell

WHEN `ws.getCell('B2').value` is a formula with a cached result
THEN the cached result value is rendered (formulas not re-evaluated)

#### Scenario: bool / error cell

WHEN `ws.getCell('B2').value` is a boolean or error
THEN `true`/`false`/the error text renders (no blank)

### Requirement: render-basic-styles

The service MUST reflect cell-level styling surfaced by excelrs
(font, fill, border, alignment, numFmt) on the rendered cell.

#### Scenario: font styling

WHEN a cell has `bold`, `italic`, `underline`, font name/size, or font color
THEN the cell text is bold/italic/underlined or colored accordingly

#### Scenario: fill color

WHEN a cell has a solid fill foreground color (ARGB hex)
THEN the cell background is that color (ARGB `#RRGGBB` or 6-hex accepted)

#### Scenario: number format

WHEN a cell has a `numFmt` that changes display (e.g. currency, date)
THEN the displayed text follows that format

#### Scenario: alignment

WHEN a cell has alignment (horizontal/vertical)
THEN text is aligned inside the cell per that alignment

### Requirement: render-merged-cells

The service MUST merge overlapping cells via colspan/rowspan.

#### Scenario: merged range

WHEN `worksheet.mergeCells(['B2:D4'])` (or excelrs equivalent)
THEN the rendered table merges those cells via `colspan`/`rowspan`

### Requirement: render-frozen-panes

The service MUST make frozen rows and columns visually sticky per the
excelrs sheet-view freeze configuration.

#### Scenario: frozen top rows

WHEN a sheet view has frozen rows (excelrs `views` / freeze)
THEN the rendered page keeps the top rows sticky on vertical scroll

#### Scenario: frozen left columns

WHEN a sheet view has frozen columns
THEN the rendered page keeps the left columns sticky on horizontal scroll

### Requirement: render-column-widths

The service MUST map excelrs column width (char units) to a pixel width,
using a default when width is unset.

#### Scenario: explicit column width

WHEN `worksheet.columns[i].width` is set
THEN the rendered column width reflects it (scaled to px)

#### Scenario: default sizing

WHEN width is unset
THEN a sensible default column width/row height is used

### Requirement: resolve-document

The service MUST resolve a document by local id or by a remote `url` query
parameter and render it.

#### Scenario: local id

WHEN request is `GET /view/:id` with id present in documents dir
THEN the service returns the rendered HTML for that XLSX

#### Scenario: remote url

WHEN request is `GET /view?url=<http(s) url>`
THEN the service fetches the XLSX and returns rendered HTML

#### Scenario: sheet selection

WHEN query `?sheet=<name>` is given
THEN that worksheet renders
WHEN omitted
THEN the first (selected/visible) sheet renders

### Requirement: serve-iframe-embeddable

The service MUST return a full standalone HTML document embeddable in an
`<iframe>`.

#### Scenario: standalone page

WHEN `GET /view/:id`
THEN response is a full HTML document (`<html><head/><body>`)
THEN embedded `<iframe src="/view/:id">` shows the spreadsheet

#### Scenario: no client JS runtime

WHEN page loads in a JS-less browser
THEN the spreadsheet still renders (static HTML only)

### Requirement: fail-loud-on-bad-input

The service MUST return HTTP 4xx/5xx with a message and never render partial
output on a parse failure.

#### Scenario: missing document

WHEN id not found
THEN HTTP 404 with a message

#### Scenario: malformed xlsx

WHEN excelrs parse fails
THEN HTTP 500 with an error message (no silent partial render)

#### Scenario: unsupported input

WHEN input is neither a valid local id nor http(s) url to XLSX
THEN HTTP 400 with a message

### Requirement: stay-under-memory-ceiling

The service MUST render a 1 MB XLSX under 512 MB resident memory and within
5 seconds.

#### Scenario: 1MB workbook

WHEN rendering a 1 MB XLSX
THEN process resident memory stays below 512 MB
THEN render completes in well under the 5s budget (no observable hang)
