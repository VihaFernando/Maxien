import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { lifesyncFetch } from '../lib/lifesyncApi'

const EMPTY_SUMMARY = { total: 0, withNewEpisode: 0, behind: 0, caughtUp: 0, pinned: 0 }

/**
 * User's anime library: watch statuses, pinning, labels, plus new-episode / behind flags.
 *
 * @param {{ enabled?: boolean, filters?: { status?: string, pinned?: boolean, label?: string, q?: string, sortBy?: string, order?: 'asc'|'desc' } }} opts
 */
export function useAnimeLibrary({ enabled = true, filters } = {}) {
    const [entries, setEntries] = useState([])
    const [summary, setSummary] = useState(EMPTY_SUMMARY)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const requestIdRef = useRef(0)

    const queryString = useMemo(() => {
        const params = new URLSearchParams()
        if (filters?.status && filters.status !== 'all') params.set('status', filters.status)
        if (filters?.pinned === true) params.set('pinned', '1')
        if (filters?.label) params.set('label', String(filters.label).trim())
        if (filters?.q) params.set('q', String(filters.q).trim())
        if (filters?.sortBy) params.set('sortBy', filters.sortBy)
        if (filters?.order) params.set('order', filters.order)
        return params.toString()
    }, [filters?.status, filters?.pinned, filters?.label, filters?.q, filters?.sortBy, filters?.order])

    const refresh = useCallback(async () => {
        if (!enabled) {
            setEntries([])
            setSummary(EMPTY_SUMMARY)
            return
        }
        const requestId = ++requestIdRef.current
        setLoading(true)
        setError('')
        try {
            const data = await lifesyncFetch(`/api/anime/library?${queryString}`)
            if (requestId !== requestIdRef.current) return
            setEntries(Array.isArray(data?.entries) ? data.entries : [])
            setSummary(data?.summary || EMPTY_SUMMARY)
        } catch (err) {
            if (requestId !== requestIdRef.current) return
            setError(String(err?.message || 'Failed to load anime library'))
            setEntries([])
            setSummary(EMPTY_SUMMARY)
        } finally {
            if (requestId === requestIdRef.current) setLoading(false)
        }
    }, [enabled, queryString])

    useEffect(() => {
        void refresh()
    }, [refresh])

    // Save / patch a library entry. Pass `finished: true` (with lastEpisodeNumber) to
    // auto-advance to the next episode.
    const saveEntry = useCallback(async (body) => {
        const result = await lifesyncFetch('/api/anime/library', { method: 'PUT', json: body })
        await refresh()
        return result
    }, [refresh])

    const patchEntry = useCallback(async (animeId, patch) => {
        setEntries((prev) => prev.map((e) => (e.animeId === animeId ? { ...e, ...patch } : e)))
        try {
            await lifesyncFetch('/api/anime/library', { method: 'PUT', json: { animeId, ...patch } })
        } catch {
            await refresh()
        }
    }, [refresh])

    const removeEntry = useCallback(async (animeId) => {
        setEntries((prev) => prev.filter((e) => e.animeId !== animeId))
        try {
            await lifesyncFetch(`/api/anime/library/${encodeURIComponent(animeId)}`, { method: 'DELETE' })
        } catch {
            await refresh()
        }
    }, [refresh])

    return { entries, summary, loading, error, refresh, saveEntry, patchEntry, removeEntry }
}
