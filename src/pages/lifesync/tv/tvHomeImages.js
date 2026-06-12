import { useEffect, useMemo, useRef, useState } from 'react'
import { lifesyncFetch } from '../../../lib/lifesyncApi'

// ─── constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'lifesync.tv.homeImages.v1'
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000
const MAX_IMAGES_PER_TAB = 20
const MIN_USABLE_POOL = 4

// ─── module-level session store ───────────────────────────────────────────────
// Survives tab switches inside a TV session; cleared on exit.
// Shape: Map<tabId, string[]>
const _sessionImages = new Map()
// Shape: Map<url, { w: number, h: number } | null>
const _resolutionCache = new Map()

/** Call this when the user exits TV mode to free memory and force a fresh fetch next time. */
export function clearTVHomeImagesCache() {
    _sessionImages.clear()
    // Keep _resolutionCache — resolution data is URL-stable across sessions.
}

// ─── fallback pool ────────────────────────────────────────────────────────────
export const FALLBACK_TV_HOME_IMAGES = {
    anime: [
        'https://cdn.myanimelist.net/images/anime/1286/99889.jpg',
        'https://cdn.myanimelist.net/images/anime/1000/110531.jpg',
        'https://cdn.myanimelist.net/images/anime/5/73199.jpg',
        'https://cdn.myanimelist.net/images/anime/9/9453.jpg',
        'https://cdn.myanimelist.net/images/anime/13/17405.jpg',
        'https://cdn.myanimelist.net/images/anime/6/73245.jpg',
        'https://cdn.myanimelist.net/images/anime/1171/109222.jpg',
        'https://cdn.myanimelist.net/images/anime/10/78745.jpg',
        'https://cdn.myanimelist.net/images/anime/1015/138006.jpg',
        'https://cdn.myanimelist.net/images/anime/1806/126216.jpg',
        'https://cdn.myanimelist.net/images/anime/1223/96541.jpg',
    ],
    manga: [
        'https://roliascan.com/content/media/manga-10996-cover-1775133523.png',
        'https://roliascan.com/content/media/manga-10492-cover-1775133327.jpg',
        'https://roliascan.com/content/media/manga-10482-cover-1775133325.webp',
        'https://roliascan.com/content/media/manga-10458-cover-1775133318.webp',
        'https://roliascan.com/content/media/manga-10664-cover-1775133397.webp',
        'https://roliascan.com/content/media/manga-1469-cover-1775048210.webp',
        'https://roliascan.com/content/media/manga-11300-cover-1775134486.jpg',
        'https://roliascan.com/content/media/manga-80194-cover-1775555921.png',
        'https://roliascan.com/content/media/manga-10558-cover-1775133344.png',
        'https://roliascan.com/content/media/manga-146584-cover-1777856073.jpg',
    ],
    hmanhwa: [
        'https://mangadistrict.com/wp-content/uploads/2026/01/Everyones-Man-Uncensored-Edit-2.png',
        'https://cdn.mangadistrict.com/thumbnail/snapping-into-love-uncensored-2.webp',
        'https://cdn.mangadistrict.com/thumbnail/dont-tell-anyone-at-school-uncensored-official.webp',
        'https://mangadistrict.com/wp-content/uploads/2025/11/Troublesome-Employee-Warning-Uncensored-Edited.png',
        'https://cdn.mangadistrict.com/thumbnail/im-the-only-man-in-this-clan-official.webp',
        'https://cdn.mangadistrict.com/thumbnail/daddys-girl-carcass-official.webp',
        'https://cdn.mangadistrict.com/thumbnail/the-double-life-of-a-public-official-official.webp',
        'https://cdn.mangadistrict.com/thumbnail/only-with-consent.webp',
        'https://cdn.mangadistrict.com/thumbnail/secret-class.webp',
    ],
    hentai: [
        'https://watchhentai.net/uploads/2022/11/boy-meets-harem-the-animation/poster.jpg',
        'https://watchhentai.net/uploads/2022/12/shinshou-genmukan/poster.jpg',
        'https://watchhentai.net/uploads/2023/8/kono-koi-ni-kiduite/poster.jpg',
        'https://watchhentai.net/uploads/2022/10/oppai-no-ouja-48/poster.jpg',
        'https://watchhentai.net/uploads/2024/gomu-o-tsukete-iimashita-yo-ne/poster.jpg',
        'https://watchhentai.net/uploads/2022/12/takarasagashi-no-natsuyasumi/poster.jpg',
        'https://watchhentai.net/uploads/2026/meijyou/3.jpg',
        'https://watchhentai.net/uploads/2026/anal-mania-otaku-to-ananii-daisuki-na-ojou-sama/1.jpg',
        'https://watchhentai.net/uploads/2025/reika-wa-karei-na-boku-no-joou-the-animation/poster.jpg',
        'https://watchhentai.net/uploads/2025/natsu-to-hako/poster.jpg',
    ],
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function randomPage(max) { return 1 + Math.floor(Math.random() * max) }

export function shuffle(list) {
    const arr = [...list]
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
}

function dedupeUrls(urls) {
    return [...new Set(urls.filter(u => typeof u === 'string' && /^https?:\/\//.test(u)))]
}

// ─── resolution probing ───────────────────────────────────────────────────────
/**
 * Probes the natural pixel dimensions of a list of image URLs.
 * Results land in the module-level `_resolutionCache` (url → {w,h}|null).
 * Already-probed URLs are skipped. Returns a Promise that resolves once all
 * outstanding probes for `urls` are settled.
 */
export function probeImageResolutions(urls) {
    const pending = urls.filter(url => !_resolutionCache.has(url))
    if (!pending.length) return Promise.resolve()
    return Promise.all(pending.map(url =>
        new Promise(resolve => {
            const img = new Image()
            img.onload = () => {
                _resolutionCache.set(url, { w: img.naturalWidth, h: img.naturalHeight })
                resolve()
            }
            img.onerror = () => {
                _resolutionCache.set(url, null)
                resolve()
            }
            img.src = url
        })
    ))
}

/**
 * Return the cached resolution for a URL.
 * • `undefined`  — never probed (not in cache)
 * • `null`       — probed and failed (CORS / 404 / etc.)
 * • `{w, h}`     — successful probe
 */
export function getImageResolution(url) {
    if (!_resolutionCache.has(url)) return undefined
    return _resolutionCache.get(url)   // null or {w,h}
}

/** Pixel count (area) used to rank images by quality. Unprobed = 0. */
function pixelArea(url) {
    const r = _resolutionCache.get(url)
    return r ? r.w * r.h : 0
}

// ─── API fetchers ─────────────────────────────────────────────────────────────
const IMAGE_FETCHERS = {
    anime: async () => {
        const pic = item => { const n = item?.node || item; return n?.poster || n?.image || n?.main_picture?.large }
        const [home, browse] = await Promise.all([
            lifesyncFetch('/api/v1/anime/home').catch(() => null),
            lifesyncFetch(`/api/v1/anime/browse?limit=30&page=${randomPage(4)}`).catch(() => null),
        ])
        return [
            ...(Array.isArray(home?.featured) ? home.featured : []),
            ...(Array.isArray(home?.trending) ? home.trending : []),
            ...(Array.isArray(browse?.data) ? browse.data : []),
        ].map(pic)
    },
    manga: async () => {
        const qs = new URLSearchParams({ page: String(randomPage(5)), limit: '25', folder: 'hot', view: 'standard' })
        qs.set('order[chapter_updated_at]', 'desc')
        const data = await lifesyncFetch(`/api/v1/manga/roliascan/browser?${qs.toString()}`).catch(() => null)
        return (Array.isArray(data?.data) ? data.data : []).map(m => m?.coverUrl || m?.cover)
    },
    hmanhwa: async () => {
        const section = Math.random() < 0.5 ? 'uncensored' : 'latest'
        const data = await lifesyncFetch(`/api/v1/manga/mangadistrict/latest/${randomPage(6)}?section=${section}&view=standard`).catch(() => null)
        const rows = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
        return rows.map(m => m?.coverUrl || m?.cover || m?.thumbnail)
    },
    mangadna: async () => {
        const data = await lifesyncFetch(`/api/v1/manga/mangadna/latest/${randomPage(5)}?view=standard`).catch(() => null)
        const rows = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
        return rows.map(m => m?.coverUrl || m?.cover || m?.thumbnail)
    },
    hentai: async () => {
        const data = await lifesyncFetch('/api/v1/hentai/watchhentai/home').catch(() => null)
        const series = Array.isArray(data?.series) ? data.series : (Array.isArray(data?.items) ? data.items : [])
        return series.map(s => s?.posterUrl)
    },
    history: async () => {
        const [animeData, mangaData] = await Promise.all([
            lifesyncFetch('/api/v1/anime/watch-history?limit=30&view=standard').catch(() => null),
            lifesyncFetch('/api/v1/progress?limit=30&sortBy=updatedAt&order=desc').catch(() => null),
        ])
        return [
            ...(Array.isArray(animeData?.entries) ? animeData.entries : []).map(e => e?.imageUrl || e?.posterUrl),
            ...(Array.isArray(mangaData?.items) ? mangaData.items : (Array.isArray(mangaData) ? mangaData : [])).map(e => e?.coverUrl || e?.cover),
        ]
    },
}

// ─── localStorage cache ───────────────────────────────────────────────────────
function readCache() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
        if (!parsed || typeof parsed.savedAt !== 'number' || typeof parsed.images !== 'object') return null
        return parsed
    } catch { return null }
}

function writeCache(cache) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cache)) } catch { /* quota */ }
}

