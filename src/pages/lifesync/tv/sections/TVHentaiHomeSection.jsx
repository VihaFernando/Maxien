import { useEffect, useMemo, useState } from 'react'
import { lifesyncFetch } from '../../../../lib/lifesyncApi'
import { TVSectionHomePage } from '../TVSectionHomePage'

const COLS = 5
const ACCENT = 'rgb(232,121,249)' // fuchsia-400

function buildSeriesItem(item) {
    if (!item) return null
    const id = item.id || item.slug
    if (!id) return null
    return {
        type: 'hentai',
        source: 'watchhentai',
        title: item.title,
        imageUrl: item.coverUrl || item.cover || item.thumbnail || item.thumbnailUrl || item.poster || null,
        description: item.synopsis || item.description || null,
        chips: item.genres?.slice(0, 2) || [],
        slug: String(id),
        ratingBadge: '18+',
        navigateTo: `/dashboard/lifesync/anime/hentai/watchhentai/home/page/1/detail/${encodeURIComponent(String(id))}`,
    }
}

function buildEpisodeItem(ep) {
    if (!ep) return null
    const id = ep.slug
    if (!id) return null
    return {
        type: 'hentai',
        source: 'watchhentai',
        title: ep.title || ep.seriesTitle || '',
        subtitle: ep.episodeLabel || null,
        imageUrl: ep.thumbnailUrl || null,
        aspectRatio: '16/9',
        slug: id,
        badge: ep.badges?.[0] || null,
        ratingBadge: '18+',
        navigateTo: `/dashboard/lifesync/anime/hentai/watchhentai/home/page/1/detail/${encodeURIComponent(id)}`,
    }
}

export function TVHentaiHomeSection({ focusPos, onItemSelect, enabled, filterOpen, onFocusedItemChange, onGridMetaChange }) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!enabled) return
        let cancelled = false
        setLoading(true)

        // /watchhentai/discover returns { featured, trending, latest, recentEpisodes }
        lifesyncFetch('/api/v1/hentai/watchhentai/discover').catch(() => null).then((home) => {
            if (cancelled) return
            const toArr = (v) => Array.isArray(v) ? v : []

            const seen = new Set()
            const deduped = (arr) => arr.filter(i => { if (!i || seen.has(i.slug)) return false; seen.add(i.slug); return true })

            const featured = toArr(home?.featured).map(buildSeriesItem).filter(Boolean)
            const trending = toArr(home?.trending).map(buildSeriesItem).filter(Boolean)
            const latest = toArr(home?.latest).map(buildSeriesItem).filter(Boolean)
            const recentEpisodes = toArr(home?.recentEpisodes).map(buildEpisodeItem).filter(Boolean)

            setData({
                hero: deduped([...featured]).slice(0, 8),
                rows: [
                    { label: 'Trending', items: deduped([...trending]).slice(0, COLS * 2) },
                    { label: 'Latest', items: deduped([...latest]).slice(0, COLS * 2) },
                    recentEpisodes.length > 0 && { label: 'Recent Episodes', items: recentEpisodes.slice(0, COLS * 2) },
                ].filter(Boolean).filter(r => r.items.length > 0),
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

TVHentaiHomeSection.COLS = COLS
