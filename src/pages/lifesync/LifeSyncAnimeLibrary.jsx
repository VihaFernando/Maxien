import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FaFilm, FaThumbtack, FaTrash, FaPlay } from 'react-icons/fa'
import { useLifeSync } from '../../context/LifeSyncContext'
import { isPluginEnabled } from '../../lib/lifesyncApi'
import { MediaPageHeader, MediaConnectPrompt } from '../../components/lifesync/MediaPageChrome'
import { useAnimeLibrary } from '../../hooks/useAnimeLibrary'

const ANIME_BASE = '/dashboard/lifesync/anime/anime'

const STATUS_OPTIONS = [
    { id: 'all', label: 'Any status' },
    { id: 'watching', label: 'Watching' },
    { id: 'on_hold', label: 'On hold' },
    { id: 'plan_to_watch', label: 'Plan to watch' },
    { id: 'completed', label: 'Completed' },
    { id: 'dropped', label: 'Dropped' },
    { id: 're_watching', label: 'Re-watching' },
]
const UPDATE_FILTERS = [
    { id: 'all', label: 'Everything' },
    { id: 'new', label: 'New episodes' },
    { id: 'behind', label: 'Catching up' },
    { id: 'caughtUp', label: 'All caught up' },
]
const SORT_OPTIONS = [
    { id: 'updatedAt', label: 'Last updated' },
    { id: 'title', label: 'Title A–Z' },
    { id: 'lastEpisode', label: 'Episode' },
]
const STATUS_LABEL = {
    watching: 'Watching',
    on_hold: 'On hold',
    plan_to_watch: 'Plan to watch',
    completed: 'Completed',
    dropped: 'Dropped',
    re_watching: 'Re-watching',
}

