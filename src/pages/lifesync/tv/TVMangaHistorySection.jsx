import { useBatchContentLists } from '../../../hooks/useBatchContentLists'
import { filterMangaReadingByNsfw } from '../../../hooks/useMangaReadingList'
import { useLifeSync } from '../../../context/LifeSyncContext'
import { isLifeSyncHManhwaVisible } from '../../../lib/lifesyncApi'
import { TVCard, TVCardSkeleton } from './TVCard'

const COLS = 4

const MANGA_BASE = '/dashboard/lifesync/anime/manga'

export function TVMangaHistorySection({ focusPos, onItemSelect, enabled }) {
    const { lifeSyncUser } = useLifeSync()
    const prefs = lifeSyncUser?.preferences
    const nsfwEnabled = Boolean(prefs?.nsfwContentEnabled)
    const hManhwaEnabled = isLifeSyncHManhwaVisible(prefs)

    const { mangaReading, loading } = useBatchContentLists({ enabled })

    const entries = filterMangaReadingByNsfw(mangaReading, nsfwEnabled, hManhwaEnabled)

    if (loading && entries.length === 0) {
        return (
            <div className="grid grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => <TVCardSkeleton key={i} />)}
            </div>
        )
    }

    if (!loading && entries.length === 0) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center">
                <p className="text-[20px] font-semibold text-white/40">No manga reading history yet.</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-4 gap-6">
            {entries.map((entry, i) => {
                const row = Math.floor(i / COLS)
                const col = i % COLS
                const focused = focusPos.row === row && focusPos.col === col
                const lastChapterId = entry.lastChapterId || entry.remoteLatestChapterId
                const badge = entry.lastChapterLabel || (entry.lastChapterId ? `Ch ${entry.lastChapterId}` : undefined)
                const navigateTo = entry.mangaId && entry.source && lastChapterId
                    ? `${MANGA_BASE}/read/${encodeURIComponent(String(entry.mangaId))}/${encodeURIComponent(String(lastChapterId))}?source=${encodeURIComponent(entry.source)}&lang=en`
                    : MANGA_BASE
                return (
                    <TVCard
                        key={entry.mangaId ? `${entry.source}:${entry.mangaId}` : i}
                        imageUrl={entry.coverUrl}
                        title={entry.title}
                        badge={badge}
                        focused={focused}
                        onSelect={() => onItemSelect({
                            type: 'manga',
                            title: entry.title,
                            imageUrl: entry.coverUrl,
                            badge,
                            chips: [entry.source === 'mangadistrict' ? 'Manga District' : 'Roliascan'],
                            navigateTo,
                        })}
                    />
                )
            })}
        </div>
    )
}

TVMangaHistorySection.COLS = COLS
