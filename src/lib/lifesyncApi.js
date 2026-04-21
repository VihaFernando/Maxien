/**
 * LifeSync backend API (JWT session). See API-AUTH.md / API-PLUGINS.md.
 * Independent of Supabase; token stored as `lifesync_token`.
 */

export const LIFESYNC_TOKEN_KEY = 'lifesync_token'

/** [AniPub API reference](https://api.anipub.xyz/) — LifeSync anime streaming uses this ecosystem (JSON typically from `https://anipub.xyz`, configurable on the server). */
export const ANIPUB_API_REFERENCE_URL = 'https://api.anipub.xyz/'

export function getLifesyncApiBase() {
    const raw = import.meta.env.VITE_API_URL
    if (raw != null && String(raw).trim() !== '') {
        return String(raw).replace(/\/$/, '')
    }
    // Dev without VITE_API_URL: same-origin `/api/*` → Vite proxy (see vite.config.js, VITE_DEV_PROXY_TARGET)
    if (import.meta.env.DEV) {
        return ''
    }
    // Production build without VITE_API_URL: match server default PORT (see server/src/config/env.js)
    return 'http://localhost:5000'
}

function remapToV1Path(path) {
    if (typeof path !== 'string' || !path.startsWith('/api/')) return path

    const qIndex = path.indexOf('?')
    const pathname = qIndex >= 0 ? path.slice(0, qIndex) : path
    const suffix = qIndex >= 0 ? path.slice(qIndex) : ''

    // Auth (implemented v1 endpoints only)
    if (
        pathname === '/api/auth/register' ||
        pathname === '/api/auth/login' ||
        pathname === '/api/auth/login-with-supabase' ||
        pathname === '/api/auth/me' ||
        pathname === '/api/auth/plugins' ||
        pathname === '/api/auth/preferences'
    ) {
        return pathname.replace('/api/auth', '/api/v1/auth') + suffix
    }

    // Anime stream + hentai ocean
    if (pathname.startsWith('/api/anime/stream/')) {
        return pathname.replace('/api/anime', '/api/v1/anime') + suffix
    }
    if (pathname === '/api/anime/search') {
        return pathname.replace('/api/anime', '/api/v1/anime') + suffix
    }
    if (pathname.startsWith('/api/anime/details/')) {
        return pathname.replace('/api/anime', '/api/v1/anime') + suffix
    }
    if (pathname.startsWith('/api/anime/ranking')) {
        return pathname.replace('/api/anime', '/api/v1/anime') + suffix
    }
    if (pathname.startsWith('/api/anime/seasonal')) {
        return pathname.replace('/api/anime', '/api/v1/anime') + suffix
    }
    if (pathname.startsWith('/api/anime/mylist')) {
        return pathname.replace('/api/anime', '/api/v1/anime') + suffix
    }
    if (pathname.startsWith('/api/anime/mal-episode-thumbnails/')) {
        return pathname.replace('/api/anime', '/api/v1/anime') + suffix
    }
    if (pathname === '/api/anime/link') {
        return '/api/v1/anime/link' + suffix
    }
    if (pathname.startsWith('/api/anime/watch-progress')) {
        return pathname.replace('/api/anime', '/api/v1/anime') + suffix
    }
    if (pathname.startsWith('/api/anime/watch-history')) {
        return pathname.replace('/api/anime', '/api/v1/anime') + suffix
    }
    if (pathname.startsWith('/api/anime/calendar/')) {
        return pathname.replace('/api/anime', '/api/v1/anime') + suffix
    }
    if (pathname.startsWith('/api/anime/hentai-ocean/')) {
        return pathname.replace('/api/anime/hentai-ocean', '/api/v1/hentai/ocean') + suffix
    }

    // Manga
    if (pathname.startsWith('/api/manga/mangadex/')) {
        return pathname.replace('/api/manga', '/api/v1/manga') + suffix
    }
    if (pathname.startsWith('/api/manga/mangadistrict/')) {
        return pathname.replace('/api/manga', '/api/v1/manga') + suffix
    }
    if (
        pathname.startsWith('/api/manga/tags') ||
        pathname.startsWith('/api/manga/search') ||
        pathname.startsWith('/api/manga/popular') ||
        pathname.startsWith('/api/manga/recent') ||
        pathname.startsWith('/api/manga/details/') ||
        pathname.startsWith('/api/manga/chapters/') ||
        pathname.startsWith('/api/manga/pages/') ||
        pathname.startsWith('/api/manga/statistics/')
    ) {
        return pathname.replace('/api/manga', '/api/v1/manga') + suffix
    }
    if (pathname.startsWith('/api/manga/reading')) {
        return pathname.replace('/api/manga', '/api/v1/manga') + suffix
    }

    // Xbox OpenXBL
    if (pathname.startsWith('/api/xbox/openxbl/')) {
        return pathname.replace('/api/xbox/openxbl', '/api/v1/xbox/openxbl') + suffix
    }

    // Steam v1 routes
    if (
        pathname === '/api/steam/status' ||
        pathname === '/api/steam/store' ||
        pathname === '/api/steam/news' ||
        pathname === '/api/steam/link'
    ) {
        return pathname.replace('/api/steam', '/api/v1/steam') + suffix
    }

    // GameRant v1 routes
    if (
        pathname === '/api/gamerant/gaming-news' ||
        pathname.startsWith('/api/gamerant/gaming-news/')
    ) {
        return pathname.replace('/api/gamerant', '/api/v1/gamerant') + suffix
    }

    // CheapShark v1 routes
    if (
        pathname === '/api/cheapshark/stores' ||
        pathname === '/api/cheapshark/deals'
    ) {
        return pathname.replace('/api/cheapshark', '/api/v1/cheapshark') + suffix
    }

    // GameSearch v1 routes
    if (pathname.startsWith('/api/gamesearch/')) {
        return pathname.replace('/api/gamesearch', '/api/v1/gamesearch') + suffix
    }

    // Wishlist v1 routes
    if (
        pathname === '/api/wishlist' ||
        pathname.startsWith('/api/wishlist/')
    ) {
        return pathname.replace('/api/wishlist', '/api/v1/wishlist') + suffix
    }

    return path
}

