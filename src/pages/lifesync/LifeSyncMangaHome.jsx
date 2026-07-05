import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
    FaBook, FaChevronLeft, FaChevronRight, FaFire, FaStar, FaTrophy,
    FaArrowRight, FaHeart, FaBolt, FaPlus, FaClock,
} from 'react-icons/fa'
import { useLifeSync } from '../../context/LifeSyncContext'
import { isPluginEnabled } from '../../lib/lifesyncApi'
import { isLifeSyncAdmin } from '../../lib/lifeSyncRoles'
import { mangaImageProps } from '../../lib/mangaChapterUtils'
import {
    MediaPageHeader,
    MediaSectionTitle,
    MediaConnectPrompt,
    MediaArrowButton,
    MediaEmptyState,
    mediaPosterFrameClass,
    mediaChipClass,
} from '../../components/lifesync/MediaPageChrome'
import { useMangaHome, useRoliascanHighScore } from '../../hooks/useMangaHome'
import { useMangaDetailPortal } from '../../components/lifesync/MangaDetailPortal'

const MANGA_BASE = '/dashboard/lifesync/anime/manga'

const SOURCES = [
    { id: 'roliascan', label: 'Roliascan', tab: 'manga' },
    { id: 'mangadistrict', label: 'Manga District', tab: 'latest' },
    { id: 'mangadna', label: 'MangaDNA', tab: 'latest' },
]

const BROWSE_PATH = {
    roliascan: `${MANGA_BASE}/roliascan/manga/page/1`,
    mangadistrict: `${MANGA_BASE}/mangadistrict/latest/page/1`,
    mangadna: `${MANGA_BASE}/mangadna/latest/page/1`,
}

const itemId = (item) => item?.id || item?.slug || item?.hid
const itemCover = (item) => item?.coverUrl || item?.cover || item?.thumbnail || ''

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
    return <div className="h-52 w-full animate-pulse rounded-3xl bg-(--color-surface-muted) sm:h-72" />
}

function SkeletonRow() {
    return (
        <div className="flex items-center gap-3 rounded-xl p-1.5">
            <div className="h-16 w-12 shrink-0 animate-pulse rounded-lg bg-(--color-surface-muted)" />
            <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 animate-pulse rounded-full bg-(--color-surface-muted)" />
                <div className="h-2.5 w-1/2 animate-pulse rounded-full bg-(--color-surface-muted)" />
            </div>
        </div>
    )
}

// ── Portrait card ─────────────────────────────────────────────────────────────

