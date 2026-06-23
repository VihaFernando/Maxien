import { useState } from 'react'
import { useActivityFeed } from '../hooks/useActivityFeed'
import { getRelativeTime } from '../lib/dateUtils'

// ─── Domain config ────────────────────────────────────────────────────────────

const DOMAINS = [
    { key: '', label: 'All' },
    { key: 'anime', label: 'Anime' },
    { key: 'manga', label: 'Manga' },
    { key: 'game', label: 'Games' },
    { key: 'wishlist', label: 'Wishlist' },
]

const DOMAIN_META = {
    anime: {
        accent: '#3B82F6',
        dim: 'rgba(59,130,246,0.13)',
        label: 'Anime',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
                <path d="M15 10l4.553-2.069A1 1 0 0121 8.869v6.262a1 1 0 01-1.447.897L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
        ),
    },
    manga: {
        accent: '#F97316',
        dim: 'rgba(249,115,22,0.13)',
        label: 'Manga',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
        ),
    },
    game: {
        accent: '#22C55E',
        dim: 'rgba(34,197,94,0.13)',
        label: 'Games',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
                <path d="M8 12h.01M12 10v4M16 12h.01M12 6C6.48 6 2 9.58 2 14c0 1.98.86 3.78 2.28 5.19L4 22l3.12-.93A10 10 0 0012 22c5.52 0 10-3.58 10-8s-4.48-8-10-8z" />
            </svg>
        ),
    },
    wishlist: {
        accent: '#A855F7',
        dim: 'rgba(168,85,247,0.13)',
        label: 'Wishlist',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
                <path d="M7 7h10M7 12h6m-4 5h2M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H9l-4 4v10a2 2 0 002 2z" />
            </svg>
        ),
    },
    system: {
        accent: '#6B7280',
        dim: 'rgba(107,114,128,0.13)',
        label: 'System',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
            </svg>
        ),
    },
}

const ACTION_LABEL = {
    manga_progress: 'Reading',
    manga_chapter_finished: 'Finished chapter',
    manga_new_chapter: 'New chapter out',
    anime_progress: 'Watching',
    anime_episode_finished: 'Finished episode',
    anime_new_episode: 'New episode out',
    wishlist_added: 'Added to wishlist',
    wishlist_removed: 'Removed',
    wishlist_price_drop: 'Price dropped',
    game_deal: 'Deal found',
}

function getBadge(entry) {
    const d = entry.data || {}
    if (d.episodeNumber != null) return `EP ${d.episodeNumber}`
    if (d.lastEpisodeNumber != null) return `EP ${d.lastEpisodeNumber}`
    if (d.chapterNum != null) return `CH ${d.chapterNum}`
    if (d.chapterId != null) return `CH ${d.chapterId}`
    return null
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
    return (
        <div className="flex gap-4 overflow-hidden rounded-2xl border border-[var(--mx-color-d2d2d7)] bg-[var(--color-surface)] p-4 animate-pulse">
            <div className="h-24 w-16 flex-shrink-0 rounded-xl bg-[var(--mx-color-f0f0f0)]" />
            <div className="flex-1 space-y-3 py-1">
                <div className="flex gap-2">
                    <div className="h-5 w-14 rounded-full bg-[var(--mx-color-f0f0f0)]" />
                    <div className="h-5 w-10 rounded-full bg-[var(--mx-color-f0f0f0)]" />
                </div>
                <div className="h-4 w-3/4 rounded-full bg-[var(--mx-color-f0f0f0)]" />
                <div className="h-3 w-1/2 rounded-full bg-[var(--mx-color-f0f0f0)]" />
                <div className="h-3 w-1/4 rounded-full bg-[var(--mx-color-f0f0f0)]" />
            </div>
        </div>
    )
}

// ─── Activity card — full width horizontal ─────────────────────────────────────

