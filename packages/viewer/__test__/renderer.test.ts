import { describe, it, expect, beforeAll } from 'vitest'
import { Workbook } from '@levu304/excelrs'
import { renderWorkbook, workbookFromBuffer, formatCellValue, type CellLike } from '../src/renderer'
import { readFixture, buildStyledBuffer } from './fixtures'

const c = (over: Partial<CellLike> = {}): CellLike => ({ type: 'String', value: null, formula: null, ...over })

// ---------------------------------------------------------------------------
// Spec 4.2 — cell value rendering (pure, plain-object unit tests)
// ---------------------------------------------------------------------------
describe('formatCellValue (spec 4.2: cell values)', () => {
  it('renders a string', () => expect(formatCellValue(c({ value: 'Hello' }))).toBe('Hello'))
  it('renders a number', () => expect(formatCellValue(c({ type: 'Number', value: 42 }))).toBe('42'))
  it('renders a boolean true / false', () => {
    expect(formatCellValue(c({ type: 'Boolean', value: true }))).toBe('TRUE')
    expect(formatCellValue(c({ type: 'Boolean', value: false }))).toBe('FALSE')
  })
  it('renders an error cell', () =>
    expect(formatCellValue(c({ type: 'Error', value: { valueType: 'Error', errorValue: 'Div0' } })))
      .toBe('#DIV/0!'))
  it('renders a missing error discriminant', () =>
    expect(formatCellValue(c({ type: 'Error', value: { valueType: 'Error' } }))).toBe('#VALUE!'))
  it('renders a null cell as blank', () => expect(formatCellValue(c({ value: null }))).toBe(''))
  it('formula cell renders cachedValue when present', () =>
    expect(formatCellValue(c({ formula: 'SUM(B2:C2)', cachedValue: 30 }))).toBe('30'))
  it('formula without cached result renders the formula text', () =>
    expect(formatCellValue(c({ type: 'Null', value: null, formula: 'SUM(B2:C2)' }))).toBe('=SUM(B2:C2)'))
  it('formula with cached date renders formatted date (numFmt)', () =>
    expect(formatCellValue(c({ formula: 'TODAY()', cachedValue: new Date('2024-06-01T10:30:00Z') }), { numFmt: 'yyyy-mm-dd' } as any).slice(0, 10)).toBe('2024-06-01'))
  it('formula with cached error renders Excel error text', () =>
    expect(formatCellValue(c({ formula: '1/0', cachedValue: { valueType: 'Error', errorValue: 'Div0' } }))).toBe('#DIV/0!'))
  it('formats a number with a numFmt (thousands + decimals)', () =>
    expect(formatCellValue(c({ type: 'Number', value: 1234.5 }), { numFmt: '#,##0.00' } as any)).toBe('1,234.50'))
  it('formats a date (no numFmt) as ISO date', () =>
    expect(formatCellValue(c({ type: 'Date', value: new Date('2024-06-01T10:30:00Z') })).slice(0, 10)).toBe('2024-06-01'))
})

// ---------------------------------------------------------------------------
// Spec 4.x — styled workbook: values, styles, merges, frozen panes
// ---------------------------------------------------------------------------
describe('renderWorkbook on a styled fixture', () => {
  let html: string
  let wb: Workbook
  beforeAll(async () => {
    const buf = await buildStyledBuffer()
    wb = await workbookFromBuffer(buf)
    html = renderWorkbook(wb, { title: 'Report' })
  })

  it('renders a full standalone HTML document (iframe-embeddable, spec 2.4)', () => {
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('<html')
    expect(html).toContain('</body>')
    expect(html).toContain('<table class="spreadsheet">')
  })

  it('renders every cell value', () => {
    expect(html).toContain('>Widgets<')   // A2 string
    expect(html).toContain('>42.00<')         // B2 number (numFmt #,##0.00 -> 42.00)
    expect(html).toContain('>9.99<')           // C2 number
    expect(html).toContain('=SUM(B2:C2)') // D2 formula (excelrs authors no cached result)
    expect(html).toContain('2024-06-01')  // E2 date
    expect(html).toContain('>TRUE<')      // F2 boolean
  })

  it('applies font/fill styles inline (bold, color, background)', () => {
    // A1 header: bold + blue font + yellow fill
    expect(html).toContain('font-weight:bold')
    expect(html).toContain('color:#0000FF')         // FF0000FF (alpha dropped)
    expect(html).toContain('background-color:#FFFF00') // FFFFFF00
  })

  it('applies numeric cell style (B2 italic + size)', () => {
    expect(html).toContain('font-style:italic')
    expect(html).toContain('font-size:14pt')
  })

  it('emits colspan/rowspan for merged header cells (spec 4.4)', () => {
    expect(html).toContain('colspan="6"') // A1:F1 merged
  })

  it('makes frozen rows sticky (spec 4.5)', () => {
    expect(html).toContain('freeze-top')
    expect(html).toContain('position:sticky;top:0')
    expect(html).toContain('z-index:2')
  })

  it('renders a JS-free sheet navigation form (spec 4.7)', () => {
    expect(html).toContain('<form')
    expect(html).toContain('name="sheet"')
    expect(html).toContain('value="Report"')
  })
})

// ---------------------------------------------------------------------------
// Spec 4.4 — merged cells rendering in isolation
// ---------------------------------------------------------------------------
describe('renderWorkbook merged cells', () => {
  it('emits colspan and spans the covered cells', async () => {
    const { buildMergedBuffer } = await import('./fixtures')
    const wb = await workbookFromBuffer(await buildMergedBuffer())
    const html = renderWorkbook(wb)
    // A1:C1 merged -> one cell spanning 3 columns; x/y/z must NOT appear twice
    expect(html).toContain('colspan="3"')
    expect((html.match(/>x</g) || []).length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Spec 5.2 — golden-file snapshot of custom-theme.xlsx
// ---------------------------------------------------------------------------
describe('golden snapshot (spec 5.2)', () => {
  it('renders custom-theme.xlsx to a stable HTML snapshot', async () => {
    const buf = await readFixture('custom-theme.xlsx')
    const wb = await workbookFromBuffer(buf)
    expect(renderWorkbook(wb, { title: 'custom-theme' })).toMatchSnapshot()
  })
})