import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAnimeWatchHistory } from '../../../../hooks/useAnimeWatchHistory'
import { useMangaReadingList } from '../../../../hooks/useMangaReadingList'
import { useLifeSync } from '../../../../context/LifeSyncContext'
import { isLifeSyncHManhwaVisible, lifesyncFetch } from '../../../../lib/lifesyncApi'
import { TVCard, TVCardSkeleton } from '../TVCard'
import { loadTVSectionFilters, resetTVSectionFilters, saveTVSectionFilters } from '../tvFilterStorage'

const COLS = 5
const HISTORY_VIEW_OPTIONS = [
    { id: 'anime', label: 'Anime' },
    { id: 'manga', label: 'Manga' },
]
const ANIME_STATUS_OPTIONS = [
    { id: '', label: 'All' },
    { id: 'watching', label: 'Watching' },
    { id: 'completed', label: 'Completed' },
    { id: 'dropped', label: 'Dropped' },
]
const MANGA_SOURCE_OPTIONS = [
    { id: 'all', label: 'All sources' },
    { id: 'roliascan', label: 'Roliascan' },
    { id: 'mangadistrict', label: 'Manga District' },
]
const MANGA_STATUS_OPTIONS = [
    { id: 'all', label: 'Any status' },
    { id: 'reading', label: 'Reading' },
    { id: 'completed', label: 'Completed' },
    { id: 'on_hold', label: 'On Hold' },
    { id: 'dropped', label: 'Dropped' },
]
const DEFAULT_HISTORY_FILTERS = {
    view: 'anime',
    animeStatus: '',
    mangaSource: 'all',
    mangaStatus: 'all',
}

function buildHistoryDetailItem(entry, subTab) {
    if (!entry) return null
    if (subTab === 'anime') {
        const badge = entry.lastEpisodeNumber != null ? `EP ${entry.lastEpisodeNumber}` : undefined
        if (!entry.animeId) return null
        return {
            type: 'anime',
            title: entry.title,
            imageUrl: entry.imageUrl || entry.posterUrl,
            badge,
            slug: String(entry.animeId),
            lastEpisodeNumber: entry.lastEpisodeNumber,
            navigateTo: `/dashboard/lifesync/anime/anime/home/page/1/detail/${encodeURIComponent(String(entry.animeId))}`,
        }
    }

    const lastChapterId = entry.lastChapterId || entry.remoteLatestChapterId
    const badge = entry.lastChapterLabel || undefined
    const navigateTo = entry.mangaId && entry.source && lastChapterId
        ? `/dashboard/lifesync/anime/manga/read/${encodeURIComponent(String(entry.mangaId))}/${encodeURIComponent(String(lastChapterId))}?source=${encodeURIComponent(entry.source)}&lang=en`
        : '/dashboard/lifesync/anime/manga'

    return {
        type: 'manga',
        source: entry.source,
        title: entry.title,
        imageUrl: entry.coverUrl,
        badge,
        mangaId: String(entry.mangaId || ''),
        chips: [entry.source === 'mangadistrict' ? 'Manga District' : 'Roliascan'],
        navigateTo,
        lastChapterId: lastChapterId ? String(lastChapterId) : undefined,
    }
}

