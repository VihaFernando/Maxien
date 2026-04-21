export const DEFAULT_GAMES_BACKGROUND_MODE = 'none'
export const DEFAULT_ANIME_BACKGROUND_MODE = 'none'
export const DEFAULT_BACKGROUND_POSITION = 50

export const GAMES_BACKGROUND_MODES = Object.freeze([
    'none',
    'steam',
    'stock_image',
    'stock_video',
    'custom_image',
    'custom_video',
])

export const ANIME_BACKGROUND_MODES = Object.freeze([
    'none',
    'stock_image',
    'stock_video',
    'custom_image',
    'custom_video',
])

export const GAMES_STOCK_IMAGE_POOL = Object.freeze([
    'https://cdn.akamai.steamstatic.com/steam/apps/1245620/library_hero.jpg',
    'https://cdn.akamai.steamstatic.com/steam/apps/1091500/library_hero.jpg',
    'https://cdn.akamai.steamstatic.com/steam/apps/1174180/library_hero.jpg',
    'https://cdn.akamai.steamstatic.com/steam/apps/1888930/library_hero.jpg',
    'https://cdn.akamai.steamstatic.com/steam/apps/271590/library_hero.jpg',
])

export const ANIME_STOCK_IMAGE_POOL = Object.freeze([
    'https://cdn.myanimelist.net/images/anime/1286/99889.jpg',
    'https://cdn.myanimelist.net/images/anime/1000/110531.jpg',
    'https://cdn.myanimelist.net/images/anime/10/78745.jpg',
    'https://cdn.myanimelist.net/images/anime/1171/109222.jpg',
    'https://cdn.myanimelist.net/images/anime/1223/96541.jpg',
])

export const GAMES_STOCK_VIDEO_POOL = Object.freeze([
    {
        mp4: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        webm: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm',
        poster: 'https://cdn.akamai.steamstatic.com/steam/apps/1245620/library_hero.jpg',
    },
    {
        mp4: 'https://www.w3schools.com/html/mov_bbb.mp4',
        webm: '',
        poster: 'https://cdn.akamai.steamstatic.com/steam/apps/1091500/library_hero.jpg',
    },
])

export const ANIME_STOCK_VIDEO_POOL = Object.freeze([
    {
        mp4: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        webm: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm',
        poster: 'https://cdn.myanimelist.net/images/anime/1286/99889.jpg',
    },
    {
        mp4: 'https://www.w3schools.com/html/mov_bbb.mp4',
        webm: '',
        poster: 'https://cdn.myanimelist.net/images/anime/1000/110531.jpg',
    },
])

export function sanitizeBackgroundUrl(value) {
    const raw = String(value || '').trim()
    if (!raw) return ''
    if (!/^https?:\/\//i.test(raw)) return ''
    return raw.slice(0, 2000)
}

export function normalizeBackgroundPosition(value, fallback = DEFAULT_BACKGROUND_POSITION) {
    const num = Number(value)
    if (!Number.isFinite(num)) return fallback
    if (num < 0) return 0
    if (num > 100) return 100
    return Math.round(num * 100) / 100
}

function normalizeYoutubeId(rawId) {
    const id = String(rawId || '').trim()
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : ''
}

export function extractYouTubeVideoId(value) {
    const raw = sanitizeBackgroundUrl(value)
    if (!raw) return ''

    try {
        const url = new URL(raw)
        const host = url.hostname.toLowerCase()
        const path = url.pathname

        if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
            const id = path.split('/').filter(Boolean)[0]
            return normalizeYoutubeId(id)
        }

        if (
            host === 'youtube.com' ||
            host === 'www.youtube.com' ||
            host === 'm.youtube.com' ||
            host.endsWith('.youtube.com')
        ) {
            if (path === '/watch') {
                return normalizeYoutubeId(url.searchParams.get('v'))
            }
            if (path.startsWith('/shorts/')) {
                return normalizeYoutubeId(path.split('/')[2])
            }
            if (path.startsWith('/embed/')) {
                return normalizeYoutubeId(path.split('/')[2])
            }
        }
    } catch {
        return ''
    }

    return ''
}

export function buildYouTubeBackgroundEmbedUrl(videoId) {
    const id = normalizeYoutubeId(videoId)
    if (!id) return ''
    const params = new URLSearchParams({
        autoplay: '1',
        mute: '1',
        controls: '0',
        loop: '1',
        playlist: id,
        rel: '0',
        modestbranding: '1',
        fs: '0',
        showinfo: '0',
        playsinline: '1',
        iv_load_policy: '3',
        disablekb: '1',
    })
    return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`
}

export function resolveBackgroundVideoSource(value) {
    const cleaned = sanitizeBackgroundUrl(value)
    if (!cleaned) return null

    const ytId = extractYouTubeVideoId(cleaned)
    if (ytId) {
        return {
            kind: 'youtube',
            videoWebmUrl: '',
            videoMp4Url: '',
            embedUrl: buildYouTubeBackgroundEmbedUrl(ytId),
            posterUrl: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
            youtubeId: ytId,
        }
    }

    if (/\.webm($|\?)/i.test(cleaned)) {
        return {
            kind: 'video',
            videoWebmUrl: cleaned,
            videoMp4Url: '',
            embedUrl: '',
            posterUrl: '',
            youtubeId: '',
        }
    }

    return {
        kind: 'video',
        videoWebmUrl: '',
        videoMp4Url: cleaned,
        embedUrl: '',
        posterUrl: '',
        youtubeId: '',
    }
}

export function normalizeGamesBackgroundMode(value, legacySteamEnabled = false) {
    const raw = String(value || '').trim().toLowerCase()
    if (GAMES_BACKGROUND_MODES.includes(raw)) return raw
    return legacySteamEnabled ? 'steam' : DEFAULT_GAMES_BACKGROUND_MODE
}

export function normalizeAnimeBackgroundMode(value) {
    const raw = String(value || '').trim().toLowerCase()
    if (ANIME_BACKGROUND_MODES.includes(raw)) return raw
    return DEFAULT_ANIME_BACKGROUND_MODE
}

function hashSeed(seed) {
    const str = String(seed || 'maxien')
    let hash = 2166136261
    for (let i = 0; i < str.length; i += 1) {
        hash ^= str.charCodeAt(i)
        hash = Math.imul(hash, 16777619)
    }
    return hash >>> 0
}

export function pickDeterministicFromPool(pool, seed) {
    if (!Array.isArray(pool) || pool.length === 0) return null
    const idx = hashSeed(seed) % pool.length
    return pool[idx] || null
}
