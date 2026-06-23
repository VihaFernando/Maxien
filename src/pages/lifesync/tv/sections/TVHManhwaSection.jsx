import { useEffect, useMemo, useState } from 'react'
import { lifesyncFetch } from '../../../../lib/lifesyncApi'
import { TVCard, TVCardSkeleton, TVPageHints } from '../TVCard'
import { loadTVSectionFilters, resetTVSectionFilters, saveTVSectionFilters } from '../tvFilterStorage'
import { useTVCardSelect } from '../useTVCardSelect'
import { useTVGridMeta } from '../useTVGridMeta'

const COLS = 5
const SECTION_OPTIONS = [
    { id: 'latest', label: 'All Latest' },
    { id: 'censored', label: 'Censored' },
    { id: 'uncensored', label: 'Uncensored' },
]
const TYPE_OPTIONS = [
    { id: '', label: 'All types' },
    { id: 'webtoons', label: 'Webtoons' },
    { id: 'manhwa', label: 'Manhwa' },
    { id: 'manhua', label: 'Manhua' },
    { id: 'uncensored', label: 'Uncensored' },
    { id: 'doujinshi', label: 'Doujinshi' },
    { id: 'one-shot', label: 'One shot' },
    { id: 'full-color', label: 'Full color' },
    { id: 'based-on-another-work', label: 'Based on another work' },
]
const SORT_OPTIONS = [
    { id: 'latest-updates', label: 'Latest' },
    { id: 'name', label: 'A-Z' },
    { id: 'hot', label: 'Trending' },
    { id: 'rating', label: 'Rating' },
    { id: 'new-releases', label: 'New' },
    { id: 'all-time-views', label: 'Most Views' },
]
const FILTER_OPTIONS = [
    '3d', '3d-anime', 'action', 'adapted-to-anime', 'adventure', 'ai-art', 'aliens',
    'animal-characteristics', 'animation', 'bl', 'bl-uncensored', 'borderline-h',
    'cohabitation', 'collection-of-stories', 'comedy', 'comics', 'cooking', 'coworkers',
    'crime', 'crossdressing', 'delinquents', 'demons', 'detectives', 'drama', 'ecchi',
    'explicit-sex', 'fantasy', 'fetish', 'gender-bender', 'ghosts', 'gl', 'gyaru',
    'harem', 'hentai-anime', 'historical', 'horror', 'incest', 'isekai', 'japanese-webtoons',
    'josei', 'light-novels', 'mafia', 'magic', 'magical-girl', 'martial-arts',
    'mature-romance', 'mecha', 'medical', 'military', 'monster-girls', 'monsters',
    'music', 'mystery', 'ninja', 'nudity', 'parody-anime', 'person-in-a-strange-world',
    'police', 'psychological', 'reincarnation', 'reverse-harem', 'romance', 'salaryman',
    'samurai', 'school-life', 'sci-fi', 'seinen', 'sexual-abuse', 'sexual-content',
    'shoujo', 'shoujo-ai', 'shounen', 'shounen-ai', 'siblings', 'slice-of-life',
    'smut', 'sports', 'summoned-into-another-world', 'superheroes', 'supernatural',
    'survival', 'thriller', 'time-travel', 'transfer-students', 'uncensored-anime',
    'vampires', 'violence', 'virtual-reality', 'web-novels', 'western', 'work-life',
    'yaoi', 'yuri', 'zombies',
].map(id => ({
    id,
    label: id.split('-').map(part => {
        if (part === '3d') return '3D'
        if (part === 'bl') return 'BL'
        if (part === 'gl') return 'GL'
        if (part === 'sci') return 'Sci'
        return part.charAt(0).toUpperCase() + part.slice(1)
    }).join(' '),
}))
const DEFAULT_FILTERS = { search: '', section: 'uncensored', type: '', sort: 'latest-updates', tags: [] }

