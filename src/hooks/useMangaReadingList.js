import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { lifesyncFetch } from '../lib/lifesyncApi'

const MD_NSFW_RATINGS = new Set(['erotica', 'pornographic'])

export function filterMangaReadingByNsfw(entries, nsfwEnabled) {
    if (nsfwEnabled) return entries
    return entries.filter((e) => {
        if (e.source === 'mangadistrict') return false
        if (e.source === 'mangadex') {
            const cr = e.contentRating
            if (cr && MD_NSFW_RATINGS.has(String(cr))) return false
            return true
        }
        return true
    })
}

/**
 * @param {{ enabled: boolean, nsfwEnabled: boolean }} opts
 */
export function useMangaReadingList({ enabled, nsfwEnabled }) {
    const [entries, setEntries] = useState([])
    const [loading, setLoading] = useState(false)
    const abortRef = useRef(null)
    const mountedRef = useRef(true)
    const reqSeqRef = useRef(0)

    const dedupe = useCallback((raw) => {
        const list = Array.isArray(raw) ? raw : []
        const byKey = new Map()
        for (const e of list) {
            const source = String(e?.source || '').toLowerCase()
            const mangaId = String(e?.mangaId || '').trim()
            if (!source || !mangaId) continue
            const key = `${source}:${mangaId}`
            const prev = byKey.get(key)
            if (!prev) {
                byKey.set(key, e)
                continue
            }
            const pt = prev?.updatedAt ? new Date(prev.updatedAt).getTime() : 0
            const et = e?.updatedAt ? new Date(e.updatedAt).getTime() : 0
            if (et >= pt) byKey.set(key, e)
        }
        return [...byKey.values()].sort((a, b) => (new Date(b.updatedAt) - new Date(a.updatedAt)))
    }, [])

    const refresh = useCallback(async () => {
        if (!enabled) {
            if (abortRef.current) {
                abortRef.current.abort()
                abortRef.current = null
            }
            setEntries([])
            setLoading(false)
            return
        }

        if (abortRef.current) abortRef.current.abort()
        const ac = new AbortController()
        abortRef.current = ac
        const reqSeq = ++reqSeqRef.current
        setLoading(true)
        try {
            const d = await lifesyncFetch('/api/v1/manga/reading?view=standard', { signal: ac.signal })
            if (!mountedRef.current || ac.signal.aborted || reqSeq !== reqSeqRef.current) return
            const next = Array.isArray(d) ? d : d?.entries || []
            setEntries(dedupe(next))
        } catch (e) {
            if (e?.name === 'AbortError' || !mountedRef.current || reqSeq !== reqSeqRef.current) return
            setEntries([])
        } finally {
            if (mountedRef.current && reqSeq === reqSeqRef.current) setLoading(false)
        }
    }, [dedupe, enabled])

    useEffect(() => {
        mountedRef.current = true
        void refresh()
        return () => {
            mountedRef.current = false
            if (abortRef.current) {
                abortRef.current.abort()
                abortRef.current = null
            }
        }
    }, [refresh])

    const visibleEntries = useMemo(
        () => filterMangaReadingByNsfw(entries, nsfwEnabled),
        [entries, nsfwEnabled]
    )

    return { entries, visibleEntries, loading, refresh }
}
