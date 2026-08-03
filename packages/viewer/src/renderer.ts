// Read-only spreadsheet renderer: excelrs model -> static HTML table + inline CSS.
// Server-side only; no client JS. (Design D2: static HTML, no JS bundle.)
import { Workbook } from '@levu304/excelrs'
import type { Worksheet, Cell, Style } from '@levu304/excelrs'

// ---------------------------------------------------------------------------
// Public options
// ---------------------------------------------------------------------------

export interface RenderOptions {
  /** Worksheet name to render. Omitted -> first visible/selected sheet. */
  sheet?: string
  /** Title shown in the page <title> / header. */
  title?: string
  /** Query-string fragment to preserve on sheet-switch form (e.g. "url=..."). */
  qs?: string
}

// ---------------------------------------------------------------------------
// HTML / CSS helpers
// ---------------------------------------------------------------------------

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ARGB hex ("FFFF0000") or RGB hex ("FF0000") -> "#RRGGBB". Drops alpha.
function argbToCss(color?: string): string | undefined {
  if (!color) return undefined
  const c = color.trim()
  if (c.length === 8) return '#' + c.slice(2).toUpperCase()
  if (c.length === 6) return '#' + c.toUpperCase()
  if (c.length === 3) return '#' + c
  return undefined
}

// Map excelrs error discriminant text (calamine Debug) to Excel error text.
const ERROR_MAP: Record<string, string> = {
  Div0: '#DIV/0!',
  NA: '#N/A',
  Name: '#NAME?',
  Null: '#NULL!',
  Number: '#NUM!',
  Ref: '#REF!',
  Value: '#VALUE!',
  Invalid: '#VALUE!',
}

// ---------------------------------------------------------------------------
// Column-letter <-> 1-indexed number
// ---------------------------------------------------------------------------

function colLetterToNum(letter: string): number {
  let n = 0
  for (const ch of letter.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64)
  }
  return n
}

interface Range {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

// Parse a merged-range reference like "B2:D4" into row/col bounds.
function parseRange(ref: string): Range | null {
  const m = ref.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/)
  if (!m) return null
  const startCol = colLetterToNum(m[1])
  const endCol = colLetterToNum(m[3])
  const startRow = Number(m[2])
  const endRow = Number(m[4])
  return { startRow, startCol, endRow, endCol }
}

// ---------------------------------------------------------------------------
// Value formatting
// ---------------------------------------------------------------------------

const PERCENT_FMT = /%/
const CURRENCY_FMT = /[$]/
const DATE_FMT = /[ymdhMs]/

// Minimal excelrs-cached numFmt interpreter.
// ponytail: covers General/thousands/percent/currency; date formats belong to
// Date cells and are handled by formatDate. Exotic formats fall back to raw.
function formatNumber(n: number, numFmt?: string): string {
  if (!numFmt || numFmt === 'General') return String(n)
  if (PERCENT_FMT.test(numFmt)) {
    const dec = (numFmt.match(/\.(0+)/) || [])[1]?.length ?? 0
    return (n * 100).toFixed(dec) + '%'
  }
  if (CURRENCY_FMT.test(numFmt)) {
    const dec = (numFmt.match(/\.(0+)/) || [])[1]?.length ?? 0
    const sym = (numFmt.match(/[$]/) || ['$'])[0]
    const sign = n < 0 ? '-' : ''
    return sign + sym + Math.abs(n).toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }
  if (DATE_FMT.test(numFmt)) return String(n) // date formats belong to Date cells
  const dec = (numFmt.match(/\.(0+)/) || [])[1]?.length ?? 0
  const s = n.toFixed(dec)
  if (numFmt.includes(',')) {
    const [head, tail] = s.split('.')
    return head.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (dec ? '.' + tail : '')
  }
  return s
}

