import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
    FaArrowRight,
    FaBolt,
    FaCalendarAlt,
    FaChevronRight,
    FaClock,
    FaFilm,
    FaGamepad,
    FaGift,
    FaNewspaper,
    FaSearch,
    FaShieldAlt,
    FaStar,
    FaTags,
} from 'react-icons/fa'
import { LifeSyncHubMangaReading } from '../../components/lifesync/MangaReadingRail'
import { LifeSyncHubAnimeWatching } from '../../components/lifesync/AnimeHubWatchingRail'
import { useLifeSync } from '../../context/LifeSyncContext'
import { useBatchContentLists } from '../../hooks/useBatchContentLists'
import { filterMangaReadingByNsfw } from '../../hooks/useMangaReadingList'
import {
    isLifeSyncAnimeNavVisible,
    isLifeSyncCrackGamesVisible,
    isLifeSyncHManhwaVisible,
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
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mx-color-a78bfa)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mx-color-faf8ff)]'

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
    gamerant: [570630, 1172620, 1438720, 1174180, 813820, 1651210, 1466560, 1328730, 1313860, 1086940].map(id => `${SC}/${id}/header.jpg`),
    deals: [1091500, 1245620, 413150, 1145360, 1174180, 1599340, 2050650, 1364780, 1657630, 2215430].map(id => `${SC}/${id}/header.jpg`),
    gamesearch: [1245620, 1091500, 990080, 1888930, 1817070, 1623730, 2050650, 367520].map(id => `${SC}/${id}/header.jpg`),
    releases: [990080, 1888930, 1716740, 1517290, 1174180, 2050650, 1086940, 1245620].map(id => `${SC}/${id}/header.jpg`),
    crackstatus: [1245620, 1091500, 990080, 1174180, 1888930, 1599340, 2050650, 1086940].map(id => `${SC}/${id}/header.jpg`),
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
        'https://cdn.myanimelist.net/images/anime/1223/96541.jpg'
    ],
    manga: [
        'https://static.comix.to/c9c8/i/b/b6/68e121be6ed89@280.jpg',
        'https://static.comix.to/7e11/i/a/2c/68de7df78456e@280.jpg',
        'https://static.comix.to/42c2/i/a/59/68de7a7941f40@280.jpg',
        'https://static.comix.to/c32a/i/d/dc/68e0957e2f38a@280.jpg',
        'https://static.comix.to/b6d4/i/4/df/68de759b28ee4@280.jpg',
        'https://static.comix.to/9a48/i/d/45/68de753270514@280.jpg',
        'https://static.comix.to/6941/i/0/c5/68de6bed96e7b@280.jpg',
        'https://static.comix.to/52fd/i/7/bc/68de7ab171b14@280.jpg'
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
        'https://watchhentai.net/uploads/2025/natsu-to-hako/poster.jpg'
    ],
    manhwa: [
        'https://mangadistrict.com/wp-content/uploads/2026/01/Everyones-Man-Uncensored-Edit-2.png',
        'https://cdn.mangadistrict.com/thumbnail/snapping-into-love-uncensored-2.webp',
        'https://cdn.mangadistrict.com/thumbnail/dont-tell-anyone-at-school-uncensored-official.webp',
        'https://mangadistrict.com/wp-content/uploads/2025/11/Troublesome-Employee-Warning-Uncensored-Edited.png',
        'https://cdn.mangadistrict.com/thumbnail/im-the-only-man-in-this-clan-official.webp',
        'https://cdn.mangadistrict.com/thumbnail/daddys-girl-carcass-official.webp',
        'https://cdn.mangadistrict.com/thumbnail/the-double-life-of-a-public-official-official.webp',
        'https://cdn.mangadistrict.com/thumbnail/only-with-consent.webp',
        'https://cdn.mangadistrict.com/thumbnail/secret-class.webp'
    ]
}

function Thumb({ src }) {
    const [ok, setOk] = useState(true)
    if (!ok) return <div className="h-full w-full" />
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
            className={`group relative block overflow-hidden rounded-[22px] bg-[var(--color-surface)] shadow-[0_10px_34px_-18px_rgba(21, 20, 24,0.35)] ring-1 ring-slate-200/80 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_-26px_rgba(21, 20, 24,0.35)] sm:rounded-[26px] ${focusRing} ${className}`}
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
                            <span className={`mb-1 inline-flex w-fit items-center rounded-full bg-[var(--color-surface)]/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-white shadow-sm ring-1 ring-[var(--color-border-strong)]/20 ${badgeClass || ''}`}>
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

                    <span className="shrink-0 inline-flex items-center gap-2 rounded-full bg-[var(--color-surface)]/15 px-3 py-2 text-[11px] font-bold text-white shadow-sm ring-1 ring-[var(--color-border-strong)]/20 backdrop-blur transition group-hover:bg-[var(--color-surface)]/20">
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
            className={`flex min-h-[104px] items-center gap-3 rounded-2xl border border-slate-200/90 bg-[var(--color-surface)] p-3 shadow-sm ring-1 ring-slate-100/80 transition hover:bg-slate-50/60 active:scale-[0.99] sm:min-h-[104px] sm:gap-4 sm:p-4 ${focusRing}`}
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
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--mx-color-64748b)] line-clamp-2 sm:mt-1 sm:text-[12px]">{subtitle}</p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-2xl bg-[var(--mx-color-c6ff00)]/25 text-slate-900 shadow-sm ring-1 ring-[var(--mx-color-c6ff00)]/40 sm:h-12 sm:w-12">
                <FaChevronRight className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden />
            </div>
        </MotionLink>
    )
}

