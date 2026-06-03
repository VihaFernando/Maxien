import { useEffect, useMemo, useState } from 'react'
import { lifesyncFetch } from '../../../../lib/lifesyncApi'
import { TVCard, TVCardSkeleton } from '../TVCard'
import { loadTVSectionFilters, resetTVSectionFilters, saveTVSectionFilters } from '../tvFilterStorage'

const COLS = 5
const TYPE_OPTIONS = [
    { id: 'manga', label: 'Manga', type: 'manga' },
    { id: 'manhwa', label: 'Manhwa', type: 'manhwa' },
    { id: 'manhua', label: 'Manhua', type: 'manhua' },
    { id: 'oneshot', label: 'Novel', type: 'other' },
]
const STATUS_OPTIONS = [
    { id: '', label: 'Any' }, { id: 'ongoing', label: 'Ongoing' },
    { id: 'completed', label: 'Completed' }, { id: 'hiatus', label: 'Hiatus' },
]
const SORT_OPTIONS = [
    { id: 'chapter_updated_at', label: 'Latest Update' },
    { id: 'views_7d', label: 'Views (7d)' },
    { id: 'views_30d', label: 'Views (30d)' },
    { id: 'follows_total', label: 'Follows' },
    { id: 'title', label: 'Title A-Z' },
]
const GENRE_OPTIONS = [
    'action', 'adaptation', 'adult', 'adventure', 'aliens', 'comedy', 'cooking', 'crime',
    'crossdressing', 'delinquents', 'demons', 'detective', 'drama', 'eastern', 'ecchi',
    'erotica', 'fantasy', 'full-color', 'game', 'gender-bender', 'ghosts', 'gore',
    'harem', 'historical', 'horror', 'isekai', 'josei', 'light-novel', 'mafia',
    'magic', 'magical-girls', 'manga', 'manhua', 'manhwa', 'martial-arts', 'mature',
    'mecha', 'medical', 'military', 'monster-girls', 'monsters', 'music', 'mystery',
    'ninja', 'novel', 'office-workers', 'official-colored', 'other', 'parody',
    'philosophical', 'psychological', 'regression', 'reincarnation', 'revenge',
    'reverse-harem', 'romance', 'school', 'school-life', 'sci-fi', 'seinen',
    'shoujo', 'shoujo-ai', 'shounen', 'slice-of-life', 'smut', 'space', 'sports',
    'supernatural', 'survival', 'suspense', 'thriller', 'time-travel', 'tragedy',
    'vampire', 'video-game', 'virtual-reality', 'web-comic', 'webtoon', 'workplace',
    'wuxia', 'xianxia', 'xuanhuan', 'yuri', 'zombies',
].map(id => ({ id, label: id.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') }))
const DEFAULT_FILTERS = { search: '', type: 'manga', status: '', sort: 'chapter_updated_at', genres: [] }

function buildMangaDetailItem(manga, typeOption) {
    if (!manga?.id) return null
    return {
        type: 'manga',
        source: 'roliascan',
        title: manga.title,
        imageUrl: manga.coverUrl || manga.cover,
        mangaId: String(manga.id),
        chips: [typeOption?.label || 'Manga'],
        navigateTo: `/dashboard/lifesync/anime/manga/roliascan/${typeOption?.id || 'manga'}/page/1/manga/${encodeURIComponent(String(manga.id))}`,
    }
}

export function TVMangaSection({ focusPos, onItemSelect, enabled, filterOpen, onRegisterFilter, onFocusedItemChange, page, onPageChange }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [hasMore, setHasMore] = useState(true)
    const [filters, setFilters] = useState(() => loadTVSectionFilters('manga', DEFAULT_FILTERS))

    const typeOption = TYPE_OPTIONS.find(option => option.id === filters.type) || TYPE_OPTIONS[0]

    useEffect(() => {
        if (!enabled) return
        let cancelled = false
        Promise.resolve().then(() => {
            if (cancelled) return
            setLoading(true)
            setItems([])
        })

        const qs = new URLSearchParams()
        qs.set('page', String(page))
        qs.set('limit', '25')
        qs.set('folder', 'hot')
        qs.append('types[]', typeOption.type)
        const searchQuery = String(filters.search || '').trim()
        if (searchQuery) qs.set('keyword', searchQuery)
        if (filters.status) qs.append('statuses[]', filters.status)
        if (Array.isArray(filters.genres)) filters.genres.forEach(genre => qs.append('genres[]', genre))
        const sortKey = filters.sort || 'chapter_updated_at'
        qs.set(`order[${sortKey}]`, 'desc')

        lifesyncFetch(`/api/v1/manga/roliascan/browser?${qs.toString()}&view=standard`)
            .then(data => {
                if (cancelled) return
                const rows = (Array.isArray(data?.data) ? data.data : [])
                    .map(r => ({ ...r, id: r?.id || r?.slug || r?.hid, source: 'roliascan' }))
                    .filter(r => r?.id)
                setItems(rows)
                setHasMore(Boolean(data?.paging?.next || (Array.isArray(data?.data) && data.data.length === 25)))
            })
            .catch(() => setItems([]))
            .finally(() => { if (!cancelled) setLoading(false) })

        return () => { cancelled = true }
    }, [enabled, typeOption.type, page, filters])

    const resetFilters = () => {
        resetTVSectionFilters('manga')
        setFilters(DEFAULT_FILTERS)
        onPageChange(1)
    }

    const filterConfig = useMemo(() => [
        { id: 'search', label: 'Search', type: 'search', placeholder: 'Search manga...' },
        { id: 'type', label: 'Type', type: 'select', options: TYPE_OPTIONS },
        { id: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
        { id: 'sort', label: 'Sort', type: 'select', options: SORT_OPTIONS },
        { id: 'genres', label: 'Genres', type: 'chip-multi', options: GENRE_OPTIONS },
        { id: 'reset', label: 'Reset filters', type: 'action', onAction: resetFilters },
    ], []) // eslint-disable-line react-hooks/exhaustive-deps

    const handleFilterChange = (id, value) => {
        setFilters(f => {
            const next = { ...f, [id]: value }
            if (id !== 'search') saveTVSectionFilters('manga', next)
            return next
        })
        onPageChange(1)
    }

    useEffect(() => {
        onRegisterFilter?.({ title: 'Manga Filters', filterConfig, filters, onFilterChange: handleFilterChange })
    }, [filterConfig, filters]) // eslint-disable-line react-hooks/exhaustive-deps

    const focusedItem = useMemo(() => {
        if (filterOpen) return null
        const idx = focusPos.row * COLS + focusPos.col
        return buildMangaDetailItem(items[idx], typeOption)
    }, [filterOpen, focusPos.col, focusPos.row, items, typeOption])

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
                        const detailItem = buildMangaDetailItem(manga, typeOption)
                        return (
                            <div key={manga.id} data-focused-card={focused ? 'true' : undefined}>
                                <TVCard
                                    imageUrl={manga.coverUrl || manga.cover}
                                    title={manga.title}
                                    focused={focused}
                                    onSelect={() => detailItem && onItemSelect(detailItem)}
                                />
                            </div>
                        )
                    })}
                </div>
            )}

            <div className="mt-4 flex items-center justify-center gap-3 text-[13px] text-white/40">
                {page > 1 && <span className="rounded bg-white/8 px-2 py-1 text-[11px] font-black">LT prev</span>}
                <span>Page {page}</span>
                {hasMore && <span className="rounded bg-white/8 px-2 py-1 text-[11px] font-black">RT next</span>}
            </div>
        </div>
    )
}

TVMangaSection.COLS = COLS
