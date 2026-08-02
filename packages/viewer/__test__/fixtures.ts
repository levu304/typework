// Shared fixture builders for viewer tests.
// Fixtures are authored with excelrs's own write API (no extra deps) so the
// full write -> read -> render path is exercised. Write round-trips styles,
// merges, and freeze views (verified empirically); column widths are NOT
// preserved by excelrs on read, and formula cached-results are not authored,
// so those paths are unit-tested via formatCellValue instead.
import { Workbook, FillKind, AlignmentHorizontal, AlignmentVertical, BorderStyleStyle } from '@levu304/excelrs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

export async function readFixture(name: string): Promise<Buffer> {
  return readFile(join(__dirname, '..', 'fixtures', name))
}

// One workbook exercising every renderer feature: string/number/bool/formula,
// font+fill+border+align+numFmt styles, merged header, frozen top row.
export async function buildStyledBuffer(): Promise<Buffer> {
  const wb = new Workbook()
  const ws = wb.addWorksheet('Report')
  ws.addRow(['Name', 'Qty', 'Price', 'Total', 'When', 'Flag'])
  ws.addRow(['Widgets', 42, 9.99])
  // Formula cell: excelrs authors formula text without a cached result, so on
  // read it surfaces as type=Null + formula="SUM(B2:C2)" -> renders "=SUM(...)".
  ws.getCell('D2').value = { valueType: 'Formula', formula: 'SUM(B2:C2)' }
  // Date cell
  ws.getCell('E2').value = new Date('2024-06-01T10:30:00Z')
  // Boolean cell
  ws.getCell('F2').value = true
  // Styles
  ws.setCellStyle(1, 1, {
    font: { bold: true, color: 'FF0000FF' },
    fill: { kind: FillKind.Solid, foreground: 'FFFFFF00' },
    numFmt: '0.00%',
  })
  ws.setCellStyle(2, 2, { font: { italic: true, size: 14 }, numFmt: '#,##0.00' })
  ws.setCellStyle(2, 5, { alignment: { horizontal: AlignmentHorizontal.Center } })
  // Merge the header row
  ws.mergeCells('A1:F1')
  // Freeze top row
  ws.views = [{ state: 'Frozen', ySplit: 1 }]
  ws.setColumns([
    { header: 'Name', key: 'name', width: 20 },
    { header: 'Qty', key: 'qty', width: 14 },
    { header: 'Price', key: 'price', width: 16 },
    { header: 'Total', key: 'total', width: 18 },
    { header: 'When', key: 'when', width: 18 },
    { header: 'Flag', key: 'flag', width: 12 },
  ])
  return wb.xlsx.write()
}

// A bare workbook that only carries a header row, for width/spanning checks.
export async function buildMergedBuffer(): Promise<Buffer> {
  const wb = new Workbook()
  const ws = wb.addWorksheet('M')
  ws.addRow(['a', 'b', 'c'])
  ws.getCell('A1').value = 'x'
  ws.mergeCells('A1:C1')
  ws.setCellStyle(1, 1, { fill: { kind: FillKind.Solid, foreground: 'FF0000' } })
  return wb.xlsx.write()
}

// Write a buffer to disk inside a temp documents dir; returns the dir path.
export async function makeDocumentsDir(files: Record<string, Buffer>): Promise<string> {
  const dir = join(tmpdir(), `typework-test-${process.pid}-${Date.now()}`)
  await mkdir(dir, { recursive: true })
  for (const [name, buf] of Object.entries(files)) {
    await writeFile(join(dir, name), buf)
  }
  return dir
}