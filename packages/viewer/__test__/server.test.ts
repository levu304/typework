import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { AddressInfo } from 'node:net'
import { createServer } from '../src/index'
import { makeDocumentsDir, buildStyledBuffer } from './fixtures'

async function start(documentsDir: string) {
  const srv = createServer({ documentsDir })
  await new Promise<void>((res) => srv.listen(0, '127.0.0.1', () => res()))
  const { port } = srv.address() as AddressInfo
  return { srv, port }
}

let dir: string
let port: number
let srv: ReturnType<typeof createServer>

beforeAll(async () => {
  dir = await makeDocumentsDir({
    'good.xlsx': await buildStyledBuffer(),
    'corrupt.xlsx': Buffer.from('not-an-xlsx-file-body'),
  })
  const s = await start(dir)
  srv = s.srv
  port = s.port
})

afterAll(() => {
  srv.close()
})

async function get(pathAndQuery: string) {
  const res = await fetch(`http://127.0.0.1:${port}${pathAndQuery}`)
  const text = await res.text()
  return { status: res.status, text }
}

// Spec 5.3 — failure-path error mapping (fail-loud D2 / C4 contract)
describe('HTTP failure paths (spec 5.3)', () => {
  it('200 renders a known document', async () => {
    const res = await get('/view/good')
    expect(res.status).toBe(200)
    expect(res.text).toContain('<!doctype html>')
    expect(res.text).toContain('Report')
  })
  it('404 for a missing local id', async () => {
    const res = await get('/view/missing')
    expect(res.status).toBe(404)
  })
  it('400 when no id or url is supplied', async () => {
    const res = await get('/view')
    expect(res.status).toBe(400)
  })
  it('400 for an unsupported url scheme (file://)', async () => {
    const res = await get('/view?url=file:///etc/passwd')
    expect(res.status).toBe(400)
  })
  it('500 for a malformed xlsx (parse failure)', async () => {
    const res = await get('/view/corrupt')
    expect(res.status).toBe(500)
  })
})