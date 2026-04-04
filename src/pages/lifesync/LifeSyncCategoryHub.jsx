import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FaGamepad, FaFilm, FaArrowRight } from 'react-icons/fa'
import { LifeSyncHubMangaReading } from '../../components/lifesync/MangaReadingRail'
import { useLifeSync } from '../../context/LifeSyncContext'
import { useMangaReadingList } from '../../hooks/useMangaReadingList'
import {
    isLifeSyncAnimeNavVisible,
    isLifeSyncHentaiHubVisible,
    isPluginEnabled,
} from '../../lib/lifesyncApi'

const SC = 'https://cdn.akamai.steamstatic.com/steam/apps'

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
    epic: [1172470, 252950, 381210, 1551360, 526870, 812140, 1085660, 311210].map(id => `${SC}/${id}/header.jpg`),
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
    if (!ok) return <div className="h-full w-full bg-neutral-800" />
    return (
        <img
            src={src}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setOk(false)}
        />
    )
}

function BentoCard({ to, pool, cols = 3, rows = 3, title, subtitle, badge, badgeClass, gradient, className = '' }) {
    const [images] = useState(() => shuffle(pool).slice(0, cols * rows))

    return (
        <Link
            to={to}
            className={`group relative block overflow-hidden rounded-[22px] border border-white/[0.06] shadow-lg transition-all duration-300 hover:shadow-2xl hover:-translate-y-0.5 ${className}`}
        >
            <div className="absolute inset-0 bg-[#1d1d1f]" />
            <div
                className="absolute inset-0 grid gap-[2px] transition-transform duration-[900ms] ease-out group-hover:scale-[1.08]"
                style={{
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gridTemplateRows: `repeat(${rows}, 1fr)`,
                }}
            >
                {images.map((src, i) => (
                    <div key={i} className="min-h-0 min-w-0 overflow-hidden">
                        <Thumb src={src} />
                    </div>
                ))}
            </div>
            <div className={`absolute inset-0 transition-opacity duration-500 group-hover:opacity-80 ${gradient}`} />
            <div className="relative z-10 flex h-full flex-col justify-end p-4 sm:p-5">
                <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                        {badge && (
                            <span className={`mb-1 inline-block rounded-lg px-2 py-[3px] text-[9px] font-bold uppercase tracking-widest ${badgeClass}`}>
                                {badge}
                            </span>
                        )}
                        <h3 className="text-[18px] sm:text-[22px] font-bold text-white tracking-tight drop-shadow-lg leading-tight">{title}</h3>
                        <p className="mt-0.5 text-[11px] sm:text-[12px] text-white/70 leading-snug line-clamp-2">{subtitle}</p>
                    </div>
                    <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm text-white/70 transition-all duration-300 group-hover:bg-[#C6FF00] group-hover:text-[#1d1d1f] group-hover:scale-110">
                        <FaArrowRight className="h-3 w-3" />
                    </div>
                </div>
            </div>
        </Link>
    )
}

function HubConnectPrompt({ title, body }) {
    return (
        <div className="min-h-full bg-[#f5f5f7] p-4 sm:p-8 flex items-center justify-center">
            <div className="w-full max-w-md rounded-[24px] border border-[#d2d2d7]/50 bg-white px-8 py-10 text-center shadow-sm">
                <p className="text-[15px] font-bold text-[#1d1d1f]">{title}</p>
                <p className="mt-2 text-[13px] text-[#86868b] leading-relaxed">{body}</p>
                <Link
                    to="/dashboard/profile?tab=integrations"
                    className="mt-5 inline-flex items-center justify-center rounded-xl bg-[#1d1d1f] px-5 py-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-black"
                >
                    Open integrations
                </Link>
            </div>
        </div>
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

    return (
        <div className="min-h-full bg-[#f5f5f7] p-4 sm:p-8">
            <div className="mx-auto max-w-5xl">
                <header className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#C6FF00] text-[#1d1d1f] shadow-sm">
                        <FaGamepad className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#86868b]">LifeSync</p>
                        <h1 className="text-[22px] font-bold tracking-tight text-[#1d1d1f] leading-tight">Games</h1>
                    </div>
                </header>

                <div className="grid grid-cols-2 sm:grid-cols-4 auto-rows-[100px] sm:auto-rows-[150px] gap-2.5 sm:gap-3">
                    <BentoCard
                        to="/dashboard/lifesync/games/steam"
                        pool={POOL.steam}
                        cols={3} rows={3}
                        title="Steam"
                        subtitle="Library, store deals & account linking"
                        gradient="bg-gradient-to-t from-[#1b2838] via-[#1b2838]/50 to-transparent"
                        className="col-span-2 row-span-3"
                    />
                    <BentoCard
                        to="/dashboard/lifesync/games/epic"
                        pool={POOL.epic}
                        cols={2} rows={2}
                        title="Epic Games"
                        subtitle="Free weekly games & linked library"
                        gradient="bg-gradient-to-t from-[#2a0845] via-[#2a0845]/50 to-transparent"
                        className="col-span-2 row-span-2"
                    />
                    <BentoCard
                        to="/dashboard/lifesync/games/wishlist"
                        pool={POOL.wishlist}
                        cols={2} rows={2}
                        title="Wishlist"
                        subtitle="Track games you want"
                        gradient="bg-gradient-to-t from-[#1d1d1f] via-[#1d1d1f]/60 to-transparent"
                        className="col-span-1 row-span-1"
                    />
                    <BentoCard
                        to="/dashboard/lifesync/games/xbox"
                        pool={POOL.xbox}
                        cols={2} rows={2}
                        title="Xbox"
                        subtitle="Deals & store picks"
                        gradient="bg-gradient-to-t from-[#0e3d0e] via-[#0e3d0e]/50 to-transparent"
                        className="col-span-1 row-span-1"
                    />
                </div>
            </div>
        </div>
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
            gradient: 'bg-gradient-to-t from-[#0f1729] via-[#0f1729]/50 to-transparent',
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
            gradient: 'bg-gradient-to-t from-[#1d1d1f] via-[#1d1d1f]/60 to-transparent',
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
            badgeClass: 'bg-rose-500/25 text-rose-300 backdrop-blur-sm',
            gradient: 'bg-gradient-to-t from-[#2d1b3d] via-[#2d1b3d]/60 to-black/20',
        })
    }
    return tiles
}

