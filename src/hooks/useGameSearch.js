import { useEffect, useRef, useState } from 'react'
import { lifesyncFetch } from '../lib/lifesyncApi'

export function useGameSearch({
    query = '',
    mode = 'fast',
    sources,
    view = 'standard',
    limit = 16,
    enabled = true,
} = {}) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const mountedRef = useRef(true)
    const requestIdRef = useRef(0)

    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
        }
    }, [])

    const fetchSearch = async () => {
        const q = String(query || '').trim()
        if (!mountedRef.current || !enabled) return
        const requestId = ++requestIdRef.current
        if (!q) {
            setData(null)
            setLoading(false)
            setError(null)
            return
        }

        setLoading(true)
        setError(null)

        try {
            const qs = new URLSearchParams()
            qs.set('q', q)
            if (mode) qs.set('mode', String(mode))
            if (view) qs.set('view', String(view))
            if (limit != null) qs.set('limit', String(limit))

            if (Array.isArray(sources) && sources.length) {
                qs.set('sources', sources.map((x) => String(x).trim()).filter(Boolean).join(','))
            } else if (typeof sources === 'string' && sources.trim() !== '') {
                qs.set('sources', sources.trim())
            }

            const path = `/api/gamesearch/search?${qs.toString()}`
            const result = await lifesyncFetch(path)

            if (mountedRef.current && requestId === requestIdRef.current) {
                setData(result)
            }
        } catch (err) {
            if (mountedRef.current && requestId === requestIdRef.current) {
                setError(err)
            }
        } finally {
            if (mountedRef.current && requestId === requestIdRef.current) {
                setLoading(false)
            }
        }
    }

    useEffect(() => {
        void fetchSearch()
    }, [query, mode, view, limit, enabled, JSON.stringify(sources || null)])

    return {
        data,
        loading,
        error,
        refetch: fetchSearch,
    }
}
