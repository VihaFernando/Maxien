import { useEffect, useMemo, useState } from 'react'
import { lifesyncFetch } from '../../../../lib/lifesyncApi'
import { TVCard, TVCardSkeleton, TVPageHints } from '../TVCard'
import { loadTVSectionFilters, resetTVSectionFilters, saveTVSectionFilters } from '../tvFilterStorage'
import { useTVCardSelect } from '../useTVCardSelect'

const COLS = 5
const DEFAULT_FILTERS = { genre: '', year: '' }

function buildHentaiDetailItem(series) {
    if (!series) return null
    const epCount = series.episodeCount || series.episodes?.length
    return {
        type: 'hentai',
        title: series.title,
        imageUrl: series.posterUrl,
        badge: epCount ? `${epCount} episodes` : undefined,
        chips: ['18+'],
        series,
        slug: series.seriesKey || series.slug,
        navigateTo: '/dashboard/lifesync/anime/hentai',
    }
}

export function TVHentaiSection({ focusPos, onItemSelect, enabled, filterOpen, onRegisterFilter, onFocusedItemChange, page, onPageChange }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [hasMore, setHasMore] = useState(true)
    const [filters, setFilters] = useState(() => loadTVSectionFilters('hentai', DEFAULT_FILTERS))
    const [genreOptions, setGenreOptions] = useState([{ id: '', label: 'All genres' }])
    const [yearOptions, setYearOptions] = useState([{ id: '', label: 'All years' }])

    useEffect(() => {
        if (!enabled) return
        let cancelled = false
        Promise.resolve().then(() => {
            if (cancelled) return
            setLoading(true)
            setItems([])
        })

        const params = new URLSearchParams({ page: String(page), perPage: '32', view: 'standard', section: 'series', sort: 'random' })
        if (filters.genre) params.set('genre', filters.genre)
        if (filters.year) params.set('year', filters.year)

        lifesyncFetch(`/api/v1/hentai/watchhentai/home?${params}`)
            .then(data => {
                if (cancelled) return
                const series = Array.isArray(data?.series) ? data.series : (Array.isArray(data?.items) ? data.items : [])
                setItems(series.slice(0, 32))
                setHasMore(Boolean(data?.hasMore !== false && series.length === 32))

                const genres = Array.isArray(data?.filters?.genres) ? data.filters.genres : []
                if (genres.length > 0) {
                    setGenreOptions([{ id: '', label: 'All genres' }, ...genres.map(g => ({ id: String(g.id || g.label), label: String(g.label) }))])
                }
                const years = Array.isArray(data?.filters?.years) ? data.filters.years : []
                if (years.length > 0) {
                    setYearOptions([{ id: '', label: 'All years' }, ...years.map(y => ({ id: String(y.id || y.label), label: String(y.label) }))])
                }
            })
            .catch(() => setItems([]))
            .finally(() => { if (!cancelled) setLoading(false) })

        return () => { cancelled = true }
    }, [enabled, page, filters])

    const resetFilters = () => {
        resetTVSectionFilters('hentai')
        setFilters(DEFAULT_FILTERS)
        onPageChange(1)
    }

    const filterConfig = useMemo(() => [
        { id: 'genre', label: 'Genre', type: 'select', options: genreOptions },
        { id: 'year', label: 'Year', type: 'select', options: yearOptions },
        { id: 'reset', label: 'Reset filters', type: 'action', onAction: resetFilters },
    ], [genreOptions, yearOptions]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleFilterChange = (id, value) => {
        setFilters(f => {
            const next = { ...f, [id]: value }
            saveTVSectionFilters('hentai', next)
            return next
        })
        onPageChange(1)
    }

    useEffect(() => {
        onRegisterFilter?.({ title: 'Hentai Filters', filterConfig, filters, onFilterChange: handleFilterChange })
    }, [filterConfig, filters]) // eslint-disable-line react-hooks/exhaustive-deps

    const detailItems = useMemo(() => items.map(buildHentaiDetailItem), [items])

    const focusedItem = useMemo(() => {
        if (filterOpen) return null
        const idx = focusPos.row * COLS + focusPos.col
        return detailItems[idx] || null
    }, [filterOpen, focusPos.col, focusPos.row, detailItems])

    useEffect(() => {
        if (!enabled) return
        onFocusedItemChange?.(focusedItem)
    }, [enabled, focusedItem, onFocusedItemChange])

    const getSelectHandler = useTVCardSelect(detailItems, onItemSelect)

    return (
        <div className="relative">
            {loading && items.length === 0 ? (
                <div className="grid grid-cols-5 gap-5">{Array.from({ length: 10 }).map((_, i) => <TVCardSkeleton key={i} />)}</div>
            ) : (
                <div className="grid grid-cols-5 gap-5">
                    {items.map((series, i) => {
                        const rowIdx = Math.floor(i / COLS)
                        const colIdx = i % COLS
                        const focused = !filterOpen && focusPos.row === rowIdx && focusPos.col === colIdx
                        const key = series.seriesKey || series.slug || i
                        const epCount = series.episodeCount || series.episodes?.length
                        const subtitle = series.year ? String(series.year) : undefined
                        return (
                            <div key={key} data-focused-card={focused ? 'true' : undefined}>
                                <TVCard
                                    imageUrl={series.posterUrl}
                                    title={series.title}
                                    badge={epCount ? `${epCount} ep` : undefined}
                                    subtitle={subtitle}
                                    ratingBadge="18+"
                                    focused={focused}
                                    onSelect={getSelectHandler(i)}
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

TVHentaiSection.COLS = COLS
