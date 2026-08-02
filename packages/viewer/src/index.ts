// HTTP server: read-only spreadsheet viewer.
// GET /view/:id  (local id in documents dir)
// GET /view?url=<url>  (remote XLSX)
// ?sheet=<name> selects worksheet. Static HTML, no client JS (design D2).
import { createServer as nodeCreateServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { cwd } from 'node:process'
import { pathToFileURL } from 'node:url'
import { HttpError, resolveDocument } from './document.js'
import { renderWorkbook, workbookFromBuffer } from './renderer.js'

export interface ServerEnv {
  documentsDir: string
}

export function defaultEnv(): ServerEnv {
  // ponytail: explicit over magic; env override with sensible default.
  const envDir = process.env.TYPWORK_DOCUMENTS_DIR
  return { documentsDir: envDir ? resolve(cwd(), envDir) : resolve(cwd(), 'documents') }
}

export interface RenderResult {
  status: number
  headers: Record<string, string>
  body: string
}

// Pure handler: routes, resolves, renders, maps errors to HTTP statuses.
// Exported so failure-path tests (404/400/500) can assert without a socket.
export async function handleRequest(
  pathname: string,
  search: URLSearchParams,
  env: ServerEnv,
): Promise<RenderResult> {
  // Route: /view/:id  or  /view?url=...
  let id: string | null = null
  let url: string | null = null

  const m = pathname.match(/^\/view\/(.+)$/)
  if (m) {
    id = decodeURIComponent(m[1])
  } else if (pathname === '/view' || pathname === '/') {
    url = search.get('url')
    if (url === null && pathname === '/view') {
      // /view with neither id nor url -> 400
      throw new HttpError(400, 'Missing document id or url parameter')
    }
  } else {
    throw new HttpError(404, 'Not found')
  }

  const buf = await resolveDocument(id, url, env.documentsDir)

  const wb = await workbookFromBuffer(buf)

  const sheet = search.get('sheet') || undefined
  const qsParts = new URLSearchParams()
  if (url) qsParts.set('url', url)
  const body = renderWorkbook(wb, { title: (id || url) || undefined, sheet, qs: qsParts.toString() })
  return { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, body }
}

export function createServer(env: ServerEnv = defaultEnv()) {
  return nodeCreateServer((req: IncomingMessage, res: ServerResponse) => {
    const parsed = new URL(req.url || '/', 'http://localhost')
    const search = new URLSearchParams(parsed.search)
    handleRequest(parsed.pathname, search, env)
      .then((r) => {
        res.writeHead(r.status, r.headers)
        res.end(r.body)
      })
      .catch((err: unknown) => {
        const status = err instanceof HttpError ? err.status : 500
        const message =
          err instanceof Error
            ? err.message
            : 'Internal Server Error'
        res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' })
        res.end(`<!doctype html><title>${status}</title><h1>${status} ${escHtml(message)}</h1>`)
      })
  })
}

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// CLI entry. Run with: `node dist/index.js` or `pnpm dev`.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const port = Number(process.env.PORT ?? 3000)
  const server = createServer()
  server.listen(port, () => {
    console.log(`spreadsheet viewer listening on http://localhost:${port}`)
  })
}