export function TVHistorySection({ focusPos, onItemSelect, enabled, filterOpen, onRegisterFilter, onFocusedItemChange }) {
    const { lifeSyncUser, isLifeSyncConnected } = useLifeSync()
    const prefs = lifeSyncUser?.preferences
    const nsfwEnabled = Boolean(prefs?.nsfwContentEnabled)
    const hManhwaEnabled = isLifeSyncHManhwaVisible(prefs)

    const [savedFilters, setSavedFilters] = useState(() => loadTVSectionFilters('history', DEFAULT_HISTORY_FILTERS))
    const [subTab, setSubTab] = useState(savedFilters.view === 'manga' ? 'manga' : 'anime')
    const [animeFilters, setAnimeFilters] = useState({ status: savedFilters.animeStatus || '' })
    const [mangaFilters, setMangaFilters] = useState({ source: savedFilters.mangaSource || 'all', status: savedFilters.mangaStatus || 'all' })
    const [syncBusy, setSyncBusy] = useState(false)

    const { entries: animeEntries, loading: animeLoading } = useAnimeWatchHistory({ enabled: enabled && subTab === 'anime', limit: 60 })

    const { visibleEntries: mangaEntries, initialLoading: mangaLoading, refresh: refreshManga } = useMangaReadingList({
        enabled: enabled && subTab === 'manga',
        nsfwEnabled,
        hManhwaEnabled,
        filters: {
            source: mangaFilters.source === 'all' ? undefined : mangaFilters.source,
            status: mangaFilters.status === 'all' ? undefined : mangaFilters.status,
            sortBy: 'updatedAt',
            order: 'desc',
            limit: 60,
        },
    })

    const handleSyncLatest = useCallback(async () => {
        if (syncBusy || !isLifeSyncConnected) return
        setSyncBusy(true)
        try {
            await lifesyncFetch('/api/v1/progress/sync', { method: 'POST', json: { scope: 'needs_sync' } })
            await refreshManga()
        } catch { /* ignore */ }
        finally { setSyncBusy(false) }
    }, [isLifeSyncConnected, refreshManga, syncBusy])

    const persistHistoryFilters = useCallback((next) => {
        setSavedFilters(next)
        saveTVSectionFilters('history', next)
    }, [])

    const resetFilters = useCallback(() => {
        resetTVSectionFilters('history')
        setSavedFilters(DEFAULT_HISTORY_FILTERS)
        setSubTab('anime')
        setAnimeFilters({ status: '' })
        setMangaFilters({ source: 'all', status: 'all' })
    }, [])

    const animeFilterConfig = useMemo(() => [
        { id: 'view', label: 'View', type: 'select', options: HISTORY_VIEW_OPTIONS },
        { id: 'status', label: 'Status', type: 'select', options: ANIME_STATUS_OPTIONS },
        { id: 'reset', label: 'Reset filters', type: 'action', onAction: resetFilters },
    ], [resetFilters])

    const mangaFilterConfig = useMemo(() => [
        { id: 'view', label: 'View', type: 'select', options: HISTORY_VIEW_OPTIONS },
        { id: 'source', label: 'Source', type: 'select', options: MANGA_SOURCE_OPTIONS },
        { id: 'status', label: 'Status', type: 'select', options: MANGA_STATUS_OPTIONS },
        { id: 'sync', label: syncBusy ? 'Syncing…' : 'Sync to Latest', type: 'action', onAction: handleSyncLatest },
        { id: 'reset', label: 'Reset filters', type: 'action', onAction: resetFilters },
    ], [syncBusy, handleSyncLatest, resetFilters])

    const filteredAnime = useMemo(() => {
        if (!animeFilters.status) return animeEntries
        return animeEntries.filter(e => e.status === animeFilters.status)
    }, [animeEntries, animeFilters.status])

    const displayItems = subTab === 'anime' ? filteredAnime : mangaEntries
    const loading = subTab === 'anime' ? animeLoading : mangaLoading

    // Bubble filter state up to TVMode for panel rendering
    const currentFilterConfig = subTab === 'anime' ? animeFilterConfig : mangaFilterConfig
    const currentFilters = useMemo(
        () => subTab === 'anime' ? { view: subTab, ...animeFilters } : { view: subTab, ...mangaFilters },
        [animeFilters, mangaFilters, subTab]
    )
    const handleFilterChange = useCallback((id, value) => {
        if (id === 'view') {
            const view = value === 'manga' ? 'manga' : 'anime'
            setSubTab(view)
            persistHistoryFilters({
                view,
                animeStatus: animeFilters.status || '',
                mangaSource: mangaFilters.source || 'all',
                mangaStatus: mangaFilters.status || 'all',
            })
            return
        }
        if (subTab === 'anime') {
            setAnimeFilters(f => {
                const nextAnime = { ...f, [id]: value }
                persistHistoryFilters({
                    view: subTab,
                    animeStatus: nextAnime.status || '',
                    mangaSource: mangaFilters.source || 'all',
                    mangaStatus: mangaFilters.status || 'all',
                })
                return nextAnime
            })
        } else {
            setMangaFilters(f => {
                const nextManga = { ...f, [id]: value }
                persistHistoryFilters({
                    view: subTab,
                    animeStatus: animeFilters.status || '',
                    mangaSource: nextManga.source || 'all',
                    mangaStatus: nextManga.status || 'all',
                })
                return nextManga
            })
        }
    }, [animeFilters.status, mangaFilters.source, mangaFilters.status, persistHistoryFilters, subTab])

    useEffect(() => {
        onRegisterFilter?.({
            title: subTab === 'anime' ? 'Anime History Filters' : 'Manga History Filters',
            filterConfig: currentFilterConfig,
            filters: currentFilters,
            onFilterChange: handleFilterChange,
        })
    }, [currentFilterConfig, currentFilters, subTab]) // eslint-disable-line react-hooks/exhaustive-deps

    const focusedItem = useMemo(() => {
        if (filterOpen) return null
        const idx = focusPos.row * COLS + focusPos.col
        return buildHistoryDetailItem(displayItems[idx], subTab)
    }, [displayItems, filterOpen, focusPos.col, focusPos.row, subTab])

    useEffect(() => {
        if (!enabled) return
        onFocusedItemChange?.(focusedItem)
    }, [enabled, focusedItem, onFocusedItemChange])

    return (
        <div className="relative">
            {/* Sub-tabs */}
            <div className="mb-5 flex gap-2">
                {[{ id: 'anime', label: 'Anime' }, { id: 'manga', label: 'Manga' }].map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSubTab(tab.id)}
                        className={`rounded-xl px-5 py-2.5 text-[15px] font-black transition-all ${
                            subTab === tab.id ? 'bg-[var(--mx-color-c6ff00)] text-black' : 'bg-white/8 text-white/50'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading && displayItems.length === 0 ? (
                <div className="grid grid-cols-5 gap-5">{Array.from({ length: 10 }).map((_, i) => <TVCardSkeleton key={i} />)}</div>
            ) : displayItems.length === 0 ? (
                <div className="flex min-h-[40vh] items-center justify-center">
                    <p className="text-[20px] font-semibold text-white/40">
                        {subTab === 'anime' ? 'No anime watch history yet.' : 'No manga reading history yet.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-5 gap-5">
                    {displayItems.map((entry, i) => {
                        const row = Math.floor(i / COLS)
                        const col = i % COLS
                        const focused = !filterOpen && focusPos.row === row && focusPos.col === col
                        const detailItem = buildHistoryDetailItem(entry, subTab)

                        if (subTab === 'anime') {
                            const badge = entry.lastEpisodeNumber != null ? `EP ${entry.lastEpisodeNumber}` : undefined
                            const subtitle = entry.status ? entry.status : 'Anime'
                            return (
                                <div key={entry.animeId || i} data-focused-card={focused ? 'true' : undefined}>
                                    <TVCard
                                        imageUrl={entry.imageUrl || entry.posterUrl}
                                        title={entry.title}
                                        badge={badge}
                                        subtitle={subtitle}
                                        focused={focused}
                                        onSelect={() => detailItem && onItemSelect(detailItem)}
                                    />
                                </div>
                            )
                        }

                        const badge = entry.lastChapterLabel || undefined
                        const subtitle = [entry.source, entry.status].filter(Boolean).join(' · ') || 'Manga'

                        return (
                            <div key={entry.source && entry.mangaId ? `${entry.source}:${entry.mangaId}` : i} data-focused-card={focused ? 'true' : undefined}>
                                <TVCard
                                    imageUrl={entry.coverUrl}
                                    title={entry.title}
                                    badge={badge}
                                    subtitle={subtitle}
                                    focused={focused}
                                    onSelect={() => detailItem && onItemSelect(detailItem)}
                                />
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

TVHistorySection.COLS = COLS