function StatBadge({ label, value, tone = 'default' }) {
    const tones = {
        default: 'bg-(--color-surface-muted) text-(--color-text-secondary)',
        new: 'bg-emerald-500/15 text-emerald-600',
        behind: 'bg-amber-500/15 text-amber-600',
    }
    return (
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${tones[tone] || tones.default}`}>
            {value} {label}
        </span>
    )
}

export default function LifeSyncAnimeLibrary() {
    const navigate = useNavigate()
    const { isLifeSyncConnected, lifeSyncUser } = useLifeSync()
    const prefs = lifeSyncUser?.preferences
    const animeEnabled = isPluginEnabled(prefs, 'pluginAnimeEnabled')

    const [status, setStatus] = useState('all')
    const [updateFilter, setUpdateFilter] = useState('all')
    const [sortBy, setSortBy] = useState('updatedAt')
    const [q, setQ] = useState('')

    const filters = useMemo(
        () => ({ status, sortBy, order: 'desc', q: q.trim() || undefined }),
        [status, sortBy, q],
    )

    const enabled = isLifeSyncConnected && animeEnabled
    const { entries, summary, loading, error, patchEntry, removeEntry } = useAnimeLibrary({ enabled, filters })

    const visible = useMemo(() => {
        if (updateFilter === 'new') return entries.filter((e) => e.hasNewEpisode)
        if (updateFilter === 'behind') return entries.filter((e) => e.behind)
        if (updateFilter === 'caughtUp') return entries.filter((e) => e.caughtUp)
        return entries
    }, [entries, updateFilter])

    if (!enabled) {
        return (
            <MediaConnectPrompt
                title="Anime list unavailable"
                body="Connect LifeSync and enable the anime plugin to track your watchlist."
            />
        )
    }

    const openAnime = (e) => {
        const next = Math.max(1, Number(e.lastEpisodeNumber || 0) || 1)
        navigate(`${ANIME_BASE}/watch/${encodeURIComponent(e.animeId)}/${next}`)
    }

    return (
        <div className="space-y-5">
            <MediaPageHeader
                accent="anime"
                icon={<FaFilm className="h-5 w-5 text-(--color-text-primary)" />}
                kicker="My List"
                title="Anime Library"
                subtitle="Picks up at your next episode and tells you when something new drops"
            />

            <div className="flex flex-wrap items-center gap-2">
                <StatBadge label="in your list" value={summary.total} />
                {summary.withNewEpisode > 0 && <StatBadge label="new to watch" value={summary.withNewEpisode} tone="new" />}
                {summary.behind > 0 && <StatBadge label="to catch up" value={summary.behind} tone="behind" />}
                {summary.caughtUp > 0 && <StatBadge label="all caught up" value={summary.caughtUp} />}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <input
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search your list…"
                    className="h-9 min-w-[180px] flex-1 rounded-xl border border-(--color-border-strong) bg-(--color-surface) px-3 text-[13px] text-(--color-text-primary) outline-none focus:border-(--mx-color-c6ff00)"
                />
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-xl border border-(--color-border-strong) bg-(--color-surface) px-3 text-[13px] text-(--color-text-primary)">
                    {STATUS_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="h-9 rounded-xl border border-(--color-border-strong) bg-(--color-surface) px-3 text-[13px] text-(--color-text-primary)">
                    {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
            </div>

            <div className="flex flex-wrap gap-2">
                {UPDATE_FILTERS.map((f) => (
                    <button
                        key={f.id}
                        type="button"
                        onClick={() => setUpdateFilter(f.id)}
                        className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
                            updateFilter === f.id
                                ? 'bg-(--mx-color-c6ff00) text-black'
                                : 'bg-(--color-surface) text-(--color-text-secondary) hover:text-(--color-text-primary)'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {error ? (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-center text-[13px] text-red-600">{error}</p>
            ) : loading && entries.length === 0 ? (
                <p className="px-4 py-16 text-center text-[13px] text-(--color-text-secondary)">Loading your list…</p>
            ) : visible.length === 0 ? (
                <div className="rounded-2xl border border-(--color-border-strong) bg-(--color-surface) px-4 py-16 text-center">
                    <p className="text-[14px] font-semibold text-(--color-text-primary)">Nothing here yet</p>
                    <p className="mt-1 text-[12px] text-(--color-text-secondary)">
                        Add anime from the <Link to={ANIME_BASE} className="font-semibold underline">anime hub</Link> to track it.
                    </p>
                </div>
            ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {visible.map((e) => (
                        <li key={e.animeId} className="group relative overflow-hidden rounded-2xl border border-(--color-border-strong) bg-(--color-surface)">
                            <button type="button" onClick={() => openAnime(e)} className="block w-full text-left">
                                <div className="relative aspect-[2/3] w-full bg-(--color-surface-muted)">
                                    {e.poster ? (
                                        <img src={e.poster} alt={e.title} className="h-full w-full object-cover" loading="lazy" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-(--color-text-secondary)"><FaFilm className="h-6 w-6" /></div>
                                    )}
                                    {/* Badges */}
                                    <div className="absolute left-1.5 top-1.5 flex flex-col gap-1">
                                        {e.hasNewEpisode && <span className="rounded-md bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white">NEW EPISODE</span>}
                                        {e.behind && <span className="rounded-md bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{e.episodesBehind} to catch up</span>}
                                        {e.seriesEnded && !e.hasNewEpisode && <span className="rounded-md bg-(--color-text-secondary) px-1.5 py-0.5 text-[9px] font-bold text-white">COMPLETE</span>}
                                    </div>
                                    {e.isPinned && <FaThumbtack className="absolute right-1.5 top-1.5 h-3 w-3 text-(--mx-color-c6ff00) drop-shadow" />}
                                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                                        <FaPlay className="h-5 w-5 text-white" />
                                    </span>
                                </div>
                                <div className="p-2.5">
                                    <p className="truncate text-[12px] font-bold text-(--color-text-primary)">{e.title || e.animeId}</p>
                                    <p className="mt-0.5 text-[11px] text-(--color-text-secondary)">
                                        {e.lastEpisodeNumber > 0 ? `Up next: Ep ${e.lastEpisodeNumber}` : 'Not started'}{e.latestEpisode ? ` of ${e.latestEpisode}` : ''}
                                        {e.watchStatus ? ` · ${STATUS_LABEL[e.watchStatus] || e.watchStatus}` : ''}
                                    </p>
                                </div>
                            </button>
                            {/* Hover actions */}
                            <div className="absolute bottom-12 right-1.5 flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                <button
                                    type="button"
                                    aria-label={e.isPinned ? 'Unpin' : 'Pin'}
                                    onClick={() => patchEntry(e.animeId, { isPinned: !e.isPinned })}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white hover:bg-black/80"
                                >
                                    <FaThumbtack className="h-3 w-3" />
                                </button>
                                <button
                                    type="button"
                                    aria-label="Remove"
                                    onClick={() => removeEntry(e.animeId)}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white hover:bg-red-500"
                                >
                                    <FaTrash className="h-3 w-3" />
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
