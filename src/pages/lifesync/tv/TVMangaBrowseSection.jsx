import { useMangaReadingList } from '../../../hooks/useMangaReadingList'
import { useLifeSync } from '../../../context/LifeSyncContext'
import { TVCard, TVCardSkeleton } from './TVCard'

const COLS = 5
const MANGA_BASE = '/dashboard/lifesync/anime/manga'

export function TVMangaBrowseSection({ focusPos, onItemSelect, enabled }) {
    const { lifeSyncUser } = useLifeSync()
    const prefs = lifeSyncUser?.preferences
    const nsfwEnabled = Boolean(prefs?.nsfwContentEnabled)

    const { visibleEntries, initialLoading } = useMangaReadingList({
        enabled,
        nsfwEnabled,
        hManhwaEnabled: false,
        filters: { sortBy: 'updatedAt', order: 'desc', page: 1, limit: 40 },
    })

    if (initialLoading && visibleEntries.length === 0) {
        return (
            <div className="grid grid-cols-5 gap-5">
                {Array.from({ length: 10 }).map((_, i) => <TVCardSkeleton key={i} />)}
            </div>
        )
    }

    if (!initialLoading && visibleEntries.length === 0) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center">
                <p className="text-[20px] font-semibold text-white/40">No manga in your library.</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-5 gap-5">
            {visibleEntries.map((entry, i) => {
                const row = Math.floor(i / COLS)
                const col = i % COLS
                const focused = focusPos.row === row && focusPos.col === col
                const lastChapterId = entry.lastChapterId || entry.remoteLatestChapterId
                const badge = entry.lastChapterLabel || undefined
                const navigateTo = entry.mangaId && entry.source && lastChapterId
                    ? `${MANGA_BASE}/read/${encodeURIComponent(String(entry.mangaId))}/${encodeURIComponent(String(lastChapterId))}?source=${encodeURIComponent(entry.source)}&lang=en`
                    : MANGA_BASE

                return (
                    <TVCard
                        key={entry.mangaId ? `${entry.source}:${entry.mangaId}` : i}
                        imageUrl={entry.coverUrl}
                        title={entry.title}
                        badge={badge}
                        ratingBadge={entry.contentRating}
                        focused={focused}
                        onSelect={() => onItemSelect({
                            type: 'manga',
                            title: entry.title,
                            imageUrl: entry.coverUrl,
                            badge,
                            chips: [entry.source === 'mangadistrict' ? 'Manga District' : entry.source === 'mangadna' ? 'MangaDNA' : 'Roliascan'],
                            navigateTo,
                        })}
                    />
                )
            })}
        </div>
    )
}

TVMangaBrowseSection.COLS = COLS
