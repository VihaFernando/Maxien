/**
 * Client-side cache for `GET /api/v1/anime/stream/info/by-slug/:animeId` (episode list + embed ids).
 * Reduces repeat fetches when browsing / reopening the same title. TTL aligns loosely with server AnimeData.
 */

const CACHE_VERSION = 3
const TTL_MS = 1000 * 60 * 60 * 24 * 14 // 14 days

/** @param {string} animeId */
function storageKey(animeId) {
  return `maxien_lifesync_stream_by_slug:v${CACHE_VERSION}:${String(animeId).trim()}`
}

/**
 * @param {unknown} animeId
 * @returns {string|null}
 */
function normalizeAnimeId(animeId) {
  const s = String(animeId ?? '').trim()
  return s || null
}

/**
 * @param {string} animeId
 * @returns {{ data: unknown, cached?: boolean } | null}
 */
export function readLifesyncStreamCatalogBySlug(animeId) {
  const id = normalizeAnimeId(animeId)
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
      try { localStorage.removeItem(storageKey(id)) } catch { /* ignore */ }
      return null
    }
    const body = row?.body
    if (!body || typeof body !== 'object' || body.data == null) return null
    return /** @type {{ data: unknown, cached?: boolean }} */ (body)
  } catch {
    try { localStorage.removeItem(storageKey(id)) } catch { /* ignore */ }
    return null
  }
}

/**
 * @param {string} animeId
 * @param {{ data?: unknown, cached?: boolean } | null | undefined} apiResponse
 */
export function writeLifesyncStreamCatalogBySlug(animeId, apiResponse) {
  const id = normalizeAnimeId(animeId)
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

/** @param {string} animeId */
export function invalidateLifesyncStreamCatalogBySlug(animeId) {
  const id = normalizeAnimeId(animeId)
  if (!id || typeof localStorage === 'undefined') return
  try { localStorage.removeItem(storageKey(id)) } catch { /* ignore */ }
}

/**
 * @param {string} animeId
 * @param {(path: string, init?: RequestInit) => Promise<unknown>} fetcher
 * @param {RequestInit} [init]
 * @param {{ forceRefresh?: boolean, fromResumeDeck?: boolean, title?: string }} [opts]
 * @returns {Promise<{ data?: unknown, cached?: boolean } | null>}
 */
export async function fetchStreamInfoBySlugWithCache(animeId, fetcher, init, opts = {}) {
  const id = normalizeAnimeId(animeId)
  if (!id) return null
  const forceRefresh = opts?.forceRefresh === true
  const fromResumeDeck = opts?.fromResumeDeck === true
  const title = String(opts?.title ?? '').trim()
  if (!forceRefresh) {
    const hit = readLifesyncStreamCatalogBySlug(id)
    if (hit) return hit
  }
  const qs = new URLSearchParams({ view: 'full' })
  if (fromResumeDeck) qs.set('fromResumeDeck', '1')
  if (title) qs.set('title', title)
  const res = await fetcher(`/api/v1/anime/stream/info/by-slug/${encodeURIComponent(id)}?${qs.toString()}`, init).catch(() => null)
  const body = res && typeof res === 'object' ? res : null
  if (body?.data != null) writeLifesyncStreamCatalogBySlug(id, body)
  return body
}
