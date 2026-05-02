import { lifesyncFetch } from '../../lib/lifesyncApi'
import {
    clearProgressStore,
    getProgressQueueObject,
    getProgressStateObject,
    getProgressEntry,
    markProgressSynced,
    removeProgressLocal,
    setProgressQueueObject,
    upsertProgressLocal,
    hydrateProgressStore,
} from './progressStore'
import {
    deleteProgressRow,
    deleteQueueRow,
    loadProgressDbState,
    replaceProgressRows,
    replaceQueueRows,
} from './progressDb'

const FLUSH_DEBOUNCE_MS = 3200
const FLUSH_INTERVAL_MS = 5000
const FLUSH_BATCH_SIZE = 32

let hydrated = false
let hydrating = null
let flushTimer = null
let intervalTimer = null

function normalizePercent(value) {
    const n = Number(value)
    if (!Number.isFinite(n)) return 0
    return Math.max(0, Math.min(100, Math.round(n * 10) / 10))
}

function normalizeSource(value) {
    const source = String(value || '').trim().toLowerCase()
    if (source === 'mangadistrict') return 'mangadistrict'
    if (source === 'comix') return 'comix'
    if (source === 'hentaifox') return 'hentaifox'
    return ''
}

function toBookId(payload) {
    const explicit = String(payload?.bookId || '').trim()
    if (explicit) return explicit
    const source = normalizeSource(payload?.source)
    const mangaId = String(payload?.mangaId || '').trim()
    if (!source || !mangaId) return ''
    return `${source}:${mangaId}`
}

function toProgressWritePayload(payload) {
    const source = normalizeSource(payload?.source)
    const mangaId = String(payload?.mangaId || '').trim()
    const chapterId = String(payload?.lastChapterId || payload?.locator?.chapterId || '').trim()
    if (!source || !mangaId || !chapterId) return null

    const savedAt = String(payload?.savedAt || payload?.updatedAt || new Date().toISOString())

    return {
        bookId: toBookId(payload),
        source,
        mangaId,
        progressPct: normalizePercent(payload?.lastReadPercent ?? payload?.progressPct),
        locator: {
            chapterId,
            ...(Number.isFinite(Number(payload?.locator?.page)) && Number(payload.locator.page) > 0
                ? { page: Math.floor(Number(payload.locator.page)) }
                : {}),
        },
        updatedAt: savedAt,
        ...(payload?.deviceId ? { deviceId: String(payload.deviceId).trim().slice(0, 120) } : {}),
        status: {
            ...(payload?.readingStatus !== undefined ? { readingStatus: payload.readingStatus || null } : {}),
            ...(payload?.isPinned !== undefined ? { isPinned: Boolean(payload.isPinned) } : {}),
            ...(payload?.labels !== undefined ? { labels: Array.isArray(payload.labels) ? payload.labels : [] } : {}),
            ...(payload?.note !== undefined ? { note: payload.note || null } : {}),
            ...(payload?.lastOpenedAt ? { lastOpenedAt: String(payload.lastOpenedAt) } : {}),
        },
    }
}

function sortQueueRows(rows) {
    return [...rows].sort((a, b) => {
        const at = Date.parse(String(a?.savedAt || ''))
        const bt = Date.parse(String(b?.savedAt || ''))
        const atSafe = Number.isFinite(at) ? at : 0
        const btSafe = Number.isFinite(bt) ? bt : 0
        return atSafe - btSafe
    })
}

export async function ensureProgressStoreReady() {
    if (hydrated) return true
    if (hydrating) return hydrating

    hydrating = (async () => {
        try {
            const snapshot = await loadProgressDbState()
            hydrateProgressStore(snapshot)
            hydrated = true
            return true
        } catch {
            hydrated = true
            return false
        } finally {
            hydrating = null
        }
    })()

    return hydrating
}

export function readProgressQueueSync() {
    return getProgressQueueObject()
}

export function writeProgressQueueSync(queueObj) {
    setProgressQueueObject(queueObj)
    void replaceQueueRows(getProgressQueueObject())
}

