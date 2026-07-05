import { useMemo, useState } from 'react'
import { useActivityFeed } from '../hooks/useActivityFeed'
import { getRelativeTime } from '../lib/dateUtils'

// ─── Domain config ─────────────────────────────────────────────────────────────

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
        label: 'Anime',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
                <path d="M15 10l4.553-2.069A1 1 0 0121 8.869v6.262a1 1 0 01-1.447.897L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
        ),
    },
    manga: {
        accent: '#F97316',
        label: 'Manga',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
        ),
    },
    game: {
        accent: '#22C55E',
        label: 'Games',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
                <path d="M8 12h.01M12 10v4M16 12h.01M12 6C6.48 6 2 9.58 2 14c0 1.98.86 3.78 2.28 5.19L4 22l3.12-.93A10 10 0 0012 22c5.52 0 10-3.58 10-8s-4.48-8-10-8z" />
            </svg>
        ),
    },
    wishlist: {
        accent: '#A855F7',
        label: 'Wishlist',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
                <path d="M7 7h10M7 12h6m-4 5h2M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H9l-4 4v10a2 2 0 002 2z" />
            </svg>
        ),
    },
    system: {
        accent: '#6B7280',
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
    manga_new_chapter: 'New chapter',
    manga_status_changed: 'Status update',
    anime_progress: 'Watching',
    anime_episode_finished: 'Finished episode',
    anime_new_episode: 'New episode',
    anime_status_changed: 'Status update',
    wishlist_added: 'Added',
    wishlist_removed: 'Removed',
    wishlist_price_drop: 'Price dropped',
    game_deal: 'Deal found',
}

const STATUS_LABEL = {
    watching: 'Watching',
    on_hold: 'On Hold',
    plan_to_watch: 'Plan to Watch',
    dropped: 'Dropped',
    completed: 'Completed',
    re_watching: 'Re-watching',
    reading: 'Reading',
    plan_to_read: 'Plan to Read',
    re_reading: 'Re-reading',
}

function getStatusFromEntry(entry) {
    const d = entry.data || {}
    const raw = d.watchStatus || d.readingStatus || ''
    return STATUS_LABEL[raw] || (raw ? raw.replace(/_/g, ' ') : null)
}

function getBadge(entry) {
    if (entry.action === 'anime_status_changed' || entry.action === 'manga_status_changed') return null
    const d = entry.data || {}
    if (d.episodeNumber != null) return `Ep ${d.episodeNumber}`
    if (d.lastEpisodeNumber != null) return `Ep ${d.lastEpisodeNumber}`
    if (d.chapterNum != null) return `Ch ${d.chapterNum}`
    if (d.chapterId != null) return `Ch ${d.chapterId}`
    return null
}

function getChapterNum(entry) {
    const n = entry?.data?.chapterNum
    return typeof n === 'number' ? n : null
}

// Formats a sorted list of chapter numbers as ranges, e.g. [13,14,15,16,17,35] -> "13-17, 35"
// and [13,15,16,17,35] -> "13, 15-17, 35".
function formatChapterRanges(nums) {
    const sorted = [...new Set(nums)].sort((a, b) => a - b)
    const parts = []
    let start = sorted[0]
    let prev = sorted[0]
    for (let i = 1; i <= sorted.length; i++) {
        const n = sorted[i]
        if (n === prev + 1) {
            prev = n
            continue
        }
        parts.push(start === prev ? `${start}` : `${start}-${prev}`)
        start = n
        prev = n
    }
    return parts.join(', ')
}

