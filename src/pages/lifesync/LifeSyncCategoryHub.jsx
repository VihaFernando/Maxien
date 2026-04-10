import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FaCalendarAlt, FaGamepad, FaFilm, FaArrowRight, FaChevronRight, FaStar } from 'react-icons/fa'
import { LifeSyncHubMangaReading } from '../../components/lifesync/MangaReadingRail'
import { LifeSyncHubAnimeWatching } from '../../components/lifesync/AnimeHubWatchingRail'
import { useLifeSync } from '../../context/LifeSyncContext'
import { useMangaReadingList } from '../../hooks/useMangaReadingList'
import { useAnimeWatchHistory } from '../../hooks/useAnimeWatchHistory'
import {
    isLifeSyncAnimeNavVisible,
    isLifeSyncHentaiHubVisible,
    isPluginEnabled,
} from '../../lib/lifesyncApi'
import { lifesyncFetch } from '../../lib/lifesyncApi'
import { LifesyncEpisodeThumbnail } from '../../components/lifesync/EpisodeLoadingSkeletons'
import { LifeSyncHubPageShell as HubShell } from '../../components/lifesync/LifeSyncHubPageShell'
import { MotionDiv } from '../../lib/lifesyncMotion'

const MotionLink = motion.create(Link)

const SC = 'https://cdn.akamai.steamstatic.com/steam/apps'

const focusRing =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa] focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf8ff]'

function dayStamp(d = new Date()) {
    try { return d.toISOString().slice(0, 10) } catch { return '' }
}

function readDailyPool(key) {
    try {
        const raw = localStorage.getItem(key)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed !== 'object') return null
        if (!parsed.at || typeof parsed.at !== 'string') return null
        if (!Array.isArray(parsed.urls)) return null
        if (parsed.at !== dayStamp()) return null
        return parsed.urls.filter(Boolean)
    } catch {
        return null
    }
}

function writeDailyPool(key, urls) {
    try {
        localStorage.setItem(key, JSON.stringify({ at: dayStamp(), urls: Array.isArray(urls) ? urls : [] }))
    } catch {
        /* ignore */
    }
}

function validateImageUrl(url, { timeoutMs = 4500 } = {}) {
    return new Promise((resolve) => {
        if (!url) return resolve(false)
        const img = new Image()
        let done = false
        const finish = (ok) => {
            if (done) return
            done = true
            try { img.onload = null; img.onerror = null } catch { /* ignore */ }
            resolve(Boolean(ok))
        }
        const t = setTimeout(() => finish(false), timeoutMs)
        img.onload = () => { clearTimeout(t); finish(true) }
        img.onerror = () => { clearTimeout(t); finish(false) }
        img.referrerPolicy = 'no-referrer'
        img.decoding = 'async'
        img.src = url
    })
}

function useDailyValidatedPool(namespace, urls, { maxValidate = 18 } = {}) {
    const [pool, setPool] = useState(() => urls)

    useEffect(() => {
        const storageKey = `maxien_lifesync_imgpool_v1_${namespace}`
        const cached = readDailyPool(storageKey)
        if (cached?.length) {
            setPool(cached)
            return
        }

        let cancelled = false
        const run = async () => {
            const target = shuffle(urls).slice(0, Math.min(maxValidate, urls.length))
            const ok = []
            const concurrency = 4
            let idx = 0

            const worker = async () => {
                while (!cancelled) {
                    const i = idx++
                    if (i >= target.length) return
                    const u = target[i]
                    // eslint-disable-next-line no-await-in-loop
                    const good = await validateImageUrl(u)
                    if (cancelled) return
                    if (good) ok.push(u)
                }
            }

            await Promise.all(Array.from({ length: concurrency }, () => worker()))
            if (cancelled) return

            const next = ok.length >= 6 ? ok : urls
            setPool(next)
            writeDailyPool(storageKey, next)
        }

        run()
        return () => { cancelled = true }
    }, [namespace, urls, maxValidate])

    return pool
}

function shuffle(arr) {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
}

const POOL = {
    steam: [1245620, 1091500, 1174180, 1086940, 271590, 730, 570, 292030, 440, 814380, 578080].map(id => `${SC}/${id}/header.jpg`),
    wishlist: [367520, 892970, 1145360, 601150, 105600, 413150].map(id => `${SC}/${id}/header.jpg`),
    xbox: [1240440, 1716740, 976730, 359550, 493520, 1238810].map(id => `${SC}/${id}/header.jpg`),
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
        'https://cdn.myanimelist.net/images/manga/2/253146.jpg',
        'https://cdn.myanimelist.net/images/manga/1/157897.jpg',
        'https://cdn.myanimelist.net/images/manga/3/216464.jpg',
        'https://cdn.myanimelist.net/images/manga/1/210681.jpg',
        'https://cdn.myanimelist.net/images/manga/2/258236.jpg',
        'https://cdn.myanimelist.net/images/manga/3/249658.jpg',
    ],
    hentai: [
        'https://cdn.myanimelist.net/images/anime/12/76049.jpg',
        'https://cdn.myanimelist.net/images/anime/7/75199.jpg',
        'https://cdn.myanimelist.net/images/anime/1935/127974.jpg',
        'https://cdn.myanimelist.net/images/anime/1377/93406.jpg',
        'https://cdn.myanimelist.net/images/anime/1491/109402.jpg',
    ],
}

function Thumb({ src }) {
    const [ok, setOk] = useState(true)
    if (!ok) return <div className="h-full w-full bg-gradient-to-br from-[#e8e4f0] to-[#dce8e4]" />
    return (
        <LifesyncEpisodeThumbnail
            src={src}
            className="h-full w-full min-h-0"
            imgClassName="h-full w-full object-cover contrast-[1.06] saturate-[1.12]"
            imgProps={{
                referrerPolicy: 'no-referrer',
                onError: () => setOk(false),
            }}
        />
    )
}

