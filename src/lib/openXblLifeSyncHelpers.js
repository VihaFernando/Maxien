/**
 * OpenXBL response helpers for LifeSync Xbox (aligned with client OpenXblCatalogSection / openXblClientCache).
 */

export function extractTitleHistoryItems(data) {
    if (!data || typeof data !== 'object') return []
    const c = data.content
    if (c && typeof c === 'object') {
        if (Array.isArray(c.titles)) return c.titles
        if (Array.isArray(c.titleHistory)) return c.titleHistory
    }
    if (Array.isArray(data.titles)) return data.titles
    if (Array.isArray(data.titleHistory)) return data.titleHistory
    return []
}

export function pickLastPlayedIso(item) {
    if (!item || typeof item !== 'object') return null
    const raw =
        item.titleHistory?.lastTimePlayed ??
        item.titleHistory?.lastPlayed ??
        item.lastTimePlayed ??
        item.lastPlayed ??
        item.lastPlayedDate ??
        item.history?.lastTimePlayed ??
        null
    if (raw == null) return null
    const s = String(raw).trim()
    return s || null
}

export function lastPlayedAtMs(item) {
    const iso = pickLastPlayedIso(item)
    if (!iso) return 0
    const ts = Date.parse(iso)
    return Number.isFinite(ts) ? ts : 0
}

