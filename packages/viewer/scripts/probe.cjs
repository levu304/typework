// De-risk the excelrs integration boundary (pony tail: one runnable check for
// non-trivial logic). Reads the in-package fixture, asserts a typed model, and
// prints heap + latency so we can trust the engine path before building the
// HTML renderer. Run: `node packages/viewer/scripts/probe.cjs`
// ponytail: probe script — stdout IS the assertion/report; console.log intentional.
const fs = require('node:fs');
const path = require('node:path');

const { Workbook } = require('@levu304/excelrs');
const pkgDir = path.dirname(require.resolve('@levu304/excelrs/package.json'));
const fixturePath = path.join(pkgDir, 'fixtures', 'custom-theme.xlsx');

const before = process.memoryUsage();
const buf = fs.readFileSync(fixturePath);

(async () => {
  const wb = new Workbook();
  const t0 = Date.now();
  await wb.xlsx.read(buf); // mutates workbook state; must await before access
  const ms = Date.now() - t0;
  const after = process.memoryUsage();

  const ws = wb.worksheets[0];
  const cell = ws.getCell('A1');
  const s = cell.style || {};
  const info = {
    engine: require('@levu304/excelrs/package.json').version,
    file_kib: Math.round(buf.length / 1024),
    worksheets: wb.worksheets.length,
    a1_value: cell.value,
    a1_value_type: cell.value === null ? 'empty' : typeof cell.value,
    a1_has_numFmt: 'numFmt' in s,
    a1_style_keys: s ? Object.keys(s) : [],
    read_ms: ms,
    heap_used_mb: (after.heapUsed / 1024 / 1024).toFixed(1),
    heap_delta_mb: ((after.heapUsed - before.heapUsed) / 1024 / 1024).toFixed(1),
  };
  console.log(JSON.stringify(info, null, 2));

  const ok = info.worksheets >= 1 && info.read_ms < 5000 && info.heap_used_mb < 512;
  console.log(ok ? 'PROBE_OK' : 'PROBE_FAIL');
  if (!ok) process.exitCode = 1;
})().catch((e) => {
  console.error('PROBE_FAIL', e);
  process.exit(1);
});