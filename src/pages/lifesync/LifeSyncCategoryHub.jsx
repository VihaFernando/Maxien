import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FaGamepad, FaFilm, FaArrowRight, FaChevronRight } from 'react-icons/fa'
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
import { LifesyncEpisodeThumbnail } from '../../components/lifesync/EpisodeLoadingSkeletons'
import { LifeSyncHubPageShell as HubShell } from '../../components/lifesync/LifeSyncHubPageShell'
import { MotionDiv } from '../../lib/lifesyncMotion'

const MotionLink = motion(Link)

const SC = 'https://cdn.akamai.steamstatic.com/steam/apps'

const focusRing =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa] focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf8ff]'

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
            imgClassName="h-full w-full object-cover"
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
            className={`group relative block overflow-hidden rounded-[22px] bg-white/55 shadow-[0_8px_30px_-8px_rgba(90,80,120,0.1),0_2px_8px_-2px_rgba(0,0,0,0.04)] backdrop-blur-md transition-shadow duration-300 hover:shadow-[0_20px_40px_-12px_rgba(90,80,120,0.14)] sm:rounded-[26px] ${focusRing} ${className}`}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-[#faf7ff]/85 to-[#ede9ff]/75" />
            <div
                className="absolute inset-[10px] grid gap-1 rounded-[18px] p-1 transition-transform duration-700 ease-out group-hover:scale-[1.03] sm:inset-[12px] sm:gap-1.5 sm:rounded-[20px] sm:duration-[900ms]"
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
            <div
                className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${gradient} group-hover:opacity-0`}
            />
            <div className="relative z-10 flex h-full min-h-[inherit] flex-col justify-end p-4 sm:p-5">
                <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0 rounded-2xl bg-white/85 px-3 py-2.5 shadow-sm backdrop-blur-md sm:px-3.5 sm:py-3">
                        {badge && (
                            <span className={`mb-1 inline-block rounded-md px-2 py-[3px] text-[9px] font-bold uppercase tracking-widest ${badgeClass}`}>
                                {badge}
                            </span>
                        )}
                        <h3 className="text-[17px] font-bold tracking-tight text-[#1a1628] leading-tight sm:text-[20px] lg:text-[22px]">
                            {title}
                        </h3>
                        <p className="mt-1 text-[11px] leading-snug text-[#5b5670] line-clamp-2 sm:text-[12px]">{subtitle}</p>
                    </div>
                    <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-[#C6FF00] text-[#1a1628] shadow-md transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg sm:h-11 sm:w-11">
                        <FaArrowRight className="h-3.5 w-3.5" />
                    </div>
                </div>
            </div>
        </MotionLink>
    )
}

/** Light, full-width row for small screens — large tap targets, clear hierarchy. */
function MobileExploreRow({ to, pool, title, subtitle, badge, badgeClass }) {
    const [thumbs] = useState(() => shuffle(pool).slice(0, 4))

    return (
        <MotionLink
            to={to}
            className={`flex min-h-[92px] items-center gap-4 rounded-[20px] bg-white/60 p-3.5 shadow-sm backdrop-blur-md sm:min-h-[100px] sm:p-4 ${focusRing}`}
            whileTap={{ scale: 0.98 }}
            whileHover={{ y: -2 }}
            transition={{ type: 'spring', stiffness: 480, damping: 32 }}
        >
            <div className="grid h-[76px] w-[76px] shrink-0 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-2xl bg-gradient-to-br from-[#ede8f7] to-[#e4f5ec] p-0.5 sm:h-[84px] sm:w-[84px]">
                {thumbs.map((src, i) => (
                    <div key={i} className="min-h-0 min-w-0 overflow-hidden">
                        <Thumb src={src} />
                    </div>
                ))}
            </div>
            <div className="min-w-0 flex-1 py-0.5">
                {badge ? (
                    <span className={`mb-1 inline-block rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${badgeClass}`}>
                        {badge}
                    </span>
                ) : null}
                <h3 className="text-[16px] font-bold leading-tight tracking-tight text-[#1d1d1f] sm:text-[17px]">{title}</h3>
                <p className="mt-1 text-[12px] leading-snug text-[#86868b] line-clamp-2">{subtitle}</p>
            </div>
            <FaChevronRight className="h-4 w-4 shrink-0 text-[#c7c7cc] sm:h-[18px] sm:w-[18px]" aria-hidden />
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

function animeTilesForPrefs(prefs) {
    const tiles = []
    if (isPluginEnabled(prefs, 'pluginAnimeEnabled')) {
        tiles.push({
            id: 'anime',
            to: '/dashboard/lifesync/anime/anime',
            pool: POOL.anime,
            cols: 3,
            rows: 3,
            title: 'Anime',
            subtitle: 'Seasonal charts, rankings & MyAnimeList sync',
            gradient: 'bg-gradient-to-t from-[#e0f2fe] via-white/65 to-transparent',
        })
    }
    if (isPluginEnabled(prefs, 'pluginMangaEnabled')) {
        tiles.push({
            id: 'manga',
            to: '/dashboard/lifesync/anime/manga',
            pool: POOL.manga,
            cols: 2,
            rows: 2,
            title: 'Manga',
            subtitle: 'Reading lists & discovery',
            gradient: 'bg-gradient-to-t from-[#fff7ed] via-white/70 to-transparent',
        })
    }
    if (isLifeSyncHentaiHubVisible(prefs)) {
        tiles.push({
            id: 'hentai',
            to: '/dashboard/lifesync/anime/hentai',
            pool: POOL.hentai,
            cols: 2,
            rows: 2,
            title: 'Hentai',
            subtitle: 'Adults only',
            badge: '18+',
            badgeClass: 'bg-rose-100 text-rose-800',
            gradient: 'bg-gradient-to-t from-[#fce7f3] via-white/75 to-transparent',
        })
    }
    return tiles
}

export function LifeSyncAnimeHub() {
    const { isLifeSyncConnected, lifeSyncUser } = useLifeSync()
    const prefs = lifeSyncUser?.preferences
    const animePluginOn = isPluginEnabled(prefs, 'pluginAnimeEnabled')
    const mangaPluginOn = isPluginEnabled(prefs, 'pluginMangaEnabled')
    const nsfwEnabled = Boolean(prefs?.nsfwContentEnabled)
    const { entries: animeWatchEntries, loading: animeWatchLoading } = useAnimeWatchHistory({
        enabled: isLifeSyncConnected && animePluginOn,
    })
    const { visibleEntries: mangaReadingVisible, loading: mangaReadingLoading } = useMangaReadingList({
        enabled: isLifeSyncConnected && mangaPluginOn,
        nsfwEnabled,
    })

    if (!isLifeSyncConnected) {
        return (
            <HubConnectPrompt
                embedded
                title="LifeSync not connected"
                body="Link your LifeSync account under Profile → Integrations to open anime and manga."
            />
        )
    }

    const tiles = animeTilesForPrefs(prefs)

    if (!isLifeSyncAnimeNavVisible(prefs)) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center px-2 py-10 sm:py-14">
                <div className="w-full max-w-md rounded-[22px] bg-white px-6 py-9 text-center shadow-sm sm:px-8 sm:py-10">
                    <p className="text-[16px] font-bold text-[#1d1d1f] sm:text-[17px]">No anime features enabled</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-[#86868b]">
                        Turn on Anime, Manga, or Hentai Ocean (with NSFW allowed) under Profile → Integrations.
                    </p>
                    <Link
                        to="/dashboard/profile?tab=integrations"
                        className={`mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#C6FF00] px-5 text-[13px] font-semibold text-[#1a1628] shadow-sm transition-all hover:brightness-95 sm:w-auto sm:min-w-[220px] ${focusRing}`}
                    >
                        Content plugin settings
                    </Link>
                </div>
            </div>
        )
    }

    const showProgressBlock = animePluginOn || mangaPluginOn
    const hasProgressRails =
        (animePluginOn && (animeWatchLoading || animeWatchEntries.length > 0)) ||
        (mangaPluginOn && (mangaReadingLoading || mangaReadingVisible.length > 0))

    const animeTile = tiles.find((t) => t.id === 'anime')
    const mangaTile = tiles.find((t) => t.id === 'manga')
    const hentaiTile = tiles.find((t) => t.id === 'hentai')
    const exploreFullThree =
        !showProgressBlock && tiles.length === 3 && animeTile && mangaTile && hentaiTile

    return (
        <>
            <header className="relative mb-6 sm:mb-7 lg:mb-8">
                <div className="absolute -left-2 top-0 hidden h-full w-1 rounded-full bg-gradient-to-b from-[#C6FF00] via-[#a78bfa] to-[#5eead4] sm:block lg:-left-3" aria-hidden />
                <div className="flex flex-col gap-1 pl-0 sm:pl-4 lg:pl-5">
                    <div className="flex items-start gap-3 sm:items-center">
                        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#fef3c7] via-white to-[#e0e7ff] text-[#1a1628] shadow-md sm:h-12 sm:w-12">
                            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#C6FF00]" aria-hidden />
                            <FaFilm className="relative h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7c7794]">LifeSync</p>
                            <h1 className="text-[24px] font-bold leading-tight tracking-tight text-[#1a1628] sm:text-[28px] lg:text-[30px]">
                                Anime <span className="font-medium text-[#7c6f9e]">&amp;</span> Manga
                            </h1>
                            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[#5b5670] lg:mt-2 lg:text-[14px]">
                                <span className="lg:hidden">Resume shows and reading, then open a hub.</span>
                                <span className="hidden lg:inline">
                                    Continue watching and reading beside a column of hub shortcuts — same rhythm as Games.
                                </span>
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <div
                className={
                    showProgressBlock
                        ? 'lg:grid lg:grid-cols-12 lg:items-stretch lg:gap-6 xl:gap-8'
                        : 'flex flex-col'
                }
            >
                {/* Your progress — primary column when plugins on */}
                <div className={showProgressBlock ? 'mb-6 lg:col-span-7 lg:mb-0 xl:col-span-8' : 'hidden'}>
                    <section className="flex flex-col" aria-labelledby="lifesync-hub-progress-label">
                        <div className="mb-3 flex items-center justify-between gap-2 sm:mb-4">
                            <SectionLabel id="lifesync-hub-progress-label">Your progress</SectionLabel>
                            {!hasProgressRails && !animeWatchLoading && !mangaReadingLoading ? (
                                <span className="hidden text-[11px] text-[#86868b] sm:inline">Nothing in progress yet</span>
                            ) : null}
                        </div>
                        <div className="flex flex-col gap-4 sm:gap-5 lg:gap-6">
                            {animePluginOn ? (
                                <LifeSyncHubAnimeWatching
                                    entries={animeWatchEntries}
                                    loading={animeWatchLoading}
                                    className="mb-0"
                                />
                            ) : null}
                            {mangaPluginOn ? (
                                <LifeSyncHubMangaReading
                                    entries={mangaReadingVisible}
                                    loading={mangaReadingLoading}
                                    className="mb-0"
                                />
                            ) : null}
                        </div>
                        {!hasProgressRails && !animeWatchLoading && !mangaReadingLoading ? (
                            <p className="mt-3 rounded-[20px] bg-white/80 px-4 py-4 text-center text-[12px] leading-relaxed text-[#5b5670] shadow-sm sm:mt-4 sm:px-5 sm:py-5 sm:text-[13px]">
                                Start watching or reading in Anime or Manga — we&apos;ll show your place here next time.
                            </p>
                        ) : null}
                    </section>
                </div>

                {/* Explore */}
                <aside
                    className={
                        showProgressBlock ? 'mt-0 flex flex-col lg:col-span-5 xl:col-span-4' : 'w-full'
                    }
                    aria-labelledby="lifesync-hub-explore-label"
                >
                    <SectionLabel id="lifesync-hub-explore-label">Explore</SectionLabel>
                    <p className="mt-1 mb-3 text-[12px] text-[#5b5670] lg:mb-4 lg:text-[13px]"></p>

                    {/* Mobile / tablet — list rows */}
                    <div className="flex flex-col gap-3 lg:hidden">
                        {tiles.map((t) => (
                            <MobileExploreRow
                                key={t.id}
                                to={t.to}
                                pool={t.pool}
                                title={t.title}
                                subtitle={t.subtitle}
                                badge={t.badge}
                                badgeClass={t.badgeClass}
                            />
                        ))}
                    </div>

                    {/* Desktop — beside progress: equal-height stack; no progress: games-style grid */}
                    <div className="mt-2 hidden flex-col gap-4 lg:mt-0 lg:flex lg:gap-5 xl:gap-6">
                        {showProgressBlock ? (
                            tiles.map((t) => (
                                <BentoCard
                                    key={t.id}
                                    to={t.to}
                                    pool={t.pool}
                                    cols={t.cols}
                                    rows={t.rows}
                                    title={t.title}
                                    subtitle={t.subtitle}
                                    badge={t.badge}
                                    badgeClass={t.badgeClass}
                                    gradient={t.gradient}
                                    className={EXPLORE_SIDEBAR_BENTO}
                                />
                            ))
                        ) : exploreFullThree ? (
                            <div className="grid grid-cols-12 items-stretch gap-4 xl:gap-6">
                                <BentoCard
                                    to={animeTile.to}
                                    pool={animeTile.pool}
                                    cols={animeTile.cols}
                                    rows={animeTile.rows}
                                    title={animeTile.title}
                                    subtitle={animeTile.subtitle}
                                    badge={animeTile.badge}
                                    badgeClass={animeTile.badgeClass}
                                    gradient={animeTile.gradient}
                                    className={EXPLORE_FULL_ANIME_HERO}
                                />
                                <div className="flex flex-col gap-4 lg:col-span-5 xl:col-span-4 xl:gap-6">
                                    <BentoCard
                                        to={mangaTile.to}
                                        pool={mangaTile.pool}
                                        cols={mangaTile.cols}
                                        rows={mangaTile.rows}
                                        title={mangaTile.title}
                                        subtitle={mangaTile.subtitle}
                                        gradient={mangaTile.gradient}
                                        className={`${EXPLORE_SIDEBAR_BENTO} min-h-[168px]`}
                                    />
                                    <BentoCard
                                        to={hentaiTile.to}
                                        pool={hentaiTile.pool}
                                        cols={hentaiTile.cols}
                                        rows={hentaiTile.rows}
                                        title={hentaiTile.title}
                                        subtitle={hentaiTile.subtitle}
                                        badge={hentaiTile.badge}
                                        badgeClass={hentaiTile.badgeClass}
                                        gradient={hentaiTile.gradient}
                                        className={`${EXPLORE_SIDEBAR_BENTO} min-h-[168px]`}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div
                                className={`grid gap-4 xl:gap-6 ${tiles.length === 2 ? 'lg:grid-cols-2' : ''} ${tiles.length === 1 ? 'mx-auto w-full max-w-4xl' : ''}`}
                            >
                                {tiles.map((t) => (
                                    <BentoCard
                                        key={t.id}
                                        to={t.to}
                                        pool={t.pool}
                                        cols={t.cols}
                                        rows={t.rows}
                                        title={t.title}
                                        subtitle={t.subtitle}
                                        badge={t.badge}
                                        badgeClass={t.badgeClass}
                                        gradient={t.gradient}
                                        className={
                                            tiles.length === 1
                                                ? 'min-h-[240px] w-full sm:min-h-[280px]'
                                                : 'min-h-[200px] w-full lg:min-h-[min(360px,calc(50dvh-80px))]'
                                        }
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </aside>
            </div>
        </>
    )
}