export function formatLastPlayedLabel(iso) {
    if (!iso) return null
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Minutes played from title-history row (best-effort; varies by API). */
export function pickMinutesPlayedFromRow(item) {
    if (!item || typeof item !== 'object') return null
    const candidates = [
        item.minutesPlayed,
        item.MinutesPlayed,
        item.totalMinutesPlayed,
        item.timePlayedMinutes,
        item.titleHistory?.minutesPlayed,
        item.titleHistory?.totalMinutesPlayed,
        item.stats?.minutesPlayed,
        item.aggregateTimePlayed,
        item.achievement?.totalTimePlayed,
    ]
    for (const c of candidates) {
        const n = Number(c)
        if (Number.isFinite(n) && n >= 0) return n
    }
    return null
}

export function formatPlaytimeHours(minutes) {
    if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null
    const h = minutes / 60
    if (h < 1) return '<1h played'
    if (h < 10) return `${h.toFixed(1)}h played`
    return `${Math.round(h)}h played`
}

function pickNonNegInt(...candidates) {
    for (const v of candidates) {
        if (v == null) continue
        const n =
            typeof v === 'string' && /^\d+$/.test(v.trim()) ? parseInt(v.trim(), 10) : Number(v)
        if (Number.isFinite(n) && n >= 0) return Math.floor(n)
    }
    return null
}

function pickPercentage(...candidates) {
    for (const v of candidates) {
        if (v == null) continue
        const n = Number(v)
        if (Number.isFinite(n) && n >= 0 && n <= 100) return n
    }
    return null
}

/** Normalize string or `{ uri, url }` image fields from Xbox / OpenXBL payloads. */
export function strOpenXblImageUrl(v) {
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (v && typeof v === 'object') {
        const u = v.uri ?? v.Uri ?? v.url ?? v.Url ?? v.URL
        if (typeof u === 'string' && u.trim()) return u.trim()
    }
    return null
}

/**
 * Prefer portrait-friendly key art (branded / tile) over wide banner `displayImage`.
 * @param {object|null|undefined} historyRow - title history row
 * @param {object|null|undefined} v3Title - optional row from `/v3/achievements/player/{xuid}`
 */
export function pickLibraryTitleCoverImage(historyRow, v3Title) {
    const portraitKeys = [
        'brandedKeyArt',
        'BrandedKeyArt',
        'posterImage',
        'PosterImage',
        'titleImage',
        'TitleImage',
        'tileImage',
        'TileImage',
        'modernTileImage',
        'ModernTileImage',
        'squareImage',
        'SquareImage',
    ]
    const wideKeys = ['displayImage', 'DisplayImage', 'image', 'Image', 'backgroundImage', 'BackgroundImage']

    const tryObj = (obj) => {
        if (!obj || typeof obj !== 'object') return null
        for (const k of portraitKeys) {
            const s = strOpenXblImageUrl(obj[k])
            if (s) return s
        }
        for (const k of wideKeys) {
            const s = strOpenXblImageUrl(obj[k])
            if (s) return s
        }
        const art = obj.art && typeof obj.art === 'object' ? obj.art : null
        if (art) {
            const s = strOpenXblImageUrl(art.backgroundImageUri ?? art.BackgroundImageUri)
            if (s) return s
        }
        return null
    }

    return (
        tryObj(v3Title) ||
        tryObj(v3Title?.title) ||
        tryObj(historyRow) ||
        tryObj(historyRow?.title) ||
        null
    )
}

/**
 * Achievement counters from a title-history or v3 achievements title row (handles `stats`, PascalCase).
 * @returns {{ earned: number|null, total: number|null, gsE: number|null, gsT: number|null, pct: number|null }|null}
 */
export function extractAchievementCounts(item) {
    if (!item || typeof item !== 'object') return null
    const ach = item.achievement && typeof item.achievement === 'object' ? item.achievement : null
    const stats = item.stats && typeof item.stats === 'object' ? item.stats : null
    const prog = item.progress && typeof item.progress === 'object' ? item.progress : null
    const detail = item.detail && typeof item.detail === 'object' ? item.detail : null
    const dAch = detail?.achievement && typeof detail.achievement === 'object' ? detail.achievement : null

    const earned = pickNonNegInt(
        item.achievementsUnlocked,
        item.earnedAchievements,
        item.currentAchievements,
        item.currentachievements,
        item.AchievementsUnlocked,
        item.CurrentAchievements,
        ach?.currentAchievements,
        ach?.CurrentAchievements,
        stats?.currentAchievements,
        stats?.CurrentAchievements,
        stats?.achievementsUnlocked,
        stats?.AchievementsUnlocked,
        prog?.currentAchievements,
        prog?.CurrentAchievements,
        dAch?.currentAchievements,
        dAch?.CurrentAchievements,
    )

    const total = pickNonNegInt(
        item.totalAchievements,
        item.maxAchievements,
        item.totalachievements,
        item.TotalAchievements,
        item.MaxAchievements,
        ach?.totalAchievements,
        ach?.TotalAchievements,
        ach?.maxAchievements,
        ach?.MaxAchievements,
        stats?.totalAchievements,
        stats?.TotalAchievements,
        stats?.maxAchievements,
        stats?.MaxAchievements,
        stats?.achievementsTotal,
        stats?.AchievementsTotal,
        prog?.totalAchievements,
        prog?.TotalAchievements,
        dAch?.totalAchievements,
        dAch?.TotalAchievements,
    )

    const gsE = pickNonNegInt(
        item.currentGamerscore,
        item.currentgamerscore,
        item.CurrentGamerscore,
        ach?.currentGamerscore,
        ach?.CurrentGamerscore,
        stats?.currentGamerscore,
        stats?.CurrentGamerscore,
    )

    const gsT = pickNonNegInt(
        item.totalGamerscore,
        item.totalgamerscore,
        item.maxGamerscore,
        item.TotalGamerscore,
        item.MaxGamerscore,
        ach?.totalGamerscore,
        ach?.TotalGamerscore,
        ach?.maxGamerscore,
        ach?.MaxGamerscore,
        stats?.totalGamerscore,
        stats?.TotalGamerscore,
    )

    const pct = pickPercentage(
        item.progressPercentage,
        ach?.progressPercentage,
        ach?.ProgressPercentage,
        stats?.progressPercentage,
        stats?.ProgressPercentage,
    )

    if (earned == null && total == null && gsE == null && gsT == null && pct == null) return null

    return { earned, total, gsE, gsT, pct }
}

export function mergeAchievementCounts(a, b) {
    const A = a || { earned: null, total: null, gsE: null, gsT: null, pct: null }
    const B = b || { earned: null, total: null, gsE: null, gsT: null, pct: null }
    const pickTotal = (x, y) => {
        const xt = x?.total
        const yt = y?.total
        if (xt != null && xt > 0) return xt
        if (yt != null && yt > 0) return yt
        return xt ?? yt ?? null
    }
    const pickGsT = (x, y) => {
        const xt = x?.gsT
        const yt = y?.gsT
        if (xt != null && xt > 0) return xt
        if (yt != null && yt > 0) return yt
        return xt ?? yt ?? null
    }
    let total = pickTotal(A, B)
    const earned = A.earned ?? B.earned ?? null
    if ((total == null || total === 0) && typeof earned === 'number' && earned > 0) {
        const p = A.pct ?? B.pct
        if (typeof p === 'number' && p > 0 && p <= 100) {
            total = Math.max(1, Math.round(earned / (p / 100)))
        }
    }
    return {
        earned,
        total,
        gsE: A.gsE ?? B.gsE ?? null,
        gsT: pickGsT(A, B),
        pct: A.pct ?? B.pct ?? null,
    }
}

/** One-line achievement + GS summary for library cards. */
export function formatAchievementCountsDisplay(c) {
    if (!c || typeof c !== 'object') return null
    const { earned, total, gsE, gsT, pct } = c
    const parts = []
    if (typeof earned === 'number' && earned >= 0) {
        if (typeof total === 'number' && total > 0) {
            parts.push(`${earned}/${total} achievements`)
        } else if (earned > 0) {
            parts.push(`${earned} unlocked`)
        }
    }
    if (typeof gsE === 'number' && typeof gsT === 'number' && gsT > 0) {
        parts.push(`${gsE.toLocaleString()}/${gsT.toLocaleString()} GS`)
    } else if (typeof gsE === 'number' && gsE > 0) {
        parts.push(`${gsE.toLocaleString()} GS`)
    }
    if (!parts.length && typeof pct === 'number') {
        parts.push(`${Math.round(pct)}% complete`)
    }
    return parts.length ? parts.join(' · ') : null
}

/** Achievement summary string from a title-history or v3 title row. */
export function formatAchievementTitleProgress(item) {
    return formatAchievementCountsDisplay(extractAchievementCounts(item))
}

export function pickXboxTitleId(item) {
    if (!item || typeof item !== 'object') return null
    const raw =
        item.titleId ??
        item.TitleId ??
        item.title_id ??
        item.titleDetails?.titleId ??
        item.titleDetails?.TitleId ??
        (item.title && typeof item.title === 'object' ? item.title.id ?? item.title.titleId : null)
    if (raw == null) return null
    const s = String(raw).trim()
    return /^\d+$/.test(s) ? s : null
}

export function normalizeTitleHistoryRow(raw) {
    if (!raw || typeof raw !== 'object') return null
    const titleBlock = raw.title && typeof raw.title === 'object' ? raw.title : null
    const name =
        raw.name ||
        raw.titleName ||
        raw.Title ||
        titleBlock?.name ||
        raw.localizedTitle ||
        'Game'
    const titleId = pickXboxTitleId(raw) ?? (titleBlock ? pickXboxTitleId(titleBlock) : null)
    const image = pickLibraryTitleCoverImage(raw, null)
    const lastPlayedIso = pickLastPlayedIso(raw)
    const minutesFromRow = pickMinutesPlayedFromRow(raw)
    const achHint = formatAchievementTitleProgress(raw)

    return {
        key: String(titleId ?? name),
        name: String(name),
        titleId,
        imageUrl: image,
        lastPlayedIso,
        lastPlayedLabel: formatLastPlayedLabel(lastPlayedIso),
        minutesPlayed: minutesFromRow,
        playtimeLabel: formatPlaytimeHours(minutesFromRow ?? undefined),
        achHint,
    }
}

export function extractOpenXblItemList(data, depth = 0) {
    if (!data || typeof data !== 'object' || depth > 5) return []
    if (Array.isArray(data)) {
        return data.every((x) => x && typeof x === 'object') ? data : []
    }
    const tryKeys = [
        'Titles',
        'titles',
        'games',
        'Games',
        'products',
        'Products',
        'items',
        'Items',
        'productSummaries',
        'ProductSummaries',
        'ChannelLineups',
        'channelLineups',
        'ListItems',
        'listItems',
        'value',
        'Value',
    ]
    for (const k of tryKeys) {
        const v = data[k]
        if (Array.isArray(v) && v.length && v.every((x) => x && typeof x === 'object')) {
            return v
        }
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            const vals = Object.values(v).filter((x) => x && typeof x === 'object')
            if (vals.length && vals.length === Object.keys(v).length) {
                return vals
            }
        }
    }
    const c = data.content
    if (c && typeof c === 'object') {
        const inner = extractOpenXblItemList(c, depth + 1)
        if (inner.length) return inner
    }
    const wrapKeys = ['data', 'Data', 'result', 'Result', 'response', 'Response', 'payload', 'Payload']
    for (const w of wrapKeys) {
        const inner = data[w]
        if (inner && typeof inner === 'object') {
            const list = extractOpenXblItemList(inner, depth + 1)
            if (list.length) return list
        }
    }
    return []
}

