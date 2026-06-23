import { useEffect, useMemo, useState } from 'react'
import { lifesyncFetch } from '../../../../lib/lifesyncApi'
import { TVSectionHomePage } from '../TVSectionHomePage'

const COLS = 5
const ACCENT = 'rgb(56,189,248)' // sky-400

function buildItem(node) {
    if (!node) return null
    const n = node?.node || node
    const slug = n?.slug || n?.id
    if (!slug) return null
    const pic = n?.poster || n?.image || n?.main_picture?.large || n?.main_picture?.medium
    const chips = []
    if (n?.type || n?.media_type) chips.push(String(n.type || n.media_type))
    if (n?.status) chips.push(String(n.status))
    return {
        type: 'anime',
        title: n?.title,
        imageUrl: pic || null,
        description: n?.synopsis || null,
        chips,
        slug: String(slug),
        navigateTo: `/dashboard/lifesync/anime/anime/home/page/1/detail/${encodeURIComponent(String(slug))}`,
    }
}

export function TVAnimeHomeSection({ focusPos, onItemSelect, enabled, filterOpen, onFocusedItemChange, onGridMetaChange }) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!enabled) return
        let cancelled = false
        setLoading(true)

        Promise.all([
            lifesyncFetch('/api/v1/anime/home').catch(() => null),
            lifesyncFetch('/api/v1/anime/browse?limit=20&page=1').catch(() => null),
        ]).then(([home, browse]) => {
            if (cancelled) return
            const featured = (Array.isArray(home?.featured) ? home.featured : []).map(buildItem).filter(Boolean)
            const trending = (Array.isArray(home?.trending) ? home.trending : []).map(buildItem).filter(Boolean)
            const latest = (Array.isArray(browse?.data) ? browse.data : []).map(buildItem).filter(Boolean)

            const seen = new Set()
            const deduped = (arr) => arr.filter(i => { if (!i || seen.has(i.slug)) return false; seen.add(i.slug); return true })

            setData({
                hero: deduped([...featured]),
                rows: [
                    { label: 'Trending', items: deduped([...trending]).slice(0, COLS * 2) },
                    { label: 'Latest', items: deduped([...latest]).slice(0, COLS * 2) },
                ].filter(r => r.items.length > 0),
            })
        }).finally(() => { if (!cancelled) setLoading(false) })

        return () => { cancelled = true }
    }, [enabled])

    const rows = data?.rows || []
    const heroPool = data?.hero || []
    const totalCount = (heroPool.length ? 1 : 0) + rows.reduce((s, r) => s + r.items.length, 0)

    const focusedItem = useMemo(() => {
        if (filterOpen) return null
        if (focusPos.row === 0) return heroPool[0] || null
        const row = rows[focusPos.row - 1]
        return row?.items?.[focusPos.col] || null
    }, [filterOpen, focusPos, heroPool, rows])

    useEffect(() => { onFocusedItemChange?.(focusedItem) }, [focusedItem, onFocusedItemChange])
    useEffect(() => { onGridMetaChange?.({ count: totalCount, hasMore: false }) }, [totalCount, onGridMetaChange])

    return (
        <TVSectionHomePage
            rows={rows}
            heroItems={heroPool}
            loading={loading}
            focusPos={focusPos}
            onItemSelect={onItemSelect}
            onFocusedItemChange={onFocusedItemChange}
            onGridMetaChange={onGridMetaChange}
            filterOpen={filterOpen}
            accent={ACCENT}
            COLS={COLS}
            hasMore={false}
        />
    )
}

TVAnimeHomeSection.COLS = COLS
