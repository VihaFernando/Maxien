import { useEffect, useRef, useState } from 'react'
import { lifesyncFetch } from '../lib/lifesyncApi'

export function useCheapSharkDeals({
    storeId,
    pageNumber = 0,
    pageSize = 12,
    title,
    sortBy = 'Deal Rating',
    desc = true,
    onSale = true,
    view = 'standard',
    refresh = false,
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

    const fetchDeals = async () => {
        if (!mountedRef.current) return
        setLoading(true)
        setError(null)

        try {
            const qs = new URLSearchParams()
            if (storeId != null && String(storeId).trim() !== '') qs.set('storeId', String(storeId))
            if (pageNumber != null) qs.set('pageNumber', String(pageNumber))
            if (pageSize != null) qs.set('pageSize', String(pageSize))
            if (title != null && String(title).trim() !== '') qs.set('title', String(title).trim())
            if (sortBy) qs.set('sortBy', String(sortBy))
            qs.set('desc', desc ? '1' : '0')
            qs.set('onSale', onSale ? '1' : '0')
            if (view) qs.set('view', String(view))
            if (refresh) qs.set('refresh', '1')

            const path = `/api/cheapshark/deals${qs.toString() ? '?' + qs.toString() : ''}`
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
        void fetchDeals()
    }, [storeId, pageNumber, pageSize, title, sortBy, desc, onSale, view, refresh])

    return {
        data,
        loading,
        error,
        refetch: fetchDeals,
    }
}
