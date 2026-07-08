import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaPlay, FaFire, FaClock, FaEye, FaArrowRight, FaChevronLeft, FaChevronRight, FaTh } from 'react-icons/fa'
import { useLifeSync } from '../../context/LifeSyncContext'
import { isPluginEnabled } from '../../lib/lifesyncApi'
import {
    MediaPageHeader,
    MediaSectionTitle,
    MediaConnectPrompt,
    MediaArrowButton,
    MediaEmptyState,
    mediaPosterFrameClass,
} from '../../components/lifesync/MediaPageChrome'
import { useHentaiHome } from '../../hooks/useHentaiHome'
import { useHentaiDetailPortal } from '../../components/lifesync/HentaiDetailPortal'

const HENTAI_BASE = '/dashboard/lifesync/anime/hentai'
const HENTAI_HOME = '/dashboard/lifesync/anime/hentai/home'

// Derive the series slug from an episode slug by stripping the episode/id suffix.
// e.g. "kenki-virgo-episode-2-id-01" → "kenki-virgo"
function seriesSlugFromEpisodeSlug(episodeSlug) {
    return String(episodeSlug || '')
        .replace(/-episode-\d+.*$/i, '')
        .replace(/-ep-?\d+.*$/i, '')
        .replace(/-id-\d+$/i, '')
        .trim()
}

// Wrap a WatchHentaiRecentEpisode into a series-shaped object that SeriesDetailPopup
// can use — it looks for series.episodes[0].slug to fetch /detail?slug=<series-slug>.
function episodeToSeriesShape(ep) {
    const episodeSlug = ep?.slug || ''
    const seriesSlug = seriesSlugFromEpisodeSlug(episodeSlug) || episodeSlug
    return {
        seriesKey: seriesSlug,
        title: ep?.seriesTitle || ep?.title || seriesSlug.replace(/-/g, ' '),
        posterUrl: ep?.thumbnailUrl || null,
        episodeCount: 1,
        episodes: [{
            slug: seriesSlug,
            title: ep?.episodeLabel || ep?.title || '',
            watchUrl: ep?.watchUrl || '',
            embedUrl: ep?.watchUrl || '',
            posterUrl: ep?.thumbnailUrl || null,
            pubDate: null,
            episodeNum: 1,
        }],
        watchUrl: ep?.watchUrl || '',
        detailUrl: ep?.watchUrl || '',
        isUpcoming: false,
        yearLabel: null,
    }
}

// ── Skeleton shimmer ──────────────────────────────────────────────────────────

function SkeletonCard({ wide = false }) {
    return (
        <div className={`shrink-0 ${wide ? 'w-60 sm:w-72' : 'w-32.5 sm:w-37.5'}`}>
            <div className={`animate-pulse rounded-xl bg-(--color-surface-muted) ${wide ? 'aspect-video' : 'aspect-[2/3]'}`} />
            <div className="mt-2 h-3 w-3/4 animate-pulse rounded-full bg-(--color-surface-muted)" />
            <div className="mt-1.5 h-2.5 w-1/2 animate-pulse rounded-full bg-(--color-surface-muted)" />
        </div>
    )
}

function SkeletonHero() {
    return (
        <div className="h-52 w-full animate-pulse rounded-3xl bg-(--color-surface-muted) sm:h-72" />
    )
}

// ── Poster card ───────────────────────────────────────────────────────────────

