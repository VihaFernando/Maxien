import { useEffect, useState, useRef } from 'react'
import { lifesyncFetch } from '../lib/lifesyncApi'

/**
 * Hook to fetch GameRant gaming news
 * @param {Object} options
 * @param {number} [options.count=20] - Number of articles to fetch (1-60)
 * @param {number} [options.page=1] - Page number (1-3)
 * @returns {Object} { data, loading, error, refetch }
 */
export function useGameRantNews({ count = 20, page = 1 } = {}) {
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

    const fetch = async () => {
        if (!mountedRef.current) return
        setLoading(true)
        setError(null)
        try {
            const qs = new URLSearchParams()
            if (count !== undefined) qs.set('count', String(count))
            if (page !== undefined) qs.set('page', String(page))
            const path = `/api/gamerant/gaming-news${qs.toString() ? '?' + qs.toString() : ''}`
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
        void fetch()
    }, [count, page])

    return {
        data,
        loading,
        error,
        refetch: fetch,
    }
}
