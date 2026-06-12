import { useEffect, useRef, useState } from 'react'
import { lifesyncFetch } from '../lib/lifesyncApi'

export function useCheapSharkStores({ view = 'standard', refresh = false } = {}) {
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

    const fetchStores = async () => {
        if (!mountedRef.current) return
        const requestId = ++requestIdRef.current
        setLoading(true)
        setError(null)

        try {
            const qs = new URLSearchParams()
            if (view) qs.set('view', String(view))
            if (refresh) qs.set('refresh', '1')

            const path = `/api/cheapshark/stores${qs.toString() ? '?' + qs.toString() : ''}`
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
        void fetchStores()
    }, [view, refresh])

    return {
        data,
        loading,
        error,
        refetch: fetchStores,
    }
}
