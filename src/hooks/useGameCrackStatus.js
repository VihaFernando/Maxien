import { useEffect, useRef, useState } from 'react'
import { lifesyncFetch } from '../lib/lifesyncApi'

export function useGameCrackStatus({
    query = '',
    slug = '',
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

    const fetchStatus = async () => {
        const q = String(query || '').trim()
        const s = String(slug || '').trim()

        if (!mountedRef.current || !enabled) return
        if (!q && !s) {
            setData(null)
            setLoading(false)
            setError(null)
            return
        }

        setLoading(true)
        setError(null)

        try {
            const qs = new URLSearchParams()
            if (q) qs.set('q', q)
            if (s) qs.set('slug', s)
            if (view) qs.set('view', String(view))
            if (refresh) qs.set('refresh', '1')

            const path = `/api/gamesearch/crack-status?${qs.toString()}`
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
        void fetchStatus()
    }, [query, slug, refresh, view, enabled])

    return {
        data,
        loading,
        error,
        refetch: fetchStatus,
    }
}
