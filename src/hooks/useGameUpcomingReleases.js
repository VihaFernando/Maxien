import { useEffect, useRef, useState } from 'react'
import { lifesyncFetch } from '../lib/lifesyncApi'

export function useGameUpcomingReleases({
    limit = 24,
    includeUnknown = false,
    refresh = false,
    view = 'standard',
    enabled = true,
} = {}) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const mountedRef = useRef(true)

    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
        }
    }, [])

    const fetchUpcoming = async () => {
        if (!mountedRef.current || !enabled) return
        setLoading(true)
        setError(null)

        try {
            const qs = new URLSearchParams()
            if (limit != null) qs.set('limit', String(limit))
            if (view) qs.set('view', String(view))
            if (includeUnknown) qs.set('include_unknown', '1')
            if (refresh) qs.set('refresh', '1')

            const path = `/api/gamesearch/upcoming${qs.toString() ? '?' + qs.toString() : ''}`
            const result = await lifesyncFetch(path)

            if (mountedRef.current) {
                setData(result)
            }
        } catch (err) {
            if (mountedRef.current) {
                setError(err)
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false)
            }
        }
    }

    useEffect(() => {
        void fetchUpcoming()
    }, [limit, includeUnknown, refresh, view, enabled])

    return {
        data,
        loading,
        error,
        refetch: fetchUpcoming,
    }
}