function formatDate(d: Date, numFmt?: string): string {
  // excelrs surfaces dates as JS Date objects. Excel serials are zone-less, so
  // format in UTC for deterministic output (avoids TZ-dependent flakiness).
  const y = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
  const da = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mi = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  if (!numFmt) return d.toISOString().slice(0, 10) // YYYY-MM-DD
  // ponytail: coarse date/time component detection; not a full numFmt engine.
  const wantDate = /[dy]/i.test(numFmt)
  const wantTime = /[hH]/.test(numFmt) || /s/i.test(numFmt)
  const parts: string[] = []
  if (wantDate) {
    parts.push(numFmt.includes('yy') && !numFmt.includes('yyyy') ? `${String(y).slice(-2)}-${mo}-${da}` : `${y}-${mo}-${da}`)
  }
  if (wantTime) parts.push(`${hh}:${mi}:${ss}`)
  return parts.join(' ') || d.toISOString().slice(0, 10)
}

// Render a cell's display text from excelrs' typed model.
/** Minimal typed model of a cell value, decoupled from the native `Cell` so the
 * formatting logic is pure and unit-testable with plain objects. */
export interface CellLike {
  type: string
  value: unknown
  formula: string | null
  // excelrs >=2.7 exposes Cell.cachedValue at runtime (Excel-embedded cached value
  // for formula cells) but it is NOT in the published TS types.
  cachedValue: unknown
}

// excelrs 2.8.0 TS types omit `cachedValue`; it exists at runtime as a getter (>=2.7).
// Narrow the Cell we read from so the getter is type-safe here without touching excelrs's decls.
type ExcelrsCell = Cell & { cachedValue?: unknown }

// Dispatch on excelrs' value shape:
//  - Formula cells: cached result (primitive/Date) wins; else "=formula".
//  - Error cells arrive as { valueType:'Error', errorValue:'Div0' }.
//  - Dates as Date; numbers honor numFmt; booleans -> TRUE/FALSE.
export function formatCellValue(c: CellLike, style?: Style | null): string {
  const v = c.value
  if (c.formula) {
    // excelrs >=2.7: Cell.cachedValue holds Excel's embedded cached value (the `<v>`
    // paired with `<f>`). Render it through the same formatting as a normal value;
    // fall back to `=formula` when no cache is embedded (the read path never
    // recomputes). See design.md D1.
    const cv = c.cachedValue
    if (cv == null) return '=' + c.formula
    if (cv === true || cv === false) return cv ? 'TRUE' : 'FALSE'
    if (typeof cv === 'number') return formatNumber(cv, style?.numFmt)
    if (cv instanceof Date) return formatDate(cv, style?.numFmt)
    if (typeof cv === 'string') return String(cv)
    if (typeof cv === 'object' && 'valueType' in cv && cv.valueType === 'Error') {
      const ev = (cv as { errorValue?: string }).errorValue
      return ev ? ERROR_MAP[ev] || ev : '#VALUE!'
    }
    return String(cv) // cachedValue
  }
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return formatNumber(v, style?.numFmt)
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (v instanceof Date) return formatDate(v, style?.numFmt)
  if (typeof v === 'string') return v
  if (typeof v === 'object' && 'valueType' in v && v.valueType === 'Error') {
    const ev = (v as { errorValue?: string }).errorValue
    return ev ? ERROR_MAP[ev] || ev : '#VALUE!'
  }
  return String(v)
}

// Render a cell's display text from excelrs' typed model (native Cell).
function cellText(cell: Cell, style?: Style | null): string {
  const c = cell as ExcelrsCell
  return formatCellValue(
    { type: String(cell.type), value: cell.value, formula: cell.formula, cachedValue: c.cachedValue ?? null },
    style,
  )
}

// ---------------------------------------------------------------------------
// Style -> inline CSS
// ---------------------------------------------------------------------------

function escapeCssIdent(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, '')
}

