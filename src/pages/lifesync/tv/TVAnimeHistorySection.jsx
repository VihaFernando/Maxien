import { useAnimeWatchHistory } from '../../../hooks/useAnimeWatchHistory'
import { TVCard, TVCardSkeleton } from './TVCard'

const COLS = 4

export function TVAnimeHistorySection({ focusPos, onItemSelect, enabled }) {
    const { entries, loading } = useAnimeWatchHistory({ enabled, limit: 40 })

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
                <p className="text-[20px] font-semibold text-white/40">No anime watch history yet.</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-4 gap-6">
            {entries.map((entry, i) => {
                const row = Math.floor(i / COLS)
                const col = i % COLS
                const focused = focusPos.row === row && focusPos.col === col
                return (
                    <TVCard
                        key={entry.animeId || i}
                        imageUrl={entry.imageUrl || entry.posterUrl}
                        title={entry.title}
                        badge={entry.lastEpisodeNumber != null ? `EP ${entry.lastEpisodeNumber}` : undefined}
                        focused={focused}
                        onSelect={() => onItemSelect({
                            type: 'anime',
                            title: entry.title,
                            imageUrl: entry.imageUrl || entry.posterUrl,
                            badge: entry.lastEpisodeNumber != null ? `EP ${entry.lastEpisodeNumber}` : undefined,
                            navigateTo: `/dashboard/lifesync/anime/anime/detail/${encodeURIComponent(String(entry.animeId))}`,
                        })}
                    />
                )
            })}
        </div>
    )
}

TVAnimeHistorySection.COLS = COLS