export function pickOpenXblItemTitle(item) {
    if (!item || typeof item !== 'object') return 'Untitled'
    const t =
        item.name ||
        item.localizedTitle ||
        item.title ||
        item.Title ||
        item.productTitle ||
        item.ProductTitle ||
        item.text
    if (t != null && String(t).trim()) return String(t).trim()
    const id = item.titleId ?? item.titleID ?? item.id ?? item.productId
    return id != null ? `ID ${id}` : 'Entry'
}

export function pickOpenXblItemImage(item) {
    if (!item || typeof item !== 'object') return null
    const nested =
        item.images?.poster?.url ||
        item.images?.boxArt?.url ||
        item.images?.superHeroArt?.url ||
        null
    return (
        nested ||
        item.displayImage ||
        item.imageUri ||
        item.ImageUri ||
        item.imageUrl ||
        item.image ||
        item.media?.[0]?.uri ||
        null
    )
}

export function pickMicrosoftStoreBigId(item) {
    if (!item || typeof item !== 'object') return null
    const id =
        item.bigId ??
        item.BigId ??
        item.productId ??
        item.ProductId ??
        item.storeId ??
        item.StoreId ??
        item.id
    if (id == null) return null
    const s = String(id).trim()
    return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(s) ? s : null
}

/**
 * Walk OpenXBL `player/stats` response; map decimal titleId -> minutes played.
 */
