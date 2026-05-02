const DB_NAME = 'lifesync_manga_progress_v1'
const DB_VERSION = 1
const PROGRESS_STORE = 'progress'
const QUEUE_STORE = 'queue'

let dbPromise = null

function supportsIndexedDb() {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'
}

function reqToPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error || new Error('IndexedDB request failed'))
    })
}

function txDone(tx) {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error || new Error('IndexedDB tx failed'))
        tx.onabort = () => reject(tx.error || new Error('IndexedDB tx aborted'))
    })
}

async function openDb() {
    if (!supportsIndexedDb()) return null
    if (dbPromise) return dbPromise

    dbPromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION)

        request.onupgradeneeded = () => {
            const db = request.result
            if (!db.objectStoreNames.contains(PROGRESS_STORE)) {
                db.createObjectStore(PROGRESS_STORE, { keyPath: 'bookId' })
            }
            if (!db.objectStoreNames.contains(QUEUE_STORE)) {
                db.createObjectStore(QUEUE_STORE, { keyPath: 'bookId' })
            }
        }

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'))
    })

    return dbPromise
}

function rowsToObject(rows) {
    const out = {}
    for (const row of Array.isArray(rows) ? rows : []) {
        const bookId = String(row?.bookId || '').trim()
        if (!bookId) continue
        out[bookId] = row
    }
    return out
}

export async function loadProgressDbState() {
    const db = await openDb()
    if (!db) return { progress: {}, queue: {} }

    const tx = db.transaction([PROGRESS_STORE, QUEUE_STORE], 'readonly')
    const progressStore = tx.objectStore(PROGRESS_STORE)
    const queueStore = tx.objectStore(QUEUE_STORE)

    const [progressRows, queueRows] = await Promise.all([
        reqToPromise(progressStore.getAll()),
        reqToPromise(queueStore.getAll()),
    ])

    await txDone(tx)

    return {
        progress: rowsToObject(progressRows),
        queue: rowsToObject(queueRows),
    }
}

export async function replaceQueueRows(queueObj) {
    const db = await openDb()
    if (!db) return

    const tx = db.transaction([QUEUE_STORE], 'readwrite')
    const queueStore = tx.objectStore(QUEUE_STORE)
    queueStore.clear()

    const rows = queueObj && typeof queueObj === 'object' ? Object.values(queueObj) : []
    for (const row of rows) {
        if (!row || typeof row !== 'object') continue
        const bookId = String(row.bookId || '').trim()
        if (!bookId) continue
        queueStore.put({ ...row, bookId })
    }

    await txDone(tx)
}

export async function replaceProgressRows(progressObj) {
    const db = await openDb()
    if (!db) return

    const tx = db.transaction([PROGRESS_STORE], 'readwrite')
    const progressStore = tx.objectStore(PROGRESS_STORE)
    progressStore.clear()

    const rows = progressObj && typeof progressObj === 'object' ? Object.values(progressObj) : []
    for (const row of rows) {
        if (!row || typeof row !== 'object') continue
        const bookId = String(row.bookId || '').trim()
        if (!bookId) continue
        progressStore.put({ ...row, bookId })
    }

    await txDone(tx)
}

export async function deleteQueueRow(bookId) {
    const key = String(bookId || '').trim()
    if (!key) return
    const db = await openDb()
    if (!db) return

    const tx = db.transaction([QUEUE_STORE], 'readwrite')
    tx.objectStore(QUEUE_STORE).delete(key)
    await txDone(tx)
}

export async function deleteProgressRow(bookId) {
    const key = String(bookId || '').trim()
    if (!key) return
    const db = await openDb()
    if (!db) return

    const tx = db.transaction([PROGRESS_STORE], 'readwrite')
    tx.objectStore(PROGRESS_STORE).delete(key)
    await txDone(tx)
}
