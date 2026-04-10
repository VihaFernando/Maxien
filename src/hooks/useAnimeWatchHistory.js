import { useCallback, useEffect, useState } from 'react'
import { lifesyncFetch } from '../lib/lifesyncApi'

export const LIFESYNC_ANIME_WATCH_HISTORY_UPDATED_EVENT = 'lifesync:anime-watch-history-updated'

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

    useEffect(() => {
        if (!enabled) return undefined

        const onUpdated = () => void refresh()
        const onVis = () => {
            if (document.visibilityState === 'visible') void refresh()
        }

        window.addEventListener(LIFESYNC_ANIME_WATCH_HISTORY_UPDATED_EVENT, onUpdated)
        window.addEventListener('focus', onUpdated)
        document.addEventListener('visibilitychange', onVis)

        return () => {
            window.removeEventListener(LIFESYNC_ANIME_WATCH_HISTORY_UPDATED_EVENT, onUpdated)
            window.removeEventListener('focus', onUpdated)
            document.removeEventListener('visibilitychange', onVis)
        }
    }, [enabled, refresh])

    return { entries, loading, refresh }
}