export function extractMinutesPlayedMapFromStats(data) {
    const map = new Map()
    const visit = (node, depth) => {
        if (depth > 12 || node == null) return
        if (Array.isArray(node)) {
            for (const x of node) visit(x, depth + 1)
            return
        }
        if (typeof node !== 'object') return
        const tid = node.titleId ?? node.TitleId ?? node.titleID
        const statName = String(node.name ?? node.Name ?? node.stat ?? '').toLowerCase()
        const val = node.value ?? node.Value ?? node.count ?? node.ValueLong ?? node.minutesPlayed
        if (tid != null && val != null) {
            const n = Number(val)
            if (Number.isFinite(n) && n >= 0) {
                if (
                    statName.includes('minute') ||
                    statName === 'minutesplayed' ||
                    statName === 'timeplayed' ||
                    (statName === '' && node.titleId != null)
                ) {
                    const k = String(tid)
                    const prev = map.get(k)
                    if (prev == null || n > prev) map.set(k, n)
                }
            }
        }
        for (const k of Object.keys(node)) {
            visit(node[k], depth + 1)
        }
    }
    visit(data, 0)
    return map
}

/**
 * True only for real unlock times — Xbox / .NET often sends DateTime.MinValue for locked rows,
 * which is a non-empty string and was incorrectly treated as "unlocked".
 */
export function isPlausibleAchievementUnlockInstant(raw) {
    if (raw == null) return false
    if (typeof raw === 'boolean') return raw
    if (typeof raw === 'number') {
        if (!Number.isFinite(raw) || raw <= 0) return false
        const ms = raw < 1e11 ? Math.round(raw * 1000) : raw
        const y = new Date(ms).getUTCFullYear()
        return y >= 2005
    }
    if (typeof raw === 'string') {
        const s = raw.trim()
        if (!s) return false
        const ts = Date.parse(s)
        if (!Number.isFinite(ts)) return false
        const y = new Date(ts).getUTCFullYear()
        return y >= 2005
    }
    return false
}

