import { useEffect, useMemo, useState } from 'react'
import { lifesyncFetch } from '../../../../lib/lifesyncApi'
import { TVCard, TVCardSkeleton, TVPageHints } from '../TVCard'
import { loadTVSectionFilters, resetTVSectionFilters, saveTVSectionFilters } from '../tvFilterStorage'
import { useTVCardSelect } from '../useTVCardSelect'
import { useTVGridMeta } from '../useTVGridMeta'

const COLS = 5
const BROWSE_TYPE_OPTIONS = [
    { id: '', label: 'All' }, { id: '1', label: 'TV' }, { id: '2', label: 'Movie' },
    { id: '3', label: 'OVA' }, { id: '4', label: 'ONA' }, { id: '5', label: 'Special' }, { id: '6', label: 'Music' },
]
const BROWSE_STATUS_OPTIONS = [
    { id: '', label: 'Any' }, { id: 'Ongoing', label: 'Ongoing' },
    { id: 'Completed', label: 'Completed' }, { id: 'info', label: 'Upcoming' },
]
const BROWSE_LANGUAGE_OPTIONS = [
    { id: '', label: 'All' }, { id: 'sub', label: 'Sub' }, { id: 'dub', label: 'Dub' },
]
const BROWSE_SORT_OPTIONS = [
    { id: '', label: 'Latest' }, { id: 'recently_added', label: 'Newly Added' },
    { id: 'release_date', label: 'Release Date' }, { id: 'title_az', label: 'A-Z' },
]
const BROWSE_GENRE_OPTIONS = [
    'action', 'adventure', 'comedy', 'drama', 'ecchi', 'fantasy', 'horror',
    'isekai', 'magic', 'mecha', 'military', 'mystery', 'psychological',
    'romance', 'sci-fi', 'slice-of-life', 'sports', 'supernatural', 'thriller',
].map(id => ({ id, label: id.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') }))
const DEFAULT_FILTERS = { search: '', type: '', status: '', language: '', sort: '', genres: [] }

function buildAnimeDetailItem(node) {
    const slug = node?.slug || node?.id
    if (!slug) return null
    const pic = node?.poster || node?.image || node?.main_picture?.large
    const chips = []
    if (node?.type || node?.media_type) chips.push(node.type || node.media_type)
    if (node?.status) chips.push(node.status)
    return {
        type: 'anime',
        title: node?.title,
        imageUrl: pic,
        description: node?.synopsis,
        chips,
        slug: String(slug),
        navigateTo: `/dashboard/lifesync/anime/anime/home/page/1/detail/${encodeURIComponent(String(slug))}`,
    }
}

export function TVAnimeSection({ focusPos, onItemSelect, enabled, filterOpen, onRegisterFilter, onFocusedItemChange, onGridMetaChange, page, onPageChange }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [hasMore, setHasMore] = useState(true)
    const [filters, setFilters] = useState(() => loadTVSectionFilters('anime', DEFAULT_FILTERS))

    useEffect(() => {
        if (!enabled) return
        let cancelled = false
        setLoading(true)

        const loadData = async () => {
            try {
                const searchQuery = String(filters.search || '').trim()
                const qs = new URLSearchParams({ limit: '30', page: String(page) })
                if (filters.type) qs.set('type', filters.type)
                if (filters.status) qs.set('status', filters.status)
                if (filters.language) qs.set('language', filters.language)
                if (filters.sort) qs.set('sort', filters.sort)
                if (Array.isArray(filters.genres) && filters.genres.length > 0) qs.set('genre', filters.genres.join(','))

                if (searchQuery) {
                    const offset = (Math.max(1, page) - 1) * 30
                    const data = await lifesyncFetch(`/api/v1/anime/search?q=${encodeURIComponent(searchQuery)}&limit=30&offset=${offset}`).catch(() => null)
                    if (cancelled) return
                    const rows = Array.isArray(data?.data) ? data.data : []
                    setItems(rows)
                    setHasMore(Boolean(data?.paging?.next))
                    return
                }

                const hasActiveFilters = Boolean(filters.type || filters.status || filters.language || filters.sort || filters.genres?.length)
                const [homeRes, browseRes] = await Promise.all([
                    page === 1 && !hasActiveFilters ? lifesyncFetch('/api/v1/anime/home').catch(() => null) : Promise.resolve(null),
                    lifesyncFetch(`/api/v1/anime/browse?${qs}`).catch(() => null),
                ])

                if (cancelled) return

                const featured = Array.isArray(homeRes?.featured) ? homeRes.featured : []
                const trending = Array.isArray(homeRes?.trending) ? homeRes.trending : []
                const browseItems = Array.isArray(browseRes?.data) ? browseRes.data : []
                setHasMore(Boolean(browseRes?.paging?.next))

                const seen = new Set()
                const merged = []
                for (const item of [...featured, ...trending, ...browseItems]) {
                    const node = item?.node || item
                    const slug = node?.slug || node?.id
                    if (!slug || seen.has(slug)) continue
                    seen.add(slug)
                    merged.push(node)
                }
                setItems(merged)
            } catch {
                setItems([])
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        void loadData()
        return () => { cancelled = true }
    }, [enabled, page, filters])

    const resetFilters = () => {
        resetTVSectionFilters('anime')
        setFilters(DEFAULT_FILTERS)
        onPageChange(1)
    }

    const filterConfig = useMemo(() => [
        { id: 'search', label: 'Search', type: 'search', placeholder: 'Search anime...' },
        { id: 'type', label: 'Type', type: 'select', options: BROWSE_TYPE_OPTIONS },
        { id: 'status', label: 'Status', type: 'select', options: BROWSE_STATUS_OPTIONS },
        { id: 'language', label: 'Language', type: 'select', options: BROWSE_LANGUAGE_OPTIONS },
        { id: 'sort', label: 'Sort', type: 'select', options: BROWSE_SORT_OPTIONS },
        { id: 'genres', label: 'Genres', type: 'chip-multi', options: BROWSE_GENRE_OPTIONS },
        { id: 'reset', label: 'Reset filters', type: 'action', onAction: resetFilters },
    ], []) // eslint-disable-line react-hooks/exhaustive-deps

    const handleFilterChange = (id, value) => {
        setFilters(f => {
            const next = { ...f, [id]: value }
            if (id !== 'search') saveTVSectionFilters('anime', next)
            return next
        })
        onPageChange(1)
    }

    // Bubble filter state up so TVMode can render the panel
    useEffect(() => {
        onRegisterFilter?.({ title: 'Anime Filters', filterConfig, filters, onFilterChange: handleFilterChange })
    }, [filterConfig, filters]) // eslint-disable-line react-hooks/exhaustive-deps

    // Precompute one detail item per card so TVCard's memo isn't defeated by a
    // fresh object on every focus move, and so onSelect closures stay stable.
    const detailItems = useMemo(() => items.map(buildAnimeDetailItem), [items])

    const focusedItem = useMemo(() => {
        if (filterOpen) return null
        const idx = focusPos.row * COLS + focusPos.col
        return detailItems[idx] || null
    }, [filterOpen, focusPos.col, focusPos.row, detailItems])

    useEffect(() => {
        if (!enabled) return
        onFocusedItemChange?.(focusedItem)
    }, [enabled, focusedItem, onFocusedItemChange])

    useTVGridMeta(enabled, items.length, hasMore, onGridMetaChange, loading)

    // Stable per-card select handlers so memoized cards don't re-render when an
    // unrelated card gains/loses focus.
    const getSelectHandler = useTVCardSelect(detailItems, onItemSelect)

    if (loading && items.length === 0) {
        return <div className="grid grid-cols-5 gap-5">{Array.from({ length: 10 }).map((_, i) => <TVCardSkeleton key={i} />)}</div>
    }

    return (
        <div className="relative">
            <div className="grid grid-cols-5 gap-5">
                {items.map((node, i) => {
                    const row = Math.floor(i / COLS)
                    const col = i % COLS
                    const focused = !filterOpen && focusPos.row === row && focusPos.col === col
                    const detailItem = detailItems[i]
                    const epCount = node?.num_episodes || node?.episodes
                    const badge = epCount ? `EP ${epCount}` : undefined
                    const typePart = node?.type || node?.media_type
                    const statusPart = node?.status
                    const subtitle = [typePart, statusPart].filter(Boolean).join(' · ') || undefined
                    const score = node?.score ? String(node.score) : undefined
                    return (
                        <div key={detailItem?.slug || i} data-focused-card={focused ? 'true' : undefined}>
                            <TVCard
                                imageUrl={detailItem?.imageUrl}
                                title={node?.title}
                                badge={badge}
                                subtitle={subtitle}
                                score={score}
                                focused={focused}
                                onSelect={getSelectHandler(i)}
                            />
                        </div>
                    )
                })}
            </div>

            <TVPageHints page={page} hasMore={hasMore} />
        </div>
    )
}

TVAnimeSection.COLS = COLS
// Expose focused item for A-button handler in TVMode
TVAnimeSection.getFocusedItem = (items, focusPos, cols) => {
    const idx = focusPos.row * cols + focusPos.col
    const node = items[idx]
    if (!node) return null
    const slug = node?.slug || node?.id
    const pic = node?.poster || node?.image || node?.main_picture?.large
    const chips = []
    if (node?.type || node?.media_type) chips.push(node.type || node.media_type)
    if (node?.status) chips.push(node.status)
    return slug ? { type: 'anime', title: node?.title, imageUrl: pic, description: node?.synopsis, chips, slug: String(slug), navigateTo: `/dashboard/lifesync/anime/anime/home/page/1/detail/${encodeURIComponent(String(slug))}` } : null
}