function ActivityCard({ entry }) {
    const meta = DOMAIN_META[entry.domain] || DOMAIN_META.system
    const action = ACTION_LABEL[entry.action] || entry.action?.replace(/_/g, ' ')
    const badge = getBadge(entry)
    const [imgErr, setImgErr] = useState(false)
    const hasImage = entry.imageUrl && !imgErr

    return (
        <li className="group flex gap-4 overflow-hidden rounded-2xl border border-[var(--mx-color-d2d2d7)] bg-[var(--color-surface)] p-4 transition-all duration-200 hover:border-[var(--mx-color-c0c0c5)] hover:shadow-md">

            {/* Poster / icon block */}
            <div className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded-xl">
                {hasImage ? (
                    <img
                        src={entry.imageUrl}
                        alt={entry.title || ''}
                        loading="lazy"
                        onError={() => setImgErr(true)}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                ) : (
                    <div
                        className="absolute inset-0 flex items-center justify-center p-4"
                        style={{ background: meta.dim }}
                    >
                        <span style={{ color: meta.accent }}>{meta.icon}</span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">

                {/* Top row: domain pill + action + badge + time */}
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <span
                        className="rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest"
                        style={{ background: meta.accent, color: '#fff' }}
                    >
                        {meta.label}
                    </span>
                    {action && (
                        <span
                            className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
                            style={{ background: meta.dim, color: meta.accent }}
                        >
                            {action}
                        </span>
                    )}
                    {badge && (
                        <span className="rounded-md bg-[var(--mx-color-f0f0f0)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-text-secondary)]">
                            {badge}
                        </span>
                    )}
                    <span className="ml-auto text-[11px] text-[var(--color-text-secondary)]">
                        {getRelativeTime(entry.occurredAt)}
                    </span>
                </div>

                {/* Title */}
                <p className="line-clamp-2 text-[14px] font-bold leading-snug text-[var(--color-text-primary)]">
                    {entry.title}
                </p>

                {/* Subtitle */}
                {entry.subtitle && (
                    <p className="mt-1 line-clamp-1 text-[12px] text-[var(--color-text-secondary)]">
                        {entry.subtitle}
                    </p>
                )}
            </div>
        </li>
    )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ domain }) {
    const meta = domain ? DOMAIN_META[domain] : null
    return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--mx-color-d2d2d7)] bg-[var(--color-surface)] px-8 py-20 text-center">
            <span
                className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl p-4"
                style={meta ? { background: meta.dim, color: meta.accent } : { background: 'var(--mx-color-f0f0f0)', color: 'var(--color-text-secondary)' }}
            >
                {meta ? meta.icon : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-full w-full">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                )}
            </span>
            <p className="text-[16px] font-extrabold text-[var(--color-text-primary)]">Nothing here yet</p>
            <p className="mt-2 max-w-[240px] text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                {domain
                    ? `Start tracking ${meta?.label?.toLowerCase() || domain} and your activity will appear here.`
                    : "Start reading, watching, or tracking and your activity will show up here."}
            </p>
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Feed() {
    const [domain, setDomain] = useState('')
    const { entries, pageInfo, loading, loadingMore, error, refresh, loadMore } = useActivityFeed({
        domain: domain || undefined,
        limit: 40,
    })

    return (
        <div className="h-full w-full px-6 py-6 lg:px-10">

            {/* ── Header ── */}
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-[24px] font-extrabold tracking-tight text-[var(--color-text-primary)]">
                        Activity
                    </h1>
                    <p className="mt-0.5 text-[13px] text-[var(--color-text-secondary)]">
                        Everything you read, watch &amp; track
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => refresh()}
                    disabled={loading}
                    aria-label="Refresh activity"
                    className="mt-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--mx-color-f0f0f0)] hover:text-[var(--color-text-primary)] disabled:opacity-40"
                >
                    <svg
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round"
                        className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                        style={{ transition: 'transform 300ms ease' }}
                    >
                        <path d="M1 4v6h6M23 20v-6h-6" />
                        <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
                    </svg>
                </button>
            </div>

            {/* ── Filter pills ── */}
            <div className="mb-6 flex flex-wrap gap-2">
                {DOMAINS.map((f) => {
                    const active = domain === f.key
                    const m = f.key ? DOMAIN_META[f.key] : null
                    return (
                        <button
                            key={f.key || 'all'}
                            type="button"
                            onClick={() => setDomain(f.key)}
                            className="cursor-pointer rounded-full px-4 py-2 text-[12px] font-bold transition-all duration-150 min-h-[36px]"
                            style={
                                active && m
                                    ? { background: m.accent, color: '#fff', border: 'none' }
                                    : active
                                    ? { background: 'var(--mx-color-c6ff00)', color: '#000', border: 'none' }
                                    : { background: 'transparent', color: 'var(--color-text-secondary)', border: '1.5px solid var(--mx-color-d2d2d7)' }
                            }
                        >
                            {f.label}
                        </button>
                    )
                })}
            </div>

            {/* ── Content ── */}
            {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-6 text-center">
                    <p className="text-[14px] font-bold text-red-700">Failed to load activity</p>
                    <p className="mt-1 text-[12px] text-red-500">{error}</p>
                    <button
                        type="button"
                        onClick={() => refresh()}
                        className="mt-4 cursor-pointer rounded-xl bg-red-600 px-5 py-2 text-[12px] font-bold text-white transition-opacity hover:opacity-90"
                    >
                        Retry
                    </button>
                </div>

            ) : loading && entries.length === 0 ? (
                /* Two-column skeleton mirrors real layout */
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
                </div>

            ) : entries.length === 0 ? (
                <EmptyState domain={domain} />

            ) : (
                <ol className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {entries.map((e) => (
                        <ActivityCard key={e._id} entry={e} />
                    ))}
                </ol>
            )}

            {/* ── Load more ── */}
            {pageInfo?.hasMore && (
                <div className="mt-8 text-center">
                    <button
                        type="button"
                        onClick={() => loadMore()}
                        disabled={loadingMore}
                        className="cursor-pointer rounded-2xl border border-[var(--mx-color-d2d2d7)] bg-[var(--color-surface)] px-8 py-3 text-[13px] font-bold text-[var(--color-text-primary)] transition-all duration-150 hover:bg-[var(--mx-color-f0f0f0)] disabled:opacity-50"
                    >
                        {loadingMore ? (
                            <span className="flex items-center gap-2">
                                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                                </svg>
                                Loading more…
                            </span>
                        ) : 'Load more'}
                    </button>
                </div>
            )}
        </div>
    )
}