/** Collage tiles with light “editorial” scrim — readable text, no dark panel backgrounds. */
function BentoCard({ to, pool, cols = 3, rows = 3, title, subtitle, badge, badgeClass, gradient, className = '' }) {
    const [images] = useState(() => shuffle(pool).slice(0, cols * rows))

    return (
        <MotionLink
            to={to}
            className={`group relative block overflow-hidden rounded-[22px] bg-white shadow-[0_10px_34px_-18px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/80 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_-26px_rgba(15,23,42,0.35)] sm:rounded-[26px] ${focusRing} ${className}`}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        >
            {/* No white wash — keep artwork crisp */}
            <div className="absolute inset-0 bg-black/0" />
            <div
                className="absolute inset-[10px] grid gap-1 rounded-[18px] p-1 transition-transform duration-700 ease-out group-hover:scale-[1.02] sm:inset-[12px] sm:gap-1.5 sm:rounded-[20px] sm:duration-[900ms]"
                style={{
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gridTemplateRows: `repeat(${rows}, 1fr)`,
                }}
            >
                {images.map((src, i) => (
                    <div key={i} className="min-h-0 min-w-0 overflow-hidden rounded-lg shadow-sm">
                        <Thumb src={src} />
                    </div>
                ))}
            </div>
            {/* Very subtle tint only (avoid “haze”) */}
            <div className={`pointer-events-none absolute inset-0 opacity-25 transition-opacity duration-300 ${gradient}`} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 via-black/35 to-black/0 sm:h-44" />

            {/* Content */}
            <div className="relative z-10 flex h-full min-h-[inherit] flex-col justify-end p-4 sm:p-5">
                <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                        {badge ? (
                            <span className={`mb-1 inline-flex w-fit items-center rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-white shadow-sm ring-1 ring-white/20 ${badgeClass || ''}`}>
                                {badge}
                            </span>
                        ) : null}
                        <h3 className="text-[18px] font-black leading-tight tracking-tight text-white sm:text-[20px] lg:text-[22px]">
                            {title}
                        </h3>
                        <p className="mt-1 max-w-[46ch] text-[12px] leading-snug text-white/80 line-clamp-2 sm:text-[13px]">
                            {subtitle}
                        </p>
                    </div>

                    <span className="shrink-0 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-[11px] font-bold text-white shadow-sm ring-1 ring-white/20 backdrop-blur transition group-hover:bg-white/20">
                        Open
                        <FaArrowRight className="h-3 w-3 opacity-85" aria-hidden />
                    </span>
                </div>
            </div>
        </MotionLink>
    )
}

