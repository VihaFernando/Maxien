import { useEffect, useMemo, useState } from 'react'
import { lifesyncFetch } from '../../../../lib/lifesyncApi'
import { TVSectionHomePage } from '../TVSectionHomePage'

const COLS = 5
const ACCENT = 'rgb(251,146,60)' // orange-400

function buildItem(manga, opts = {}) {
    if (!manga) return null
    const id = manga.id || manga.slug
    if (!id) return null
    // landscape episode cards use thumbnailUrl (16:9), series cards use coverUrl (2:3)
    const imageUrl = manga.thumbnailUrl || manga.coverUrl || manga.cover || manga.thumbnail || null
    return {
        type: 'manga',
        source: 'mangadna',
        title: manga.title,
        imageUrl,
        aspectRatio: opts.landscape ? '16/9' : '2/3',
        mangaId: String(id),
        chips: manga.genres?.slice(0, 2) || [],
        navigateTo: `/dashboard/lifesync/anime/manga/mangadna/manga/page/1/manga/${encodeURIComponent(String(id))}`,
    }
}

function buildEpisodeItem(ep) {
    if (!ep) return null
    const id = ep.slug
    if (!id) return null
    return {
        type: 'manga',
        source: 'mangadna',
        title: ep.title || ep.seriesTitle || ep.slug || '',
        subtitle: ep.episodeLabel || null,
        imageUrl: ep.thumbnailUrl || null,
        aspectRatio: '16/9',
        mangaId: id,
        badge: ep.badges?.[0] || null,
        navigateTo: `/dashboard/lifesync/anime/manga/mangadna/manga/page/1/manga/${encodeURIComponent(id)}`,
    }
}

export function TVMangaDNAHomeSection({ focusPos, onItemSelect, enabled, filterOpen, onFocusedItemChange, onGridMetaChange }) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!enabled) return
        let cancelled = false
        setLoading(true)

        lifesyncFetch('/api/v1/manga/mangadna/home').catch(() => null).then((home) => {
            if (cancelled) return
            const toArr = (v) => Array.isArray(v) ? v : []

            const seen = new Set()
            const deduped = (arr) => arr.filter(i => { if (!i || seen.has(i.mangaId)) return false; seen.add(i.mangaId); return true })

            const featured = toArr(home?.featured).map(m => buildItem(m)).filter(Boolean)
            const popular = toArr(home?.popular).map(m => buildItem(m)).filter(Boolean)
            const latest = toArr(home?.latest).map(m => buildItem(m)).filter(Boolean)
            const recentEpisodes = toArr(home?.recentEpisodes).map(ep => buildEpisodeItem(ep)).filter(Boolean)

            setData({
                hero: deduped([...featured]),
                rows: [
                    { label: 'Popular', items: deduped([...popular]).slice(0, COLS * 2) },
                    { label: 'Latest Updates', items: deduped([...latest]).slice(0, COLS * 2) },
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

TVMangaDNAHomeSection.COLS = COLS
