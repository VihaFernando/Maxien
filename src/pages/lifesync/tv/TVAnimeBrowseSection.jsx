import { useEffect, useState } from 'react'
import { lifesyncFetch } from '../../../lib/lifesyncApi'
import { TVCard, TVCardSkeleton } from './TVCard'

const COLS = 5

export function TVAnimeBrowseSection({ focusPos, onItemSelect, enabled }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!enabled) return
        let cancelled = false
        setLoading(true)

        const load = async () => {
            try {
                const [homeRes, ongoingRes] = await Promise.all([
                    lifesyncFetch('/api/v1/anime/home').catch(() => null),
                    lifesyncFetch('/api/v1/anime/ongoing?limit=30&page=1').catch(() => null),
                ])

                if (cancelled) return

                const featured = Array.isArray(homeRes?.featured) ? homeRes.featured : []
                const trending = Array.isArray(homeRes?.trending) ? homeRes.trending : []
                const ongoing = Array.isArray(ongoingRes?.data) ? ongoingRes.data : []

                // Merge and deduplicate by slug
                const seen = new Set()
                const merged = []
                for (const item of [...featured, ...trending, ...ongoing]) {
                    const node = item?.node || item
                    const slug = node?.slug || node?.id
                    if (!slug || seen.has(slug)) continue
                    seen.add(slug)
                    merged.push(node)
                }

                setItems(merged.slice(0, 40))
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
            <div className="grid grid-cols-5 gap-5">
                {Array.from({ length: 10 }).map((_, i) => <TVCardSkeleton key={i} />)}
            </div>
        )
    }

    if (!loading && items.length === 0) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center">
                <p className="text-[20px] font-semibold text-white/40">No anime available.</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-5 gap-5">
            {items.map((node, i) => {
                const row = Math.floor(i / COLS)
                const col = i % COLS
                const focused = focusPos.row === row && focusPos.col === col
                const slug = node?.slug || node?.id
                const pic = node?.poster || node?.image || node?.main_picture?.large
                const chips = []
                if (node?.type || node?.media_type) chips.push(node.type || node.media_type)
                if (node?.status) chips.push(node.status)

                return (
                    <TVCard
                        key={slug || i}
                        imageUrl={pic}
                        title={node?.title}
                        focused={focused}
                        onSelect={() => slug && onItemSelect({
                            type: 'anime',
                            title: node?.title,
                            imageUrl: pic,
                            description: node?.synopsis,
                            chips,
                            navigateTo: `/dashboard/lifesync/anime/anime/home/page/1/detail/${encodeURIComponent(String(slug))}`,
                        })}
                    />
                )
            })}
        </div>
    )
}

TVAnimeBrowseSection.COLS = COLS