export function getLifesyncToken() {
    try {
        return localStorage.getItem(LIFESYNC_TOKEN_KEY)
    } catch {
        return null
    }
}

export function setLifesyncToken(token) {
    try {
        if (token) localStorage.setItem(LIFESYNC_TOKEN_KEY, token)
        else localStorage.removeItem(LIFESYNC_TOKEN_KEY)
    } catch {
        // ignore storage failures
    }
}

/**
 * @param {'mal'|'animeschedule'} provider
 * @returns {string|null} URL or null if not logged in to LifeSync
 */
export function lifesyncOAuthStartUrl(provider) {
    const token = getLifesyncToken()
    if (!token) return null
    const base = getLifesyncApiBase()
    return `${base}/api/v1/oauth/${provider}/start?access_token=${encodeURIComponent(token)}`
}

async function parseResponse(res) {
    const text = await res.text()
    if (!text) return null
    try {
        return JSON.parse(text)
    } catch {
        return text
    }
}

/**
 * @param {string} path - e.g. `/api/auth/me`
 * @param {RequestInit & { json?: object, token?: string|null, skipAuth?: boolean }} options
 */
export async function lifesyncFetch(path, options = {}) {
    const { json, token, skipAuth, headers: initHeaders, ...rest } = options
    const base = getLifesyncApiBase()
    const headers = new Headers(initHeaders)

    if (json !== undefined) {
        headers.set('Content-Type', 'application/json')
    }

    if (!skipAuth) {
        const t = token !== undefined ? token : getLifesyncToken()
        if (t) headers.set('Authorization', `Bearer ${t}`)
    }

    const apiPath = remapToV1Path(path)

    const res = await fetch(`${base}${apiPath}`, {
        ...rest,
        headers,
        body: json !== undefined ? JSON.stringify(json) : rest.body,
    })

    const data = await parseResponse(res)

    if (!res.ok) {
        const msg =
            (data && typeof data === 'object' && data.error && String(data.error)) ||
            (Array.isArray(data?.errors) && data.errors.map((e) => e?.msg || e?.message).filter(Boolean).join(', ')) ||
            res.statusText ||
            'Request failed'
        const err = new Error(msg)
        err.status = res.status
        err.body = data
        throw err
    }

    return data
}

