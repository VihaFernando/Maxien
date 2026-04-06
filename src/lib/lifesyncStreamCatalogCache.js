/**
 * Client-side cache for `GET /api/anime/stream/info/by-mal/:malId` (episode list + embed ids).
 * Reduces repeat fetches when browsing / reopening the same title. TTL aligns loosely with server AnimeData.
 */

const CACHE_VERSION = 1
const TTL_MS = 1000 * 60 * 60 * 24 * 14 // 14 days (same order as server AnimeData TTL)

/** @param {string} malId */
function storageKey(malId) {
  return `maxien_lifesync_stream_by_mal:v${CACHE_VERSION}:${String(malId).trim()}`
}

/**
 * @param {unknown} malId
 * @returns {string|null}
 */
function normalizeMalId(malId) {
  const s = String(malId ?? '').trim()
  return /^\d+$/.test(s) ? s : null
}

/**
 * @param {string} malId
 * @returns {{ data: unknown, cached?: boolean } | null}
 */
export function readLifesyncStreamCatalogByMal(malId) {
  const id = normalizeMalId(malId)
  if (!id || typeof localStorage === 'undefined') return null
  let raw = ''
  try {
    raw = localStorage.getItem(storageKey(id)) || ''
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const row = JSON.parse(raw)
    const savedAt = Number(row?.savedAt)
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > TTL_MS) {
      try {
        localStorage.removeItem(storageKey(id))
      } catch {
        /* ignore */
      }
      return null
    }
    const body = row?.body
    if (!body || typeof body !== 'object' || body.data == null) return null
    return /** @type {{ data: unknown, cached?: boolean }} */ (body)
  } catch {
    try {
      localStorage.removeItem(storageKey(id))
    } catch {
      /* ignore */
    }
    return null
  }
}

/**
 * @param {string|number} malId
 * @param {{ data?: unknown, cached?: boolean } | null | undefined} apiResponse — JSON body from the stream/info route
 */
export function writeLifesyncStreamCatalogByMal(malId, apiResponse) {
  const id = normalizeMalId(malId)
  if (!id || typeof localStorage === 'undefined') return
  if (!apiResponse || apiResponse.data == null) return
  try {
    const payload = JSON.stringify({
      savedAt: Date.now(),
      body: { data: apiResponse.data, ...(apiResponse.cached != null ? { cached: apiResponse.cached } : {}) },
    })
    localStorage.setItem(storageKey(id), payload)
  } catch {
    /* quota or private mode */
  }
}

/** @param {string|number} malId */
export function invalidateLifesyncStreamCatalogByMal(malId) {
  const id = normalizeMalId(malId)
  if (!id || typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(storageKey(id))
  } catch {
    /* ignore */
  }
}

/**
 * @param {string|number} malId
 * @param {(path: string, init?: RequestInit) => Promise<unknown>} fetcher — e.g. lifesyncFetch
 * @param {RequestInit} [init]
 * @returns {Promise<{ data?: unknown, cached?: boolean } | null>}
 */
export async function fetchStreamInfoByMalWithCache(malId, fetcher, init) {
  const id = normalizeMalId(malId)
  if (!id) return null
  const hit = readLifesyncStreamCatalogByMal(id)
  if (hit) return hit
  const res = await fetcher(`/api/anime/stream/info/by-mal/${encodeURIComponent(id)}`, init).catch(() => null)
  const body = res && typeof res === 'object' ? res : null
  if (body?.data != null) writeLifesyncStreamCatalogByMal(id, body)
  return body
}
