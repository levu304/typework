import { describe, it, expect } from 'vitest'
import { Workbook } from '@levu304/excelrs'
import { renderWorkbook, workbookFromBuffer } from '../src/renderer'

// Spec 5.4 — memory/perf smoke: large fixture renders under the 512 MB / 5 s
// ceiling (constraint C1). We author a ~1MB-class workbook with excelrs itself.
describe('perf smoke (spec 5.4: stay under memory ceiling)', () => {
  it('renders a large workbook under 512MB heap and within 5s', async () => {
    const wb = new Workbook()
    const ws = wb.addWorksheet('Big')
    for (let r = 1; r <= 10000; r++) {
      ws.addRow([`name-${r}`, r, r * 1.5, r % 2 === 0])
    }
    ws.setCellStyle(1, 1, { font: { bold: true } })
    const buf = await wb.xlsx.write()
    const sizeKib = Math.round(buf.length / 1024)

    const t0 = Date.now()
    const wb2 = await workbookFromBuffer(buf)
    const html = renderWorkbook(wb2)
    const ms = Date.now() - t0
    const heapUsed = process.memoryUsage().heapUsed

    // console.assert-style check that fails the test if the budget is blown.
    console.log(`perf: ${sizeKib} KiB xlsx, ${wb2.worksheets[0].rowCount} rows, ${ms} ms, heap ${Math.round(heapUsed / 1024 / 1024)} MB`)
    expect(html.length).toBeGreaterThan(0)
    expect(heapUsed).toBeLessThan(512 * 1024 * 1024) // C1: < 512 MB
    expect(ms).toBeLessThan(5000) // C1: < 5 s
  }, 10000)
})