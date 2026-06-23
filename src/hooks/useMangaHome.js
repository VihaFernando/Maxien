import { useCallback, useEffect, useRef, useState } from 'react'
import { lifesyncFetch } from '../lib/lifesyncApi'

// Backend home endpoints per manga source. Each returns { featured, popular, latest }.
const SOURCE_ENDPOINT = {
    roliascan: '/api/v1/manga/roliascan/home',
    mangadistrict: '/api/v1/manga/mangadistrict/home',
    mangadna: '/api/v1/manga/mangadna/home',
}

/**
 * Curated home rails (featured / popular / latest) for a single manga source.
 *
 * @param {{ source: 'roliascan'|'mangadistrict'|'mangadna', enabled?: boolean }} opts
 */
export function useMangaHome({ source = 'roliascan', enabled = true } = {}) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const requestIdRef = useRef(0)

    const refresh = useCallback(async () => {
        const endpoint = SOURCE_ENDPOINT[source]
        if (!enabled || !endpoint) {
            setData(null)
            return
        }
        const requestId = ++requestIdRef.current
        setLoading(true)
        setError('')
        try {
            const res = await lifesyncFetch(endpoint)
            if (requestId !== requestIdRef.current) return
            setData({
                source,
                featured: Array.isArray(res?.featured) ? res.featured : [],
                popular: Array.isArray(res?.popular) ? res.popular : [],
                latest: Array.isArray(res?.latest) ? res.latest : [],
                // Source-specific extra rails.
                highScore: Array.isArray(res?.highScore) ? res.highScore : [], // roliascan
                mostFollowed: Array.isArray(res?.mostFollowed) ? res.mostFollowed : [], // roliascan
                newChapters: Array.isArray(res?.newChapters) ? res.newChapters : [], // roliascan
                recentlyAdded: Array.isArray(res?.recentlyAdded) ? res.recentlyAdded : [], // roliascan
                weeklyPicks: Array.isArray(res?.weeklyPicks) ? res.weeklyPicks : [], // mangadistrict
            })
        } catch (err) {
            if (requestId !== requestIdRef.current) return
            setError(String(err?.message || 'Failed to load home'))
            setData(null)
        } finally {
            if (requestId === requestIdRef.current) setLoading(false)
        }
    }, [source, enabled])

    useEffect(() => {
        void refresh()
    }, [refresh])

    return { data, loading, error, refresh }
}

/**
 * Roliascan "High Score Manga" rail, filtered by content type.
 * @param {{ enabled?: boolean, type?: 'all'|'manga'|'manhwa'|'manhua', initial?: Array }} opts
 */
export function useRoliascanHighScore({ enabled = true, type = 'all', initial = [] } = {}) {
    const [items, setItems] = useState(initial)
    const [loading, setLoading] = useState(false)
    const requestIdRef = useRef(0)
    const firstRef = useRef(true)

    useEffect(() => {
        if (!enabled) return
        // Use the home-provided list for the default "all" on first render (no extra fetch).
        if (firstRef.current && type === 'all' && initial.length) {
            firstRef.current = false
            setItems(initial)
            return
        }
        firstRef.current = false
        const requestId = ++requestIdRef.current
        setLoading(true)
        lifesyncFetch(`/api/v1/manga/roliascan/high-score?type=${encodeURIComponent(type)}`)
            .then((res) => {
                if (requestId !== requestIdRef.current) return
                setItems(Array.isArray(res?.data) ? res.data : [])
            })
            .catch(() => {
                if (requestId === requestIdRef.current) setItems([])
            })
            .finally(() => {
                if (requestId === requestIdRef.current) setLoading(false)
            })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, type])

    return { items, loading }
}
