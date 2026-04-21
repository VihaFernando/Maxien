import { useEffect, useRef, useState } from 'react'
import { lifesyncFetch } from '../lib/lifesyncApi'

export function useGameRantArticle(slug) {
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

    useEffect(() => {
        const cleanSlug = String(slug || '').trim()
        if (!cleanSlug) {
            setData(null)
            return
        }

        const run = async () => {
            if (!mountedRef.current) return
            setLoading(true)
            setError(null)
            try {
                const result = await lifesyncFetch(`/api/gamerant/gaming-news/${encodeURIComponent(cleanSlug)}`)
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

        void run()
    }, [slug])

    return {
        data,
        loading,
        error,
    }
}
