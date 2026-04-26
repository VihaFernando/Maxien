import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { lifesyncFetch } from '../lib/lifesyncApi'

const EMPTY_SUMMARY = {
    total: 0,
    withNewChapter: 0,
    needsSync: 0,
    caughtUp: 0,
    seriesEnded: 0,
    pinned: 0,
    sources: { mangadistrict: 0, comix: 0, hentaifox: 0 },
    statuses: { reading: 0, on_hold: 0, plan_to_read: 0, dropped: 0, completed: 0, re_reading: 0 },
}

function entryKey(entry) {
    return `${entry?.source || ''}:${entry?.mangaId || ''}`
}

function dedupeEntries(raw) {
    const list = Array.isArray(raw) ? raw : []
    const byKey = new Map()
    for (const entry of list) {
        const key = entryKey(entry)
        if (!key || key === ':') continue
        const prev = byKey.get(key)
        if (!prev) {
            byKey.set(key, entry)
            continue
        }
        const prevTime = prev?.updatedAt ? new Date(prev.updatedAt).getTime() : 0
        const nextTime = entry?.updatedAt ? new Date(entry.updatedAt).getTime() : 0
        if (nextTime >= prevTime) byKey.set(key, entry)
    }
    return [...byKey.values()]
}

function normalizeReadingStatus(entry) {
    const status = String(entry?.readingStatus || entry?.remoteStatus || '').trim()
    if (!status) return ''
    return status
}

function summarizeEntries(entries) {
    if (!Array.isArray(entries) || entries.length === 0) return EMPTY_SUMMARY
    const summary = {
        total: entries.length,
        withNewChapter: 0,
        needsSync: 0,
        caughtUp: 0,
        seriesEnded: 0,
        pinned: 0,
        sources: { mangadistrict: 0, comix: 0, hentaifox: 0 },
        statuses: { reading: 0, on_hold: 0, plan_to_read: 0, dropped: 0, completed: 0, re_reading: 0 },
    }
    for (const entry of entries) {
        if (entry?.source && summary.sources[entry.source] != null) summary.sources[entry.source] += 1
        const status = normalizeReadingStatus(entry)
        if (status && summary.statuses[status] != null) summary.statuses[status] += 1
        if (entry?.hasNewChapter) summary.withNewChapter += 1
        if (entry?.needsSync) summary.needsSync += 1
        if (entry?.caughtUp) summary.caughtUp += 1
        if (entry?.seriesEnded) summary.seriesEnded += 1
        if (entry?.isPinned) summary.pinned += 1
    }
    return summary
}

function normalizePageInfo(pageInfo, fallbackTotal, fallbackLimit) {
    const total = Number(pageInfo?.total ?? fallbackTotal ?? 0)
    const perPage = Math.max(1, Number(pageInfo?.perPage ?? fallbackLimit ?? 25))
    const totalPages = Math.max(1, Number(pageInfo?.totalPages ?? (Math.ceil(total / perPage) || 1)))
    const page = Math.min(Math.max(1, Number(pageInfo?.page || 1)), totalPages)
    return {
        type: 'page',
        page,
        perPage,
        total,
        totalPages,
        hasMore: Boolean(pageInfo?.hasMore ?? page < totalPages),
    }
}

function toBooleanQuery(value) {
    if (value === true) return 'true'
    if (value === false) return 'false'
    return ''
}

