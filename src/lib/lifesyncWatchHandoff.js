/**
 * Short-lived session handoff from Anime detail → dedicated watch route.
 * Survives React Strict Mode remounts (peek does not delete); entries expire by TTL.
 */

const PREFIX = 'maxien_lifesync_watch_handoff:v1:'
const TTL_MS = 1000 * 60 * 5

function key(id) {
  return `${PREFIX}${String(id || '').trim()}`
}

/**
 * @param {{
 *   malId: string,
 *   episodeIndex: number,
 *   anime: unknown,
 *   episodes: unknown[],
 *   stream: unknown,
 * }} payload
 * @returns {string} handoff id for `navigate(..., { state: { handoffId } })`
 */
export function stashAnimeWatchHandoff(payload) {
  const id = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
  if (typeof sessionStorage === 'undefined') return id
  try {
    sessionStorage.setItem(
      key(id),
      JSON.stringify({
        savedAt: Date.now(),
        malId: String(payload.malId ?? '').trim(),
        episodeIndex: Number(payload.episodeIndex) || 0,
        anime: payload.anime ?? null,
        episodes: Array.isArray(payload.episodes) ? payload.episodes : [],
        stream: payload.stream ?? null,
      }),
    )
  } catch {
    /* quota / private mode */
  }
  return id
}

/**
 * @param {string} id
 * @returns {{ malId: string, episodeIndex: number, anime: unknown, episodes: unknown[], stream: unknown } | null}
 */
export function peekAnimeWatchHandoff(id) {
  if (!id || typeof sessionStorage === 'undefined') return null
  let raw = ''
  try {
    raw = sessionStorage.getItem(key(id)) || ''
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const row = JSON.parse(raw)
    const savedAt = Number(row?.savedAt)
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > TTL_MS) {
      try {
        sessionStorage.removeItem(key(id))
      } catch {
        /* ignore */
      }
      return null
    }
    const malId = String(row?.malId ?? '').trim()
    if (!malId) return null
    return {
      malId,
      episodeIndex: Number(row?.episodeIndex) || 0,
      anime: row?.anime ?? null,
      episodes: Array.isArray(row?.episodes) ? row.episodes : [],
      stream: row?.stream ?? null,
    }
  } catch {
    try {
      sessionStorage.removeItem(key(id))
    } catch {
      /* ignore */
    }
    return null
  }
}

/** Optional: remove after successful longer session (e.g. user left watch page). */
export function clearAnimeWatchHandoff(id) {
  if (!id || typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(key(id))
  } catch {
    /* ignore */
  }
}
