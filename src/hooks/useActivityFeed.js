import { useCallback, useEffect, useRef, useState } from 'react'
import { lifesyncFetch } from '../lib/lifesyncApi'

/**
 * Unified cross-domain activity feed (manga/anime/game/wishlist).
 *
 * @param {{ enabled?: boolean, domain?: string, limit?: number }} opts
 */
export function useActivityFeed({ enabled = true, domain, limit = 30 } = {}) {
    const [entries, setEntries] = useState([])
    const [pageInfo, setPageInfo] = useState(null)
    const [loading, setLoading] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const [error, setError] = useState('')
    const requestIdRef = useRef(0)

    const buildQuery = useCallback((before) => {
        const params = new URLSearchParams()
        if (domain) params.set('domain', domain)
        if (limit) params.set('limit', String(limit))
        if (before) params.set('before', before)
        return params.toString()
    }, [domain, limit])

    const refresh = useCallback(async () => {
        if (!enabled) {
            setEntries([])
            setPageInfo(null)
            return
        }
        const requestId = ++requestIdRef.current
        setLoading(true)
        setError('')
        try {
            const data = await lifesyncFetch(`/api/feed?${buildQuery()}`)
            if (requestId !== requestIdRef.current) return
            setEntries(Array.isArray(data?.entries) ? data.entries : [])
            setPageInfo(data?.pageInfo || null)
        } catch (err) {
            if (requestId !== requestIdRef.current) return
            setError(String(err?.message || 'Failed to load feed'))
        } finally {
            if (requestId === requestIdRef.current) setLoading(false)
        }
    }, [enabled, buildQuery])

    useEffect(() => {
        void refresh()
    }, [refresh])

    const loadMore = useCallback(async () => {
        if (!enabled || !pageInfo?.hasMore || !pageInfo?.nextBefore) return
        setLoadingMore(true)
        try {
            const data = await lifesyncFetch(`/api/feed?${buildQuery(pageInfo.nextBefore)}`)
            setEntries((prev) => [...prev, ...(Array.isArray(data?.entries) ? data.entries : [])])
            setPageInfo(data?.pageInfo || null)
        } catch (err) {
            setError(String(err?.message || 'Failed to load more'))
        } finally {
            setLoadingMore(false)
        }
    }, [enabled, pageInfo, buildQuery])

    return { entries, pageInfo, loading, loadingMore, error, refresh, loadMore }
}
