import { useEffect, useRef, useState } from 'react'
import { lifesyncFetch } from '../lib/lifesyncApi'

const DEBOUNCE_MS = 380
const MIN_QUERY_LEN = 2

/**
 * Fetches manga search suggestions from the unified search endpoint.
 * Debounces the query and cancels in-flight requests on change.
 *
 * Returns { suggestions, loading, error } where suggestions is the
 * raw `bySource` map: { roliascan: [...], mangadistrict: [...], mangadna: [...] }
 */
export function useMangaSearchSuggestions(query, { enabled = true } = {}) {
    const [suggestions, setSuggestions] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const abortRef = useRef(null)
    const timerRef = useRef(null)

    useEffect(() => {
        const q = String(query || '').trim()

        if (!enabled || q.length < MIN_QUERY_LEN) {
            clearTimeout(timerRef.current)
            abortRef.current?.abort()
            setSuggestions(null)
            setLoading(false)
            setError(null)
            return
        }

        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(async () => {
            abortRef.current?.abort()
            const controller = new AbortController()
            abortRef.current = controller

            setLoading(true)
            setError(null)
            try {
                const params = new URLSearchParams({ q, view: 'compact' })
                const data = await lifesyncFetch(`/api/v1/manga/search?${params}`, {
                    signal: controller.signal,
                })
                if (controller.signal.aborted) return
                setSuggestions(data?.bySource || null)
            } catch (err) {
                if (err?.name === 'AbortError' || controller.signal.aborted) return
                setError(String(err?.message || 'Search failed'))
                setSuggestions(null)
            } finally {
                if (!controller.signal.aborted) setLoading(false)
            }
        }, DEBOUNCE_MS)

        return () => {
            clearTimeout(timerRef.current)
        }
    }, [query, enabled])

    // Clear on unmount
    useEffect(() => () => {
        clearTimeout(timerRef.current)
        abortRef.current?.abort()
    }, [])

    return { suggestions, loading, error }
}
