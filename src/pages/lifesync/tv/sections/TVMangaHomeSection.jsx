import { useEffect, useMemo, useState } from 'react'
import { lifesyncFetch } from '../../../../lib/lifesyncApi'
import { TVSectionHomePage } from '../TVSectionHomePage'

const COLS = 5
const ACCENT = 'rgb(251,191,36)' // amber-400

function buildItem(manga) {
    if (!manga?.id && !manga?.slug) return null
    const id = manga.id || manga.slug
    return {
        type: 'manga',
        source: 'roliascan',
        title: manga.title,
        imageUrl: manga.coverUrl || manga.cover || null,
        mangaId: String(id),
        chips: manga.genres?.slice(0, 2) || [],
        score: manga.ratings?.average || manga.ratingAverage || null,
        navigateTo: `/dashboard/lifesync/anime/manga/roliascan/manga/page/1/manga/${encodeURIComponent(String(id))}`,
    }
}

export function TVMangaHomeSection({ focusPos, onItemSelect, enabled, filterOpen, onFocusedItemChange, onGridMetaChange }) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!enabled) return
        let cancelled = false
        setLoading(true)

        lifesyncFetch('/api/v1/manga/roliascan/home').catch(() => null).then((home) => {
            if (cancelled) return
            const toArr = (v) => Array.isArray(v) ? v : []

            const seen = new Set()
            const deduped = (arr) => arr.filter(i => { if (!i || seen.has(i.mangaId)) return false; seen.add(i.mangaId); return true })

            const featured = toArr(home?.featured).map(buildItem).filter(Boolean)
            const popular = toArr(home?.popular).map(buildItem).filter(Boolean)
            const highScore = toArr(home?.highScore).map(buildItem).filter(Boolean)
            const mostFollowed = toArr(home?.mostFollowed).map(buildItem).filter(Boolean)
            const newChapters = toArr(home?.newChapters || home?.latest).map(buildItem).filter(Boolean)

            setData({
                hero: deduped([...featured]),
                rows: [
                    { label: 'Popular', items: deduped([...popular]).slice(0, COLS * 2) },
                    { label: 'High Score', items: deduped([...highScore]).slice(0, COLS * 2) },
                    { label: 'Most Followed', items: deduped([...mostFollowed]).slice(0, COLS * 2) },
                    { label: 'New Chapters', items: deduped([...newChapters]).slice(0, COLS * 2) },
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

TVMangaHomeSection.COLS = COLS