function buildReadingQuery(filters) {
    const params = new URLSearchParams()
    params.set('view', 'standard')
    const q = String(filters?.q || '').trim()
    if (q) params.set('q', q)

    if (filters?.source && filters.source !== 'all') params.set('source', filters.source)
    if (filters?.status && filters.status !== 'all') params.set('status', filters.status)
    if (filters?.updateState && filters.updateState !== 'all') params.set('updateState', filters.updateState)
    if (filters?.sortBy) params.set('sortBy', filters.sortBy)
    if (filters?.order) params.set('order', filters.order)
    if (filters?.page && Number(filters.page) > 0) params.set('page', String(filters.page))
    if (filters?.limit && Number(filters.limit) > 0) params.set('limit', String(filters.limit))
    if (filters?.label) params.set('label', String(filters.label).trim())

    const pinned = toBooleanQuery(filters?.pinned)
    const hasNewChapter = toBooleanQuery(filters?.hasNewChapter)
    const needsSync = toBooleanQuery(filters?.needsSync)
    const caughtUp = toBooleanQuery(filters?.caughtUp)
    const seriesEnded = toBooleanQuery(filters?.seriesEnded)
    if (pinned) params.set('pinned', pinned)
    if (hasNewChapter) params.set('hasNewChapter', hasNewChapter)
    if (needsSync) params.set('needsSync', needsSync)
    if (caughtUp) params.set('caughtUp', caughtUp)
    if (seriesEnded) params.set('seriesEnded', seriesEnded)

    return params.toString()
}

export function filterMangaReadingByNsfw(entries, nsfwEnabled, hManhwaEnabled = true) {
    if (nsfwEnabled && hManhwaEnabled) return entries
    return entries.filter((entry) => {
        if (entry.source === 'mangadistrict') return Boolean(nsfwEnabled && hManhwaEnabled)
        if (entry.source === 'comix' && !nsfwEnabled) {
            const rating = String(entry.contentRating || '').trim().toLowerCase()
            if (rating === 'adult' || rating === 'hentai' || rating === 'mature' || rating === 'ecchi') return false
        }
        return true
    })
}

function applyLocalPatch(entry, patch) {
    const next = { ...entry }
    if (patch?.readingStatus !== undefined) next.readingStatus = patch.readingStatus || null
    if (patch?.isPinned !== undefined) next.isPinned = Boolean(patch.isPinned)
    if (patch?.labels !== undefined) next.labels = Array.isArray(patch.labels) ? [...patch.labels] : []
    if (patch?.note !== undefined) next.note = patch.note || ''
    if (patch?.clearSyncError) {
        next.syncError = null
        next.needsSync = false
    }
    if (patch?.lastOpenedAt) next.lastOpenedAt = patch.lastOpenedAt
    return next
}

/**
 * @param {{
 *   enabled: boolean,
 *   nsfwEnabled: boolean,
 *   hManhwaEnabled?: boolean,
 *   filters: {
 *     q?: string, source?: string, status?: string, updateState?: string,
 *     sortBy?: string, order?: 'asc'|'desc', page?: number, limit?: number,
 *     pinned?: boolean, hasNewChapter?: boolean, needsSync?: boolean, caughtUp?: boolean, seriesEnded?: boolean, label?: string
 *   }
 * }} opts
 */