function collectAchievementArrays(node, depth = 0) {
    if (depth > 14 || node == null || typeof node !== 'object') return []
    if (Array.isArray(node)) return []
    const out = []
    for (const key of Object.keys(node)) {
        const val = node[key]
        if (/^achievements$/i.test(key) && Array.isArray(val) && val.every((x) => x && typeof x === 'object')) {
            out.push(val)
        }
        if (val && typeof val === 'object') {
            out.push(...collectAchievementArrays(val, depth + 1))
        }
    }
    return out
}

export function extractPlayerTitleAchievements(data) {
    if (!data || typeof data !== 'object') return []
    const c = data.content
    if (c && typeof c === 'object' && Array.isArray(c.achievements)) {
        return c.achievements
    }
    if (c && typeof c === 'object' && Array.isArray(c.Achievements)) {
        return c.Achievements
    }
    if (Array.isArray(data.achievements)) {
        return data.achievements
    }
    const nested = collectAchievementArrays(data)
    if (nested.length) {
        nested.sort((a, b) => b.length - a.length)
        return nested[0]
    }
    return []
}

export function pickAchievementGamerscoreReward(a) {
    if (!a || typeof a !== 'object') return null
    const rewards = a.rewards ?? a.Rewards
    if (!Array.isArray(rewards)) return null
    const g = rewards.find((r) => r && String(r.type || r.Type || '').toLowerCase() === 'gamerscore')
    const v = g?.value ?? g?.Value
    return typeof v === 'number' ? v : null
}

const LOCKED_ACHIEVEMENT_STATES = new Set([
    'notstarted',
    'not_started',
    'locked',
    'none',
    'inprogress',
    'in_progress',
])

function normState(s) {
    return String(s ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '')
}

export function isAchievementUnlocked(a) {
    if (!a || typeof a !== 'object') return false
    if (a.isLocked === true || a.locked === true) return false
    if (a.isUnlocked === false || a.unlocked === false) return false
    if (a.earned === false || a.isAchieved === false) return false

    const progressState = normState(a.progressState ?? a.ProgressState)
    const state = normState(a.state ?? a.Status ?? a.status)

    if (LOCKED_ACHIEVEMENT_STATES.has(progressState) || LOCKED_ACHIEVEMENT_STATES.has(state)) {
        return false
    }

    if (a.isUnlocked === true || a.unlocked === true) return true

    if (
        progressState === 'achieved' ||
        state === 'achieved' ||
        progressState === 'unlocked' ||
        state === 'unlocked'
    ) {
        return true
    }

    if (isPlausibleAchievementUnlockInstant(a.timeUnlocked)) return true
    if (isPlausibleAchievementUnlockInstant(a.dateUnlocked)) return true
    if (isPlausibleAchievementUnlockInstant(a.unlockedDate)) return true

    if (a.earned === true || a.isAchieved === true) return true

    if (a.progression && typeof a.progression === 'object') {
        const p = a.progression
        if (isPlausibleAchievementUnlockInstant(p.timeUnlocked) || isPlausibleAchievementUnlockInstant(p.unlockedDate)) {
            return true
        }
        const ps = normState(p.state ?? p.State)
        if (ps === 'achieved' || ps === 'unlocked') return true
    }

    if (a.progressState != null || a.ProgressState != null) return false
    return false
}

/**
 * OpenXBL `GET /v2/presence/{xuid}` — user-facing lines (see OpenXBL docs).
 * @returns {{ status: string, game: string|null, detail: string|null }|null}
 */
