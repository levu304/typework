// Document resolution: local id -> documents dir, remote url -> fetch Buffer.
// Fail-loud: missing -> 404, bad params -> 400, parse failure is caller's duty (500).
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { stat } from 'node:fs/promises'

export const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024 // ponytail: guard rail; 1MB target, hard cap 50MB

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'HttpError'
  }
}

export async function resolveDocument(
  id: string | null,
  url: string | null,
  documentsDir: string,
): Promise<Buffer> {
  if (url) {
    return fetchRemote(url)
  }
  if (id) {
    // Accept /documents/<id> or /documents/<id>.xlsx
    for (const candidate of [
      resolve(documentsDir, id),
      resolve(documentsDir, id + '.xlsx'),
    ]) {
      try {
        const stat_ = await stat(candidate)
        if (stat_.isFile()) {
          return readFile(candidate)
        }
      } catch {
        // try next candidate
      }
    }
    throw new HttpError(404, `Document not found: ${id}`)
  }
  throw new HttpError(400, 'Missing document id or url parameter')
}

async function fetchRemote(url: string): Promise<Buffer> {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    throw new HttpError(400, `Invalid url parameter`)
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new HttpError(400, 'Unsupported url scheme (http/https only)')
  }
  let res: Response
  try {
    res = await fetch(u, { redirect: 'follow' })
  } catch {
    throw new HttpError(400, `Failed to fetch url`)
  }
  if (!res.ok) {
    throw new HttpError(400, `Remote fetch failed: ${res.status}`)
  }
  const len = res.headers.get('content-length')
  if (len && Number(len) > MAX_DOWNLOAD_BYTES) {
    throw new HttpError(413, `Remote document too large (> ${MAX_DOWNLOAD_BYTES} bytes)`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > MAX_DOWNLOAD_BYTES) {
    throw new HttpError(413, `Remote document too large (> ${MAX_DOWNLOAD_BYTES} bytes)`)
  }
  return buf
}