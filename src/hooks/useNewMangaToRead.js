import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Tracks "new manga to read"  titles that picked up a fresh chapter after a sync.
 *
 * The list is derived from reading entries flagged `hasNewChapter`, but we persist
 * the *dismissed* set (book ids the user has already opened or cleared) in
 * localStorage so a card never reappears once it's been acted on  even across
 * reloads. When the user opens a title we record it as read; the panel removes it
 * immediately and it stays gone until a genuinely newer chapter lands.
 */

const STORAGE_KEY = 'lifesync.mangaLibrary.newToRead.dismissed.v1'
const MAX_TRACKED = 400

function bookKey(entry) {
    const book = String(entry?.bookId || '').trim()
    if (book) return book
    return `${entry?.source || ''}:${entry?.mangaId || ''}`
}

/** Identity of the *unread* chapter  so a card returns only when a newer one drops. */
function chapterSignature(entry) {
    return String(
        entry?.remoteLatestChapterId
        || entry?.remoteLatestChapterLabel
        || entry?.lastChapterId
        || '',
    ).trim()
}

function readStore() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return {}
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
        return {}
    }
}

function writeStore(map) {
    try {
        const entries = Object.entries(map)
        // Cap growth  keep the most recently dismissed.
        const trimmed = entries.length > MAX_TRACKED
            ? entries
                .sort((a, b) => Number(b[1]?.at || 0) - Number(a[1]?.at || 0))
                .slice(0, MAX_TRACKED)
            : entries
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(trimmed)))
    } catch {
        /* storage full / unavailable  non-fatal */
    }
}

export function useNewMangaToRead(entries) {
    const [dismissed, setDismissed] = useState(readStore)
    const dismissedRef = useRef(dismissed)
    useEffect(() => { dismissedRef.current = dismissed }, [dismissed])

    // Cross-tab sync  another tab marking something read should reflect here too.
    useEffect(() => {
        const onStorage = (e) => {
            if (e.key === STORAGE_KEY) setDismissed(readStore())
        }
        window.addEventListener('storage', onStorage)
        return () => window.removeEventListener('storage', onStorage)
    }, [])

    const persist = useCallback((updater) => {
        setDismissed((prev) => {
            const next = updater(prev)
            writeStore(next)
            return next
        })
    }, [])

    const newItems = useMemo(() => {
        const list = Array.isArray(entries) ? entries : []
        const seen = new Set()
        const out = []
        for (const entry of list) {
            if (!entry?.hasNewChapter) continue
            const key = bookKey(entry)
            if (!key || key === ':' || seen.has(key)) continue
            // Skip if the user already dismissed *this* chapter (signature match).
            const record = dismissed[key]
            if (record && record.sig === chapterSignature(entry)) continue
            seen.add(key)
            out.push(entry)
        }
        return out
    }, [entries, dismissed])

    const dismissOne = useCallback((entry) => {
        const key = bookKey(entry)
        if (!key || key === ':') return
        persist((prev) => ({
            ...prev,
            [key]: { sig: chapterSignature(entry), at: Date.now() },
        }))
    }, [persist])

    const dismissAll = useCallback((items) => {
        const list = Array.isArray(items) ? items : []
        if (!list.length) return
        persist((prev) => {
            const next = { ...prev }
            const at = Date.now()
            for (const entry of list) {
                const key = bookKey(entry)
                if (!key || key === ':') continue
                next[key] = { sig: chapterSignature(entry), at }
            }
            return next
        })
    }, [persist])

    return { newItems, dismissOne, dismissAll }
}
