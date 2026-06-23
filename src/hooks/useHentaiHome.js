import { useCallback, useEffect, useRef, useState } from 'react'
import { lifesyncFetch } from '../lib/lifesyncApi'

/**
 * Curated WatchHentai home rails (featured / trending / latest) for the Hentai hub.
 *
 * @param {{ enabled?: boolean }} opts
 */
export function useHentaiHome({ enabled = true } = {}) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const requestIdRef = useRef(0)

    const refresh = useCallback(async () => {
        if (!enabled) {
            setData(null)
            return
        }
        const requestId = ++requestIdRef.current
        setLoading(true)
        setError('')
        try {
            const res = await lifesyncFetch('/api/v1/hentai/watchhentai/discover')
            if (requestId !== requestIdRef.current) return
            setData({
                featured: Array.isArray(res?.featured) ? res.featured : [],
                trending: Array.isArray(res?.trending) ? res.trending : [],
                latest: Array.isArray(res?.latest) ? res.latest : [],
                recentEpisodes: Array.isArray(res?.recentEpisodes) ? res.recentEpisodes : [],
                genres: Array.isArray(res?.genres) ? res.genres : [],
            })
        } catch (err) {
            if (requestId !== requestIdRef.current) return
            setError(String(err?.message || 'Failed to load home'))
            setData(null)
        } finally {
            if (requestId === requestIdRef.current) setLoading(false)
        }
    }, [enabled])

    useEffect(() => {
        void refresh()
    }, [refresh])

    return { data, loading, error, refresh }
}
