import { useCallback, useEffect, useState } from 'react'
import { lifesyncFetch } from '../lib/lifesyncApi'

/**
 * @param {{ enabled: boolean }} opts
 */
export function useAnimeWatchHistory({ enabled }) {
    const [entries, setEntries] = useState([])
    const [loading, setLoading] = useState(false)

    const refresh = useCallback(async () => {
        if (!enabled) {
            setEntries([])
            return
        }
        setLoading(true)
        try {
            const d = await lifesyncFetch('/api/anime/watch-history?limit=24')
            setEntries(Array.isArray(d?.entries) ? d.entries : [])
        } catch {
            setEntries([])
        } finally {
            setLoading(false)
        }
    }, [enabled])

    useEffect(() => {
        void refresh()
    }, [refresh])

    return { entries, loading, refresh }
}
