import { useEffect, useState } from 'react'
import { lifesyncFetch } from '../../../lib/lifesyncApi'
import { TVCard, TVCardSkeleton } from './TVCard'

const COLS = 4

export function TVHentaiBrowseSection({ focusPos, onItemSelect, enabled }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!enabled) return
        let cancelled = false
        setLoading(true)

        const load = async () => {
            try {
                const params = new URLSearchParams({ page: '1', perPage: '32', view: 'standard', section: 'series' })
                const data = await lifesyncFetch(`/api/v1/hentai/watchhentai/home?${params}`)
                if (cancelled) return
                const series = Array.isArray(data?.series) ? data.series : []
                const items2 = Array.isArray(data?.items) ? data.items : []
                const list = series.length > 0 ? series : items2
                setItems(list.slice(0, 32))
            } catch {
                setItems([])
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        void load()
        return () => { cancelled = true }
    }, [enabled])

    if (loading && items.length === 0) {
        return (
            <div className="grid grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => <TVCardSkeleton key={i} />)}
            </div>
        )
    }

    if (!loading && items.length === 0) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center">
                <p className="text-[20px] font-semibold text-white/40">No hentai available.</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-4 gap-6">
            {items.map((series, i) => {
                const row = Math.floor(i / COLS)
                const col = i % COLS
                const focused = focusPos.row === row && focusPos.col === col
                const key = series.seriesKey || series.slug || i
                const epCount = series.episodeCount || series.episodes?.length

                return (
                    <TVCard
                        key={key}
                        imageUrl={series.posterUrl}
                        title={series.title}
                        badge={epCount ? `${epCount} ep` : undefined}
                        focused={focused}
                        onSelect={() => onItemSelect({
                            type: 'hentai',
                            title: series.title,
                            imageUrl: series.posterUrl,
                            badge: epCount ? `${epCount} episodes` : undefined,
                            chips: ['18+'],
                            // Navigate to hentai page  TV mode will exit and open normal hentai page
                            navigateTo: '/dashboard/lifesync/anime/hentai',
                            navigateState: { openSeries: series },
                        })}
                    />
                )
            })}
        </div>
    )
}

TVHentaiBrowseSection.COLS = COLS