function HentaiCard({ item, onOpen }) {
    const cover = item?.posterUrl || item?.coverUrl || item?.image || ''
    const title = item?.title || item?.name || ''
    return (
        <button
            type="button"
            onClick={() => onOpen(item)}
            className="group w-32.5 shrink-0 snap-start cursor-pointer text-left sm:w-37.5"
        >
            <div className={mediaPosterFrameClass}>
                {cover ? (
                    <img
                        src={cover}
                        alt={title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-108"
                    />
                ) : (
                    <div className="flex aspect-[2/3] w-full items-center justify-center text-(--color-text-secondary)">
                        <FaPlay className="h-5 w-5" />
                    </div>
                )}
                {item?.yearLabel && (
                    <span className="absolute left-2 top-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                        {item.yearLabel}
                    </span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-fuchsia-500/90 shadow-lg shadow-fuchsia-500/40">
                        <FaPlay className="h-4 w-4 text-white" />
                    </span>
                </span>
            </div>
            <p className="mt-2 line-clamp-2 text-[12px] font-semibold leading-tight text-(--color-text-primary)">{title}</p>
        </button>
    )
}

// ── Episode landscape card ────────────────────────────────────────────────────

function EpisodeCard({ ep, onOpen, grid = false }) {
    const thumb = ep?.thumbnailUrl || ''
    return (
        <button
            type="button"
            onClick={() => onOpen(ep)}
            className={`group cursor-pointer text-left ${grid ? 'w-full' : 'w-60 shrink-0 snap-start sm:w-72'}`}
        >
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-(--color-surface-muted) ring-1 ring-(--color-border-soft) shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_16px_40px_-12px_rgba(0,0,0,0.45)] group-hover:ring-fuchsia-400/50">
                {thumb ? (
                    <img
                        src={thumb}
                        alt={ep?.title || ''}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-(--color-text-secondary)">
                        <FaPlay className="h-5 w-5" />
                    </div>
                )}
                {Array.isArray(ep?.badges) && ep.badges.length > 0 && (
                    <div className="absolute left-2 top-2 flex gap-1">
                        {ep.badges.map((b) => (
                            <span key={b} className="rounded-md bg-fuchsia-500/90 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white backdrop-blur-sm">
                                {b}
                            </span>
                        ))}
                    </div>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-fuchsia-500/90 shadow-lg shadow-fuchsia-500/40">
                        <FaPlay className="h-4 w-4 text-white" />
                    </span>
                </span>
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/90 to-transparent px-2.5 pb-2 pt-6 text-[10px] font-semibold text-white/90">
                    {ep?.timeAgo && (
                        <span className="inline-flex items-center gap-1">
                            <FaClock className="h-2.5 w-2.5 text-fuchsia-300" /> {ep.timeAgo}
                        </span>
                    )}
                    {ep?.views && (
                        <span className="inline-flex items-center gap-1">
                            <FaEye className="h-2.5 w-2.5 text-fuchsia-300" /> {ep.views}
                        </span>
                    )}
                </div>
            </div>
            <p className="mt-2 truncate text-[12px] font-bold leading-tight text-(--color-text-primary)">{ep?.seriesTitle || ep?.title}</p>
            {ep?.episodeLabel && (
                <p className="mt-0.5 truncate text-[11px] text-(--color-text-secondary)">{ep.episodeLabel}</p>
            )}
        </button>
    )
}

// ── Horizontal scrollable rail ────────────────────────────────────────────────

function Rail({ title, hint, items, wide = false, loading = false, render }) {
    const ref = useRef(null)
    const scroll = (dir) => ref.current?.scrollBy({ left: dir * (wide ? 480 : 320), behavior: 'smooth' })

    const skeletonCount = wide ? 4 : 6

    if (!loading && !items?.length) return null

    return (
        <div>
            <MediaSectionTitle
                accent="hentai"
                title={title}
                hint={hint}
                action={
                    <div className="flex items-center gap-1.5">
                        <MediaArrowButton direction="left" onClick={() => scroll(-1)} label="Scroll left" size="sm" />
                        <MediaArrowButton direction="right" onClick={() => scroll(1)} label="Scroll right" size="sm" />
                    </div>
                }
            />
            <div ref={ref} className="flex gap-3.5 overflow-x-auto pb-3 pt-1 hide-scrollbar snap-x">
                {loading
                    ? Array.from({ length: skeletonCount }).map((_, i) => <SkeletonCard key={i} wide={wide} />)
                    : items.map((item, i) => render(item, i))}
            </div>
        </div>
    )
}

// ── Hero featured carousel ────────────────────────────────────────────────────

function FeaturedCarousel({ items, onOpen, loading = false }) {
    const [idx, setIdx] = useState(0)
    const count = items?.length || 0

    useEffect(() => {
        if (count <= 1) return undefined
        const t = setInterval(() => setIdx((i) => (i + 1) % count), 5500)
        return () => clearInterval(t)
    }, [count])

    if (loading) return <SkeletonHero />
    if (!count) return null

    const item = items[Math.min(idx, count - 1)]
    const bg = item?.posterUrl || item?.coverUrl || ''

    return (
        <div className="relative h-52 w-full overflow-hidden rounded-3xl sm:h-72">
            <button type="button" onClick={() => onOpen(item)} className="group block h-full w-full cursor-pointer text-left">
                {bg && (
                    <img
                        key={bg}
                        src={bg}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 h-full w-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-105"
                    />
                )}
                {/* Cinematic gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/50 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                <div className="relative flex h-full flex-col justify-end p-5 sm:p-8">
                    <span className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-fuchsia-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-fuchsia-500/40">
                        <FaFire className="h-2.5 w-2.5" /> Featured
                    </span>
                    <h2 className="line-clamp-2 max-w-lg text-[22px] font-black leading-tight tracking-tight text-white sm:text-[30px]">
                        {item?.title || ''}
                    </h2>
                    <div className="mt-3 flex items-center gap-2">
                        <span className="flex items-center gap-1.5 rounded-full bg-fuchsia-500/90 px-3.5 py-1.5 text-[11px] font-black text-white shadow-md shadow-fuchsia-500/30 transition-all duration-200 group-hover:bg-fuchsia-400">
                            <FaPlay className="h-2.5 w-2.5" /> Watch Now
                        </span>
                    </div>
                </div>
            </button>

            {count > 1 && (
                <>
                    {/* Prev / Next arrows */}
                    <button
                        type="button"
                        aria-label="Previous"
                        onClick={(e) => { e.stopPropagation(); setIdx((i) => (i - 1 + count) % count) }}
                        className="absolute left-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-fuchsia-500/80"
                    >
                        <FaChevronLeft className="h-3 w-3" />
                    </button>
                    <button
                        type="button"
                        aria-label="Next"
                        onClick={(e) => { e.stopPropagation(); setIdx((i) => (i + 1) % count) }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-fuchsia-500/80"
                    >
                        <FaChevronRight className="h-3 w-3" />
                    </button>
                    {/* Dot indicators */}
                    <div className="absolute bottom-3 right-4 flex gap-1.5">
                        {items.slice(0, 10).map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                aria-label={`Slide ${i + 1}`}
                                onClick={() => setIdx(i)}
                                className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? 'w-6 bg-fuchsia-400' : 'w-1.5 bg-white/40 hover:bg-white/70'}`}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

// ── Recent Episodes grid section ──────────────────────────────────────────────

function RecentEpisodesSection({ episodes, loading, onOpen }) {
    const [expanded, setExpanded] = useState(false)

    if (!loading && !episodes?.length) return null

    const visible = expanded ? episodes : episodes?.slice(0, 8)

    return (
        <div>
            <MediaSectionTitle
                accent="hentai"
                title={<span className="inline-flex items-center gap-2"><FaTh className="h-3.5 w-3.5 text-fuchsia-400" />Recent Episodes</span>}
                hint="Freshly released"
                action={
                    !loading && episodes?.length > 8 ? (
                        <button
                            type="button"
                            onClick={() => setExpanded((v) => !v)}
                            className="flex min-h-9 items-center gap-1 rounded-full bg-(--color-surface-muted) px-3 text-[11px] font-bold text-(--color-text-secondary) transition hover:text-(--color-text-primary)"
                        >
                            {expanded ? 'Show less' : `Show all ${episodes.length}`}
                        </button>
                    ) : null
                }
            />
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
                {loading
                    ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} wide />)
                    : visible?.map((ep, i) => <EpisodeCard key={ep?.slug || i} ep={ep} onOpen={onOpen} grid />)}
            </div>
        </div>
    )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LifeSyncHentaiHome() {
    const navigate = useNavigate()
    const { isLifeSyncConnected, lifeSyncUser } = useLifeSync()
    const prefs = lifeSyncUser?.preferences
    const nsfwEnabled = Boolean(prefs?.nsfwContentEnabled)
    const pluginEnabled = isPluginEnabled(prefs, 'pluginHentaiEnabled')
    const enabled = isLifeSyncConnected && pluginEnabled && nsfwEnabled

    const { data, loading, error, refresh } = useHentaiHome({ enabled })

    const { openSeries, portal } = useHentaiDetailPortal()

    // Episode cards (WatchHentaiRecentEpisode) have a /videos/ slug, not a /series/ slug.
    // Convert them to a series-shaped object so the detail popup fetches the correct URL.
    const onOpen = (item) => {
        const series = item?.seriesTitle !== undefined
            ? episodeToSeriesShape(item)
            : item
        openSeries(series)
    }

    if (!enabled) {
        return (
            <MediaConnectPrompt
                accent="hentai"
                title="Hentai unavailable"
                body="Enable the hentai plugin and NSFW content in your profile to browse."
            />
        )
    }

    return (
        <div className="space-y-7">
            {portal}
            <MediaPageHeader
                accent="hentai"
                icon={<FaPlay className="h-5 w-5 text-(--color-text-primary)" />}
                kicker="Hentai"
                title="Hentai Home"
                subtitle="Trending and freshly released titles from WatchHentai"
                actions={
                    <button
                        type="button"
                        onClick={() => navigate(HENTAI_BASE, { state: { from: HENTAI_HOME } })}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-(--color-surface) px-3.5 text-[12px] font-bold text-(--color-text-primary) ring-1 ring-(--color-border-soft) transition hover:brightness-95"
                    >
                        Browse all <FaArrowRight className="h-3 w-3" />
                    </button>
                }
            />

            {error ? (
                <MediaEmptyState
                    accent="hentai"
                    title="Failed to load"
                    message={error}
                    action={
                        <button
                            type="button"
                            onClick={() => refresh()}
                            className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-500/10 px-4 py-2 text-[12px] font-bold text-fuchsia-500 ring-1 ring-fuchsia-400/30 transition hover:bg-fuchsia-500/20"
                        >
                            Retry
                        </button>
                    }
                />
            ) : (
                <div className="space-y-7">
                    <FeaturedCarousel items={data?.featured} onOpen={onOpen} loading={loading && !data} />

                    <Rail
                        title="Trending"
                        hint="Hot right now"
                        items={data?.trending}
                        loading={loading && !data}
                        render={(item, i) => (
                            <HentaiCard key={item?.seriesKey || item?.slug || i} item={item} onOpen={onOpen} />
                        )}
                    />

                    <RecentEpisodesSection
                        episodes={data?.recentEpisodes}
                        loading={loading && !data}
                        onOpen={onOpen}
                    />

                    <Rail
                        title="Latest Releases"
                        items={data?.latest}
                        loading={loading && !data}
                        render={(item, i) => (
                            <HentaiCard key={item?.seriesKey || item?.slug || i} item={item} onOpen={onOpen} />
                        )}
                    />

                    {!loading && !data?.trending?.length && !data?.latest?.length && !data?.recentEpisodes?.length && (
                        <MediaEmptyState
                            accent="hentai"
                            title="No titles available"
                            message="Check back later for trending and new releases."
                        />
                    )}
                </div>
            )}
        </div>
    )
}