export function persistProgressLocal(payload) {
    const normalized = {
        ...payload,
        source: normalizeSource(payload?.source),
        bookId: toBookId(payload),
        lastReadPercent: normalizePercent(payload?.lastReadPercent),
        savedAt: payload?.savedAt || new Date().toISOString(),
        updatedAt: payload?.savedAt || new Date().toISOString(),
    }

    const row = upsertProgressLocal(normalized, { savedAt: normalized.savedAt })
    if (!row) return null

    void replaceProgressRows(getProgressStateObject())
    void replaceQueueRows(getProgressQueueObject())
    return row
}

export async function removeProgressByBookId(bookId) {
    const key = String(bookId || '').trim()
    if (!key) return false

    removeProgressLocal(key)
    await Promise.allSettled([
        deleteProgressRow(key),
        deleteQueueRow(key),
    ])

    try {
        await lifesyncFetch('/api/v1/progress/batch', {
            method: 'POST',
            json: {
                items: [{ delete: true, bookId: key }],
            },
        })
    } catch {
        // keep local deletion; retry not required for this UX path
    }

    return true
}

export async function flushProgressQueue({ keepalive = false, maxItems = FLUSH_BATCH_SIZE } = {}) {
    const queue = getProgressQueueObject()
    const rows = sortQueueRows(Object.values(queue || {}))
    if (!rows.length) return { sent: 0 }

    const slice = rows.slice(0, Math.max(1, maxItems))
    const items = slice
        .map((row) => toProgressWritePayload(row))
        .filter(Boolean)

    if (!items.length) return { sent: 0 }

    await lifesyncFetch('/api/v1/progress/batch', {
        method: 'POST',
        json: { items },
        ...(keepalive ? { keepalive: true } : {}),
    })

    for (const row of slice) {
        const key = toBookId(row)
        if (!key) continue
        markProgressSynced(key)
        await deleteQueueRow(key)
    }

    return { sent: slice.length }
}

export function scheduleProgressFlush() {
    if (flushTimer) window.clearTimeout(flushTimer)
    flushTimer = window.setTimeout(() => {
        flushTimer = null
        void flushProgressQueue().catch(() => {})
    }, FLUSH_DEBOUNCE_MS)
}

export function startProgressBackgroundSync() {
    if (intervalTimer) return
    intervalTimer = window.setInterval(() => {
        void flushProgressQueue().catch(() => {})
    }, FLUSH_INTERVAL_MS)
}

export function stopProgressBackgroundSync() {
    if (flushTimer) {
        window.clearTimeout(flushTimer)
        flushTimer = null
    }
    if (intervalTimer) {
        window.clearInterval(intervalTimer)
        intervalTimer = null
    }
}

export function pickLocalResumeCandidate(mangaId, preferredSource = '') {
    const targetMangaId = String(mangaId || '').trim()
    if (!targetMangaId) return null

    const sourceHint = normalizeSource(preferredSource)
    const rows = Object.values(getProgressQueueObject() || {})
    let best = null

    for (const row of rows) {
        if (String(row?.mangaId || '').trim() !== targetMangaId) continue
        const percent = normalizePercent(row?.lastReadPercent)
        if (!(percent > 0 && percent < 100)) continue

        const chapterId = String(row?.lastChapterId || '').trim()
        if (!chapterId) continue

        const source = normalizeSource(row?.source)
        const score = sourceHint && source === sourceHint ? 1 : 0
        const savedAtRaw = Date.parse(String(row?.savedAt || row?.updatedAt || ''))
        const savedAt = Number.isFinite(savedAtRaw) ? savedAtRaw : 0

        if (!best || score > best.score || (score === best.score && savedAt > best.savedAt)) {
            best = { source, chapterId, percent, savedAt, score }
        }
    }

    if (!best) return null
    return {
        source: best.source,
        chapterId: best.chapterId,
        percent: best.percent,
        savedAt: best.savedAt,
    }
}

export function clearProgressState() {
    clearProgressStore()
}

export function getProgressByBookId(bookId) {
    return getProgressEntry(bookId)
}