export function useMangaReadingList({ enabled, nsfwEnabled, hManhwaEnabled = true, filters }) {
    const [entries, setEntries] = useState([])
    const [summary, setSummary] = useState(EMPTY_SUMMARY)
    const [totalSummary, setTotalSummary] = useState(EMPTY_SUMMARY)
    const [pageInfo, setPageInfo] = useState(normalizePageInfo(null, 0, filters?.limit || 25))
    const [error, setError] = useState('')
    const [initialLoading, setInitialLoading] = useState(false)
    const [refreshing, setRefreshing] = useState(false)

    const entriesRef = useRef([])
    const requestIdRef = useRef(0)
    const queryString = useMemo(() => buildReadingQuery(filters || {}), [filters])

    useEffect(() => {
        entriesRef.current = entries
    }, [entries])

    const refresh = useCallback(
        async ({ forceInitial = false } = {}) => {
            if (!enabled) {
                requestIdRef.current += 1
                setEntries([])
                setSummary(EMPTY_SUMMARY)
                setTotalSummary(EMPTY_SUMMARY)
                setPageInfo(normalizePageInfo(null, 0, filters?.limit || 25))
                setError('')
                setInitialLoading(false)
                setRefreshing(false)
                return
            }

            const requestId = ++requestIdRef.current
            const shouldInitial = forceInitial || entriesRef.current.length === 0
            setError('')
            if (shouldInitial) setInitialLoading(true)
            else setRefreshing(true)

            try {
                const data = await lifesyncFetch(`/api/v1/manga/reading?${queryString}`)
                if (requestId !== requestIdRef.current) return

                const rows = dedupeEntries(Array.isArray(data) ? data : data?.entries || [])
                setEntries(rows)
                setSummary(data?.summary || summarizeEntries(rows))
                setTotalSummary(data?.totalSummary || data?.summary || summarizeEntries(rows))
                setPageInfo(normalizePageInfo(data?.pageInfo, rows.length, filters?.limit || 25))
            } catch (err) {
                if (requestId !== requestIdRef.current) return
                setError(String(err?.message || 'Failed to load reading history'))
                setEntries([])
                setSummary(EMPTY_SUMMARY)
                setTotalSummary(EMPTY_SUMMARY)
                setPageInfo(normalizePageInfo(null, 0, filters?.limit || 25))
            } finally {
                if (requestId !== requestIdRef.current) return
                setInitialLoading(false)
                setRefreshing(false)
            }
        },
        [enabled, filters?.limit, queryString],
    )

    useEffect(() => {
        void refresh()
    }, [refresh])

    const patchEntry = useCallback(
        async (entry, patch, opts = {}) => {
            const key = entryKey(entry)
            const optimistic = opts?.optimistic !== false
            if (optimistic) {
                setEntries((prev) => prev.map((row) => (entryKey(row) === key ? applyLocalPatch(row, patch) : row)))
            }
            try {
                await lifesyncFetch(
                    `/api/v1/manga/reading/${encodeURIComponent(entry.source)}/${encodeURIComponent(entry.mangaId)}`,
                    { method: 'PATCH', json: patch },
                )
            } catch (err) {
                await refresh()
                throw err
            }
        },
        [refresh],
    )

    const removeEntry = useCallback(
        async (entry) => {
            await lifesyncFetch(
                `/api/v1/manga/reading/${encodeURIComponent(entry.source)}/${encodeURIComponent(entry.mangaId)}`,
                { method: 'DELETE' },
            )
            await refresh()
        },
        [refresh],
    )

    const bulkPatch = useCallback(
        async (items, patch) => {
            const rows = Array.isArray(items) ? items : []
            if (rows.length === 0) return { matched: 0, modified: 0 }
            const payload = {
                items: rows.map((row) => ({
                    source: row.source,
                    mangaId: row.mangaId,
                    patch,
                })),
            }
            const result = await lifesyncFetch('/api/v1/manga/reading/bulk/patch', {
                method: 'POST',
                json: payload,
            })
            await refresh()
            return result
        },
        [refresh],
    )

    const bulkDelete = useCallback(
        async (items) => {
            const rows = Array.isArray(items) ? items : []
            if (rows.length === 0) return { deleted: 0 }
            const payload = {
                items: rows.map((row) => ({
                    source: row.source,
                    mangaId: row.mangaId,
                })),
            }
            const result = await lifesyncFetch('/api/v1/manga/reading/bulk/delete', {
                method: 'POST',
                json: payload,
            })
            await refresh()
            return result
        },
        [refresh],
    )

    const visibleEntries = useMemo(
        () => filterMangaReadingByNsfw(entries, nsfwEnabled, hManhwaEnabled),
        [entries, hManhwaEnabled, nsfwEnabled],
    )
    const visibleSummary = useMemo(() => summarizeEntries(visibleEntries), [visibleEntries])

    return {
        entries,
        visibleEntries,
        summary,
        totalSummary,
        visibleSummary,
        pageInfo,
        error,
        loading: initialLoading || refreshing,
        initialLoading,
        refreshing,
        refresh,
        patchEntry,
        removeEntry,
        bulkPatch,
        bulkDelete,
    }
}
