# Specification delta: spreadsheet-view

> Delta for the `spreadsheet-view` capability produced by `migrate-excelrs-v280`.
> This is a **modification** of the capability; the baseline lives at
> `openspec/specs/spreadsheet-view/spec.md`. Only the changed / newly-constrained
> behaviour is specified here.

## Purpose

Formula cells now render the value Excel embedded alongside the formula
(excels `<f>…</f><v>…</v>`) by reading excelrs `Cell.cachedValue`, available on
`@levu304/excelrs` ≥ 2.7.0. When the XLSX carries **no** cached value for a
formula cell, the cell renders the `=formula` text instead.

This realises the baseline `render-cell-values` "formula cell → cached result"
scenario, which was previously specified but un-implemented on excelrs 2.6.0
(`cell.value` for a formula cell is an object wrapping the formula string, and
`cachedValue` returned `null`).

The pre-existing column-widths limitation is **retained, not regressed**:
excelrs read path still exposes no column widths. `columnWidths` keeps its
auto-fit-from-content fallback + 82px default.

## MODIFIED Requirements

### Requirement: render-formula-cached-value

A formula cell MUST render Excel's cached computed value when one is embedded
in the XLSX, surfaced via excelrs `Cell.cachedValue` (≥ 2.7).

#### Scenario: formula cell with cached value renders the cached number

- **WHEN** `ws.getCell('B2')` is a formula cell and excelrs `cell.cachedValue` is a primitive (e.g. `15`)
- **THEN** the rendered `<td>` contains `15`, not `=SUM(...)`

#### Scenario: formula cell with cached date renders formatted date

- **WHEN** `cell.cachedValue` is a `Date` and the cell has a `numFmt`
- **THEN** the rendered cell follows that `numFmt` (date formatting), not `=formula`

## ADDED Requirements

### Requirement: render-formula-with-no-cached-value

A formula cell MUST render the `=formula` text when excelrs `Cell.cachedValue` is `null` (no embedded cached value).

#### Scenario: excelrs-authored formula (no cache) renders formula text

- **WHEN** the XLSX was written without an embedded cached value (e.g. an excelrs-authored
  fixture sets `{ valueType:'Formula', formula:'SUM(B2:C2)' }`)
- **AND** `cell.cachedValue` is `null`
- **THEN** the rendered `<td>` contains `=SUM(B2:C2)`

#### Scenario: error value not swallowed

- **WHEN** a formula evaluates (in Excel) to an Excel error and embeds it as the cached value
- **THEN** the rendered cell shows the Excel error text (`#DIV/0!`, `#VALUE!`, …), not `=formula`

## Retained (out of scope, not changed)

- Explicit column widths are still not surfaced by exceljs read path; auto-fit-from-content
  + default sizing remain the renderer.
- In-memory formula recalculation is **not** added: `Worksheet::recalculate()` is Rust-only in
  excelrs. This delta reads only Excel-embedded cached values.