function PortraitCard({ item, source, tab, onOpen, rank }) {
    const id = itemId(item)
    const cover = itemCover(item)
    const title = item?.title || item?.name || String(id || '')
    const chapter = item?.lastChapter || item?.latestChapter || ''
    const rating = item?.ratingAverage || item?.ratings?.average || null

    return (
        <button
            type="button"
            onClick={() => id && onOpen(source, tab, id, item)}
            className="group relative w-32.5 shrink-0 snap-start cursor-pointer text-left sm:w-37.5"
        >
            <div className={mediaPosterFrameClass}>
                {cover ? (
                    <img
                        src={cover}
                        alt={title}
                        loading="lazy"
                        {...mangaImageProps(cover)}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-108"
                    />
                ) : (
                    <div className="flex aspect-[2/3] w-full items-center justify-center text-(--color-text-secondary)">
                        <FaBook className="h-6 w-6" />
                    </div>
                )}
                {typeof rank === 'number' && (
                    <span className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-br-xl bg-amber-500/90 text-[13px] font-black text-black backdrop-blur-sm">
                        {rank}
                    </span>
                )}
                {rating != null && Number(rating) > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 backdrop-blur-sm">
                        <FaStar className="h-2.5 w-2.5" /> {Number(rating).toFixed(1)}
                    </span>
                )}
                {chapter && (
                    <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-5 text-[10px] font-semibold text-white">
                        {chapter}
                    </span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/90 shadow-lg shadow-amber-500/40">
                        <FaBook className="h-4 w-4 text-black" />
                    </span>
                </span>
            </div>
            <p className="mt-2 line-clamp-2 text-[12px] font-semibold leading-tight text-(--color-text-primary)">{title}</p>
        </button>
    )
}

// ── Compact chapter row ───────────────────────────────────────────────────────

function ChapterRow({ item, source, tab, onOpen }) {
    const id = itemId(item)
    const cover = itemCover(item)
    const title = item?.title || item?.name || String(id || '')
    const chapter = item?.lastChapter || item?.latestChapter || ''
    return (
        <button
            type="button"
            onClick={() => id && onOpen(source, tab, id, item)}
            className="group flex w-full cursor-pointer items-center gap-3 rounded-xl p-1.5 text-left transition-colors duration-150 hover:bg-(--color-surface-muted)"
        >
            <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-(--color-surface-muted) ring-1 ring-(--color-border-soft)">
                {cover && (
                    <img
                        src={cover}
                        alt=""
                        loading="lazy"
                        {...mangaImageProps(cover)}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                )}
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-(--color-text-primary)">{title}</p>
                {chapter && <p className="mt-0.5 truncate text-[11px] text-(--color-text-secondary)">{chapter}</p>}
            </div>
            <FaChevronRight className="h-3 w-3 shrink-0 text-(--color-text-secondary) opacity-0 transition group-hover:opacity-100 group-hover:translate-x-0.5" />
        </button>
    )
}

// ── Horizontal scrollable rail ────────────────────────────────────────────────

function Rail({ title, icon, items, source, tab, onOpen, ranked = false, action, loading = false }) {
    const ref = useRef(null)
    const scroll = (dir) => ref.current?.scrollBy({ left: dir * 320, behavior: 'smooth' })

    if (!loading && !items?.length) return null

    return (
        <div>
            <MediaSectionTitle
                accent="manga"
                title={<span className="inline-flex items-center gap-2">{icon}{title}</span>}
                action={
                    <div className="flex items-center gap-1.5">
                        {action}
                        <MediaArrowButton direction="left" onClick={() => scroll(-1)} label="Scroll left" size="sm" />
                        <MediaArrowButton direction="right" onClick={() => scroll(1)} label="Scroll right" size="sm" />
                    </div>
                }
            />
            <div ref={ref} className="flex gap-3.5 overflow-x-auto pb-3 pt-1 hide-scrollbar snap-x">
                {loading
                    ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
                    : items.map((item, i) => (
                        <PortraitCard
                            key={itemId(item) || i}
                            item={item}
                            source={source}
                            tab={tab}
                            onOpen={onOpen}
                            rank={ranked ? i + 1 : undefined}
                        />
                    ))}
            </div>
        </div>
    )
}

// ── Featured hero carousel ────────────────────────────────────────────────────

function FeaturedCarousel({ items, source, tab, onOpen, badge = 'Featured', loading = false }) {
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
    const id = itemId(item)
    const bg = item?.backgroundImageUrl || itemCover(item)

    return (
        <div className="relative h-52 w-full overflow-hidden rounded-3xl sm:h-72">
            <button
                type="button"
                onClick={() => id && onOpen(source, tab, id, item)}
                className="group block h-full w-full cursor-pointer text-left"
            >
                {bg && (
                    <img
                        key={bg}
                        src={bg}
                        alt=""
                        {...mangaImageProps(bg)}
                        className="absolute inset-0 h-full w-full object-cover opacity-65 transition-transform duration-700 group-hover:scale-105"
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/50 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                <div className="relative flex h-full flex-col justify-end p-5 sm:p-8">
                    <span className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-black shadow-lg shadow-amber-500/40">
                        <FaFire className="h-2.5 w-2.5" /> {badge}
                    </span>
                    <h2 className="line-clamp-2 max-w-lg text-[22px] font-black leading-tight tracking-tight text-white sm:text-[30px]">
                        {item?.title || ''}
                    </h2>
                    {item?.lastChapter && (
                        <p className="mt-1 text-[12px] font-semibold text-white/70">{item.lastChapter}</p>
                    )}
                    <div className="mt-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/90 px-3.5 py-1.5 text-[11px] font-black text-black shadow-md shadow-amber-500/30 transition-all duration-200 group-hover:bg-amber-400">
                            <FaBook className="h-2.5 w-2.5" /> Read Now
                        </span>
                    </div>
                </div>
            </button>

            {count > 1 && (
                <>
                    <button
                        type="button"
                        aria-label="Previous"
                        onClick={(e) => { e.stopPropagation(); setIdx((i) => (i - 1 + count) % count) }}
                        className="absolute left-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-amber-500/80"
                    >
                        <FaChevronLeft className="h-3 w-3" />
                    </button>
                    <button
                        type="button"
                        aria-label="Next"
                        onClick={(e) => { e.stopPropagation(); setIdx((i) => (i + 1) % count) }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-amber-500/80"
                    >
                        <FaChevronRight className="h-3 w-3" />
                    </button>
                    <div className="absolute bottom-3 right-4 flex gap-1.5">
                        {items.slice(0, 10).map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                aria-label={`Slide ${i + 1}`}
                                onClick={() => setIdx(i)}
                                className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? 'w-6 bg-amber-400' : 'w-1.5 bg-white/40 hover:bg-white/70'}`}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

// ── High Score section (Roliascan) ────────────────────────────────────────────

const HIGH_SCORE_TYPES = [
    { id: 'all', label: 'All' },
    { id: 'manga', label: 'Manga' },
    { id: 'manhwa', label: 'Manhwa' },
    { id: 'manhua', label: 'Manhua' },
]

function HighScoreSection({ initial, enabled, onOpen, tab }) {
    const [type, setType] = useState('all')
    const { items, loading } = useRoliascanHighScore({ enabled, type, initial })
    const ref = useRef(null)
    const scroll = (dir) => ref.current?.scrollBy({ left: dir * 320, behavior: 'smooth' })

    return (
        <div>
            <MediaSectionTitle
                accent="manga"
                title={<span className="inline-flex items-center gap-2"><FaTrophy className="h-3.5 w-3.5 text-amber-400" />High Score Manga</span>}
                hint="Highest rated"
                action={
                    <div className="flex items-center gap-1.5">
                        <MediaArrowButton direction="left" onClick={() => scroll(-1)} label="Scroll left" size="sm" />
                        <MediaArrowButton direction="right" onClick={() => scroll(1)} label="Scroll right" size="sm" />
                    </div>
                }
            />
            <div className="mb-3 flex flex-wrap gap-1.5">
                {HIGH_SCORE_TYPES.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setType(t.id)}
                        className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold transition-all duration-200 ${
                            type === t.id
                                ? 'bg-amber-500/15 text-amber-500 ring-1 ring-amber-400/40'
                                : 'bg-(--color-surface-muted) text-(--color-text-secondary) hover:text-(--color-text-primary)'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
            {loading && !items.length ? (
                <div className="flex gap-3.5 overflow-hidden pb-3 pt-1">
                    {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
            ) : !items.length ? (
                <p className="px-1 py-8 text-[12px] text-(--color-text-secondary)">
                    No {type !== 'all' ? type : ''} titles here.
                </p>
            ) : (
                <div ref={ref} className="flex gap-3.5 overflow-x-auto pb-3 pt-1 hide-scrollbar snap-x">
                    {items.map((item, i) => (
                        <PortraitCard
                            key={itemId(item) || i}
                            item={item}
                            source="roliascan"
                            tab={tab}
                            onOpen={onOpen}
                            rank={i + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Per-source layouts ────────────────────────────────────────────────────────

function RoliascanLayout({ data, enabled, onOpen, tab, loading }) {
    return (
        <div className="space-y-7">
            <FeaturedCarousel items={data?.featured} source="roliascan" tab={tab} onOpen={onOpen} badge="Popular now" loading={loading} />
            <Rail
                title="Popular Manga"
                icon={<FaFire className="h-3.5 w-3.5 text-orange-400" />}
                items={data?.popular}
                source="roliascan"
                tab={tab}
                onOpen={onOpen}
                ranked
                loading={loading}
            />
            <HighScoreSection initial={data?.highScore || []} enabled={enabled} onOpen={onOpen} tab={tab} />
            <Rail
                title="Most Followed"
                icon={<FaHeart className="h-3.5 w-3.5 text-rose-400" />}
                items={data?.mostFollowed}
                source="roliascan"
                tab={tab}
                onOpen={onOpen}
                loading={loading}
            />
            {(loading || data?.newChapters?.length > 0) && (
                <div>
                    <MediaSectionTitle
                        accent="manga"
                        title={<span className="inline-flex items-center gap-2"><FaBolt className="h-3.5 w-3.5 text-amber-400" />New Chapters</span>}
                    />
                    <div className="grid gap-1 sm:grid-cols-2">
                        {loading
                            ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                            : data.newChapters.slice(0, 12).map((item, i) => (
                                <ChapterRow key={itemId(item) || i} item={item} source="roliascan" tab={tab} onOpen={onOpen} />
                            ))}
                    </div>
                </div>
            )}
            <Rail
                title="Recently Added"
                icon={<FaPlus className="h-3 w-3 text-emerald-400" />}
                items={data?.recentlyAdded}
                source="roliascan"
                tab={tab}
                onOpen={onOpen}
                loading={loading}
            />
        </div>
    )
}

function MangaDistrictLayout({ data, onOpen, tab, loading }) {
    return (
        <div className="space-y-7">
            {/* MUST READ hero carousel — reco-block--slider, wide landscape banners */}
            <FeaturedCarousel items={data?.featured} source="mangadistrict" tab={tab} onOpen={onOpen} badge="Must Read" loading={loading} />
            {/* WEEKLY PICKS — popular-item-wrap sidebar widget */}
            <Rail
                title="Weekly Picks"
                icon={<FaStar className="h-3.5 w-3.5 text-amber-400" />}
                items={data?.weeklyPicks}
                source="mangadistrict"
                tab={tab}
                onOpen={onOpen}
                ranked
                loading={loading}
            />
            {/* LAST UPDATES — main page grid */}
            <Rail
                title="Last Updates"
                icon={<FaClock className="h-3.5 w-3.5 text-sky-400" />}
                items={data?.latest}
                source="mangadistrict"
                tab={tab}
                onOpen={onOpen}
                loading={loading}
            />
        </div>
    )
}

function MangaDnaLayout({ data, onOpen, tab, loading }) {
    return (
        <div className="space-y-7">
            <FeaturedCarousel items={data?.featured} source="mangadna" tab={tab} onOpen={onOpen} badge="Popular update" loading={loading} />
            <Rail
                title="Popular Updates"
                icon={<FaFire className="h-3.5 w-3.5 text-orange-400" />}
                items={data?.popular}
                source="mangadna"
                tab={tab}
                onOpen={onOpen}
                ranked
                loading={loading}
            />
            {(loading || data?.latest?.length > 0) && (
                <div>
                    <MediaSectionTitle
                        accent="manga"
                        title={<span className="inline-flex items-center gap-2"><FaBolt className="h-3.5 w-3.5 text-amber-400" />Latest Manga Updates</span>}
                    />
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
                        {loading
                            ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
                            : data.latest.map((item, i) => (
                                <PortraitCard
                                    key={itemId(item) || i}
                                    item={item}
                                    source="mangadna"
                                    tab={tab}
                                    onOpen={onOpen}
                                />
                            ))}
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const HOME_PATH = `${MANGA_BASE}/home`
const VALID_SOURCES = new Set(SOURCES.map((s) => s.id))
// Manga District and MangaDNA are NSFW sources — admin-only, hidden from everyone else.
const NSFW_SOURCE_IDS = new Set(['mangadistrict', 'mangadna'])

export default function LifeSyncMangaHome() {
    const navigate = useNavigate()
    const location = useLocation()
    const { isLifeSyncConnected, lifeSyncUser } = useLifeSync()
    const prefs = lifeSyncUser?.preferences
    const mangaEnabled = isPluginEnabled(prefs, 'pluginMangaEnabled')
    const isAdmin = isLifeSyncAdmin(lifeSyncUser)
    const visibleSources = useMemo(
        () => (isAdmin ? SOURCES : SOURCES.filter((s) => !NSFW_SOURCE_IDS.has(s.id))),
        [isAdmin],
    )

    const initialSource = useMemo(() => {
        const q = new URLSearchParams(location.search).get('source')
        if (NSFW_SOURCE_IDS.has(q) && !isAdmin) return 'roliascan'
        return VALID_SOURCES.has(q) ? q : 'roliascan'
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const [source, setSource] = useState(initialSource)
    const activeSource = useMemo(() => visibleSources.find((s) => s.id === source) || visibleSources[0], [source, visibleSources])
    const enabled = isLifeSyncConnected && mangaEnabled
    const { data, loading, error, refresh } = useMangaHome({ source, enabled })

    const changeSource = (id) => {
        setSource(id)
        navigate(`${HOME_PATH}?source=${id}`, { replace: true })
    }

    const homeUrl = `${HOME_PATH}?source=${source}`

    const { openManga, portal } = useMangaDetailPortal({
        onStartRead: (manga, chapter) => {
            const src = manga?.source || source
            const params = new URLSearchParams()
            params.set('source', src)
            params.set('lang', 'en')
            navigate(
                `${MANGA_BASE}/read/${encodeURIComponent(String(manga.id))}/${encodeURIComponent(String(chapter.id))}?${params.toString()}`,
                { state: { source: src, browseTranslatedLang: 'en', from: homeUrl } },
            )
        },
        isLifeSyncConnected,
    })

    const onOpen = (src, _tab, _id, item) => openManga(item, src)
    const tab = activeSource.tab
    const isLoading = loading && !data

    if (!enabled) {
        return (
            <MediaConnectPrompt
                title="Manga unavailable"
                body="Connect LifeSync and enable the manga plugin to browse manga homes."
            />
        )
    }

    return (
        <div className="space-y-6">
            {portal}
            <MediaPageHeader
                accent="manga"
                icon={<FaBook className="h-5 w-5 text-(--color-text-primary)" />}
                kicker="Manga"
                title="Manga Home"
                subtitle="Each source, the way its own site lays it out"
                actions={
                    <Link
                        to={BROWSE_PATH[source]}
                        state={{ from: homeUrl }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-(--color-surface) px-3.5 py-2 text-[12px] font-bold text-(--color-text-primary) ring-1 ring-(--color-border-soft) transition hover:brightness-95"
                    >
                        Browse all {activeSource.label} <FaArrowRight className="h-3 w-3" />
                    </Link>
                }
            />

            {/* Source selector — hidden entirely when only one source is visible (e.g. NSFW disabled) */}
            {visibleSources.length > 1 && (
                <div className="flex flex-wrap gap-2">
                    {visibleSources.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => changeSource(s.id)}
                            className={mediaChipClass(source === s.id)}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
            )}

            {error ? (
                <MediaEmptyState
                    accent="manga"
                    title="Failed to load"
                    message={error}
                    action={
                        <button
                            type="button"
                            onClick={() => refresh()}
                            className="inline-flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-2 text-[12px] font-bold text-amber-500 ring-1 ring-amber-400/30 transition hover:bg-amber-500/20"
                        >
                            Retry
                        </button>
                    }
                />
            ) : source === 'roliascan' ? (
                <RoliascanLayout key="roliascan" data={data} enabled={enabled} onOpen={onOpen} tab={tab} loading={isLoading} />
            ) : source === 'mangadistrict' ? (
                <MangaDistrictLayout key="mangadistrict" data={data} onOpen={onOpen} tab={tab} loading={isLoading} />
            ) : (
                <MangaDnaLayout key="mangadna" data={data} onOpen={onOpen} tab={tab} loading={isLoading} />
            )}
        </div>
    )
}