function styleToCss(style?: Style | null): string {
  if (!style) return ''
  const parts: string[] = []
  const font = style.font
  if (font) {
    if (font.bold) parts.push('font-weight:bold')
    if (font.italic) parts.push('font-style:italic')
    if (font.underline) parts.push('text-decoration:underline')
    if (font.size) parts.push(`font-size:${font.size}pt`)
    if (font.name) parts.push(`font-family:${escapeCssIdent(font.name)}`)
    if (font.color) {
      const c = argbToCss(font.color)
      if (c) parts.push(`color:${c}`)
    }
  }
  const fill = style.fill
  if (fill && fill.kind === 'Solid' && fill.foreground) {
    const c = argbToCss(fill.foreground)
    if (c) parts.push(`background-color:${c}`)
  }
  const align = style.alignment
  if (align) {
    if (align.horizontal) parts.push(`text-align:${align.horizontal.toLowerCase()}`)
    if (align.vertical) parts.push(`vertical-align:${align.vertical.toLowerCase()}`)
    if (align.wrapText) parts.push('white-space:pre-wrap;word-wrap:break-word')
    if (align.indent && align.indent > 0) parts.push(`padding-left:${align.indent * 3}px`)
  }
  return parts.join(';')
}

// ---------------------------------------------------------------------------
// Merged cells
// ---------------------------------------------------------------------------

interface MergeInfo {
  colspan: number
  rowspan: number
}

interface MergeMap {
  anchor: Map<string, MergeInfo>
  covered: Set<string>
}

function buildMergeMap(ws: Worksheet): MergeMap {
  const anchor = new Map<string, MergeInfo>()
  const covered = new Set<string>()
  for (const ref of ws.mergedRanges) {
    const r = parseRange(ref)
    if (!r) continue
    const colspan = r.endCol - r.startCol + 1
    const rowspan = r.endRow - r.startRow + 1
    anchor.set(`${r.startRow},${r.startCol}`, { colspan, rowspan })
    for (let row = r.startRow; row <= r.endRow; row++) {
      for (let col = r.startCol; col <= r.endCol; col++) {
        if (row === r.startRow && col === r.startCol) continue
        covered.add(`${row},${col}`)
      }
    }
  }
  return { anchor, covered }
}

// ---------------------------------------------------------------------------
// Frozen panes
// ---------------------------------------------------------------------------

interface Freeze {
  rows: number // ySplit
  cols: number // xSplit
}

function getFreeze(ws: Worksheet): Freeze {
  for (const view of ws.views) {
    if (view.state === 'Frozen') {
      return { rows: view.ySplit ?? 0, cols: view.xSplit ?? 0 }
    }
  }
  return { rows: 0, cols: 0 }
}

// ---------------------------------------------------------------------------
// Column widths
// ---------------------------------------------------------------------------

// excelrs does NOT expose column widths on the read path (ws.columns is empty
// for parsed XLSX; only outline levels are retained). ponytail: fall back to an
// auto-fit estimate from cell content with a sensible default. Upgrade path: if
// excelrs adds <col width> parsing, ws.columns[i].width becomes available here.
// CONFLICT (surfaced): spec 4.6 "explicit width reflects it" is unmet on read;
// the "default sizing" scenario is satisfied. See design.md decision record.
const DEFAULT_COL_WIDTH_PX = 82
const CHAR_TO_PX = 7

function columnWidths(ws: Worksheet, rowCount: number, columnCount: number): number[] {
  const widths: number[] = []
  const cols = ws.columns
  for (let c = 1; c <= columnCount; c++) {
    const explicit = cols[c - 1]
    if (explicit && explicit.width > 0) {
      widths.push(Math.max(40, explicit.width * CHAR_TO_PX))
      continue
    }
    let maxChars = 10
    for (let r = 1; r <= rowCount; r++) {
      const cell = ws.getCell(r, c)
      if (cell.value === null || cell.value === undefined) continue
      const len = String(cell.value).length
      if (len > maxChars) maxChars = len
    }
    widths.push(Math.max(DEFAULT_COL_WIDTH_PX, maxChars * CHAR_TO_PX))
  }
  return widths
}

// ---------------------------------------------------------------------------
// Sheet nav
// ---------------------------------------------------------------------------

function sheetNav(wb: Workbook, selected: string, qs: string): string {
  const opts: string[] = []
  for (const ws of wb.worksheets) {
    const sel = ws.name === selected ? ' selected' : ''
    opts.push(`<option value="${esc(ws.name)}"${sel}>${esc(ws.name)}</option>`)
  }
  return `<form class="sheet-nav" method="get" action="/view${qs ? `?${qs}` : ''}">
  <label>Sheet: <select name="sheet" onchange="this.form.requestSubmit()">${opts.join('')}</select></label>
  <button type="submit">Switch</button>
</form>`
}

