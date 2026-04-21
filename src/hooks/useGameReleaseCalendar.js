import { useEffect, useRef, useState } from 'react'
import { lifesyncFetch } from '../lib/lifesyncApi'

export function useGameReleaseCalendar({
    limit = 1200,
    groupByDate = true,
    includePast = true,
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

    const fetchCalendar = async () => {
        if (!mountedRef.current || !enabled) return
        setLoading(true)
        setError(null)

        try {
            const qs = new URLSearchParams()
            if (limit != null) qs.set('limit', String(limit))
            if (view) qs.set('view', String(view))
            if (groupByDate) qs.set('group_by_date', '1')
            if (includePast) qs.set('include_past', '1')
            if (refresh) qs.set('refresh', '1')

            const path = `/api/gamesearch/calendar${qs.toString() ? '?' + qs.toString() : ''}`
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
        void fetchCalendar()
    }, [limit, groupByDate, includePast, refresh, view, enabled])

    return {
        data,
        loading,
        error,
        refetch: fetchCalendar,
    }
}