// Groups consecutive "finished chapter" entries for the same manga into a single
// collapsible group so a reading binge shows as one row (e.g. "Ch 13-17") instead of
// five identical rows. Non-chapter entries, or runs of a single chapter, pass through.
function groupFeedEntries(entries) {
    const groups = []
    let i = 0
    while (i < entries.length) {
        const entry = entries[i]
        if (entry.action !== 'manga_chapter_finished' || getChapterNum(entry) == null) {
            groups.push({ type: 'single', entry })
            i++
            continue
        }
        const run = [entry]
        let j = i + 1
        while (
            j < entries.length &&
            entries[j].action === 'manga_chapter_finished' &&
            entries[j].refId === entry.refId &&
            getChapterNum(entries[j]) != null
        ) {
            run.push(entries[j])
            j++
        }
        if (run.length > 1) {
            groups.push({ type: 'group', entries: run })
        } else {
            groups.push({ type: 'single', entry })
        }
        i = j
    }
    return groups
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function RowSkeleton() {
    return (
        <div className="flex gap-4 py-4 animate-pulse" aria-hidden="true">
            <div className="flex flex-col items-center gap-1 pt-1">
                <div className="h-2 w-2 rounded-full bg-[var(--mx-color-d2d2d7)]" />
            </div>
            <div className="flex flex-1 gap-3">
                <div className="h-12 w-9 flex-shrink-0 rounded-md bg-[var(--mx-color-f0f0f0)]" />
                <div className="flex-1 space-y-2 pt-0.5">
                    <div className="h-3 w-24 rounded-sm bg-(--mx-color-f0f0f0)" />
                    <div className="h-4 w-2/3 rounded-sm bg-(--mx-color-f0f0f0)" />
                    <div className="h-3 w-1/3 rounded-sm bg-(--mx-color-f0f0f0)" />
                </div>
            </div>
        </div>
    )
}

// ─── Single activity row ────────────────────────────────────────────────────────

function ActivityRow({ entry, isLast, badgeOverride, timeOverride, trailing }) {
    const meta = DOMAIN_META[entry.domain] || DOMAIN_META.system
    const action = ACTION_LABEL[entry.action] || entry.action?.replace(/_/g, ' ')
    const badge = badgeOverride !== undefined ? badgeOverride : getBadge(entry)
    const statusLabel = getStatusFromEntry(entry)
    const isStatusEvent = entry.action === 'anime_status_changed' || entry.action === 'manga_status_changed'
    const [imgErr, setImgErr] = useState(false)
    const hasImage = entry.imageUrl && !imgErr

    return (
        <li className="group flex gap-4">
            {/* Timeline spine */}
            <div className="flex flex-col items-center" style={{ width: 8 }}>
                <div
                    className="mt-2 h-2 w-2 flex-shrink-0 rounded-full transition-colors duration-150 group-hover:scale-125"
                    style={{ background: meta.accent, transition: 'transform 150ms ease-out' }}
                />
                {!isLast && (
                    <div className="mt-1 flex-1 w-px bg-[var(--mx-color-d2d2d7)]" />
                )}
            </div>

            {/* Row content */}
            <div className="flex flex-1 gap-3 pb-6 min-w-0">
                {/* Thumbnail */}
                <div className="relative h-12 w-9 flex-shrink-0 overflow-hidden rounded-md bg-[var(--mx-color-f0f0f0)]">
                    {hasImage ? (
                        <img
                            src={entry.imageUrl}
                            alt=""
                            loading="lazy"
                            onError={() => setImgErr(true)}
                            className="absolute inset-0 h-full w-full object-cover"
                        />
                    ) : (
                        <div
                            className="absolute inset-0 flex items-center justify-center p-2"
                            style={{ color: meta.accent }}
                        >
                            {meta.icon}
                        </div>
                    )}
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1 pt-0.5">
                    {/* Meta row */}
                    <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span
                            className="text-[11px] font-semibold uppercase tracking-wider"
                            style={{ color: meta.accent }}
                        >
                            {meta.label}
                        </span>
                        {action && (
                            <span className="text-[11px] text-[var(--color-text-secondary)]">
                                {action}
                            </span>
                        )}
                        {badge && (
                            <span className="text-[11px] font-medium text-[var(--color-text-secondary)]">
                                · {badge}
                            </span>
                        )}
                        {isStatusEvent && statusLabel && (
                            <span
                                className="text-[11px] font-semibold"
                                style={{ color: meta.accent }}
                            >
                                · {statusLabel}
                            </span>
                        )}
                        <span className="ml-auto text-[11px] text-[var(--color-text-secondary)] tabular-nums">
                            {timeOverride || getRelativeTime(entry.occurredAt)}
                        </span>
                    </div>

                    {/* Title */}
                    <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--color-text-primary)]">
                        {entry.title}
                    </p>

                    {/* Subtitle */}
                    {entry.subtitle && (
                        <p className="mt-0.5 line-clamp-1 text-[12px] text-[var(--color-text-secondary)]">
                            {entry.subtitle}
                        </p>
                    )}

                    {trailing}
                </div>
            </div>
        </li>
    )
}

// ─── Grouped "reading binge" row (consecutive chapters, same manga) ────────────

