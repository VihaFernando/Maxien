import { useEffect, useMemo, useState } from 'react'
import { lifesyncFetch } from '../../../../lib/lifesyncApi'
import { TVSectionHomePage } from '../TVSectionHomePage'

const COLS = 5
const ACCENT = 'rgb(251,113,133)' // rose-400

function buildItem(manga) {
    if (!manga) return null
    const id = manga.id || manga.slug
    if (!id) return null
    return {
        type: 'manga',
        source: 'mangadistrict',
        title: manga.title,
        imageUrl: manga.coverUrl || manga.cover || manga.thumbnail || null,
        mangaId: String(id),
        ratingBadge: '18+',
        navigateTo: `/dashboard/lifesync/anime/manga/mangadistrict/uncensored/page/1/manga/${encodeURIComponent(String(id))}`,
    }
}

export function TVHManhwaHomeSection({ focusPos, onItemSelect, enabled, filterOpen, onFocusedItemChange, onGridMetaChange }) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!enabled) return
        let cancelled = false
        setLoading(true)

        Promise.all([
            lifesyncFetch('/api/v1/manga/mangadistrict/latest/1?section=uncensored&view=standard').catch(() => null),
            lifesyncFetch('/api/v1/manga/mangadistrict/latest/1?section=latest&view=standard').catch(() => null),
        ]).then(([uncensored, latest]) => {
            if (cancelled) return
            const toArr = d => Array.isArray(d?.data) ? d.data : (Array.isArray(d) ? d : [])
            const uncensoredItems = toArr(uncensored).map(buildItem).filter(Boolean)
            const latestItems = toArr(latest).map(buildItem).filter(Boolean)

            const seen = new Set()
            const deduped = (arr) => arr.filter(i => { if (!i || seen.has(i.mangaId)) return false; seen.add(i.mangaId); return true })

            const hero = deduped([...uncensoredItems]).slice(0, 8)
            // reset seen for rows — hero items can appear in rows too
            seen.clear()

            setData({
                hero,
                rows: [
                    { label: 'Uncensored', items: deduped([...uncensoredItems]).slice(0, COLS * 2) },
                    { label: 'Latest', items: deduped([...latestItems]).slice(0, COLS * 2) },
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

TVHManhwaHomeSection.COLS = COLS
