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
 * @param {'steam'|'mal'|'animeschedule'} provider
 * @returns {string|null} URL or null if not logged in to LifeSync
 */
export function lifesyncOAuthStartUrl(provider) {
    const token = getLifesyncToken()
    if (!token) return null
    const base = getLifesyncApiBase()
    return `${base}/api/oauth/${provider}/start?access_token=${encodeURIComponent(token)}`
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

    const res = await fetch(`${base}${path}`, {
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
    return lifesyncFetch('/api/auth/plugins', { method: 'POST', json: body })
}

export function lifesyncPatchPreferences(body) {
    return lifesyncFetch('/api/auth/preferences', { method: 'PATCH', json: body })
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

/** Matches LifeSyncHentai: plugin on and NSFW preference on. */
export function isLifeSyncHentaiHubVisible(prefs) {
    return isPluginEnabled(prefs, 'pluginHentaiEnabled') && Boolean(prefs?.nsfwContentEnabled)
}

/** Any anime hub destination (sidebar / hub tiles) should appear. */
export function isLifeSyncAnimeNavVisible(prefs) {
    return (
        isPluginEnabled(prefs, 'pluginAnimeEnabled') ||
        isPluginEnabled(prefs, 'pluginMangaEnabled') ||
        isLifeSyncHentaiHubVisible(prefs)
    )
}
