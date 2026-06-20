import { useEffect, useMemo, useState } from 'react'
import { lifesyncFetch } from '../../../../lib/lifesyncApi'
import { TVCard, TVCardSkeleton, TVPageHints } from '../TVCard'
import { loadTVSectionFilters, resetTVSectionFilters, saveTVSectionFilters } from '../tvFilterStorage'

const COLS = 5
const SORT_OPTIONS = [
    { id: 'latest', label: 'Latest' },
    { id: 'alphabet', label: 'A-Z' },
    { id: 'rating', label: 'Rating' },
    { id: 'trending', label: 'Trending' },
]
const DEFAULT_FILTERS = { search: '', sort: 'latest', genre: '' }

function buildMangaDNADetailItem(manga) {
    const id = manga?.id || manga?.slug
    if (!id) return null
    return {
        type: 'manga',
        source: 'mangadna',
        title: manga.title,
        imageUrl: manga.coverUrl || manga.cover || manga.thumbnail,
        mangaId: String(id),
        chips: ['H Manhwa', '18+'],
        navigateTo: '/dashboard/lifesync/anime/manga/mangadna/latest/page/1',
    }
}

export function TVMangaDNASection({ focusPos, onItemSelect, enabled, filterOpen, onRegisterFilter, onFocusedItemChange, page, onPageChange }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [hasMore, setHasMore] = useState(true)
    const [filters, setFilters] = useState(() => loadTVSectionFilters('mangadna', DEFAULT_FILTERS))
    const [genreOptions, setGenreOptions] = useState([])

    // Load genres once
    useEffect(() => {
        if (!enabled) return undefined
        let cancelled = false
        lifesyncFetch('/api/v1/manga/mangadna/terms?view=full')
            .then(data => {
                if (cancelled) return
                const genres = Array.isArray(data?.genres) ? data.genres : []
                setGenreOptions([{ id: '', label: 'All genres' }, ...genres.map(g => ({ id: g.slug || g.id, label: g.title || g.slug }))])
            })
            .catch(() => {})
        return () => { cancelled = true }
    }, [enabled])

    useEffect(() => {
        if (!enabled) return
        let cancelled = false
        Promise.resolve().then(() => {
            if (cancelled) return
            setLoading(true)
            setItems([])
        })

        const searchQuery = String(filters.search || '').trim()
        let endpoint
        if (searchQuery) {
            endpoint = `/api/v1/manga/mangadna/search?q=${encodeURIComponent(searchQuery)}&view=standard`
        } else {
            const qs = new URLSearchParams()
            if (filters.sort && filters.sort !== 'latest') qs.set('orderBy', filters.sort)
            if (filters.genre) qs.set('genre', filters.genre)
            const suffix = qs.toString() ? `?${qs}` : ''
            endpoint = `/api/v1/manga/mangadna/latest/${page}${suffix}`
        }

        lifesyncFetch(endpoint)
            .then(data => {
                if (cancelled) return
                const rows = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
                setItems(rows.filter(r => r?.id || r?.slug))
                setHasMore(!searchQuery && Boolean(data?.hasNextPage || rows.length >= 24))
            })
            .catch(() => { if (!cancelled) setItems([]) })
            .finally(() => { if (!cancelled) setLoading(false) })

        return () => { cancelled = true }
    }, [enabled, page, filters])

    const resetFilters = () => {
        resetTVSectionFilters('mangadna')
        setFilters(DEFAULT_FILTERS)
        onPageChange(1)
    }

    const filterConfig = useMemo(() => [
        { id: 'search', label: 'Search', type: 'search', placeholder: 'Search MangaDNA...' },
        { id: 'sort', label: 'Sort', type: 'select', options: SORT_OPTIONS },
        { id: 'genre', label: 'Genre', type: 'select', options: genreOptions.length ? genreOptions : [{ id: '', label: 'Loading...' }] },
        { id: 'reset', label: 'Reset filters', type: 'action', onAction: resetFilters },
    ], [genreOptions]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleFilterChange = (id, value) => {
        setFilters(f => {
            const next = { ...f, [id]: value }
            if (id !== 'search') saveTVSectionFilters('mangadna', next)
            return next
        })
        onPageChange(1)
    }

    useEffect(() => {
        onRegisterFilter?.({ title: 'MangaDNA Filters', filterConfig, filters, onFilterChange: handleFilterChange })
    }, [filterConfig, filters]) // eslint-disable-line react-hooks/exhaustive-deps

    const focusedItem = useMemo(() => {
        if (filterOpen) return null
        const idx = focusPos.row * COLS + focusPos.col
        return buildMangaDNADetailItem(items[idx])
    }, [filterOpen, focusPos.col, focusPos.row, items])

    useEffect(() => {
        if (!enabled) return
        onFocusedItemChange?.(focusedItem)
    }, [enabled, focusedItem, onFocusedItemChange])

    return (
        <div className="relative">
            {loading && items.length === 0 ? (
                <div className="grid grid-cols-5 gap-5">{Array.from({ length: 10 }).map((_, i) => <TVCardSkeleton key={i} />)}</div>
            ) : (
                <div className="grid grid-cols-5 gap-5">
                    {items.map((manga, i) => {
                        const row = Math.floor(i / COLS)
                        const col = i % COLS
                        const focused = !filterOpen && focusPos.row === row && focusPos.col === col
                        const id = manga.id || manga.slug
                        const detailItem = buildMangaDNADetailItem(manga)
                        const subtitle = manga.status || undefined
                        return (
                            <div key={id || i} data-focused-card={focused ? 'true' : undefined}>
                                <TVCard
                                    imageUrl={manga.coverUrl || manga.cover || manga.thumbnail}
                                    title={manga.title}
                                    badge={manga.latestChapter ? `Ch ${manga.latestChapter}` : undefined}
                                    subtitle={subtitle}
                                    ratingBadge={manga.contentRating || 'mature'}
                                    focused={focused}
                                    onSelect={() => detailItem && onItemSelect(detailItem)}
                                />
                            </div>
                        )
                    })}
                </div>
            )}

            <TVPageHints page={page} hasMore={hasMore} />
        </div>
    )
}

TVMangaDNASection.COLS = COLS