function buildHManhwaDetailItem(manga) {
    const id = manga?.id || manga?.slug
    if (!id) return null
    return {
        type: 'manga',
        source: 'mangadistrict',
        title: manga.title,
        imageUrl: manga.coverUrl || manga.cover || manga.thumbnail,
        mangaId: String(id || ''),
        chips: ['H Manhwa', '18+'],
        navigateTo: '/dashboard/lifesync/anime/manga/mangadistrict/latest/page/1',
    }
}

export function TVHManhwaSection({ focusPos, onItemSelect, enabled, filterOpen, onRegisterFilter, onFocusedItemChange, onGridMetaChange, page, onPageChange }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [hasMore, setHasMore] = useState(true)
    const [filters, setFilters] = useState(() => loadTVSectionFilters('hmanhwa', DEFAULT_FILTERS))

    useEffect(() => {
        if (!enabled) return
        let cancelled = false
        Promise.resolve().then(() => {
            if (cancelled) return
            setLoading(true)
            setItems([])
        })

        const qs = new URLSearchParams()
        qs.set('section', filters.section)
        if (filters.type) qs.set('genre', filters.type)
        if (filters.sort && filters.sort !== 'latest-updates') qs.set('orderBy', filters.sort)
        if (Array.isArray(filters.tags)) filters.tags.forEach(tag => qs.append('filterGenre', tag))

        const searchQuery = String(filters.search || '').trim()
        const endpoint = searchQuery
            ? `/api/v1/manga/mangadistrict/search?q=${encodeURIComponent(searchQuery)}&view=standard`
            : `/api/v1/manga/mangadistrict/latest/${page}?${qs}&view=standard`

        lifesyncFetch(endpoint)
            .then(data => {
                if (cancelled) return
                const rows = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
                setItems(rows.filter(r => r?.id || r?.slug))
                setHasMore(!searchQuery && Boolean(data?.hasNextPage || (rows.length === 24)))
            })
            .catch(() => setItems([]))
            .finally(() => { if (!cancelled) setLoading(false) })

        return () => { cancelled = true }
    }, [enabled, page, filters])

    const resetFilters = () => {
        resetTVSectionFilters('hmanhwa')
        setFilters(DEFAULT_FILTERS)
        onPageChange(1)
    }

    const filterConfig = useMemo(() => [
        { id: 'search', label: 'Search', type: 'search', placeholder: 'Search H manhwa...' },
        { id: 'section', label: 'Section', type: 'select', options: SECTION_OPTIONS },
        { id: 'type', label: 'Type of Manga', type: 'select', options: TYPE_OPTIONS },
        { id: 'sort', label: 'Sort', type: 'select', options: SORT_OPTIONS },
        { id: 'tags', label: 'Filters', type: 'chip-multi', options: FILTER_OPTIONS },
        { id: 'reset', label: 'Reset filters', type: 'action', onAction: resetFilters },
    ], []) // eslint-disable-line react-hooks/exhaustive-deps

    const handleFilterChange = (id, value) => {
        setFilters(f => {
            const next = { ...f, [id]: value }
            if (id !== 'search') saveTVSectionFilters('hmanhwa', next)
            return next
        })
        onPageChange(1)
    }

    useEffect(() => {
        onRegisterFilter?.({ title: 'H Manhwa Filters', filterConfig, filters, onFilterChange: handleFilterChange })
    }, [filterConfig, filters]) // eslint-disable-line react-hooks/exhaustive-deps

    const detailItems = useMemo(() => items.map(buildHManhwaDetailItem), [items])

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

    const getSelectHandler = useTVCardSelect(detailItems, onItemSelect)

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
                        const typeLabel = TYPE_OPTIONS.find(o => o.id === manga.type)?.label
                        const subtitle = [typeLabel, manga.status].filter(Boolean).join(' · ') || undefined
                        return (
                            <div key={id || i} data-focused-card={focused ? 'true' : undefined}>
                                <TVCard
                                    imageUrl={manga.coverUrl || manga.cover || manga.thumbnail}
                                    title={manga.title}
                                    badge={manga.latestChapter ? `Ch ${manga.latestChapter}` : undefined}
                                    subtitle={subtitle}
                                    ratingBadge={manga.contentRating || 'mature'}
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

TVHManhwaSection.COLS = COLS