// ---------------------------------------------------------------------------
// Core renderer
// ---------------------------------------------------------------------------

export function renderWorkbook(wb: Workbook, opts: RenderOptions = {}): string {
  const sheets = wb.worksheets
  if (sheets.length === 0) return page('', '<p>No worksheets found.</p>', opts)

  const ws: Worksheet =
    (opts.sheet ? wb.getWorksheet(opts.sheet) : null) ?? sheets[0]

  const rowCount = ws.rowCount
  const columnCount = ws.columnCount
  const widths = columnWidths(ws, rowCount, columnCount)
  const merges = buildMergeMap(ws)
  const freeze = getFreeze(ws)
  const nav = sheetNav(wb, ws.name, opts.qs || '')

  const rowsHtml: string[] = []
  for (let r = 1; r <= rowCount; r++) {
    const cells: string[] = []
    for (let c = 1; c <= columnCount; c++) {
      const key = `${r},${c}`
      if (merges.covered.has(key)) continue
      const merge = merges.anchor.get(key)
      const cell = ws.getCell(r, c)
      const style = cell.style
      const cls: string[] = []
      if (freeze.rows > 0 && r <= freeze.rows) cls.push('freeze-top')
      if (freeze.cols > 0 && c <= freeze.cols) cls.push('freeze-left')
      const tdStyle: string[] = []
      tdStyle.push(styleToCss(style))
      tdStyle.push(`width:${widths[c - 1]}px`)
      if (freeze.rows > 0 && r <= freeze.rows) {
        tdStyle.push('position:sticky;top:0')
        tdStyle.push('z-index:2')
      }
      if (freeze.cols > 0 && c <= freeze.cols) {
        tdStyle.push('position:sticky;left:0')
        tdStyle.push(cls.includes('freeze-top') ? 'z-index:4' : 'z-index:3')
      }
      const mergeAttrs = merge
        ? ` colspan="${merge.colspan}" rowspan="${merge.rowspan}"`
        : ''
      const classAttr = cls.length ? ` class="${cls.join(' ')}"` : ''
      cells.push(`<td${classAttr}${mergeAttrs} style="${tdStyle.join(';')}">${esc(cellText(cell, style))}</td>`)
    }
    rowsHtml.push(`<tr>${cells.join('')}</tr>`)
  }

  const body = `${nav}
<div class="sheet-viewport">
<table class="spreadsheet">
  <colgroup>${widths.map((w) => `<col style="width:${w}px">`).join('')}</colgroup>
  <tbody>
${rowsHtml.join('\n')}
  </tbody>
</table>
</div>`

  return page(opts.title || ws.name, body, opts)
}

function page(title: string, body: string, opts: RenderOptions): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  html,body{margin:0;padding:0}
  body{font-family:"Segoe UI",Arial,sans-serif;font-size:11pt;background:#fafafa}
  .sheet-nav{padding:6px 10px;border-bottom:1px solid #ddd;background:#fff}
  .sheet-viewport{overflow:auto;max-height:calc(100vh-3.5rem)}
  .spreadsheet{border-collapse:collapse}
  .spreadsheet td{border:1px solid #d4d4d4;padding:2px 4px;text-align:left;vertical-align:top}
  .spreadsheet td.freeze-top{position:sticky;top:0;background:#fff}
  .spreadsheet td.freeze-left{position:sticky;left:0;background:#f8f8f8}
</style>
</head>
<body>
<h2 style="margin:4px 10px">${esc(opts.title || '')}</h2>
${body}
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Read bridge (async-contract gate, see task 3.1)
// ---------------------------------------------------------------------------

// excelrs swaps workbook state only when this Promise resolves; callers must
// access the model strictly after the `await` (async-contract gate).
export async function workbookFromBuffer(buf: Buffer): Promise<Workbook> {
  const wb = new Workbook()
  await wb.xlsx.read(buf)
  return wb
}

export { Workbook }