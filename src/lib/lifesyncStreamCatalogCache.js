/**
 * Client-side cache for `GET /api/v1/anime/stream/info/by-mal/:malId` (episode list + embed ids).
 * Reduces repeat fetches when browsing / reopening the same title. TTL aligns loosely with server AnimeData.
 */

const CACHE_VERSION = 2
const TTL_MS = 1000 * 60 * 60 * 24 * 14 // 14 days (same order as server AnimeData TTL)
const KEY_PREFIX = `maxien_lifesync_stream_by_mal:v${CACHE_VERSION}:`
const MAX_CACHE_ROWS = 120

function pruneStreamCatalogCache() {
  if (typeof localStorage === 'undefined') return
  const now = Date.now()
  /** @type {{ key: string, savedAt: number }[]} */
  const live = []
  /** @type {string[]} */
  const keys = []
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (k && k.startsWith(KEY_PREFIX)) keys.push(k)
    }
  } catch {
    return
  }

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) {
        localStorage.removeItem(key)
        continue
      }
      const row = JSON.parse(raw)
      const savedAt = Number(row?.savedAt)
      if (!Number.isFinite(savedAt) || now - savedAt > TTL_MS) {
        localStorage.removeItem(key)
        continue
      }
      live.push({ key, savedAt })
    } catch {
      try {
        localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
    }
  }

  if (live.length <= MAX_CACHE_ROWS) return
  live
    .sort((a, b) => a.savedAt - b.savedAt)
    .slice(0, live.length - MAX_CACHE_ROWS)
    .forEach((row) => {
      try {
        localStorage.removeItem(row.key)
      } catch {
        /* ignore */
      }
    })
}

/** @param {string} malId @param {string} [mirror] */
function storageKey(malId, mirror = '') {
  const m = mirror === 'kickassanime' ? ':kaa' : ''
  return `maxien_lifesync_stream_by_mal:v${CACHE_VERSION}:${String(malId).trim()}${m}`
}

/**
 * @param {unknown} malId
 * @returns {string|null}
 */
function normalizeMalId(malId) {
  const s = String(malId ?? '').trim()
  return /^\d+$/.test(s) ? s : null
}

function normalizeMirror(mirror) {
  const s = String(mirror ?? '').trim().toLowerCase()
  return s === 'kickassanime' ? 'kickassanime' : ''
}

/**
 * @param {string} malId
 * @param {string} [mirror]
 * @returns {{ data: unknown, cached?: boolean } | null}
 */
export function readLifesyncStreamCatalogByMal(malId, mirror = '') {
  const id = normalizeMalId(malId)
  if (!id || typeof localStorage === 'undefined') return null
  // Opportunistic maintenance so stale entries do not accumulate forever.
  if (Math.random() < 0.03) pruneStreamCatalogCache()
  const m = normalizeMirror(mirror)
  let raw = ''
  try {
    raw = localStorage.getItem(storageKey(id, m)) || ''
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const row = JSON.parse(raw)
    const savedAt = Number(row?.savedAt)
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > TTL_MS) {
      try {
        localStorage.removeItem(storageKey(id, m))
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
      localStorage.removeItem(storageKey(id, m))
    } catch {
      /* ignore */
    }
    return null
  }
}

/**
 * @param {string|number} malId
 * @param {{ data?: unknown, cached?: boolean } | null | undefined} apiResponse — JSON body from the stream/info route
 * @param {string} [mirror]
 */
export function writeLifesyncStreamCatalogByMal(malId, apiResponse, mirror = '') {
  const id = normalizeMalId(malId)
  if (!id || typeof localStorage === 'undefined') return
  if (!apiResponse || apiResponse.data == null) return
  const m = normalizeMirror(mirror)
  try {
    const payload = JSON.stringify({
      savedAt: Date.now(),
      body: { data: apiResponse.data, ...(apiResponse.cached != null ? { cached: apiResponse.cached } : {}) },
    })
    localStorage.setItem(storageKey(id, m), payload)
    pruneStreamCatalogCache()
  } catch {
    /* quota or private mode */
  }
}

/** @param {string|number} malId @param {string} [mirror] */
export function invalidateLifesyncStreamCatalogByMal(malId, mirror) {
  const id = normalizeMalId(malId)
  if (!id || typeof localStorage === 'undefined') return
  const m = normalizeMirror(mirror)
  try {
    localStorage.removeItem(storageKey(id, m))
  } catch {
    /* ignore */
  }
}

/**
 * @param {string|number} malId
 * @param {(path: string, init?: RequestInit) => Promise<unknown>} fetcher — e.g. lifesyncFetch
 * @param {RequestInit} [init]
 * @param {{ mirror?: string }} [opts]
 * @returns {Promise<{ data?: unknown, cached?: boolean } | null>}
 */
export async function fetchStreamInfoByMalWithCache(malId, fetcher, init, opts = {}) {
  const id = normalizeMalId(malId)
  if (!id) return null
  const mirror = normalizeMirror(opts.mirror)
  const hit = readLifesyncStreamCatalogByMal(id, mirror)
  if (hit) return hit
  const qs = new URLSearchParams({ view: 'full' })
  if (mirror === 'kickassanime') qs.set('mirror', 'kickassanime')
  const res = await fetcher(`/api/v1/anime/stream/info/by-mal/${encodeURIComponent(id)}?${qs.toString()}`, init).catch(() => null)
  const body = res && typeof res === 'object' ? res : null
  if (body?.data != null) writeLifesyncStreamCatalogByMal(id, body, mirror)
  return body
}
