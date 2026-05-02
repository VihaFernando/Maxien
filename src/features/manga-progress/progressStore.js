const listeners = new Set()

let queueByBookId = new Map()
let progressByBookId = new Map()

function emit() {
    for (const listener of listeners) {
        try {
            listener()
        } catch {
            // noop
        }
    }
}

function toBookId(payload) {
    if (!payload || typeof payload !== 'object') return ''
    const explicit = String(payload.bookId || '').trim()
    if (explicit) return explicit
    const source = String(payload.source || '').trim()
    const mangaId = String(payload.mangaId || '').trim()
    if (!source || !mangaId) return ''
    return `${source}:${mangaId}`
}

function toObject(map) {
    return Object.fromEntries(map.entries())
}

export function subscribeProgressStore(listener) {
    if (typeof listener !== 'function') return () => {}
    listeners.add(listener)
    return () => listeners.delete(listener)
}

export function hydrateProgressStore({ queue = {}, progress = {} } = {}) {
    const nextQueue = new Map()
    const nextProgress = new Map()

    for (const [key, value] of Object.entries(queue || {})) {
        const bookId = String(key || '').trim() || toBookId(value)
        if (!bookId) continue
        nextQueue.set(bookId, { ...value, bookId })
    }

    for (const [key, value] of Object.entries(progress || {})) {
        const bookId = String(key || '').trim() || toBookId(value)
        if (!bookId) continue
        nextProgress.set(bookId, { ...value, bookId })
    }

    queueByBookId = nextQueue
    progressByBookId = nextProgress
    emit()
}

export function getProgressQueueObject() {
    return toObject(queueByBookId)
}

export function getProgressStateObject() {
    return toObject(progressByBookId)
}

export function setProgressQueueObject(queueObj) {
    const nextQueue = new Map()
    const rows = queueObj && typeof queueObj === 'object' ? Object.entries(queueObj) : []

    for (const [key, value] of rows) {
        const bookId = String(key || '').trim() || toBookId(value)
        if (!bookId) continue
        nextQueue.set(bookId, { ...value, bookId })
    }

    queueByBookId = nextQueue
    emit()
}

export function upsertProgressLocal(payload, { savedAt } = {}) {
    const bookId = toBookId(payload)
    if (!bookId) return null

    const nowIso = typeof savedAt === 'string' && savedAt ? savedAt : new Date().toISOString()
    const next = { ...payload, bookId, savedAt: nowIso }

    const prevProgress = progressByBookId.get(bookId)
    const prevUpdatedAt = Date.parse(String(prevProgress?.updatedAt || prevProgress?.savedAt || ''))
    const nextUpdatedAt = Date.parse(String(next.updatedAt || next.savedAt || ''))

    if (!prevProgress || !Number.isFinite(prevUpdatedAt) || (Number.isFinite(nextUpdatedAt) && nextUpdatedAt >= prevUpdatedAt)) {
        progressByBookId.set(bookId, next)
    }

    queueByBookId.set(bookId, next)
    emit()
    return next
}

export function markProgressSynced(bookId) {
    const key = String(bookId || '').trim()
    if (!key) return
    if (!queueByBookId.has(key)) return
    queueByBookId.delete(key)
    emit()
}

export function removeProgressLocal(bookId) {
    const key = String(bookId || '').trim()
    if (!key) return
    queueByBookId.delete(key)
    progressByBookId.delete(key)
    emit()
}

export function getProgressEntry(bookId) {
    const key = String(bookId || '').trim()
    if (!key) return null
    return progressByBookId.get(key) || null
}

export function clearProgressStore() {
    queueByBookId = new Map()
    progressByBookId = new Map()
    emit()
}