function tileLayoutClass(tileId, total) {
    if (total === 1) return 'col-span-full min-h-[280px] sm:min-h-[320px]'
    if (total === 2) return 'col-span-1 row-span-2'
    if (tileId === 'anime') return 'col-span-2 row-span-2'
    return 'col-span-1 row-span-1'
}

export function LifeSyncAnimeHub() {
    const { isLifeSyncConnected, lifeSyncUser } = useLifeSync()
    const prefs = lifeSyncUser?.preferences
    const mangaPluginOn = isPluginEnabled(prefs, 'pluginMangaEnabled')
    const nsfwEnabled = Boolean(prefs?.nsfwContentEnabled)
    const { visibleEntries: mangaReadingVisible, loading: mangaReadingLoading } = useMangaReadingList({
        enabled: isLifeSyncConnected && mangaPluginOn,
        nsfwEnabled,
    })

    if (!isLifeSyncConnected) {
        return (
            <HubConnectPrompt
                title="LifeSync not connected"
                body="Link your LifeSync account under Profile → Integrations to open anime and manga."
            />
        )
    }

    const tiles = animeTilesForPrefs(prefs)

    if (!isLifeSyncAnimeNavVisible(prefs)) {
        return (
            <div className="min-h-full bg-[#f5f5f7] p-4 sm:p-8 flex items-center justify-center">
                <div className="w-full max-w-md rounded-[24px] border border-[#d2d2d7]/50 bg-white px-8 py-10 text-center shadow-sm">
                    <p className="text-[15px] font-bold text-[#1d1d1f]">No anime features enabled</p>
                    <p className="mt-2 text-[13px] text-[#86868b] leading-relaxed">
                        Turn on Anime, Manga, or Hentai Ocean (with NSFW allowed) under Profile → Integrations.
                    </p>
                    <Link
                        to="/dashboard/profile?tab=integrations"
                        className="mt-5 inline-flex items-center justify-center rounded-xl bg-[#1d1d1f] px-5 py-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-black"
                    >
                        Content plugin settings
                    </Link>
                </div>
            </div>
        )
    }

    const gridClass =
        tiles.length === 1
            ? 'grid grid-cols-1 gap-2.5 sm:gap-3'
            : tiles.length === 2
              ? 'grid grid-cols-2 auto-rows-[140px] sm:auto-rows-[200px] gap-2.5 sm:gap-3'
              : 'grid grid-cols-2 sm:grid-cols-3 auto-rows-[130px] sm:auto-rows-[170px] gap-2.5 sm:gap-3'

    return (
        <div className="min-h-full bg-[#f5f5f7] p-4 sm:p-8">
            <div className="mx-auto max-w-5xl">
                <header className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#C6FF00] text-[#1d1d1f] shadow-sm">
                        <FaFilm className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#86868b]">LifeSync</p>
                        <h1 className="text-[22px] font-bold tracking-tight text-[#1d1d1f] leading-tight">Anime & Manga</h1>
                    </div>
                </header>

                {mangaPluginOn && (
                    <LifeSyncHubMangaReading entries={mangaReadingVisible} loading={mangaReadingLoading} />
                )}

                <div className={gridClass}>
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
                            className={tileLayoutClass(t.id, tiles.length)}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}
