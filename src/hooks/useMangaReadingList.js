import { useCallback, useEffect, useMemo, useState } from 'react'
import { lifesyncFetch } from '../lib/lifesyncApi'

const MD_NSFW_RATINGS = new Set(['erotica', 'pornographic'])

export function filterMangaReadingByNsfw(entries, nsfwEnabled) {
    if (nsfwEnabled) return entries
    return entries.filter((e) => {
        if (e.source === 'hentaifox' || e.source === 'mangadistrict') return false
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

    const refresh = useCallback(async () => {
        if (!enabled) {
            setEntries([])
            return
        }
        setLoading(true)
        try {
            const d = await lifesyncFetch('/api/manga/reading')
            setEntries(Array.isArray(d) ? d : d?.entries || [])
        } catch {
            setEntries([])
        } finally {
            setLoading(false)
        }
    }, [enabled])

    useEffect(() => {
        void refresh()
    }, [refresh])

    const visibleEntries = useMemo(
        () => filterMangaReadingByNsfw(entries, nsfwEnabled),
        [entries, nsfwEnabled]
    )

    return { entries, visibleEntries, loading, refresh }
}
