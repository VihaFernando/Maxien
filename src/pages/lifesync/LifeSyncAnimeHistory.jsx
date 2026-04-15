import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FaChevronLeft, FaPlay, FaStar } from 'react-icons/fa'
import { useLifeSync } from '../../context/LifeSyncContext'
import { lifesyncFetch, isPluginEnabled } from '../../lib/lifesyncApi'
import {
    LIFESYNC_ANIME_WATCH_HISTORY_UPDATED_EVENT,
    useAnimeWatchHistory,
} from '../../hooks/useAnimeWatchHistory'
import { LifesyncEpisodeThumbnail, LifesyncMediaLibraryPageSkeleton } from '../../components/lifesync/EpisodeLoadingSkeletons'
import { SeriesCompleteBadge } from '../../components/lifesync/LifeSyncShelfDecor'
import {
    MotionDiv,
    lifeSyncEaseOut,
    lifeSyncPageTransition,
    lifeSyncStaggerContainerDense,
    lifeSyncStaggerItemFade,
} from '../../lib/lifesyncMotion'

const MotionLi = motion.li

const ANIME_BASE = '/dashboard/lifesync/anime/anime'
const ANIME_HISTORY_PATH = `${ANIME_BASE}/history`
const SPOTLIGHT_ROTATE_MS = 8000

function formatUpdatedAt(iso) {
    if (!iso) return '—'
    try {
        return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    } catch {
        return '—'
    }
}

function relativeTouch(iso) {
    if (!iso) return ''
    try {
        const d = new Date(iso)
        const now = Date.now()
        const diff = now - d.getTime()
        const days = Math.floor(diff / 864e5)
        if (days <= 0) return 'Today'
        if (days === 1) return 'Yesterday'
        if (days < 7) return `${days}d ago`
        if (days < 30) return `${Math.floor(days / 7)}w ago`
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    } catch {
        return ''
    }
}

function entryKey(e) {
    return String(e?.malId ?? '')
}

function lastEpNum(entry) {
    const n = Math.floor(Number(entry?.lastEpisodeNumber) || 1)
    return Number.isFinite(n) && n > 0 ? n : 1
}

function totalEpNum(entry) {
    const n = Math.floor(Number(entry?.numEpisodes))
    return Number.isFinite(n) && n > 0 ? n : null
}

function isSeriesComplete(entry) {
    const total = totalEpNum(entry)
    if (total == null) return false
    return lastEpNum(entry) >= total
}

function resumeWatchTarget(entry) {
    const ep = lastEpNum(entry)
    return {
        to: `${ANIME_BASE}/watch/${encodeURIComponent(String(entry.malId))}/${ep}`,
        state: { from: ANIME_HISTORY_PATH },
    }
}

function progressFraction(entry) {
    const total = totalEpNum(entry)
    if (total == null) return null
    return Math.min(1, lastEpNum(entry) / total)
}

const spotlightSlide = {
    initial: { opacity: 0, x: 28 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -28 },
}

const spotlightTransition = {
    type: 'tween',
    duration: 0.38,
    ease: lifeSyncEaseOut,
}

