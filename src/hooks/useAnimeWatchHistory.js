import { useCallback, useEffect, useRef, useState } from 'react'
import { lifesyncFetch } from '../lib/lifesyncApi'

export const LIFESYNC_ANIME_WATCH_HISTORY_UPDATED_EVENT = 'lifesync:anime-watch-history-updated'

/**
 * @param {{ enabled: boolean, limit?: number }} opts
 */
export function useAnimeWatchHistory({ enabled, limit = 24 }) {
    const [entries, setEntries] = useState([])
    const [loading, setLoading] = useState(false)
    const requestIdRef = useRef(0)

    const refresh = useCallback(async () => {
        const requestId = ++requestIdRef.current
        if (!enabled) {
            setEntries([])
            return
        }
        setLoading(true)
        try {
            const cap = Math.min(100, Math.max(1, Math.floor(Number(limit)) || 24))
            const d = await lifesyncFetch(`/api/v1/anime/watch-history?limit=${encodeURIComponent(String(cap))}&view=standard`)
            if (requestId !== requestIdRef.current) return
            setEntries(Array.isArray(d?.entries) ? d.entries : [])
        } catch {
            if (requestId !== requestIdRef.current) return
            setEntries([])
        } finally {
            if (requestId === requestIdRef.current) setLoading(false)
        }
    }, [enabled, limit])

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
