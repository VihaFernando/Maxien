import { useCallback, useEffect, useRef, useState } from 'react'
import { lifesyncFetch } from '../lib/lifesyncApi'

export const LIFESYNC_ANIME_WATCH_HISTORY_UPDATED_EVENT = 'lifesync:anime-watch-history-updated'
const REFRESH_DEBOUNCE_MS = 120

/**
 * @param {{ enabled: boolean, limit?: number }} opts
 */
export function useAnimeWatchHistory({ enabled, limit = 24 }) {
    const [entries, setEntries] = useState([])
    const [loading, setLoading] = useState(false)
    const abortRef = useRef(null)
    const mountedRef = useRef(true)
    const reqSeqRef = useRef(0)
    const refreshTimerRef = useRef(null)

    const clearScheduledRefresh = useCallback(() => {
        if (refreshTimerRef.current != null) {
            window.clearTimeout(refreshTimerRef.current)
            refreshTimerRef.current = null
        }
    }, [])

    const refresh = useCallback(async ({ silent = false } = {}) => {
        if (!enabled) {
            if (abortRef.current) {
                abortRef.current.abort()
                abortRef.current = null
            }
            setEntries([])
            if (!silent) setLoading(false)
            return
        }

        if (!silent) setLoading(true)
        if (abortRef.current) abortRef.current.abort()
        const ac = new AbortController()
        abortRef.current = ac
        const reqSeq = ++reqSeqRef.current

        try {
            const cap = Math.min(100, Math.max(1, Math.floor(Number(limit)) || 24))
            const d = await lifesyncFetch(
                `/api/v1/anime/watch-history?limit=${encodeURIComponent(String(cap))}&view=standard`,
                { signal: ac.signal },
            )
            if (!mountedRef.current || ac.signal.aborted || reqSeq !== reqSeqRef.current) return
            setEntries(Array.isArray(d?.entries) ? d.entries : [])
        } catch (e) {
            if (e?.name === 'AbortError' || !mountedRef.current || reqSeq !== reqSeqRef.current) return
            setEntries([])
        } finally {
            if (!silent && mountedRef.current && reqSeq === reqSeqRef.current) {
                setLoading(false)
            }
        }
    }, [enabled, limit])

    const scheduleRefresh = useCallback((opts = {}) => {
        clearScheduledRefresh()
        refreshTimerRef.current = window.setTimeout(() => {
            refreshTimerRef.current = null
            void refresh(opts)
        }, REFRESH_DEBOUNCE_MS)
    }, [clearScheduledRefresh, refresh])

    useEffect(() => {
        mountedRef.current = true
        void refresh()
        return () => {
            mountedRef.current = false
            clearScheduledRefresh()
            if (abortRef.current) {
                abortRef.current.abort()
                abortRef.current = null
            }
        }
    }, [clearScheduledRefresh, refresh])

    useEffect(() => {
        if (!enabled) return undefined

        const onUpdated = () => scheduleRefresh({ silent: true })
        const onVis = () => {
            if (document.visibilityState === 'visible') scheduleRefresh({ silent: true })
        }

        window.addEventListener(LIFESYNC_ANIME_WATCH_HISTORY_UPDATED_EVENT, onUpdated)
        window.addEventListener('focus', onUpdated)
        document.addEventListener('visibilitychange', onVis)

        return () => {
            window.removeEventListener(LIFESYNC_ANIME_WATCH_HISTORY_UPDATED_EVENT, onUpdated)
            window.removeEventListener('focus', onUpdated)
            document.removeEventListener('visibilitychange', onVis)
            clearScheduledRefresh()
        }
    }, [clearScheduledRefresh, enabled, scheduleRefresh])

    return { entries, loading, refresh }
}