/** Corner ribbon for titles that still have episodes to watch (not a pill). */
function ContinueWatchingRibbon({ size = 'card' }) {
    const wide = size === 'spotlight'
    return (
        <div
            className={`pointer-events-none absolute right-0 top-0 z-20 overflow-hidden ${wide ? 'h-24 w-24' : 'h-[4.25rem] w-[4.25rem]'}`}
            aria-hidden
        >
            <motion.div
                className={`absolute rotate-45 bg-gradient-to-b from-[#eeff77] via-[#C6FF00] to-[#b4e830] text-center font-black uppercase tracking-[0.22em] text-slate-900 shadow-[0_3px_14px_rgba(0,0,0,0.18)] ${wide ? 'right-[-38%] top-[18%] w-[130%] py-2 text-[8px] sm:text-[9px]' : 'right-[-42%] top-[16%] w-[140%] py-1.5 text-[7px] sm:text-[8px]'}`}
                animate={{ filter: ['brightness(1)', 'brightness(1.09)', 'brightness(1)'] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            >
                {wide ? 'CONTINUE' : 'GO'}
            </motion.div>
        </div>
    )
}

export default function LifeSyncAnimeHistory() {
    const navigate = useNavigate()
    const { isLifeSyncConnected, lifeSyncUser } = useLifeSync()
    const prefs = lifeSyncUser?.preferences
    const animePluginOn = isPluginEnabled(prefs, 'pluginAnimeEnabled')

    const { entries, loading, refresh } = useAnimeWatchHistory({
        enabled: isLifeSyncConnected && animePluginOn,
        limit: 100,
    })

    const [removeBusyKey, setRemoveBusyKey] = useState('')
    const [filter, setFilter] = useState('all')
    const [sortBy, setSortBy] = useState('recent')
    const [query, setQuery] = useState('')
    const [spotlightIndex, setSpotlightIndex] = useState(0)

    useEffect(() => {
        if (!isLifeSyncConnected) {
            navigate('/dashboard/profile?tab=integrations', { replace: true })
        }
    }, [isLifeSyncConnected, navigate])

    const onRemove = useCallback(
        async (entry) => {
            const key = entryKey(entry)
            if (!key || removeBusyKey) return
            setRemoveBusyKey(key)
            try {
                await lifesyncFetch(`/api/v1/anime/watch-progress/${encodeURIComponent(key)}`, {
                    method: 'DELETE',
                })
                window.dispatchEvent(new CustomEvent(LIFESYNC_ANIME_WATCH_HISTORY_UPDATED_EVENT))
                await refresh()
            } catch {
                /* ignore */
            } finally {
                setRemoveBusyKey('')
            }
        },
        [refresh, removeBusyKey],
    )

    const stats = useMemo(() => {
        const complete = entries.filter((e) => isSeriesComplete(e)).length
        const inProgress = entries.length - complete
        return { total: entries.length, complete, inProgress }
    }, [entries])

    const filteredSorted = useMemo(() => {
        let list = [...entries]
        const q = query.trim().toLowerCase()
        if (q) {
            list = list.filter((e) => String(e.title || '').toLowerCase().includes(q))
        }
        if (filter === 'progress') {
            list = list.filter((e) => !isSeriesComplete(e))
        }
        if (filter === 'complete') {
            list = list.filter((e) => isSeriesComplete(e))
        }
        if (sortBy === 'recent') {
            list.sort((a, b) => {
                const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
                const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
                return tb - ta
            })
        } else {
            list.sort((a, b) =>
                String(a.title || '').localeCompare(String(b.title || ''), undefined, { sensitivity: 'base' }),
            )
        }
        return list
    }, [entries, filter, sortBy, query])

    const spotlightCandidates = useMemo(() => {
        const open = entries.filter((e) => !isSeriesComplete(e))
        return [...open].sort((a, b) => {
            const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
            const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
            return tb - ta
        })
    }, [entries])

    const candidatesSig = useMemo(() => spotlightCandidates.map(entryKey).join('|'), [spotlightCandidates])

    useEffect(() => {
        setSpotlightIndex(0)
    }, [candidatesSig])

    useEffect(() => {
        setSpotlightIndex((i) => {
            if (!spotlightCandidates.length) return 0
            return Math.min(i, spotlightCandidates.length - 1)
        })
    }, [spotlightCandidates.length])

    useEffect(() => {
        if (spotlightCandidates.length <= 1) return undefined
        const rotate = () => {
            if (document.visibilityState !== 'visible') return
            setSpotlightIndex((i) => (i + 1) % spotlightCandidates.length)
        }
        const id = window.setInterval(() => {
            rotate()
        }, SPOTLIGHT_ROTATE_MS)
        document.addEventListener('visibilitychange', rotate)
        return () => {
            window.clearInterval(id)
            document.removeEventListener('visibilitychange', rotate)
        }
    }, [spotlightCandidates.length, candidatesSig])

    const spotlight = spotlightCandidates[spotlightIndex] ?? null

    const showSpotlight =
        Boolean(spotlight) &&
        spotlightCandidates.length > 0 &&
        entries.length > 1 &&
        filter === 'all' &&
        !query.trim()

    if (!isLifeSyncConnected) return null

    if (!animePluginOn) {
        return (
            <MotionDiv
                className="relative overflow-hidden rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 via-white to-lime-50/40 px-6 py-14 text-center shadow-lg sm:px-10"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={lifeSyncPageTransition}
            >
                <div
                    className="pointer-events-none absolute -left-20 top-0 h-56 w-56 rounded-full bg-amber-300/25 blur-3xl"
                    aria-hidden
                />
                <FaPlay className="mx-auto h-10 w-10 text-lime-600" aria-hidden />
                <p className="mt-4 text-[17px] font-bold text-slate-900">Anime streaming is off</p>
                <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-slate-600">
                    Turn on the anime plugin in LifeSync preferences to track watch history here.
                </p>
                <Link
                    to="/dashboard/profile?tab=preferences"
                    className="mt-8 inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-[14px] font-semibold text-white shadow-lg transition hover:bg-slate-800"
                >
                    Open preferences
                </Link>
            </MotionDiv>
        )
    }

    return (
        <MotionDiv
            className="relative min-w-0"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={lifeSyncPageTransition}
        >
            <div
                className="pointer-events-none absolute -left-32 top-0 h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-amber-200/35 via-lime-100/20 to-transparent blur-3xl"
                aria-hidden
            />
            <div
                className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-gradient-to-tl from-lime-200/20 via-amber-100/20 to-transparent blur-3xl"
                aria-hidden
            />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
                <aside className="lg:w-[min(100%,280px)] lg:shrink-0">
                    <div className="sticky top-2 space-y-4 rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] backdrop-blur-md ring-1 ring-white/60">
                        <div className="flex items-start gap-3">
                            <Link
                                to="/dashboard/lifesync/anime"
                                className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-white hover:shadow-sm"
                                aria-label="Back to hub"
                            >
                                <FaChevronLeft className="h-4 w-4" aria-hidden />
                            </Link>
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-800/90">
                                    Queue
                                </p>
                                <h1 className="mt-0.5 text-[20px] font-black leading-tight tracking-tight text-slate-900">
                                    Watch history
                                </h1>
                            </div>
                        </div>

                        <p className="text-[12px] leading-relaxed text-slate-600">
                            Every title you open in the player keeps its last episode here. Remove entries you
                            no longer want suggested.
                        </p>

                        <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-white px-2 py-3 text-center ring-1 ring-slate-100">
                                <p className="text-[20px] font-black tabular-nums text-slate-900">
                                    {loading ? '…' : stats.total}
                                </p>
                                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Saved</p>
                            </div>
                            <div className="rounded-2xl bg-gradient-to-br from-lime-50 to-[#ecfccb] px-2 py-3 text-center ring-1 ring-lime-200/60">
                                <p className="text-[20px] font-black tabular-nums text-slate-900">
                                    {loading ? '…' : stats.inProgress}
                                </p>
                                <p className="text-[9px] font-bold uppercase tracking-wide text-lime-900/70">Active</p>
                            </div>
                            <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/80 px-2 py-3 text-center ring-1 ring-emerald-200/50">
                                <p className="text-[20px] font-black tabular-nums text-slate-900">
                                    {loading ? '…' : stats.complete}
                                </p>
                                <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-900/70">Done</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={() => void refresh()}
                                disabled={loading}
                                className="min-h-[42px] rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
                            >
                                {loading ? 'Refreshing…' : 'Reload list'}
                            </button>
                            <Link
                                to={`${ANIME_BASE}/seasonal/page/1`}
                                className="flex min-h-[42px] items-center justify-center rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-2.5 text-center text-[12px] font-semibold text-amber-950 transition hover:bg-amber-100"
                            >
                                Discover seasonal anime
                            </Link>
                        </div>

                        <div className="border-t border-slate-100 pt-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Filter</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {[
                                    { id: 'all', label: 'All' },
                                    { id: 'progress', label: 'In progress' },
                                    { id: 'complete', label: 'Finished' },
                                ].map((f) => (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => setFilter(f.id)}
                                        className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                                            filter === f.id
                                                ? 'bg-slate-900 text-white shadow-sm'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Sort</p>
                            <div className="mt-2 flex rounded-xl border border-slate-200 bg-slate-50/80 p-1">
                                <button
                                    type="button"
                                    onClick={() => setSortBy('recent')}
                                    className={`flex-1 rounded-lg py-2 text-[11px] font-semibold transition ${
                                        sortBy === 'recent'
                                            ? 'bg-white text-slate-900 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    Recent
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSortBy('title')}
                                    className={`flex-1 rounded-lg py-2 text-[11px] font-semibold transition ${
                                        sortBy === 'title'
                                            ? 'bg-white text-slate-900 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    A–Z
                                </button>
                            </div>
                        </div>

                        <label className="block">
                            <span className="sr-only">Search titles</span>
                            <input
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search your queue…"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-[#C6FF00]/70 focus:outline-none focus:ring-2 focus:ring-amber-200/80"
                            />
                        </label>
                    </div>
                </aside>

                <div className="min-w-0 flex-1 space-y-5">
                    {loading && entries.length === 0 ? (
                        <div className="rounded-3xl border border-slate-100 bg-white/60 p-6">
                            <LifesyncMediaLibraryPageSkeleton gridCount={8} showSpotlight />
                        </div>
                    ) : entries.length === 0 ? (
                        <MotionDiv
                            className="relative overflow-hidden rounded-3xl border border-dashed border-amber-200/70 bg-gradient-to-br from-white via-amber-50/40 to-lime-50/25 px-6 py-16 text-center"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={lifeSyncPageTransition}
                        >
                            <FaStar className="mx-auto h-10 w-10 text-amber-400" aria-hidden />
                            <p className="mt-4 text-[17px] font-bold text-slate-900">No watch history yet</p>
                            <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-slate-600">
                                Start an episode from seasonal or search — we save your place automatically.
                            </p>
                            <Link
                                to={`${ANIME_BASE}/seasonal/page/1`}
                                className="mt-8 inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-[14px] font-semibold text-white shadow-lg transition hover:bg-slate-800"
                            >
                                Browse seasonal
                            </Link>
                        </MotionDiv>
                    ) : (
                        <>
                            {showSpotlight && spotlight ? (
                                <div className="space-y-3">
                                    <AnimatePresence mode="wait" initial={false}>
                                        <AnimeSpotlightCard
                                            key={entryKey(spotlight)}
                                            entry={spotlight}
                                            onRemove={onRemove}
                                            removeBusyKey={removeBusyKey}
                                            slideVariants={spotlightSlide}
                                            transition={spotlightTransition}
                                        />
                                    </AnimatePresence>
                                    {spotlightCandidates.length > 1 ? (
                                        <div
                                            className="flex justify-center gap-1.5"
                                            role="tablist"
                                            aria-label="Rotating picks"
                                        >
                                            {spotlightCandidates.map((c, i) => (
                                                <button
                                                    key={entryKey(c)}
                                                    type="button"
                                                    role="tab"
                                                    aria-selected={i === spotlightIndex}
                                                    onClick={() => setSpotlightIndex(i)}
                                                    className={`h-2 rounded-full transition-all duration-300 ${
                                                        i === spotlightIndex
                                                            ? 'w-6 bg-amber-600 ring-2 ring-amber-200'
                                                            : 'w-2 bg-amber-200/80 hover:bg-amber-300'
                                                    }`}
                                                />
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}

                            {filteredSorted.length === 0 ? (
                                <MotionDiv
                                    className="rounded-3xl border border-slate-200 bg-white/90 px-6 py-12 text-center"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={lifeSyncPageTransition}
                                >
                                    <p className="text-[15px] font-semibold text-slate-800">No matches</p>
                                    <p className="mt-2 text-[13px] text-slate-500">
                                        Try another filter or clear search.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFilter('all')
                                            setQuery('')
                                        }}
                                        className="mt-4 text-[13px] font-semibold text-amber-800 hover:underline"
                                    >
                                        Reset filters
                                    </button>
                                </MotionDiv>
                            ) : (
                                <MotionDiv
                                    className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4"
                                    variants={lifeSyncStaggerContainerDense}
                                    initial="hidden"
                                    animate="show"
                                >
                                    {filteredSorted.map((entry) => {
                                        const isSpotlightSlot =
                                            showSpotlight &&
                                            spotlight &&
                                            entryKey(entry) === entryKey(spotlight)
                                        if (isSpotlightSlot) return null
                                        return (
                                            <AnimeHistoryCard
                                                key={entryKey(entry)}
                                                entry={entry}
                                                onRemove={onRemove}
                                                removeBusyKey={removeBusyKey}
                                            />
                                        )
                                    })}
                                </MotionDiv>
                            )}
                        </>
                    )}
                </div>
            </div>
        </MotionDiv>
    )
}

function AnimeSpotlightCard({ entry, onRemove, removeBusyKey, slideVariants, transition }) {
    const { to, state } = resumeWatchTarget(entry)
    const busyRemove = removeBusyKey === entryKey(entry)
    const rel = relativeTouch(entry.updatedAt)
    const complete = isSeriesComplete(entry)
    const frac = progressFraction(entry)
    const total = totalEpNum(entry)

    return (
        <MotionDiv
            layout
            className="relative overflow-visible rounded-3xl border border-amber-200/90 bg-white shadow-[0_12px_40px_-14px_rgba(180,140,60,0.18)] ring-1 ring-amber-100/60"
            variants={slideVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transition}
        >
            <div
                className="pointer-events-none absolute -right-6 -top-10 h-40 w-40 rounded-full bg-[#C6FF00]/15 blur-3xl"
                aria-hidden
            />
            <div
                className="pointer-events-none absolute -left-4 bottom-0 h-32 w-32 rounded-full bg-amber-200/25 blur-2xl"
                aria-hidden
            />

            <div className="relative flex flex-col gap-4 border-l-[6px] border-l-amber-500 pl-4 pr-4 pb-5 pt-4 sm:flex-row sm:items-stretch sm:gap-6 sm:pl-5 sm:pr-6 sm:pb-8 sm:pt-5">
                <div className="flex shrink-0 items-start gap-3 sm:flex-col sm:items-center">
                    <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 text-amber-900 shadow-sm ring-1 ring-amber-200/80"
                        aria-hidden
                    >
                        <FaPlay className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 pt-0.5 sm:hidden">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-800/90">
                            Resume here
                        </p>
                    </div>
                </div>

                <div className="relative mx-auto shrink-0 sm:mx-0">
                    <Link
                        to={to}
                        state={state}
                        className="relative mx-auto block h-[196px] w-[128px] overflow-hidden rounded-2xl bg-slate-100 shadow-md ring-2 ring-amber-200/70 sm:h-[218px] sm:w-[146px]"
                    >
                        {entry.imageUrl ? (
                            <motion.div
                                className="absolute inset-0 h-full w-full"
                                initial={{ scale: 1.06 }}
                                animate={{ scale: 1 }}
                                transition={{ duration: 0.55, ease: lifeSyncEaseOut }}
                            >
                                <LifesyncEpisodeThumbnail
                                    src={entry.imageUrl}
                                    className="absolute inset-0 h-full w-full"
                                    imgClassName="h-full w-full object-cover"
                                    imgProps={{ referrerPolicy: 'no-referrer' }}
                                />
                            </motion.div>
                        ) : null}
                        {!complete ? <ContinueWatchingRibbon size="spotlight" /> : null}
                        {frac != null ? (
                            <div
                                className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/25"
                                aria-hidden
                            >
                                <div
                                    className="h-full bg-gradient-to-r from-[#C6FF00] to-amber-400"
                                    style={{ width: `${Math.round(frac * 100)}%` }}
                                />
                            </div>
                        ) : null}
                    </Link>
                    {complete ? <SeriesCompleteBadge /> : null}
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-center">
                    <p className="hidden text-[10px] font-black uppercase tracking-[0.2em] text-amber-800/90 sm:block">
                        Resume here
                    </p>
                    <h2 className="mt-0 line-clamp-2 text-[19px] font-black leading-tight tracking-tight text-slate-900 sm:mt-1 sm:text-[22px]">
                        <Link to={to} state={state} className="transition hover:text-amber-900">
                            {entry.title || 'Untitled'}
                        </Link>
                    </h2>
                    <p className="mt-1 text-[12px] font-medium text-slate-500">
                        MAL #{entry.malId}
                        {rel ? ` · ${rel}` : ''}
                    </p>
                    <div className="relative mt-3 pl-4">
                        <div className="absolute bottom-1.5 left-[7px] top-1.5 w-px bg-gradient-to-b from-amber-400/90 via-slate-200 to-slate-200" />
                        <div className="space-y-3">
                            <div className="relative">
                                <span
                                    className="absolute -left-[13px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-amber-500 shadow-sm ring-1 ring-amber-300/60"
                                    aria-hidden
                                />
                                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">
                                    Last watched
                                </p>
                                <p className="text-[13px] font-bold text-slate-900">Episode {lastEpNum(entry)}</p>
                            </div>
                            <div className="relative">
                                <span
                                    className="absolute -left-[13px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-400 shadow-sm ring-1 ring-slate-300/50"
                                    aria-hidden
                                />
                                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">
                                    Series length
                                </p>
                                <p className="text-[13px] font-semibold text-slate-800">
                                    {total != null ? `${total} episode${total === 1 ? '' : 's'}` : 'Unknown'}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Link
                            to={to}
                            state={state}
                            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-2xl bg-[#C6FF00] px-5 py-2.5 text-[13px] font-bold text-slate-900 shadow-sm ring-1 ring-slate-900/10 transition hover:brightness-95 sm:flex-none"
                        >
                            Resume episode
                        </Link>
                        <button
                            type="button"
                            onClick={() => void onRemove(entry)}
                            disabled={busyRemove}
                            className="min-h-[44px] rounded-2xl border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                            {busyRemove ? '…' : 'Remove'}
                        </button>
                    </div>
                </div>
            </div>
        </MotionDiv>
    )
}

function AnimeHistoryCard({ entry, onRemove, removeBusyKey }) {
    const { to, state } = resumeWatchTarget(entry)
    const busyRemove = removeBusyKey === entryKey(entry)
    const complete = isSeriesComplete(entry)
    const frac = progressFraction(entry)
    const total = totalEpNum(entry)

    return (
        <MotionLi
            variants={lifeSyncStaggerItemFade}
            className="group relative flex min-w-0 flex-col overflow-visible rounded-3xl border border-slate-200/90 bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.15)]"
            whileHover={{ y: -4, transition: { type: 'tween', duration: 0.2, ease: lifeSyncEaseOut } }}
        >
            <div className="relative w-full">
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-t-3xl bg-gradient-to-br from-slate-100 to-slate-50">
                    <Link to={to} state={state} className="absolute inset-0 block">
                        {entry.imageUrl ? (
                            <LifesyncEpisodeThumbnail
                                src={entry.imageUrl}
                                className="absolute inset-0 h-full w-full"
                                imgClassName="h-full w-full object-cover transition duration-500 group-hover:scale-[1.06]"
                                imgProps={{ referrerPolicy: 'no-referrer' }}
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center text-slate-300">
                                <FaPlay className="h-14 w-14" aria-hidden />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent opacity-95" />
                        {frac != null ? (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30" aria-hidden>
                                <div
                                    className="h-full bg-gradient-to-r from-[#C6FF00] to-amber-400"
                                    style={{ width: `${Math.round(frac * 100)}%` }}
                                />
                            </div>
                        ) : null}
                    </Link>
                    {!complete ? <ContinueWatchingRibbon size="card" /> : null}
                    <button
                        type="button"
                        onClick={() => void onRemove(entry)}
                        disabled={busyRemove}
                        className="absolute right-2.5 top-2.5 z-30 rounded-full bg-white/95 p-2 text-[11px] font-bold text-slate-500 opacity-0 shadow-md ring-1 ring-slate-200/80 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        aria-label="Remove from history"
                    >
                        {busyRemove ? '…' : '✕'}
                    </button>
                    <span className="absolute left-2 top-2 z-10 max-w-[calc(100%-1rem)] truncate rounded-md bg-white/90 px-1.5 py-0.5 font-mono text-[8px] font-bold tabular-nums uppercase tracking-wide text-slate-900 ring-1 ring-slate-200/80">
                        EP {lastEpNum(entry)}
                    </span>
                    <div className={`absolute left-0 right-0 p-3 ${complete ? 'bottom-5' : 'bottom-0'}`}>
                        <Link to={to} state={state} className="block">
                            <h3 className="line-clamp-2 text-[13px] font-bold leading-snug text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] sm:text-[14px]">
                                {entry.title || 'Untitled'}
                            </h3>
                        </Link>
                    </div>
                </div>
                {complete ? <SeriesCompleteBadge /> : null}
            </div>

            <div
                className={`relative flex flex-1 flex-col gap-1 border-t border-slate-100/90 bg-[linear-gradient(180deg,#fafaf9_0%,#ffffff_100%)] px-3 pb-3 pt-3 sm:gap-1.5 sm:px-4 sm:pb-4 sm:pt-4 ${complete ? 'pt-5 sm:pt-6' : ''}`}
            >
                <div className="relative pl-4">
                    <div className="absolute bottom-2 left-[7px] top-2 w-px bg-gradient-to-b from-amber-400/80 via-slate-200 to-slate-200" />
                    <div className="space-y-3.5">
                        <div className="relative">
                            <span
                                className="absolute -left-[13px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-amber-500 shadow-sm ring-1 ring-amber-300/60"
                                aria-hidden
                            />
                            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">
                                Last watched
                            </p>
                            <p className="text-[11px] font-bold leading-snug text-slate-900">
                                Episode {lastEpNum(entry)}
                                {total != null ? ` / ${total}` : ''}
                            </p>
                            <p className="text-[9px] text-slate-400">{formatUpdatedAt(entry.updatedAt)}</p>
                        </div>
                    </div>
                </div>

                <Link
                    to={to}
                    state={state}
                    className="mt-auto flex min-h-[40px] w-full items-center justify-center rounded-2xl bg-slate-900 py-2.5 text-[11px] font-bold text-white transition hover:bg-slate-800 sm:min-h-[42px] sm:text-[12px]"
                >
                    Open player
                </Link>
            </div>
        </MotionLi>
    )
}