export function lifesyncLogin(email, password) {
    return lifesyncFetch('/api/auth/login', {
        method: 'POST',
        skipAuth: true,
        json: { email, password },
    })
}

/** Server verifies the Supabase access token and returns a LifeSync JWT (creates user if needed). */
export function lifesyncLoginWithSupabase(accessToken) {
    return lifesyncFetch('/api/auth/login-with-supabase', {
        method: 'POST',
        skipAuth: true,
        json: { accessToken },
    })
}

export function lifesyncRegister({ email, password, name }) {
    return lifesyncFetch('/api/auth/register', {
        method: 'POST',
        skipAuth: true,
        json: { email, password, ...(name != null && name !== '' ? { name } : {}) },
    })
}

export function lifesyncGetMe() {
    return lifesyncFetch('/api/auth/me', { method: 'GET' })
}

export function lifesyncPostPlugins(body) {
    return lifesyncFetch('/api/v1/auth/plugins', { method: 'POST', json: body })
}

export function lifesyncPatchPreferences(body) {
    return lifesyncFetch('/api/v1/auth/preferences', { method: 'PATCH', json: body })
}

/** @param {Record<string, unknown>|null|undefined} prefs */
export function getAnimeStreamAudio(prefs) {
    return prefs?.animeStreamAudio === 'dub' ? 'dub' : 'sub'
}

/** API default: missing preference = enabled */
export function isPluginEnabled(prefs, key) {
    if (!prefs || prefs[key] === undefined) return true
    return Boolean(prefs[key])
}

/**
 * v1 startup bundle (client-side fan-out).
 * Keeps old call-sites compatible without relying on removed `/api/batch/*` routes.
 */
export function lifesyncBatchUserStartup() {
    return Promise.allSettled([
        lifesyncFetch('/api/v1/auth/me', { method: 'GET' }),
        lifesyncFetch('/api/v1/steam/status?view=compact', { method: 'GET' }),
        lifesyncFetch('/api/v1/manga/mangadex/auth/status?view=compact', { method: 'GET' }),
        lifesyncFetch('/api/v1/xbox/openxbl/status?view=compact', { method: 'GET' }),
    ]).then(([me, steam, mangadex, xbox]) => ({
        user: me.status === 'fulfilled' ? me.value : null,
        integrations: {
            steam: steam.status === 'fulfilled' ? steam.value : null,
            mangadex: mangadex.status === 'fulfilled' ? mangadex.value : null,
            xbox: xbox.status === 'fulfilled' ? xbox.value : null,
        },
    }))
}

/** Matches LifeSyncHentai: plugin on and NSFW preference on. */
export function isLifeSyncHentaiHubVisible(prefs) {
    return isPluginEnabled(prefs, 'pluginHentaiEnabled') && Boolean(prefs?.nsfwContentEnabled)
}

/** H manhwa visibility inside anime/manga hubs requires NSFW + plugin enabled. */
export function isLifeSyncHManhwaVisible(prefs) {
    return isPluginEnabled(prefs, 'pluginHManhwaEnabled') && Boolean(prefs?.nsfwContentEnabled)
}

/** Crack games plugin controls crack search/status lanes. */
export function isLifeSyncCrackGamesVisible(prefs) {
    return isPluginEnabled(prefs, 'pluginCrackGamesEnabled')
}

/** Any anime hub destination (sidebar / hub tiles) should appear. */
export function isLifeSyncAnimeNavVisible(prefs) {
    return (
        isPluginEnabled(prefs, 'pluginAnimeEnabled') ||
        isPluginEnabled(prefs, 'pluginMangaEnabled') ||
        isLifeSyncHManhwaVisible(prefs) ||
        isLifeSyncHentaiHubVisible(prefs)
    )
}