/** Anime explore lane card with portrait poster strip (no oversized hero art). */
function AnimeExploreLaneCard({ tile, compact = false, className = '' }) {
    const posters = useMemo(() => {
        const pool = Array.isArray(tile?.pool) ? tile.pool : []
        return shuffle(pool).slice(0, compact ? 4 : 6)
    }, [tile, compact])

    return (
        <MotionLink
            to={tile?.to || '#'}
            className={`group block overflow-hidden rounded-[22px] border border-slate-200/85 p-3.5 shadow-[0_14px_34px_-24px_rgba(21, 20, 24,0.36)] ring-1 ring-[var(--color-border-strong)]/70 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_56px_-30px_rgba(21, 20, 24,0.42)] sm:p-4 ${focusRing} ${className}`}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.995 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="truncate text-[18px] font-black tracking-tight text-slate-900 sm:text-[20px]">
                        {tile?.title || 'Destination'}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-slate-600 sm:text-[13px]">
                        {tile?.subtitle || ''}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                    {tile?.badge ? (
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] ${tile.badgeClass || 'bg-slate-100 text-slate-700'}`}>
                            {tile.badge}
                        </span>
                    ) : null}
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm transition group-hover:bg-slate-700">
                        <FaArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </span>
                </div>
            </div>

            <div className={`mt-3 grid gap-2 ${compact ? 'grid-cols-4' : 'grid-cols-6'}`}>
                {posters.map((src, i) => (
                    <div key={`${tile?.id || 't'}-poster-${i}`} className="overflow-hidden rounded-xl border border-slate-200/80 bg-slate-100 shadow-sm">
                        <LifesyncEpisodeThumbnail
                            src={src}
                            className={compact ? 'aspect-[2/3] w-full' : 'h-[156px] w-full xl:h-[182px]'}
                            imgClassName="h-full w-full object-cover"
                            imgProps={{ referrerPolicy: 'no-referrer' }}
                        />
                    </div>
                ))}
            </div>
        </MotionLink>
    )
}

function GameHubFastTravelTile({ to, icon, title, subtitle }) {
    const IconComponent = icon

    return (
        <Link
            to={to}
            className={`group relative overflow-hidden rounded-2xl px-3.5 py-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:px-4 sm:py-4 ${focusRing}`}
        >
            <div className="pointer-events-none absolute inset-0" aria-hidden />
            <div className="relative flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white ring-1 ring-slate-200/80">
                    <IconComponent className="h-4.5 w-4.5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-black tracking-tight text-slate-900">{title}</span>
                    <span className="mt-1 block text-[11px] leading-snug text-slate-600">{subtitle}</span>
                </span>
                <FaChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition group-hover:text-slate-900" aria-hidden />
            </div>
        </Link>
    )
}

function HubConnectPrompt({ title, body, embedded = false }) {
    const inner = (
        <div className="flex min-h-[50vh] items-center justify-center px-2 py-10 sm:py-14">
            <MotionDiv
                className="w-full max-w-md rounded-[22px] bg-[var(--color-surface)] px-6 py-9 text-center shadow-sm sm:px-8 sm:py-10"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
                <p className="text-[16px] font-bold text-[var(--mx-color-1d1d1f)] sm:text-[17px]">{title}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--mx-color-86868b)]">{body}</p>
                <Link
                    to="/dashboard/profile?tab=integrations"
                    className={`mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[var(--mx-color-c6ff00)] px-5 text-[13px] font-semibold text-[var(--mx-color-1a1628)] shadow-sm transition-all hover:brightness-95 sm:w-auto sm:min-w-[200px] ${focusRing}`}
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
            className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--mx-color-5b5670)] sm:text-xs"
        >
            <span className="h-px w-6 rounded-full bg-gradient-to-r from-[var(--mx-color-c6ff00)] to-[var(--mx-color-a78bfa)] sm:w-8" aria-hidden />
            {children}
        </h2>
    )
}

export function LifeSyncGamesHub() {
    const { isLifeSyncConnected, lifeSyncUser } = useLifeSync()
    const crackGamesPluginOn = isLifeSyncCrackGamesVisible(lifeSyncUser?.preferences)

    if (!isLifeSyncConnected) {
        return (
            <HubConnectPrompt
                title="LifeSync not connected"
                body="Link your LifeSync account under Profile → Integrations to browse games hubs."
            />
        )
    }

    const gamesHeroMinH = 'lg:min-h-[min(470px,calc(100dvh-190px))]'
    const connectedRouteCount = crackGamesPluginOn ? 8 : 6
    const intelLaneCount = crackGamesPluginOn ? 4 : 2

    const mainDeckTiles = [
        {
            id: 'wishlist',
            to: '/dashboard/lifesync/games/wishlist',
            pool: POOL.wishlist,
            title: 'Wishlist',
            subtitle: 'Your saved targets and reminders',
            gradient: 'bg-gradient-to-t from-[var(--mx-color-faf5ff)] via-[var(--color-surface)]/65 to-transparent',
        },
        {
            id: 'xbox',
            to: '/dashboard/lifesync/games/xbox',
            pool: POOL.xbox,
            title: 'Xbox',
            subtitle: 'Store highlights and platform offers',
            gradient: 'bg-gradient-to-t from-[var(--mx-color-ecfdf5)] via-[var(--color-surface)]/60 to-transparent',
        },
        {
            id: 'deals',
            to: '/dashboard/lifesync/games/deals',
            pool: POOL.deals,
            title: 'Deal radar',
            subtitle: 'CheapShark price drops and bundle spikes',
            gradient: 'bg-gradient-to-t from-[var(--mx-color-f0fdf4)] via-[var(--color-surface)]/60 to-transparent',
        },
    ]

    const discoveryTiles = [
        {
            id: 'news',
            to: '/dashboard/lifesync/games/gamerant',
            pool: POOL.gamerant,
            title: 'Gaming news',
            subtitle: 'Headline sweep for quick context before you play',
            gradient: 'bg-gradient-to-t from-[var(--mx-color-fef2f2)] via-[var(--color-surface)]/60 to-transparent',
        },
        ...(crackGamesPluginOn
            ? [{
                id: 'search',
                to: '/dashboard/lifesync/games/search',
                pool: POOL.gamesearch,
                title: 'Game search',
                subtitle: 'Cross-provider links and crack metadata lookup',
                gradient: 'bg-gradient-to-t from-[var(--mx-color-eef2ff)] via-[var(--color-surface)]/60 to-transparent',
            }]
            : []),
        {
            id: 'releases',
            to: '/dashboard/lifesync/games/releases',
            pool: POOL.releases,
            title: 'Release calendar',
            subtitle: 'Upcoming launches grouped by day and window',
            gradient: 'bg-gradient-to-t from-[var(--mx-color-ecfeff)] via-[var(--color-surface)]/60 to-transparent',
        },
        ...(crackGamesPluginOn
            ? [{
                id: 'crack-status',
                to: '/dashboard/lifesync/games/crack-status',
                pool: POOL.crackstatus,
                title: 'Crack status',
                subtitle: 'Protection history, timeline, and release notes',
                gradient: 'bg-gradient-to-t from-[var(--mx-color-fff7ed)] via-[var(--color-surface)]/60 to-transparent',
            }]
            : []),
    ]

    const fastTravelTiles = [
        {
            id: 'steam',
            to: '/dashboard/lifesync/games/steam',
            icon: FaBolt,
            title: 'Launch Steam hub',
            subtitle: 'Library, profile, and current storefront state.',
            accent: 'from-cyan-50 to-indigo-50',
        },
        {
            id: 'deals',
            to: '/dashboard/lifesync/games/deals',
            icon: FaTags,
            title: 'Track live deals',
            subtitle: 'Jump straight to active pricing changes.',
            accent: 'from-emerald-50 to-lime-50',
        },
        {
            id: 'news',
            to: '/dashboard/lifesync/games/gamerant',
            icon: FaNewspaper,
            title: 'Read news pulse',
            subtitle: 'Open current gaming headlines and updates.',
            accent: 'from-rose-50 to-orange-50',
        },
        ...(crackGamesPluginOn
            ? [{
                id: 'search',
                to: '/dashboard/lifesync/games/search',
                icon: FaSearch,
                title: 'Run game lookup',
                subtitle: 'Search by title and compare provider links.',
                accent: 'from-violet-50 to-fuchsia-50',
            }]
            : []),
        {
            id: 'releases',
            to: '/dashboard/lifesync/games/releases',
            icon: FaClock,
            title: 'Watch launch dates',
            subtitle: 'See what is dropping next across your list.',
            accent: 'from-sky-50 to-cyan-50',
        },
        ...(crackGamesPluginOn
            ? [{
                id: 'status',
                to: '/dashboard/lifesync/games/crack-status',
                icon: FaShieldAlt,
                title: 'Open status intel',
                subtitle: 'Review crack/protection timelines in one view.',
                accent: 'from-amber-50 to-yellow-50',
            }]
            : []),
        {
            id: 'wishlist',
            to: '/dashboard/lifesync/games/wishlist',
            icon: FaGift,
            title: 'Review wishlist',
            subtitle: 'Your saved titles and pending grabs.',
            accent: 'from-pink-50 to-rose-50',
        },
        {
            id: 'xbox',
            to: '/dashboard/lifesync/games/xbox',
            icon: FaGamepad,
            title: 'Switch to Xbox',
            subtitle: 'Platform deals and console store picks.',
            accent: 'from-emerald-50 to-teal-50',
        },
    ]
    const fastTravelRouteCount = fastTravelTiles.length

    return (
        <HubShell>
            <div className="lifesync-category-borderless">
            <header className="relative mb-7 sm:mb-8 lg:mb-10">
                <div className="overflow-hidden rounded-[30px] border border-slate-200/85 p-4 shadow-[0_30px_70px_-34px_rgba(21, 20, 24,0.28)] sm:p-6 lg:p-7">
                    <div className="pointer-events-none absolute -right-14 -top-20 h-56 w-56 rounded-full bg-sky-300/30 blur-3xl" aria-hidden />
                    <div className="pointer-events-none absolute -left-10 bottom-0 h-44 w-44 rounded-full bg-[var(--mx-color-c6ff00)]/25 blur-3xl" aria-hidden />

                    <div className="relative grid gap-6 lg:grid-cols-12 lg:items-center">
                        <div className="lg:col-span-8">
                            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-surface)]/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 ring-1 ring-slate-200/80">
                                <FaBolt className="h-3 w-3 text-slate-900" aria-hidden />
                                Game Hub
                            </div>

                            <div className="mt-3 flex items-start gap-3 sm:gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--mx-color-c6ff00)] text-slate-900 shadow-lg shadow-[var(--mx-color-c6ff00)]/30 sm:h-14 sm:w-14">
                                    <FaGamepad className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
                                </div>
                                <div className="min-w-0 pt-0.5">
                                    <h1 className="text-[27px] font-black leading-tight tracking-tight text-slate-900 sm:text-[33px] lg:text-[36px]">
                                        Player command center
                                    </h1>
                                    <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-slate-600 sm:text-[14px]">
                                        {crackGamesPluginOn
                                            ? 'Run your game stack from one hub: storefronts, deals, news, release timing, and status checks. Steam anchors the deck while tactical modules stay one click away.'
                                            : 'Run your game stack from one hub: storefronts, deals, news, and release timing. Steam anchors the deck while tactical modules stay one click away.'}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2.5">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 ring-1 ring-sky-100">
                                    <FaBolt className="h-3 w-3" aria-hidden />
                                    Steam first
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 ring-1 ring-emerald-100">
                                    <FaTags className="h-3 w-3" aria-hidden />
                                    Deal aware
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 ring-1 ring-amber-100">
                                    <FaCalendarAlt className="h-3 w-3" aria-hidden />
                                    Launch tracking
                                </span>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2.5 sm:gap-3">
                                <Link
                                    to="/dashboard/lifesync/games/steam"
                                    className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-[12px] font-semibold text-white shadow-sm transition hover:bg-slate-800 ${focusRing}`}
                                >
                                    Open Steam
                                    <FaArrowRight className="h-3.5 w-3.5" aria-hidden />
                                </Link>
                                <Link
                                    to="/dashboard/lifesync/games/deals"
                                    className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-[var(--mx-color-c6ff00)] px-4 text-[12px] font-semibold text-slate-900 shadow-sm transition hover:brightness-95 ${focusRing}`}
                                >
                                    View live deals
                                    <FaChevronRight className="h-3.5 w-3.5" aria-hidden />
                                </Link>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:gap-3.5 lg:col-span-4">
                            <div className="rounded-2xl border border-slate-200/80 bg-[var(--color-surface)]/85 p-3 shadow-sm">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Modules</p>
                                <p className="mt-1 text-[26px] font-black leading-none tracking-tight text-slate-900">{connectedRouteCount}</p>
                                <p className="mt-1 text-[10px] text-slate-600">Connected routes</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200/80 bg-[var(--color-surface)]/85 p-3 shadow-sm">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Intel lanes</p>
                                <p className="mt-1 text-[26px] font-black leading-none tracking-tight text-slate-900">{intelLaneCount}</p>
                                <p className="mt-1 text-[10px] text-slate-600">{crackGamesPluginOn ? 'News + search + status' : 'News + releases'}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200/80 bg-[var(--color-surface)]/85 p-3 shadow-sm">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Storefronts</p>
                                <p className="mt-1 text-[26px] font-black leading-none tracking-tight text-slate-900">2</p>
                                <p className="mt-1 text-[10px] text-slate-600">Steam and Xbox</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200/80 bg-[var(--color-surface)]/85 p-3 shadow-sm">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Daily mode</p>
                                <p className="mt-1 text-[26px] font-black leading-none tracking-tight text-slate-900">Live</p>
                                <p className="mt-1 text-[10px] text-slate-600">Deals and releases</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <section aria-labelledby="lifesync-games-maindeck-label">
                <SectionLabel id="lifesync-games-maindeck-label">Main Deck</SectionLabel>
                <p className="mt-1 mb-4 text-[12px] text-[var(--mx-color-5b5670)] lg:mb-5 lg:text-[13px]">
                    <span className="lg:hidden">Steam drives the front slot. Wishlist, Xbox, and deal radar stay stacked for quick tactical jumps.</span>
                    <span className="hidden lg:inline">Steam occupies the command lane; wishlist, Xbox, and deal radar fill the tactical stack on the right.</span>
                </p>

                <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-stretch lg:gap-6 xl:gap-8">
                    <BentoCard
                        to="/dashboard/lifesync/games/steam"
                        pool={POOL.steam}
                        cols={3}
                        rows={3}
                        title="Steam command"
                        subtitle="Library pulse, storefront momentum, and account sync in one launcher."
                        gradient="bg-gradient-to-t from-[var(--mx-color-e0f2fe)] via-[var(--color-surface)]/70 to-transparent"
                        className={`min-h-[240px] w-full shrink-0 sm:min-h-[280px] lg:col-span-8 xl:col-span-8 ${gamesHeroMinH}`}
                    />
                    <div className="grid grid-cols-1 gap-3.5 lg:col-span-4 lg:grid-cols-1 lg:gap-5 xl:col-span-4 xl:gap-6">
                        {mainDeckTiles.map((tile) => (
                            <BentoCard
                                key={tile.id}
                                to={tile.to}
                                pool={tile.pool}
                                cols={2}
                                rows={2}
                                title={tile.title}
                                subtitle={tile.subtitle}
                                gradient={tile.gradient}
                                className="min-h-[168px] w-full lg:flex lg:flex-col"
                            />
                        ))}
                    </div>
                </div>
            </section>

            <section aria-labelledby="lifesync-games-discovery-label" className="mt-8 sm:mt-10">
                <SectionLabel id="lifesync-games-discovery-label">Discovery Lanes</SectionLabel>
                <p className="mt-1 mb-4 text-[12px] text-[var(--mx-color-5b5670)] lg:mb-5 lg:text-[13px]">
                    <span className="lg:hidden">
                        {crackGamesPluginOn
                            ? 'News, search, launch timeline, and status intel stay grouped for rapid recon.'
                            : 'News and launch timeline stay grouped while crack tools remain hidden.'}
                    </span>
                    <span className="hidden lg:inline">
                        {crackGamesPluginOn
                            ? 'Dedicated intelligence lanes for news, cross-store search, release timing, and crack-status verification.'
                            : 'Dedicated intelligence lanes for news and release timing while crack intelligence remains hidden.'}
                    </span>
                </p>

                <div className="flex flex-col gap-3.5 lg:hidden">
                    {discoveryTiles.map((tile) => (
                        <MobileExploreRow
                            key={tile.id}
                            to={tile.to}
                            pool={tile.pool}
                            title={tile.title}
                            subtitle={tile.subtitle}
                        />
                    ))}
                </div>

                <div className="hidden lg:grid lg:grid-cols-12 lg:gap-5 xl:gap-6">
                    {discoveryTiles.map((tile) => (
                        <BentoCard
                            key={tile.id}
                            to={tile.to}
                            pool={tile.pool}
                            cols={2}
                            rows={2}
                            title={tile.title}
                            subtitle={tile.subtitle}
                            gradient={tile.gradient}
                            className="min-h-[190px] lg:col-span-6"
                        />
                    ))}
                </div>
            </section>

            <section className="mt-8 sm:mt-10 lg:mt-12" aria-labelledby="lifesync-games-fasttravel-label">
                <div className="rounded-[28px] border border-slate-200/80 p-4 shadow-[0_22px_58px_-28px_rgba(21, 20, 24,0.2)] sm:p-5 lg:p-6">
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h2
                                id="lifesync-games-fasttravel-label"
                                className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 sm:text-xs"
                            >
                                Fast Travel
                            </h2>
                            <p className="mt-1 text-[12px] leading-relaxed text-slate-600 sm:text-[13px]">
                                Shortcut grid for direct jumps into each game lane.
                            </p>
                        </div>
                        <span className="inline-flex w-fit items-center rounded-full bg-[var(--mx-color-c6ff00)]/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-900 ring-1 ring-[var(--mx-color-c6ff00)]/45">
                            {fastTravelRouteCount} routes
                        </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {fastTravelTiles.map((tile) => (
                            <GameHubFastTravelTile
                                key={tile.id}
                                to={tile.to}
                                icon={tile.icon}
                                title={tile.title}
                                subtitle={tile.subtitle}
                            />
                        ))}
                    </div>
                </div>
            </section>
            </div>
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

    const res = await lifesyncFetch(`/api/v1/anime/calendar/month?year=${year}&month=${month1}&tz=${encodeURIComponent(tz)}&view=compact`)
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
    mangaHome: '/dashboard/lifesync/anime/manga',
    hManhwaHome: '/dashboard/lifesync/anime/manga/mangadistrict/latest/page/1',
    hentaiHome: '/dashboard/lifesync/anime/hentai',
}

/**
 * Ordered destinations for the anime area hub (Games-style bento + mobile rows).
 */
function buildAnimeExploreTiles({ animePluginOn, mangaPluginOn, hManhwaVisible, hentaiVisible }) {
    const tiles = []
    if (animePluginOn) {
        tiles.push({
            id: 'seasonal',
            to: ANIME_HUB_PATHS.seasonal,
            pool: POOL.anime,
            cols: 3,
            rows: 3,
            title: 'Anime',
            subtitle: 'MAL seasonal lineups, rankings, search, and your list.',
            gradient: 'bg-gradient-to-t from-[var(--mx-color-e0f2fe)] via-[var(--color-surface)]/70 to-transparent',
            hero: true,
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
            subtitle: 'Comix and Manga District browse, chapters, and reader.',
            gradient: 'bg-gradient-to-t from-[var(--mx-color-fff8eb)] via-[var(--color-surface)]/65 to-transparent',
            hero: !animePluginOn && tiles.length === 0,
        })
    }
    if (hManhwaVisible) {
        tiles.push({
            id: 'h-manhwa',
            to: ANIME_HUB_PATHS.hManhwaHome,
            pool: POOL.manhwa,
            cols: 2,
            rows: 2,
            title: 'H manhwa',
            subtitle: 'Manga District in a separate destination.',
            badge: '18+',
            badgeClass: 'bg-rose-100 text-rose-800',
            gradient: 'bg-gradient-to-t from-[var(--mx-color-ffe4e6)] via-[var(--color-surface)]/60 to-transparent',
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
            title: 'Hentai',
            subtitle: 'Adults-only catalog with its own controls.',
            badge: '18+',
            badgeClass: 'bg-rose-100 text-rose-800',
            gradient: 'bg-gradient-to-t from-[var(--mx-color-ffe4e6)] via-[var(--color-surface)]/60 to-transparent',
            hero: !animePluginOn && !mangaPluginOn,
        })
    }
    return tiles
}

function AnimeHubExploreSection({ tiles }) {
    if (!tiles.length) return null
    const desktopSpanClass = (index, count) => {
        if (count <= 1) return 'lg:col-span-12'
        if (count === 2) return 'lg:col-span-6'
        if (count === 3) return index === 0 ? 'lg:col-span-6' : 'lg:col-span-3'
        return 'lg:col-span-6'
    }

    return (
        <section
            aria-labelledby="lifesync-anime-explore-label"
            className="rounded-[30px] p-4 shadow-[0_26px_60px_-30px_rgba(21, 20, 24,0.24)] backdrop-blur-md sm:p-6 lg:p-7"
        >
            <div className="mb-4 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2
                        id="lifesync-anime-explore-label"
                        className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 sm:text-xs"
                    >
                        Explore
                    </h2>
                    <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-slate-600 sm:text-[13px]">
                        <span className="lg:hidden">Jump into seasonal anime, manga, H manhwa, or 18+ from the cards below.</span>
                        <span className="hidden lg:inline">Primary lane on the left, with adaptive destination cards on the right for faster routing.</span>
                    </p>
                </div>
                <span className="mt-1 inline-flex w-fit items-center rounded-full bg-[var(--mx-color-c6ff00)]/25 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-800 ring-1 ring-[var(--mx-color-c6ff00)]/40 sm:mt-0">
                    {tiles.length} destinations
                </span>
            </div>

            <div className="grid gap-4 lg:hidden">
                {tiles.map((tile) => (
                    <AnimeExploreLaneCard key={`mobile-lane-${tile.id}`} tile={tile} compact />
                ))}
            </div>

            <div className="hidden lg:grid lg:grid-cols-12 lg:gap-5 xl:gap-6">
                {tiles.map((tile, index) => (
                    <AnimeExploreLaneCard
                        key={`desktop-lane-${tile.id}`}
                        tile={tile}
                        className={desktopSpanClass(index, tiles.length)}
                    />
                ))}
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
            <div className="rounded-[28px] border border-slate-200/80 p-3.5 shadow-[0_24px_60px_-30px_rgba(30,27,75,0.2)] backdrop-blur-md sm:p-5 lg:p-6">
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
                    <div className="space-y-4 rounded-2xl p-4 ring-1 ring-slate-200/60 xl:col-span-4 xl:pr-2 xl:ring-0">
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
                            className={`inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--mx-color-c6ff00)] px-4 py-2.5 text-[13px] font-semibold text-[var(--mx-color-1a1628)] shadow-sm transition-all hover:brightness-95 ${focusRing}`}
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
                                className={`inline-flex min-h-[40px] w-fit items-center justify-center rounded-xl bg-[var(--color-surface)] px-3.5 text-[11px] font-bold text-slate-900 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-slate-50 ${focusRing}`}
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
                                            shrink-0 rounded-2xl px-3 py-2 text-left shadow-sm transition
                                            ${isSel ? 'bg-slate-900 text-white' : 'text-slate-900 hover:bg-slate-50'}
                                            ${focusRing}
                                        `}
                                        aria-pressed={isSel}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-black uppercase tracking-[0.16em] ${isSel ? 'text-white/75' : 'text-slate-500'}`}>
                                                {isToday ? 'Today' : dow}
                                            </span>
                                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold tabular-nums ${isSel ? 'bg-[var(--color-surface)]/15 text-white' : 'bg-slate-100 text-slate-700'}`}>
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
                        <div className="mt-4 rounded-2x p-3 sm:p-4">
                            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <p className="text-[11px] font-black tracking-tight text-slate-900">
                                        {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                    </p>
                                    <p className="text-[11px] text-slate-600">Pinned episodes are shown first.</p>
                                </div>
                                <Link
                                    to={`${ANIME_HUB_PATHS.calendar}?date=${encodeURIComponent(selectedKey)}`}
                                    className={`inline-flex min-h-[40px] w-fit items-center justify-center rounded-xl bg-[var(--mx-color-c6ff00)] px-3.5 text-[11px] font-bold text-slate-900 shadow-sm transition hover:brightness-95 ${focusRing}`}
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
                                                ${it?.isPinned ? 'border-[var(--mx-color-c6ff00)]/50 bg-[var(--mx-color-f7fee7)]/70' : 'border-slate-200/80 bg-slate-50/80'}
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
                flex gap-3 rounded-2xl border border-slate-200/90 p-3 shadow-sm
                xl:h-full xl:min-h-[min(280px,42vh)] xl:flex-col xl:gap-0 xl:rounded-none xl:border-0 xl:border-r xl:border-slate-200/90 xl:bg-transparent xl:p-0 xl:shadow-none
                xl:last:border-r-0
                ${isToday ? 'ring-2 ring-[var(--mx-color-c6ff00)]/45 ring-offset-2 ring-offset-white xl:ring-0 xl:ring-offset-0 xl:bg-[var(--mx-color-f7fee7)]/40' : ''}
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
                    ${isToday ? 'bg-[var(--mx-color-c6ff00)] text-slate-900' : 'bg-slate-100 text-slate-700 xl:bg-[var(--color-surface)] xl:text-slate-800'}
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
                            : 'bg-[var(--mx-color-c6ff00)]/35 text-slate-900 xl:bg-[var(--mx-color-c6ff00)]/25 xl:text-slate-800'
                        : isToday
                            ? 'bg-slate-900/10 text-slate-800'
                            : 'bg-[var(--color-surface)]/80 text-slate-600 xl:bg-slate-100 xl:text-slate-700'}
                    `}
                >
                    {pinned.length ? <FaStar className="h-2 w-2 xl:h-2.5 xl:w-2.5" aria-hidden /> : <FaCalendarAlt className="h-2 w-2 xl:h-2.5 xl:w-2.5" aria-hidden />}
                    {list.length}
                </span>
            </Link>

            <div className="min-w-0 flex-1 xl:border-t-0 xl:bg-[var(--color-surface)] xl:p-2.5">
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
                                    ${it?.isPinned ? 'border-[var(--mx-color-c6ff00)]/50 bg-[var(--mx-color-f7fee7)]/80' : 'border-slate-200/80 bg-slate-50/80'}
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
    const hManhwaVisible = isLifeSyncHManhwaVisible(prefs)
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
    const { animeHistory, mangaReading, loading: batchLoading } = useBatchContentLists({
        enabled: isLifeSyncConnected && (animePluginOn || mangaPluginOn),
    })

    const { entries: animeWatchEntries, loading: animeWatchLoading } = useMemo(() => ({
        entries: animeHistory,
        loading: batchLoading,
    }), [animeHistory, batchLoading])

    const { visibleEntries: mangaReadingVisible, loading: mangaReadingLoading } = useMemo(() => ({
        visibleEntries: filterMangaReadingByNsfw(mangaReading, nsfwEnabled, hManhwaVisible),
        loading: batchLoading,
    }), [mangaReading, nsfwEnabled, hManhwaVisible, batchLoading])
    const resumeMobileTabs = useMemo(() => {
        const tabs = []
        if (animePluginOn) {
            tabs.push({
                id: 'anime',
                label: 'Anime',
                count: animeWatchEntries.length,
                loading: animeWatchLoading,
            })
        }
        if (mangaPluginOn) {
            tabs.push({
                id: 'manga',
                label: 'Manga',
                count: mangaReadingVisible.length,
                loading: mangaReadingLoading,
            })
        }
        return tabs
    }, [
        animePluginOn,
        animeWatchEntries.length,
        animeWatchLoading,
        mangaPluginOn,
        mangaReadingVisible.length,
        mangaReadingLoading,
    ])
    const [resumeMobileTab, setResumeMobileTab] = useState('anime')
    const activeResumeMobileTab = resumeMobileTabs.some((tab) => tab.id === resumeMobileTab)
        ? resumeMobileTab
        : (resumeMobileTabs[0]?.id || 'anime')

    

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

    const animePool = useDailyValidatedPool('anime-hub-anime-v3', POOL.anime)
    const mangaPool = useDailyValidatedPool('anime-hub-manga-v3', POOL.manga)
    const hManhwaPool = useDailyValidatedPool('anime-hub-hmanhwa-v3', POOL.manhwa)
    const hentaiPool = useDailyValidatedPool('anime-hub-hentai-v3', POOL.hentai)

    const exploreTiles = useMemo(
        () => {
            const tiles = buildAnimeExploreTiles({ animePluginOn, mangaPluginOn, hManhwaVisible, hentaiVisible })
            return tiles.map((t) => {
                if (t.id === 'seasonal') return { ...t, pool: animePool }
                if (t.id === 'manga') return { ...t, pool: mangaPool }
                if (t.id === 'h-manhwa') return { ...t, pool: hManhwaPool }
                if (t.id === 'hentai') return { ...t, pool: hentaiPool }
                return t
            })
        },
        [animePluginOn, hentaiVisible, hManhwaVisible, mangaPluginOn, animePool, mangaPool, hManhwaPool, hentaiPool]
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
        <div className="relative lifesync-category-borderless">
            <header className="relative mb-6 sm:mb-8">
                <div className="overflow-hidden rounded-[28px] backdrop-blur-md p-5 text-slate-900 shadow-[0_28px_60px_-32px_rgba(21, 20, 24,0.18)] sm:p-6 lg:p-7">
                    <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[var(--mx-color-c6ff00)]/20 blur-3xl" aria-hidden />
                    <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-indigo-300/25 blur-3xl" aria-hidden />
                    <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-slate-900 shadow-lg shadow-[var(--mx-color-c6ff00)]/25 sm:h-14 sm:w-14">
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
                        <section className="rounded-[28px] shadow-[0_26px_60px_-30px_rgba(21, 20, 24,0.24)] backdrop-blur-md sm:p-5 lg:p-6">
                            <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Continue</p>
                                    <h2 className="mt-1 text-[20px] font-black leading-tight tracking-tight text-slate-900 sm:text-[22px]">Resume deck</h2>
                                    <p className="mt-1 text-[12px] text-slate-600">
                                        <span className="lg:hidden">Mobile-first quick resume. Switch lanes and jump back in.</span>
                                        <span className="hidden lg:inline">Pick up streams and chapters without hunting through menus.</span>
                                    </p>
                                </div>
                                <span className="w-fit rounded-full bg-[var(--mx-color-c6ff00)]/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900 ring-1 ring-[var(--mx-color-c6ff00)]/50">
                                    Live sync
                                </span>
                            </div>

                            {resumeMobileTabs.length > 1 ? (
                                <div className="mb-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-1.5 lg:hidden">
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {resumeMobileTabs.map((tab) => {
                                            const active = tab.id === activeResumeMobileTab
                                            return (
                                                <button
                                                    key={`resume-mobile-tab-${tab.id}`}
                                                    type="button"
                                                    onClick={() => setResumeMobileTab(tab.id)}
                                                    className={`flex min-h-[44px] items-center justify-between rounded-xl px-3 py-2 text-[12px] font-semibold transition ${
                                                        active
                                                            ? 'bg-slate-900 text-white shadow-[0_10px_22px_-16px_rgba(21, 20, 24,0.8)]'
                                                            : 'bg-[var(--color-surface)] text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <span>{tab.label}</span>
                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${active ? 'bg-[var(--color-surface)]/15 text-white' : 'bg-slate-100 text-slate-700'}`}>
                                                        {tab.loading ? '…' : tab.count}
                                                    </span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ) : null}

                            <div className="lg:hidden">
                                {animePluginOn && activeResumeMobileTab === 'anime' ? (
                                    <motion.div
                                        className="min-w-0"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.28, delay: 0.04 }}
                                    >
                                        <LifeSyncHubAnimeWatching
                                            entries={animeWatchEntries}
                                            loading={animeWatchLoading}
                                            className="mb-0"
                                        />
                                    </motion.div>
                                ) : null}

                                {mangaPluginOn && activeResumeMobileTab === 'manga' ? (
                                    <motion.div
                                        className="min-w-0"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.28, delay: 0.04 }}
                                    >
                                        <LifeSyncHubMangaReading
                                            entries={mangaReadingVisible}
                                            loading={mangaReadingLoading}
                                            className="mb-0"
                                        />
                                    </motion.div>
                                ) : null}
                            </div>

                            <div
                                className={
                                    animePluginOn && mangaPluginOn
                                        ? 'hidden lg:grid gap-6 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-slate-100'
                                        : 'hidden lg:block'
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
                                        className={`min-w-0 ${animePluginOn && mangaPluginOn ? 'lg:pl-6' : ''}`}
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
