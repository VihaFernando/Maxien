function asObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return value
}

function asArray(value) {
    return Array.isArray(value) ? value : []
}

export function isGameStatusUrl(url) {
    const raw = String(url || '').trim().toLowerCase()
    return raw.includes('://gamestatus.info/') || raw.includes('://www.gamestatus.info/')
}

export function isGameStatusLink(link) {
    const source = String(link?.source || '').trim().toLowerCase()
    return source === 'gamestatus' || isGameStatusUrl(link?.url)
}

function pushStoreLink(stores, row) {
    if (!row || typeof row !== 'object') return

    const url = String(row.url || '').trim()
    if (!url || isGameStatusUrl(url)) return

    const source = String(row.source || 'store').trim().toLowerCase()
    const name = String(row.name || row.title || source || 'Store').trim()
    if (!name) return

    const dedupeKey = `${source}:${url.toLowerCase()}`
    const exists = stores.some((s) => `${String(s.source || '').toLowerCase()}:${String(s.url || '').toLowerCase()}` === dedupeKey)
    if (exists) return

    stores.push({ source, name, url })
}

export function normalizeDirectStoreLinks(links, extras = []) {
    const stores = []
    asArray(links).forEach((row) => {
        if (isGameStatusLink(row)) return
        pushStoreLink(stores, row)
    })
    asArray(extras).forEach((row) => {
        pushStoreLink(stores, row)
    })
    return stores
}

export function buildGameDetailsFromSearchPayload(payload, { fallbackTitle = '' } = {}) {
    const body = asObject(payload)
    const game = asObject(body.game)
    const metadata = asObject(body.metadata)
    const steam = asObject(metadata.steam)
    const rawg = asObject(metadata.rawg)
    const gamestatus = asObject(metadata.gamestatus)

    const steamUrl = steam.steam_url || (game.steam_appid ? `https://store.steampowered.com/app/${game.steam_appid}/` : '')

    const stores = normalizeDirectStoreLinks(body.links, [
        steamUrl ? { source: 'steam', name: 'Steam Store', url: steamUrl } : null,
        steam.website ? { source: 'official', name: 'Official Website', url: steam.website } : null,
        rawg.rawg_url ? { source: 'rawg', name: 'RAWG', url: rawg.rawg_url } : null,
    ])

    return {
        title:
            game.name ||
            gamestatus.title ||
            steam.name ||
            rawg.name ||
            String(fallbackTitle || '').trim() ||
            'Unknown title',
        releaseDate: game.release_date || gamestatus.release_date || rawg.released || null,
        statusKey: gamestatus.status_key || null,
        statusText: gamestatus.status_text || null,
        description:
            steam.short_description ||
            rawg.description ||
            gamestatus.status_text ||
            '',
        heroImage:
            steam.header_image ||
            gamestatus.full_image ||
            gamestatus.image ||
            null,
        bannerImage:
            gamestatus.full_image ||
            steam.header_image ||
            gamestatus.image ||
            null,
        developers: asArray(steam.developers),
        publishers: asArray(steam.publishers),
        genres: asArray(steam.genres),
        protection: gamestatus.protection || null,
        group: gamestatus.group || null,
        crackDate: gamestatus.crack_date || null,
        crackedInDays: gamestatus.cracked_in_days ?? null,
        stores,
    }
}