/** Full-width row for small screens — 44px+ tap targets, thumb grid, clear hierarchy. */
function MobileExploreRow({ to, pool, title, subtitle, badge, badgeClass }) {
    const [thumbs] = useState(() => shuffle(pool).slice(0, 4))

    return (
        <MotionLink
            to={to}
            className={`flex min-h-[104px] items-center gap-3 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-100/80 transition hover:bg-slate-50/60 active:scale-[0.99] sm:min-h-[104px] sm:gap-4 sm:p-4 ${focusRing}`}
            whileTap={{ scale: 0.99 }}
            whileHover={{ y: -2 }}
            transition={{ type: 'spring', stiffness: 480, damping: 32 }}
        >
            <div className="grid h-[80px] w-[80px] shrink-0 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-100 to-indigo-50 p-0.5 ring-1 ring-slate-200/80 sm:h-[84px] sm:w-[84px]">
                {thumbs.map((src, i) => (
                    <div key={i} className="min-h-0 min-w-0 overflow-hidden rounded-md">
                        <Thumb src={src} />
                    </div>
                ))}
            </div>
            <div className="min-w-0 flex-1 py-0.5 pr-1">
                {badge ? (
                    <span className={`mb-0.5 inline-block rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${badgeClass}`}>
                        {badge}
                    </span>
                ) : null}
                <h3 className="text-[15px] font-black leading-tight tracking-tight text-slate-900 sm:text-[17px]">{title}</h3>
                <p className="mt-0.5 text-[11px] leading-snug text-[#64748b] line-clamp-2 sm:mt-1 sm:text-[12px]">{subtitle}</p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-2xl bg-[#C6FF00]/25 text-slate-900 shadow-sm ring-1 ring-[#C6FF00]/40 sm:h-12 sm:w-12">
                <FaChevronRight className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden />
            </div>
        </MotionLink>
    )
}

/** Bento cards in the Explore aside — content-sized so the hub page can scroll (no flex-1 height trap). */
const EXPLORE_SIDEBAR_BENTO = 'min-h-[168px] w-full lg:flex lg:flex-col'

/** Hero-style anime tile when Explore is full width (no progress column). */
const EXPLORE_FULL_ANIME_HERO =
    'min-h-[220px] w-full sm:min-h-[260px] lg:col-span-7 xl:col-span-8 lg:min-h-[min(460px,calc(100dvh-200px))]'

function HubConnectPrompt({ title, body, embedded = false }) {
    const inner = (
        <div className="flex min-h-[50vh] items-center justify-center px-2 py-10 sm:py-14">
            <MotionDiv
                className="w-full max-w-md rounded-[22px] bg-white px-6 py-9 text-center shadow-sm sm:px-8 sm:py-10"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
                <p className="text-[16px] font-bold text-[#1d1d1f] sm:text-[17px]">{title}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-[#86868b]">{body}</p>
                <Link
                    to="/dashboard/profile?tab=integrations"
                    className={`mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#C6FF00] px-5 text-[13px] font-semibold text-[#1a1628] shadow-sm transition-all hover:brightness-95 sm:w-auto sm:min-w-[200px] ${focusRing}`}
                >
                    Open integrations
                </Link>
            </MotionDiv>
        </div>
    )
    if (embedded) return inner
    return <HubShell>{inner}</HubShell>
}

function SectionLabel({ id, children }) {
    return (
        <h2
            id={id}
            className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5b5670] sm:text-xs"
        >
            <span className="h-px w-6 rounded-full bg-gradient-to-r from-[#C6FF00] to-[#a78bfa] sm:w-8" aria-hidden />
            {children}
        </h2>
    )
}

export function LifeSyncGamesHub() {
    const { isLifeSyncConnected } = useLifeSync()

    if (!isLifeSyncConnected) {
        return (
            <HubConnectPrompt
                title="LifeSync not connected"
                body="Link your LifeSync account under Profile → Integrations to browse games hubs."
            />
        )
    }

    const gamesHeroMinH = 'lg:min-h-[min(460px,calc(100dvh-200px))]'

    return (
        <HubShell>
            <header className="relative mb-6 sm:mb-7 lg:mb-8">
                <div className="absolute -left-2 top-0 hidden h-full w-1 rounded-full bg-gradient-to-b from-[#C6FF00] via-[#38bdf8] to-[#a78bfa] sm:block lg:-left-3" aria-hidden />
                <div className="flex flex-col gap-1 pl-0 sm:pl-4 lg:pl-5">
                    <div className="flex items-start gap-3 sm:items-center">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#C6FF00] to-[#9fe870] text-[#1a1628] shadow-md sm:h-12 sm:w-12">
                            <FaGamepad className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7c7794]">LifeSync</p>
                            <h1 className="text-[24px] font-bold leading-tight tracking-tight text-[#1a1628] sm:text-[28px] lg:text-[30px]">Games</h1>
                            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[#5b5670] lg:mt-2 lg:text-[14px]">
                                Steam is the main hub; wishlist and Xbox sit alongside on large screens — quick jumps on any device.
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <section aria-labelledby="lifesync-games-explore-label">
                <SectionLabel id="lifesync-games-explore-label">Explore</SectionLabel>
                <p className="mt-1 mb-4 text-[12px] text-[#5b5670] lg:mb-5 lg:text-[13px]">
                    <span className="lg:hidden">Steam first, then wishlist and Xbox in a row.</span>
                    <span className="hidden lg:inline">Steam fills the primary column; the other two stack on the right.</span>
                </p>

                {/* Mobile / tablet: Steam hero, then two-up. Desktop: 12-col — Steam ~⅔, wishlist + Xbox stacked ~⅓ (no empty grid cells). */}
                <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-stretch lg:gap-6 xl:gap-8">
                    <BentoCard
                        to="/dashboard/lifesync/games/steam"
                        pool={POOL.steam}
                        cols={3}
                        rows={3}
                        title="Steam"
                        subtitle="Library, store deals & account linking"
                        gradient="bg-gradient-to-t from-[#f0f9ff] via-white/70 to-transparent"
                        className={`min-h-[220px] w-full shrink-0 sm:min-h-[260px] lg:col-span-7 xl:col-span-8 ${gamesHeroMinH}`}
                    />
                    <div className="grid grid-cols-2 gap-3 lg:col-span-5 lg:flex lg:flex-col lg:gap-5 xl:col-span-4 xl:gap-6">
                        <BentoCard
                            to="/dashboard/lifesync/games/wishlist"
                            pool={POOL.wishlist}
                            cols={2}
                            rows={2}
                            title="Wishlist"
                            subtitle="Games you want"
                            gradient="bg-gradient-to-t from-[#faf5ff] via-white/65 to-transparent"
                            className="min-h-[168px] w-full lg:flex lg:flex-col"
                        />
                        <BentoCard
                            to="/dashboard/lifesync/games/xbox"
                            pool={POOL.xbox}
                            cols={2}
                            rows={2}
                            title="Xbox"
                            subtitle="Deals & store picks"
                            gradient="bg-gradient-to-t from-[#ecfdf5] via-white/60 to-transparent"
                            className="min-h-[168px] w-full lg:flex lg:flex-col"
                        />
                    </div>
                </div>
            </section>
        </HubShell>
    )
}

function isoDayKey(d) {
    try {
        const x = new Date(d)
        const y = x.getFullYear()
        const m = String(x.getMonth() + 1).padStart(2, '0')
        const day = String(x.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
    } catch {
        return ''
    }
}

function addDays(d, n) {
    const x = new Date(d)
    x.setDate(x.getDate() + n)
    return x
}

function startOfWeekMonday(d = new Date()) {
    const x = new Date(d)
    const day = x.getDay() // 0 Sun .. 6 Sat
    const diff = (day === 0 ? -6 : 1) - day
    x.setHours(0, 0, 0, 0)
    x.setDate(x.getDate() + diff)
    return x
}

async function fetchCalendarMonthCached(year, month1) {
    const tz = Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || 'UTC'
    const key = `maxien_animehub_weekcal_${year}-${String(month1).padStart(2, '0')}-${tz}`
    try {
        const raw = sessionStorage.getItem(key)
        if (raw) {
            const parsed = JSON.parse(raw)
            if (parsed && typeof parsed === 'object' && parsed.days && typeof parsed.days === 'object') {
                return parsed
            }
        }
    } catch { /* ignore */ }

    const res = await lifesyncFetch(`/api/anime/calendar/month?year=${year}&month=${month1}&tz=${encodeURIComponent(tz)}`)
    const payload = {
        at: Date.now(),
        days: res?.days && typeof res.days === 'object' ? res.days : {},
        pins: Array.isArray(res?.pins) ? res.pins : [],
    }
    try { sessionStorage.setItem(key, JSON.stringify(payload)) } catch { /* ignore */ }
    return payload
}

const ANIME_HUB_PATHS = {
    seasonal: '/dashboard/lifesync/anime/anime/seasonal/page/1',
    calendar: '/dashboard/lifesync/anime/anime/calendar',
    mangaHome: '/dashboard/lifesync/anime/manga/mangadex/popular/page/1',
    hentaiHome: '/dashboard/lifesync/anime/hentai',
}

/**
 * Ordered destinations for the anime area hub (Games-style bento + mobile rows).
 */
function buildAnimeExploreTiles({ animePluginOn, mangaPluginOn, hentaiVisible }) {
    const tiles = []
    if (animePluginOn) {
        tiles.push({
            id: 'seasonal',
            to: ANIME_HUB_PATHS.seasonal,
            pool: POOL.anime,
            cols: 3,
            rows: 3,
            title: 'Seasonal & charts',
            subtitle: 'MAL seasonal lineups, rankings, search, and your list.',
            gradient: 'bg-gradient-to-t from-[#e0f2fe] via-white/70 to-transparent',
            hero: true,
        })
        tiles.push({
            id: 'calendar',
            to: ANIME_HUB_PATHS.calendar,
            pool: POOL.anime,
            cols: 2,
            rows: 2,
            title: 'Calendar',
            subtitle: 'Weekly broadcast preview and a full month view with pins.',
            gradient: 'bg-gradient-to-t from-[#ecfeff] via-white/65 to-transparent',
            hero: false,
        })
    }
    if (mangaPluginOn) {
        tiles.push({
            id: 'manga',
            to: ANIME_HUB_PATHS.mangaHome,
            pool: POOL.manga,
            cols: 2,
            rows: 2,
            title: 'Manga',
            subtitle: 'MangaDex queues, chapters, and reader.',
            gradient: 'bg-gradient-to-t from-[#fff8eb] via-white/65 to-transparent',
            hero: !animePluginOn && tiles.length === 0,
        })
    }
    if (hentaiVisible) {
        tiles.push({
            id: 'hentai',
            to: ANIME_HUB_PATHS.hentaiHome,
            pool: POOL.hentai,
            cols: 2,
            rows: 2,
            title: 'Hentai Ocean',
            subtitle: 'Adults-only catalog with its own controls.',
            badge: '18+',
            badgeClass: 'bg-rose-100 text-rose-800',
            gradient: 'bg-gradient-to-t from-[#ffe4e6] via-white/60 to-transparent',
            hero: !animePluginOn && !mangaPluginOn,
        })
    }
    return tiles
}

function AnimeHubExploreSection({ tiles }) {
    const primary = tiles.find((t) => t.hero) ?? tiles[0]
    const rest = primary ? tiles.filter((t) => t.id !== primary.id) : []
    const animeHeroMinH = 'lg:min-h-[min(460px,calc(100dvh-200px))]'

    if (!tiles.length) return null

    return (
        <section
            aria-labelledby="lifesync-anime-explore-label"
            className="rounded-[28px] border border-slate-200/70 bg-gradient-to-b from-white/90 to-slate-50/40 p-4 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.18)] ring-1 ring-white/80 backdrop-blur-sm sm:p-5 lg:p-6"
        >
            <div className="mb-4 flex flex-col gap-1 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2
                        id="lifesync-anime-explore-label"
                        className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 sm:text-xs"
                    >
                        Explore
                    </h2>
                    <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-slate-600 sm:text-[13px]">
                        <span className="lg:hidden">Jump into seasonal anime, manga, or 18+ from the cards below.</span>
                        <span className="hidden lg:inline">Hero tile for the main catalog; secondary tiles stack beside it on wide screens.</span>
                    </p>
                </div>
                <span className="mt-2 inline-flex w-fit items-center rounded-full bg-[#C6FF00]/25 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-800 ring-1 ring-[#C6FF00]/40 sm:mt-0">
                    {tiles.length} destinations
                </span>
            </div>

            <div className="flex flex-col gap-3.5 max-lg:pb-0.5 lg:hidden">
                {tiles.map((tile) => (
                    <MobileExploreRow
                        key={tile.id}
                        to={tile.to}
                        pool={tile.pool}
                        title={tile.title}
                        subtitle={tile.subtitle}
                        badge={tile.badge}
                        badgeClass={tile.badgeClass}
                    />
                ))}
            </div>

            <div className="hidden lg:grid lg:grid-cols-12 lg:items-stretch lg:gap-6 xl:gap-8">
                {rest.length === 0 ? (
                    <BentoCard
                        to={primary.to}
                        pool={primary.pool}
                        cols={primary.cols}
                        rows={primary.rows}
                        title={primary.title}
                        subtitle={primary.subtitle}
                        badge={primary.badge}
                        badgeClass={primary.badgeClass}
                        gradient={primary.gradient}
                        className={`w-full ${EXPLORE_FULL_ANIME_HERO} ${animeHeroMinH}`}
                    />
                ) : (
                    <>
                        <BentoCard
                            to={primary.to}
                            pool={primary.pool}
                            cols={primary.cols}
                            rows={primary.rows}
                            title={primary.title}
                            subtitle={primary.subtitle}
                            badge={primary.badge}
                            badgeClass={primary.badgeClass}
                            gradient={primary.gradient}
                            className={`lg:col-span-7 xl:col-span-8 ${EXPLORE_FULL_ANIME_HERO} ${animeHeroMinH}`}
                        />
                        <div className="flex flex-col gap-5 lg:col-span-5 xl:col-span-4">
                            {rest.map((tile) => (
                                <BentoCard
                                    key={tile.id}
                                    to={tile.to}
                                    pool={tile.pool}
                                    cols={tile.cols}
                                    rows={tile.rows}
                                    title={tile.title}
                                    subtitle={tile.subtitle}
                                    badge={tile.badge}
                                    badgeClass={tile.badgeClass}
                                    gradient={tile.gradient}
                                    className={EXPLORE_SIDEBAR_BENTO}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </section>
    )
}

/** Snapshot + weekly day cards in one panel. Desktop: 4-col stats / CTA + 7-col day grid; mobile: stack. */
function AnimeHubBroadcastWeekSection({
    weekBusy,
    weekError,
    onRetry,
    weekList,
    weekDays,
    weekCardsLoading,
    scheduledCount,
    pinnedCount,
}) {
    const todayKey = isoDayKey(new Date())
    const [selectedKey, setSelectedKey] = useState(todayKey)

    const selectedDate = useMemo(() => {
        const found = weekList.find((d) => isoDayKey(d) === selectedKey)
        return found || weekList[0] || new Date()
    }, [selectedKey, weekList])

    const selectedItems = useMemo(() => {
        const list = Array.isArray(weekDays?.[selectedKey]) ? weekDays[selectedKey] : []
        return list
    }, [selectedKey, weekDays])

    return (
        <motion.section
            className="mt-8 sm:mt-10 lg:mt-12"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        >
            <div className="rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/30 to-indigo-50/20 p-3.5 shadow-[0_24px_60px_-30px_rgba(30,27,75,0.2)] backdrop-blur-md sm:p-5 lg:p-6">
                {weekError ? (
                    <motion.div
                        className="mb-4 rounded-2xl border border-red-200 bg-red-50/85 px-4 py-3 text-[12px] font-medium text-red-700 xl:mb-6"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <span className="min-w-0">{weekError}</span>
                            <button
                                type="button"
                                onClick={onRetry}
                                className={`inline-flex min-h-[40px] w-fit items-center justify-center rounded-xl bg-red-700 px-3.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm hover:bg-red-800 ${focusRing}`}
                            >
                                Retry
                            </button>
                        </div>
                    </motion.div>
                ) : null}

                <div className="flex flex-col gap-6 xl:grid xl:grid-cols-12 xl:items-start xl:gap-8">
                    <div className="space-y-4 rounded-2xl bg-white/70 p-4 ring-1 ring-slate-200/60 xl:col-span-4 xl:pr-2 xl:ring-0">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">This week</p>
                            <h2 className="mt-0.5 text-[19px] font-black leading-tight tracking-tight text-slate-900 sm:mt-1 sm:text-[22px]">Broadcast</h2>
                            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600 sm:text-[13px]">
                                {weekBusy
                                    ? 'Loading your calendar…'
                                    : 'A quick look at the next 7 days. Pinned shows appear first.'}
                            </p>
                        </div>
                        <dl className="grid grid-cols-2 gap-2.5 sm:gap-3">
                            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 sm:px-3.5 sm:py-3">
                                <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Episodes</dt>
                                <dd className="mt-0.5 text-[20px] font-black tabular-nums text-slate-900 sm:mt-1 sm:text-[22px]">{scheduledCount}</dd>
                            </div>
                            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 sm:px-3.5 sm:py-3">
                                <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pinned</dt>
                                <dd className="mt-0.5 text-[20px] font-black tabular-nums text-slate-900 sm:mt-1 sm:text-[22px]">{pinnedCount}</dd>
                            </div>
                        </dl>
                        <Link
                            to={ANIME_HUB_PATHS.calendar}
                            className={`inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-[#C6FF00] px-4 py-2.5 text-[13px] font-semibold text-[#1a1628] shadow-sm transition-all hover:brightness-95 ${focusRing}`}
                        >
                            Open full calendar
                            <FaChevronRight className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                    </div>

                    <div className="min-w-0 border-t border-slate-200/70 pt-5 xl:col-span-8 xl:border-l xl:border-slate-200/70 xl:border-t-0 xl:pl-8 xl:pt-0">
                        <div className="mb-4 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Daily lineup</p>
                                <p className="mt-0.5 text-[11px] leading-snug text-slate-600 sm:text-[12px]">
                                    Pick a day to preview. Tap a day to open it in Calendar.
                                </p>
                            </div>
                            <Link
                                to={`${ANIME_HUB_PATHS.calendar}?date=${encodeURIComponent(selectedKey)}`}
                                className={`inline-flex min-h-[40px] w-fit items-center justify-center rounded-xl bg-white px-3.5 text-[11px] font-bold text-slate-900 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-slate-50 ${focusRing}`}
                            >
                                View day
                            </Link>
                        </div>

                        {/* Compact day picker */}
                        <div className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {weekList.map((day) => {
                                const k = isoDayKey(day)
                                const list = Array.isArray(weekDays?.[k]) ? weekDays[k] : []
                                const pinned = list.reduce((acc, it) => (it?.isPinned ? acc + 1 : acc), 0)
                                const isSel = k === selectedKey
                                const isToday = k === todayKey
                                const dow = day.toLocaleDateString('en-US', { weekday: 'short' })
                                return (
                                    <button
                                        key={k}
                                        type="button"
                                        onClick={() => setSelectedKey(k)}
                                        className={`
                                            shrink-0 rounded-2xl px-3 py-2 text-left shadow-sm ring-1 transition
                                            ${isSel ? 'bg-slate-900 text-white ring-slate-900/10' : 'bg-white text-slate-900 ring-slate-200/80 hover:bg-slate-50'}
                                            ${focusRing}
                                        `}
                                        aria-pressed={isSel}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-black uppercase tracking-[0.16em] ${isSel ? 'text-white/75' : 'text-slate-500'}`}>
                                                {isToday ? 'Today' : dow}
                                            </span>
                                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold tabular-nums ${isSel ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'}`}>
                                                {pinned ? <FaStar className="h-2.5 w-2.5" aria-hidden /> : <FaCalendarAlt className="h-2.5 w-2.5" aria-hidden />}
                                                {list.length}
                                            </span>
                                        </div>
                                        <div className="mt-1 text-[18px] font-black tabular-nums leading-none">{day.getDate()}</div>
                                    </button>
                                )
                            })}
                        </div>

                        {/* Selected day preview */}
                        <div className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-slate-200/80 sm:p-4">
                            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <p className="text-[11px] font-black tracking-tight text-slate-900">
                                        {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                    </p>
                                    <p className="text-[11px] text-slate-600">Pinned episodes are shown first.</p>
                                </div>
                                <Link
                                    to={`${ANIME_HUB_PATHS.calendar}?date=${encodeURIComponent(selectedKey)}`}
                                    className={`inline-flex min-h-[40px] w-fit items-center justify-center rounded-xl bg-[#C6FF00] px-3.5 text-[11px] font-bold text-slate-900 shadow-sm transition hover:brightness-95 ${focusRing}`}
                                >
                                    Open in calendar
                                </Link>
                            </div>

                            {weekCardsLoading ? (
                                <div className="space-y-2">
                                    <div className="h-12 rounded-xl bg-slate-100 animate-pulse" />
                                    <div className="h-12 rounded-xl bg-slate-100 animate-pulse" />
                                    <div className="h-12 rounded-xl bg-slate-100 animate-pulse" />
                                </div>
                            ) : selectedItems.length ? (
                                <ul className="space-y-2">
                                    {selectedItems.slice(0, 6).map((it, i) => (
                                        <li
                                            key={`${selectedKey}-${it?.malId}-${it?.episodeNumber}-${i}`}
                                            className={`
                                                flex items-center gap-3 rounded-xl border px-3 py-2
                                                ${it?.isPinned ? 'border-[#C6FF00]/50 bg-[#f7fee7]/70' : 'border-slate-200/80 bg-slate-50/80'}
                                            `}
                                        >
                                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-slate-200 ring-1 ring-slate-200/80">
                                                {it?.imageUrl ? <img src={it.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-[12px] font-bold text-slate-900">{it?.title || 'Anime'}</p>
                                                <p className="mt-0.5 font-mono text-[10px] font-semibold tabular-nums text-slate-500">
                                                    EP {it?.episodeNumber || '?'}
                                                </p>
                                            </div>
                                            {it?.isPinned ? (
                                                <span className="shrink-0 rounded-full bg-slate-900 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-white">
                                                    Pinned
                                                </span>
                                            ) : null}
                                        </li>
                                    ))}
                                    {selectedItems.length > 6 ? (
                                        <li className="px-1 text-[11px] font-medium text-slate-600">
                                            +{selectedItems.length - 6} more — open calendar to see all
                                        </li>
                                    ) : null}
                                </ul>
                            ) : (
                                <div className="flex min-h-[7rem] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-6">
                                    <p className="text-center text-[12px] font-medium text-slate-600">Nothing scheduled</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </motion.section>
    )
}

function BroadcastDayRailCard({ day, items, index, loading }) {
    const key = isoDayKey(day)
    const label = day.toLocaleDateString('en-US', { weekday: 'short' })
    const dnum = day.getDate()
    const list = Array.isArray(items) ? items : []
    const pinned = list.filter((x) => x?.isPinned).slice(0, 2)
    const rest = list.filter((x) => !x?.isPinned).slice(0, 3 - pinned.length)
    const show = [...pinned, ...rest].slice(0, 3)
    const isToday = key === isoDayKey(new Date())

    return (
        <motion.article
            role="listitem"
            className={`
                flex gap-3 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm
                xl:h-full xl:min-h-[min(280px,42vh)] xl:flex-col xl:gap-0 xl:rounded-none xl:border-0 xl:border-r xl:border-slate-200/90 xl:bg-transparent xl:p-0 xl:shadow-none
                xl:last:border-r-0
                ${isToday ? 'ring-2 ring-[#C6FF00]/45 ring-offset-2 ring-offset-white xl:ring-0 xl:ring-offset-0 xl:bg-[#f7fee7]/40' : ''}
            `}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.04 * index }}
            whileHover={{ y: 0 }}
        >
            {/* Day label — narrow column on mobile, band on desktop */}
            <Link
                to={`${ANIME_HUB_PATHS.calendar}?date=${encodeURIComponent(key)}`}
                className={`
                    group flex w-[4.25rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 text-center
                    xl:w-full xl:flex-row xl:justify-between xl:rounded-none xl:px-2.5 xl:py-2.5
                    ${isToday ? 'bg-[#C6FF00] text-slate-900' : 'bg-slate-100 text-slate-700 xl:bg-white xl:text-slate-800'}
                    ${focusRing}
                `}
                aria-label={`Open calendar for ${label} ${dnum}`}
            >
                <div>
                    <p className={`text-[9px] font-black uppercase tracking-[0.12em] ${isToday ? 'text-slate-800' : 'text-slate-500 xl:text-slate-500'}`}>
                        {isToday ? 'Today' : label}
                    </p>
                    <p className="mt-0.5 text-[17px] font-black tabular-nums leading-none tracking-tight sm:text-[19px]">
                        {dnum}
                    </p>
                </div>
                <span
                    className={`
                        mt-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold tabular-nums
                        xl:mt-0 xl:px-2 xl:py-1 xl:text-[9px]
                        ${pinned.length
                        ? isToday
                            ? 'bg-slate-900/10 text-slate-900'
                            : 'bg-[#C6FF00]/35 text-slate-900 xl:bg-[#C6FF00]/25 xl:text-slate-800'
                        : isToday
                            ? 'bg-slate-900/10 text-slate-800'
                            : 'bg-white/80 text-slate-600 xl:bg-slate-100 xl:text-slate-700'}
                    `}
                >
                    {pinned.length ? <FaStar className="h-2 w-2 xl:h-2.5 xl:w-2.5" aria-hidden /> : <FaCalendarAlt className="h-2 w-2 xl:h-2.5 xl:w-2.5" aria-hidden />}
                    {list.length}
                </span>
            </Link>

            <div className="min-w-0 flex-1 xl:border-t-0 xl:bg-white xl:p-2.5">
                {loading ? (
                    <div className="space-y-2">
                        <div className="h-11 rounded-xl bg-slate-100 animate-pulse" />
                        <div className="h-11 rounded-xl bg-slate-100 animate-pulse" />
                        <div className="hidden h-11 rounded-xl bg-slate-100 animate-pulse xl:block" />
                    </div>
                ) : show.length ? (
                    <ul className="space-y-2">
                        {show.map((it, i) => (
                            <li
                                key={`${key}-${it?.malId}-${it?.episodeNumber}-${i}`}
                                className={`
                                    flex items-center gap-2 rounded-xl border px-2 py-2
                                    ${it?.isPinned ? 'border-[#C6FF00]/50 bg-[#f7fee7]/80' : 'border-slate-200/80 bg-slate-50/80'}
                                `}
                            >
                                <div className="h-9 w-8 shrink-0 overflow-hidden rounded-lg bg-slate-200 ring-1 ring-slate-200/80">
                                    {it?.imageUrl ? <img src={it.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[11px] font-bold leading-tight text-slate-900">
                                        {it?.title || 'Anime'}
                                    </p>
                                    <p className="mt-0.5 font-mono text-[9px] font-semibold tabular-nums text-slate-500">
                                        EP {it?.episodeNumber || '?'}
                                    </p>
                                </div>
                                {it?.isPinned ? (
                                    <span className="shrink-0 rounded-md bg-slate-900 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
                                        Pin
                                    </span>
                                ) : null}
                            </li>
                        ))}
                        {list.length > show.length ? (
                            <li className="px-0.5 text-[10px] font-medium text-slate-500">
                                +{list.length - show.length} more in calendar
                            </li>
                        ) : null}
                    </ul>
                ) : (
                    <div className="flex min-h-[5.5rem] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-2 py-3">
                        <p className="text-center text-[10px] font-medium text-slate-500">Quiet day</p>
                    </div>
                )}
            </div>
        </motion.article>
    )
}

export function LifeSyncAnimeHub() {
    const { isLifeSyncConnected, lifeSyncUser } = useLifeSync()
    const prefs = lifeSyncUser?.preferences
    const animePluginOn = isPluginEnabled(prefs, 'pluginAnimeEnabled')
    const mangaPluginOn = isPluginEnabled(prefs, 'pluginMangaEnabled')
    const hentaiVisible = isLifeSyncHentaiHubVisible(prefs)
    const nsfwEnabled = Boolean(prefs?.nsfwContentEnabled)

    const [weekBusy, setWeekBusy] = useState(false)
    const [weekError, setWeekError] = useState('')
    const [weekDays, setWeekDays] = useState(() => ({}))
    const [weekReloadTick, setWeekReloadTick] = useState(0)

    const weekStart = useMemo(() => startOfWeekMonday(), [])

    const weekList = useMemo(
        () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
        [weekStart]
    )

    const { entries: animeWatchEntries, loading: animeWatchLoading } = useAnimeWatchHistory({
        enabled: isLifeSyncConnected && animePluginOn,
    })
    const { visibleEntries: mangaReadingVisible, loading: mangaReadingLoading } = useMangaReadingList({
        enabled: isLifeSyncConnected && mangaPluginOn,
        nsfwEnabled,
    })

    useEffect(() => {
        if (!isLifeSyncConnected || !animePluginOn) return
        let cancelled = false

        const run = async () => {
            if (!cancelled) {
                setWeekBusy(true)
                setWeekError('')
            }

            try {
                const monthKeys = [...new Set(weekList.map((day) => `${day.getFullYear()}-${day.getMonth() + 1}`))]
                const res = await Promise.all(
                    monthKeys.map(async (monthKey) => {
                        const [yy, mm] = monthKey.split('-').map(Number)
                        try {
                            return await fetchCalendarMonthCached(yy, mm)
                        } catch {
                            return { at: Date.now(), days: {}, pins: [] }
                        }
                    })
                )

                const merged = {}
                for (const pack of res) {
                    const d = pack?.days && typeof pack.days === 'object' ? pack.days : {}
                    for (const [k, v] of Object.entries(d)) {
                        if (!merged[k]) merged[k] = []
                        if (Array.isArray(v)) merged[k].push(...v)
                    }
                }

                const out = {}
                for (const day of weekList) {
                    const k = isoDayKey(day)
                    const arr = Array.isArray(merged[k]) ? merged[k] : []
                    out[k] = [...arr].sort((x, y) => {
                        const xp = x?.isPinned ? Number(x?.priority || 999) : 999999
                        const yp = y?.isPinned ? Number(y?.priority || 999) : 999999
                        if (xp !== yp) return xp - yp
                        const xt = x?.airedAt ? new Date(x.airedAt).getTime() : 0
                        const yt = y?.airedAt ? new Date(y.airedAt).getTime() : 0
                        return xt - yt
                    })
                }
                if (!cancelled) setWeekDays(out)
            } catch (e) {
                if (!cancelled) {
                    setWeekDays({})
                    setWeekError(e?.message || 'We couldn’t load your weekly schedule. Try again.')
                }
            } finally {
                if (!cancelled) setWeekBusy(false)
            }
        }

        run()
        return () => { cancelled = true }
    }, [animePluginOn, isLifeSyncConnected, weekList, weekReloadTick])

    const weeklyStats = useMemo(() => {
        let scheduled = 0
        let pinned = 0

        for (const day of weekList) {
            const key = isoDayKey(day)
            const list = Array.isArray(weekDays?.[key]) ? weekDays[key] : []
            scheduled += list.length
            pinned += list.reduce((acc, item) => (item?.isPinned ? acc + 1 : acc), 0)
        }

        return { scheduled, pinned }
    }, [weekDays, weekList])

    const animePool = useDailyValidatedPool('anime', POOL.anime)
    const mangaPool = useDailyValidatedPool('manga', POOL.manga)
    const hentaiPool = useDailyValidatedPool('hentai', POOL.hentai)

    const exploreTiles = useMemo(
        () => {
            const tiles = buildAnimeExploreTiles({ animePluginOn, mangaPluginOn, hentaiVisible })
            return tiles.map((t) => {
                if (t.id === 'seasonal') return { ...t, pool: animePool }
                if (t.id === 'manga') return { ...t, pool: mangaPool }
                if (t.id === 'hentai') return { ...t, pool: hentaiPool }
                return t
            })
        },
        [animePluginOn, hentaiVisible, mangaPluginOn, animePool, mangaPool, hentaiPool]
    )

    const weekCardsLoading = weekBusy && !weekError && weeklyStats.scheduled === 0
    const retryWeek = () => setWeekReloadTick((n) => n + 1)

    if (!isLifeSyncConnected) {
        return (
            <HubConnectPrompt
                embedded
                title="LifeSync not connected"
                body="Link your LifeSync account under Profile → Integrations to open anime and manga."
            />
        )
    }

    if (!isLifeSyncAnimeNavVisible(prefs)) {
        return (
            <HubConnectPrompt
                title="No anime features enabled"
                body="Turn on Anime, Manga, or Hentai Ocean (with NSFW allowed) under Profile → Integrations."
            />
        )
    }

    const showProgressBlock = animePluginOn || mangaPluginOn
    const hasProgressRails =
        (animePluginOn && (animeWatchLoading || animeWatchEntries.length > 0)) ||
        (mangaPluginOn && (mangaReadingLoading || mangaReadingVisible.length > 0))

    return (
        <div className="relative">
            <header className="relative mb-6 sm:mb-8">
                <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-white via-[#f8fafc] to-indigo-50/60 p-5 text-slate-900 shadow-[0_28px_60px_-32px_rgba(15,23,42,0.18)] sm:p-6 lg:p-7">
                    <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#C6FF00]/20 blur-3xl" aria-hidden />
                    <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-indigo-300/25 blur-3xl" aria-hidden />
                    <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#C6FF00] text-slate-900 shadow-lg shadow-[#C6FF00]/25 sm:h-14 sm:w-14">
                                <FaFilm className="h-6 w-6 sm:h-7 sm:w-7" />
                            </div>
                            <div className="min-w-0 pt-0.5">
                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">LifeSync</p>
                                <h1 className="mt-1 text-[24px] font-bold leading-tight tracking-tight sm:text-[30px] lg:text-[32px]">Anime &amp; media</h1>
                                <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-slate-600 sm:text-[14px]">
                                    <span className="lg:hidden">Browse, resume, and scan this week’s airings in one place.</span>
                                    <span className="hidden lg:inline">
                                        Seasonal charts, your shelf, and a seven-day broadcast strip — built for quick jumps and catch-up.
                                    </span>
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3 sm:shrink-0 sm:items-end">
                            <div className="flex flex-wrap gap-2 sm:justify-end">
                            <span className="rounded-full bg-white/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 ring-1 ring-slate-200/80">
                                {animePluginOn ? 'Anime on' : 'Anime off'}
                            </span>
                            <span className="rounded-full bg-white/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 ring-1 ring-slate-200/80">
                                {mangaPluginOn ? 'Manga on' : 'Manga off'}
                            </span>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {animePluginOn ? (
                                    <>
                                        <Link
                                            to={ANIME_HUB_PATHS.seasonal}
                                            className={`inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-white px-4 text-[12px] font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-slate-50 ${focusRing}`}
                                        >
                                            Seasonal
                                        </Link>
                                        <Link
                                            to={ANIME_HUB_PATHS.calendar}
                                            className={`inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-[#C6FF00] px-4 text-[12px] font-semibold text-slate-900 shadow-sm shadow-[#C6FF00]/20 transition hover:brightness-95 ${focusRing}`}
                                        >
                                            Calendar
                                        </Link>
                                    </>
                                ) : null}
                                {mangaPluginOn ? (
                                    <Link
                                        to={ANIME_HUB_PATHS.mangaHome}
                                        className={`inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-white px-4 text-[12px] font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-slate-50 ${focusRing}`}
                                    >
                                        Manga
                                    </Link>
                                ) : null}
                                {!animePluginOn && !mangaPluginOn ? (
                                    <Link
                                        to="/dashboard/profile?tab=integrations"
                                        className={`inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-white px-4 text-[12px] font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-slate-50 ${focusRing}`}
                                    >
                                        Turn on features
                                    </Link>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {showProgressBlock ? (
                <div className="mt-5 sm:mt-7">
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.42, delay: 0.06, type: 'spring', stiffness: 220, damping: 26 }}
                    >
                        <section className="rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-[0_22px_55px_-28px_rgba(15,23,42,0.2)] sm:p-5 lg:p-6">
                            <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Continue</p>
                                    <h2 className="mt-1 text-[20px] font-black leading-tight tracking-tight text-slate-900 sm:text-[22px]">Resume deck</h2>
                                    <p className="mt-1 text-[12px] text-slate-600">Pick up streams and chapters without hunting through menus.</p>
                                </div>
                                <span className="w-fit rounded-full bg-[#C6FF00]/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900 ring-1 ring-[#C6FF00]/50">
                                    Live sync
                                </span>
                            </div>

                            <div
                                className={
                                    animePluginOn && mangaPluginOn
                                        ? 'grid gap-6 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-slate-100'
                                        : 'space-y-0'
                                }
                            >
                                {animePluginOn ? (
                                    <motion.div
                                        className={`min-w-0 ${animePluginOn && mangaPluginOn ? 'lg:pr-6' : ''}`}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.35, delay: 0.1 }}
                                    >
                                        <LifeSyncHubAnimeWatching
                                            entries={animeWatchEntries}
                                            loading={animeWatchLoading}
                                            className="mb-0"
                                        />
                                    </motion.div>
                                ) : null}

                                {mangaPluginOn ? (
                                    <motion.div
                                        className={`min-w-0 ${animePluginOn && mangaPluginOn ? 'border-t border-slate-100 pt-6 lg:border-t-0 lg:pt-0 lg:pl-6' : ''}`}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.35, delay: 0.16 }}
                                    >
                                        <LifeSyncHubMangaReading
                                            entries={mangaReadingVisible}
                                            loading={mangaReadingLoading}
                                            className="mb-0"
                                        />
                                    </motion.div>
                                ) : null}
                            </div>

                            {!hasProgressRails && !animeWatchLoading && !mangaReadingLoading ? (
                                <motion.p
                                    className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5 text-center text-[12px] font-medium leading-relaxed text-slate-600 sm:px-6 sm:py-6 sm:text-[13px]"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.42, delay: 0.2 }}
                                >
                                    Start an anime episode or manga chapter and your resumable rails will appear here.
                                </motion.p>
                            ) : null}
                        </section>
                    </motion.div>
                </div>
            ) : null}

            <div className="mt-6 sm:mt-8">
                <AnimeHubExploreSection tiles={exploreTiles} />
            </div>

            {animePluginOn ? (
                <AnimeHubBroadcastWeekSection
                    weekBusy={weekBusy}
                    weekError={weekError}
                    onRetry={retryWeek}
                    weekList={weekList}
                    weekDays={weekDays}
                    weekCardsLoading={weekCardsLoading}
                    scheduledCount={weeklyStats.scheduled}
                    pinnedCount={weeklyStats.pinned}
                />
            ) : null}
        </div>
    )
}