// ─── hook ─────────────────────────────────────────────────────────────────────
/**
 * Returns image pools keyed by tabId. Loads once per TV session (module-level
 * cache), persists to localStorage across sessions (6 h TTL), and merges live
 * history images that come from the user's own hooks.
 */
export function useTVHomeImages(tabIds, historyImages = []) {
    // Snapshot from module store + localStorage on first render
    const [sessionSnapshot, setSessionSnapshot] = useState(() => {
        const lsImages = readCache()?.images || {}
        const result = { ...FALLBACK_TV_HOME_IMAGES, ...lsImages }
        _sessionImages.forEach((urls, id) => { result[id] = urls })
        return result
    })

    // Guard against running concurrent fetches for the same tab
    const fetchingRef = useRef(new Set())

    useEffect(() => {
        const lsCache = readCache()
        const lsFresh = lsCache && (Date.now() - lsCache.savedAt < REFRESH_INTERVAL_MS)

        const toFetch = tabIds.filter(id => {
            if (_sessionImages.has(id)) return false          // already in session
            if (fetchingRef.current.has(id)) return false     // in-flight
            if (lsFresh && lsCache.images?.[id]?.length >= MIN_USABLE_POOL) {
                // localStorage is fresh — promote to session store and skip fetch
                _sessionImages.set(id, lsCache.images[id])
                return false
            }
            return IMAGE_FETCHERS[id] != null
        })

        if (!toFetch.length) return

        toFetch.forEach(id => fetchingRef.current.add(id))
        let cancelled = false

        ;(async () => {
            const next = {}
            await Promise.all(toFetch.map(async (id) => {
                try {
                    const urls = dedupeUrls(await IMAGE_FETCHERS[id]())
                    if (urls.length >= MIN_USABLE_POOL) {
                        const pool = shuffle(urls).slice(0, MAX_IMAGES_PER_TAB)
                        next[id] = pool
                        _sessionImages.set(id, pool)
                    }
                } catch { /* keep fallback */ }
                fetchingRef.current.delete(id)
            }))

            if (cancelled || !Object.keys(next).length) return

            // Persist to localStorage
            const merged = { ...(readCache()?.images || {}), ...next }
            writeCache({ savedAt: Date.now(), images: merged })

            setSessionSnapshot(prev => ({ ...prev, ...next }))
        })()

        return () => { cancelled = true }
    // tabIds identity is stable (useMemo in caller); this only re-runs if the array reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabIds])

    // Merge live history without caching
    return useMemo(() => {
        if (!historyImages.length) return sessionSnapshot
        const live = dedupeUrls(historyImages)
        if (!live.length) return sessionSnapshot
        const existing = sessionSnapshot.history || []
        return { ...sessionSnapshot, history: dedupeUrls([...live, ...existing]).slice(0, MAX_IMAGES_PER_TAB) }
    }, [sessionSnapshot, historyImages])
}

// ─── collage image selection ──────────────────────────────────────────────────

/**
 * Seeded shuffle — same seed + same pool → same order every render.
 * Returns exactly `count` items, cycling if the pool is smaller.
 */
export function pickCollageImages(images, tabId, seed, count = 12) {
    const pool = images?.[tabId]?.length ? images[tabId] : (FALLBACK_TV_HOME_IMAGES[tabId] || [])
    if (!pool.length) return []
    const seedStr = `${tabId}:${seed}`
    let h = 2166136261
    for (let i = 0; i < seedStr.length; i++) h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619)
    const arr = [...pool]
    for (let i = arr.length - 1; i > 0; i--) {
        h = Math.imul(h ^ i, 2246822519)
        const j = (h >>> 0) % (i + 1)
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    const result = []
    for (let i = 0; i < count; i++) result.push(arr[i % arr.length])
    return result
}

/**
 * Reorder `urls` so that the highest-resolution images land in the largest
 * grid slots defined by `slotSizes`.
 *
 * • `slotSizes` is a parallel array of 'large'|'medium'|'small', one per cell.
 * • Null/undefined entries in `urls` are treated as area=0 and fall into the
 *   smallest available slots, never into large ones.
 * • The returned array is always the same length as `slotSizes` with no nulls:
 *   if `urls` has fewer real items than slots they are cycled to fill every cell.
 */
export function assignImagesByResolution(urls, slotSizes) {
    const real = urls.filter(Boolean)
    if (!real.length) return slotSizes.map((_, i) => urls[i % Math.max(urls.length, 1)] ?? null)

    const count = slotSizes.length
    // Cycle real URLs to guarantee no gaps
    const filled = Array.from({ length: count }, (_, i) => real[i % real.length])

    const RANK = { large: 0, medium: 1, small: 2 }
    // Slots ordered largest → smallest
    const slotOrder = slotSizes
        .map((size, idx) => ({ size, idx }))
        .sort((a, b) => RANK[a.size] - RANK[b.size])

    // Images ordered highest-res → lowest-res
    // Deduplicate so the same URL doesn't end up ranked twice
    const unique = [...new Set(filled)]
    const imageOrder = unique.sort((a, b) => pixelArea(b) - pixelArea(a))

    // Assign best image to biggest slot; cycle if we run out of unique images
    const result = Array(count)
    slotOrder.forEach(({ idx }, rank) => {
        result[idx] = imageOrder[rank % imageOrder.length]
    })
    return result
}

/** Single-image pick (kept for backward compat). */
export function pickTVHomeImage(images, tabId, seedValue) {
    return pickCollageImages(images, tabId, seedValue, 1)[0] ?? null
}