export function summarizeOpenXblPresence(data) {
    if (!data || typeof data !== 'object') return null
    const c = data.content && typeof data.content === 'object' ? data.content : data
    const rawState = c.state != null ? String(c.state).trim() : ''
    if (!rawState && !Array.isArray(c.devices)) return null

    const status = rawState || 'Unknown'
    let game = null
    let detail = null

    const devices = Array.isArray(c.devices) ? c.devices : []
    for (const dev of devices) {
        const titles = Array.isArray(dev?.titles) ? dev.titles : []
        for (const t of titles) {
            if (!t || typeof t !== 'object') continue
            const st = String(t.state || t.State || '').toLowerCase()
            if (st === 'active' || st === 'playing' || st === 'broadcasting') {
                const name = t.name || t.Name || t.title || null
                game = name != null && String(name).trim() ? String(name).trim() : game
                const rp = t.activity?.richPresence ?? t.richPresence ?? t.Activity?.richPresence
                if (typeof rp === 'string' && rp.trim()) detail = rp.trim()
                break
            }
        }
        if (game) break
    }

    if (!game && devices.length) {
        for (const dev of devices) {
            const titles = Array.isArray(dev?.titles) ? dev.titles : []
            const t0 = titles[0]
            if (t0 && typeof t0 === 'object') {
                const name = t0.name || t0.Name
                if (name != null && String(name).trim()) {
                    game = String(name).trim()
                    break
                }
            }
        }
    }

    return { status, game, detail }
}

/** Titles array from `GET /v3/achievements/player/{xuid}` (OpenXBL v3). */
export function extractV3PlayerAchievementTitles(data) {
    if (!data || typeof data !== 'object') return []
    const c = data.content
    if (c && typeof c === 'object' && Array.isArray(c.titles)) return c.titles
    if (Array.isArray(data.titles)) return data.titles
    return []
}

/**
 * Map decimal titleId → raw v3 title row (for merging with title history).
 */
export function indexV3TitlesByTitleId(data) {
    const map = new Map()
    for (const t of extractV3PlayerAchievementTitles(data)) {
        if (!t || typeof t !== 'object') continue
        const id = pickXboxTitleId(t)
        if (id) map.set(String(id), t)
        const modern = t.modernTitleId ?? t.ModernTitleId
        if (modern != null) {
            const s = String(modern).trim()
            if (/^\d+$/.test(s)) map.set(s, t)
        }
    }
    return map
}

/** Prefer v3 stats / achievement summary / art when title history row is thin. */
export function mergeLibraryRowWithV3Title(row, v3Title) {
    if (!row || !v3Title || typeof v3Title !== 'object') return row
    const merged = { ...row }
    const stats = v3Title.stats && typeof v3Title.stats === 'object' ? v3Title.stats : null
    const minutesFromV3 = stats != null ? Number(stats.minutesPlayed ?? stats.MinutesPlayed) : NaN
    if (merged.minutesPlayed == null && Number.isFinite(minutesFromV3) && minutesFromV3 >= 0) {
        merged.minutesPlayed = minutesFromV3
        merged.playtimeLabel = formatPlaytimeHours(minutesFromV3)
    }
    const mergedCounts = mergeAchievementCounts(extractAchievementCounts(row), extractAchievementCounts(v3Title))
    const mergedHint = formatAchievementCountsDisplay(mergedCounts)
    if (mergedHint) merged.achHint = mergedHint

    const cover = pickLibraryTitleCoverImage(row, v3Title)
    if (cover) merged.imageUrl = cover

    const v3Last = v3Title.titleHistory?.lastTimePlayed ?? v3Title.titleHistory?.lastPlayed
    if (v3Last && !merged.lastPlayedIso) {
        const iso = String(v3Last).trim()
        if (iso) {
            merged.lastPlayedIso = iso
            merged.lastPlayedLabel = formatLastPlayedLabel(iso)
        }
    }
    return merged
}

export function summarizeAchievementList(list) {
    if (!Array.isArray(list)) {
        return { unlocked: 0, total: 0, gsEarned: 0, gsPossible: 0 }
    }
    let unlocked = 0
    let gsEarned = 0
    let gsPossible = 0
    for (const a of list) {
        const gs = pickAchievementGamerscoreReward(a)
        if (gs != null) gsPossible += gs
        if (isAchievementUnlocked(a)) {
            unlocked += 1
            if (gs != null) gsEarned += gs
        }
    }
    return {
        unlocked,
        total: list.length,
        gsEarned,
        gsPossible,
    }
}