function GroupedActivityRow({ entries, isLast }) {
    const [expanded, setExpanded] = useState(false)
    const head = entries[0]
    const nums = entries.map(getChapterNum).filter((n) => n != null)
    const rangeLabel = `Ch ${formatChapterRanges(nums)}`

    if (expanded) {
        return (
            <>
                {entries.map((e, i) => (
                    <ActivityRow key={e._id} entry={e} isLast={isLast && i === entries.length - 1} />
                ))}
                <li className="-mt-4 flex gap-4 pb-6">
                    <div style={{ width: 8 }} />
                    <button
                        type="button"
                        onClick={() => setExpanded(false)}
                        className="cursor-pointer text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors duration-150 hover:text-[var(--color-text-primary)]"
                    >
                        Collapse
                    </button>
                </li>
            </>
        )
    }

    return (
        <ActivityRow
            entry={head}
            isLast={isLast}
            badgeOverride={rangeLabel}
            timeOverride={getRelativeTime(head.occurredAt)}
            trailing={
                <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className="mt-1 cursor-pointer text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors duration-150 hover:text-[var(--color-text-primary)]"
                >
                    Show {entries.length} chapters
                </button>
            }
        />
    )
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ domain }) {
    const meta = domain ? DOMAIN_META[domain] : null
    return (
        <div className="py-20 text-center">
            <div
                className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full p-2.5"
                style={meta
                    ? { background: `${meta.accent}15`, color: meta.accent }
                    : { background: 'var(--mx-color-f0f0f0)', color: 'var(--color-text-secondary)' }
                }
            >
                {meta ? meta.icon : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-full w-full">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                )}
            </div>
            <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">Nothing here yet</p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
                {domain
                    ? `Start tracking ${meta?.label?.toLowerCase() || domain} to see activity.`
                    : 'Start reading, watching, or tracking.'}
            </p>
        </div>
    )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function Feed() {
    const [domain, setDomain] = useState('')
    const { entries, pageInfo, loading, loadingMore, error, refresh, loadMore } = useActivityFeed({
        domain: domain || undefined,
        limit: 40,
    })
    const groups = useMemo(() => groupFeedEntries(entries), [entries])

    return (
        <div className="w-full px-6 py-8 lg:px-10 xl:px-16">

            {/* ── Header ── */}
            <div className="mb-8 flex items-start justify-between">
                <div>
                    <h1 className="text-[20px] font-semibold tracking-tight text-[var(--color-text-primary)]">
                        Activity
                    </h1>
                    <p className="mt-0.5 text-[13px] text-[var(--color-text-secondary)]">
                        Your recent reads, watches &amp; updates
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => refresh()}
                    disabled={loading}
                    aria-label="Refresh activity"
                    className="mt-0.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--mx-color-f0f0f0)] hover:text-[var(--color-text-primary)] disabled:opacity-40"
                >
                    <svg
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round"
                        className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
                    >
                        <path d="M1 4v6h6M23 20v-6h-6" />
                        <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
                    </svg>
                </button>
            </div>

            {/* ── Filter tabs ── */}
            <div className="mb-8 flex gap-0 border-b border-[var(--mx-color-d2d2d7)]">
                {DOMAINS.map((f) => {
                    const active = domain === f.key
                    const m = f.key ? DOMAIN_META[f.key] : null
                    return (
                        <button
                            key={f.key || 'all'}
                            type="button"
                            onClick={() => setDomain(f.key)}
                            className="relative cursor-pointer px-3 pb-2.5 pt-0.5 text-[12px] font-medium transition-colors duration-150 min-h-[36px]"
                            style={{
                                color: active
                                    ? (m?.accent || 'var(--color-text-primary)')
                                    : 'var(--color-text-secondary)',
                            }}
                        >
                            {f.label}
                            {active && (
                                <span
                                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                                    style={{ background: m?.accent || 'var(--color-text-primary)' }}
                                />
                            )}
                        </button>
                    )
                })}
            </div>

            {/* ── Error ── */}
            {error && (
                <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center dark:border-red-900 dark:bg-red-950">
                    <p className="text-[13px] font-medium text-red-700 dark:text-red-400">{error}</p>
                    <button
                        type="button"
                        onClick={() => refresh()}
                        className="mt-2 cursor-pointer text-[12px] font-semibold text-red-600 underline underline-offset-2 hover:no-underline dark:text-red-400"
                    >
                        Try again
                    </button>
                </div>
            )}

            {/* ── Content ── */}
            {!error && (
                <>
                    {loading && entries.length === 0 ? (
                        <ol className="ml-3">
                            {Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)}
                        </ol>
                    ) : entries.length === 0 ? (
                        <EmptyState domain={domain} />
                    ) : (
                        <ol className="ml-3">
                            {groups.map((g, i) => {
                                const isLast = i === groups.length - 1 && !pageInfo?.hasMore
                                return g.type === 'group' ? (
                                    <GroupedActivityRow key={g.entries[0]._id} entries={g.entries} isLast={isLast} />
                                ) : (
                                    <ActivityRow key={g.entry._id} entry={g.entry} isLast={isLast} />
                                )
                            })}
                        </ol>
                    )}

                    {/* ── Load more ── */}
                    {pageInfo?.hasMore && (
                        <div className="ml-3 mt-2 pb-4">
                            <button
                                type="button"
                                onClick={() => loadMore()}
                                disabled={loadingMore}
                                className="cursor-pointer text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors duration-150 hover:text-[var(--color-text-primary)] disabled:opacity-40"
                            >
                                {loadingMore ? (
                                    <span className="flex items-center gap-1.5">
                                        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                                        </svg>
                                        Loading…
                                    </span>
                                ) : 'Load more'}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
