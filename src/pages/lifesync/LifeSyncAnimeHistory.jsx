import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useLifeSync } from '../../context/LifeSyncContext'
import { lifesyncFetch, isPluginEnabled } from '../../lib/lifesyncApi'
import useIsMobile from '../../hooks/useIsMobile'
import {
    LIFESYNC_ANIME_WATCH_HISTORY_UPDATED_EVENT,
    useAnimeWatchHistory,
} from '../../hooks/useAnimeWatchHistory'
import { LifesyncEpisodeThumbnail } from '../../components/lifesync/EpisodeLoadingSkeletons'
import {
    MotionDiv,
    lifeSyncSpringPageVariants,
    lifeSyncSpringPageTransition,
    lifeSyncStatBlockContainer,
    lifeSyncStatBlockItem,
    lifeSyncCardGridContainer,
} from '../../lib/lifesyncMotion'

const ANIME_BASE = '/dashboard/lifesync/anime/anime'
const ANIME_HISTORY_PATH = `${ANIME_BASE}/history`

function cleanAnimeTitle(raw) {
    if (!raw) return ''
    return String(raw)
        .replace(/\s*[-–]\s*AniNeko\s*$/i, '')
        .replace(/\s+Anime\s+Info\s*$/i, '')
        .trim()
}

function relativeTouch(iso) {
    if (!iso) return ''
    try {
        const d = new Date(iso)
        const diff = Date.now() - d.getTime()
        const days = Math.floor(diff / 864e5)
        if (days <= 0) return 'Today'
        if (days === 1) return 'Yesterday'
        if (days < 7) return `${days}d ago`
        if (days < 30) return `${Math.floor(days / 7)}w ago`
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    } catch { return '' }
}

function entryKey(e) { return String(e?.animeId ?? '') }
function lastEpNum(entry) {
    const n = Math.floor(Number(entry?.lastEpisodeNumber) || 1)
    return Number.isFinite(n) && n > 0 ? n : 1
}
function latestEpNum(entry) {
    const n = Math.floor(Number(entry?.latestEpisode) || 0)
    return Number.isFinite(n) && n > 0 ? n : 0
}
function hasNewEpisode(entry) { return Boolean(entry?.hasNewEpisode) }
// How many aired episodes the viewer has not watched yet.
function newEpisodeCount(entry) {
    const n = Math.floor(Number(entry?.episodesBehind) || 0)
    if (Number.isFinite(n) && n > 0) return n
    return Math.max(0, latestEpNum(entry) - lastEpNum(entry))
}
// Target episode for "watch the new one": the next unwatched episode, bounded by
// the latest aired episode the catalog knows about.
function newEpisodeTarget(entry) {
    const latest = latestEpNum(entry)
    const next = lastEpNum(entry) + 1
    const ep = latest > 0 ? Math.min(next, latest) : next
    return {
        to: `${ANIME_BASE}/watch/${encodeURIComponent(String(entry.animeId))}/${ep}`,
        state: { from: ANIME_HISTORY_PATH },
        ep,
    }
}
function isSyncTerminal(s) {
    const v = String(s || '').toLowerCase()
    return v === 'completed' || v === 'completed_with_errors' || v === 'failed'
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
        to: `${ANIME_BASE}/watch/${encodeURIComponent(String(entry.animeId))}/${ep}`,
        state: { from: ANIME_HISTORY_PATH },
    }
}
function progressFraction(entry) {
    const total = totalEpNum(entry)
    if (total == null) return null
    return Math.min(1, lastEpNum(entry) / total)
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const IconPlay = ({ className = 'h-4 w-4' }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
)
const IconX = ({ className = 'h-3.5 w-3.5' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
)
const IconSearch = ({ className = 'h-4 w-4' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
    </svg>
)
const IconBack = ({ className = 'h-3.5 w-3.5' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
)
const IconCheck = ({ className = 'h-3 w-3' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
)
const IconGrid = ({ className = 'h-4 w-4' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
)
const IconList = ({ className = 'h-4 w-4' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
)
const IconSync = ({ className = 'h-3.5 w-3.5' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
)
const IconSparkle = ({ className = 'h-3 w-3' }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2l1.9 5.6L19.5 9l-5.6 1.9L12 16.5l-1.9-5.6L4.5 9l5.6-1.4L12 2z" />
    </svg>
)

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonRow() {
    return (
        <div className="flex items-center gap-4 px-4 py-3 animate-pulse">
            <div className="h-[54px] w-[38px] shrink-0 rounded-lg bg-(--color-surface-muted)" />
            <div className="flex-1 space-y-2">
                <div className="h-3 w-2/3 rounded bg-(--color-surface-muted)" />
                <div className="h-2 w-1/3 rounded bg-(--color-surface-muted)" />
            </div>
            <div className="h-8 w-8 shrink-0 rounded-xl bg-(--color-surface-muted)" />
        </div>
    )
}
function SkeletonCard() {
    return (
        <div className="animate-pulse overflow-hidden rounded-2xl border border-(--color-border-soft) bg-(--color-surface)">
            <div className="aspect-2/3 w-full bg-(--color-surface-muted)" />
            <div className="p-2.5 space-y-1.5">
                <div className="h-3 w-3/4 rounded bg-(--color-surface-muted)" />
                <div className="h-2 w-1/2 rounded bg-(--color-surface-muted)" />
                <div className="h-1.5 w-full rounded-full bg-(--color-surface-muted)" />
            </div>
        </div>
    )
}

// ─── Detail drawer ────────────────────────────────────────────────────────────
function DetailDrawer({ entry, onClose, onContinue, onRemove, removeBusy }) {
    if (!entry) return null
    const frac = progressFraction(entry)
    const total = totalEpNum(entry)
    const current = lastEpNum(entry)
    const complete = isSeriesComplete(entry)
    const title = cleanAnimeTitle(entry.title)
    const pct = frac != null ? Math.round(frac * 100) : null

    useEffect(() => {
        const fn = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', fn)
        return () => window.removeEventListener('keydown', fn)
    }, [onClose])

    return (
        <MotionDiv
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <MotionDiv
                className="relative w-full max-w-lg overflow-hidden rounded-t-3xl sm:rounded-3xl bg-(--color-surface) shadow-2xl"
                initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 340, damping: 32 }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Hero banner ── */}
                <div className="relative h-44 sm:h-48 overflow-hidden">
                    {/* Blurred backdrop */}
                    {entry.imageUrl && (
                        <img
                            src={entry.imageUrl}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover opacity-35 blur-2xl scale-105 pointer-events-none select-none"
                        />
                    )}
                    {/* Sky radial glow */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.18),transparent_70%)] pointer-events-none" />
                    {/* Sky hairline at top */}
                    <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-sky-400/60 to-transparent pointer-events-none" />
                    {/* Dark gradient overlay */}
                    <div className="absolute inset-0 bg-linear-to-t from-(--color-surface) via-(--color-surface)/70 to-transparent pointer-events-none" />
                    {/* Close button */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white/80 hover:text-white transition backdrop-blur-sm"
                    >
                        <IconX className="h-4 w-4" />
                    </button>
                    {/* Cover + title row overlaid on hero */}
                    <div className="absolute bottom-0 inset-x-0 flex gap-4 px-5 pb-6 pt-12 items-end">
                        <div className="relative w-20 shrink-0 overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/20 aspect-2/3 bg-(--color-surface-muted)">
                            {entry.imageUrl && (
                                <LifesyncEpisodeThumbnail
                                    src={entry.imageUrl}
                                    className="absolute inset-0 h-full w-full"
                                    imgClassName="h-full w-full object-cover"
                                    imgProps={{ referrerPolicy: 'no-referrer' }}
                                />
                            )}
                            {complete && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                    <IconCheck className="h-5 w-5 text-primary" />
                                </div>
                            )}
                        </div>
                        <div className="min-w-0 flex-1 pb-1">
                            <h2 className="line-clamp-2 text-[19px] font-black leading-snug text-white drop-shadow-lg">{title || 'Untitled'}</h2>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="rounded-lg bg-sky-500/20 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-sky-400">
                                    {complete ? 'Finished' : 'Watching'}
                                </span>
                            </div>
                            {entry.updatedAt && (
                                <p className="mt-1.5 text-[11px] text-white/60">{relativeTouch(entry.updatedAt)}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Scrollable body ── */}
                <div className="max-h-[min(70vh,480px)] overflow-y-auto">
                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3 px-5 py-5 border-b border-(--color-border-soft)">
                        {[
                            { label: 'Current', value: `Ep ${current}` },
                            { label: 'Total', value: total != null ? `Ep ${total}` : '' },
                            { label: 'Progress', value: `${pct ?? 0}%` },
                        ].map(({ label, value }) => (
                            <div key={label} className="rounded-2xl bg-(--color-surface-muted) px-3 py-3 text-center">
                                <p className="text-[20px] font-black text-(--color-text-primary)">{value}</p>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-(--color-text-secondary) mt-1">{label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Progress bar */}
                    <div className="px-5 py-4 border-b border-(--color-border-soft)">
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-(--color-border-soft)">
                            <div className="h-full rounded-full bg-primary shadow-[0_0_12px_rgba(198,255,0,0.4)] transition-all" style={{ width: `${frac != null ? Math.round(frac * 100) : 0}%` }} />
                        </div>
                    </div>
                </div>

                {/* ── Action footer ── */}
                <div className="px-5 py-4 border-t border-(--color-border-soft) space-y-2.5">
                    <MotionDiv
                        whileTap={{ scale: 0.97 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    >
                        <button
                            type="button" onClick={() => onContinue(entry)}
                            className="flex w-full min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary text-[13px] font-black text-black transition hover:brightness-110 shadow-[0_6px_20px_-6px_rgba(198,255,0,0.4)]"
                        >
                            <IconPlay className="h-4 w-4" /> Resume Ep {current}
                        </button>
                    </MotionDiv>
                    <button
                        type="button" onClick={() => void onRemove(entry)} disabled={removeBusy}
                        className="w-full min-h-11 rounded-2xl border border-red-300/30 bg-red-500/8 px-4 text-[13px] font-semibold text-red-600 dark:text-red-400 transition hover:border-red-400/50 hover:bg-red-500/15 disabled:opacity-40"
                    >
                        {removeBusy ? '…' : 'Remove'}
                    </button>
                </div>
            </MotionDiv>
        </MotionDiv>
    )
}

// ─── List row ─────────────────────────────────────────────────────────────────
function FeedRow({ entry, onOpenDetail, onRemove, removeBusyKey, isLast }) {
    const { to, state } = resumeWatchTarget(entry)
    const frac = progressFraction(entry)
    const total = totalEpNum(entry)
    const current = lastEpNum(entry)
    const complete = isSeriesComplete(entry)
    const rel = relativeTouch(entry.updatedAt)
    const title = cleanAnimeTitle(entry.title)
    const busy = removeBusyKey === entryKey(entry)

    return (
        <MotionDiv
            layout
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -16 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            className={`group relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-(--color-surface-muted) ${!isLast ? 'border-b border-(--color-border-soft)' : ''}`}
        >
            <button
                type="button" onClick={() => onOpenDetail(entry)}
                className="relative h-[54px] w-[38px] shrink-0 overflow-hidden rounded-lg bg-(--color-surface-muted) shadow-sm transition group-hover:shadow-md"
                aria-label={`Details for ${title || 'anime'}`}
            >
                {entry.imageUrl ? (
                    <LifesyncEpisodeThumbnail
                        src={entry.imageUrl}
                        className="absolute inset-0 h-full w-full"
                        imgClassName="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        imgProps={{ referrerPolicy: 'no-referrer' }}
                    />
                ) : (
                    <div className="flex h-full items-center justify-center text-(--color-border-strong)">
                        <IconPlay className="h-4 w-4" />
                    </div>
                )}
                {complete && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <IconCheck className="h-3.5 w-3.5 text-primary" />
                    </div>
                )}
                {frac != null && !complete && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-black/30">
                        <div className="h-full bg-primary" style={{ width: `${Math.round(frac * 100)}%` }} />
                    </div>
                )}
            </button>

            <button type="button" onClick={() => onOpenDetail(entry)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-[13px] font-semibold leading-snug text-(--color-text-primary)">{title || 'Untitled'}</p>
                <div className="mt-0.5 flex items-center gap-2">
                    <span className={`inline-flex h-[18px] items-center rounded-md px-1.5 text-[9px] font-bold uppercase tracking-wide ${
                        complete ? 'bg-primary/15 text-primary' : 'bg-(--color-surface-soft) text-(--color-text-secondary) border border-(--color-border-soft)'
                    }`}>
                        {complete ? 'Done' : `Ep ${current}${total != null ? ` / ${total}` : ''}`}
                    </span>
                    {hasNewEpisode(entry) && (
                        <span className="inline-flex h-[18px] items-center gap-1 rounded-md bg-sky-500/15 px-1.5 text-[9px] font-black uppercase tracking-wide text-sky-500 dark:text-sky-400">
                            <IconSparkle className="h-2.5 w-2.5" />
                            {newEpisodeCount(entry) > 1 ? `${newEpisodeCount(entry)} New` : `New Ep ${newEpisodeTarget(entry).ep}`}
                        </span>
                    )}
                    {rel && <span className="text-[10px] text-(--color-text-secondary)">{rel}</span>}
                </div>
                {frac != null && (
                    <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-(--color-border-soft)">
                        <div
                            className={`h-full rounded-full transition-all ${complete ? 'bg-primary/50' : 'bg-primary'}`}
                            style={{ width: `${Math.round(frac * 100)}%` }}
                        />
                    </div>
                )}
            </button>

            <div className="flex shrink-0 items-center gap-1.5 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                <button
                    type="button" onClick={() => void onRemove(entry)} disabled={busy}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-(--color-text-secondary) transition hover:bg-red-50 hover:text-red-500 disabled:opacity-30 dark:hover:bg-red-900/20"
                    aria-label="Remove"
                >
                    {busy ? <span className="text-[11px]">…</span> : <IconX className="h-3.5 w-3.5" />}
                </button>
                <Link
                    to={to} state={state}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-black transition hover:brightness-95 active:scale-95"
                    aria-label={`Play episode ${current}`}
                >
                    <IconPlay className="ml-px h-3.5 w-3.5" />
                </Link>
            </div>
        </MotionDiv>
    )
}

// ─── Grid card ────────────────────────────────────────────────────────────────
function GridCard({ entry, onOpenDetail, onRemove, removeBusyKey }) {
    const { to, state } = resumeWatchTarget(entry)
    const frac = progressFraction(entry)
    const total = totalEpNum(entry)
    const current = lastEpNum(entry)
    const complete = isSeriesComplete(entry)
    const rel = relativeTouch(entry.updatedAt)
    const title = cleanAnimeTitle(entry.title)
    const busy = removeBusyKey === entryKey(entry)

    return (
        <MotionDiv
            layout
            initial={{ opacity: 0, scale: 0.92, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            whileHover={{ y: -3, transition: { type: 'spring', stiffness: 340, damping: 24 } }}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-(--color-border-soft) bg-(--color-surface) shadow-sm"
        >
            {/* Poster */}
            <button
                type="button" onClick={() => onOpenDetail(entry)}
                className="relative block w-full aspect-2/3 overflow-hidden bg-(--color-surface-muted)"
                aria-label={`Details for ${title || 'anime'}`}
            >
                {entry.imageUrl ? (
                    <LifesyncEpisodeThumbnail
                        src={entry.imageUrl}
                        className="absolute inset-0 h-full w-full"
                        imgClassName="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                        imgProps={{ referrerPolicy: 'no-referrer' }}
                    />
                ) : (
                    <div className="flex h-full items-center justify-center text-(--color-border-strong)">
                        <IconPlay className="h-8 w-8" />
                    </div>
                )}
                <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/10 to-transparent" />

                {/* EP badge */}
                <span className="absolute left-2 top-2 z-10 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-white backdrop-blur-sm">
                    EP {current}
                </span>
                {hasNewEpisode(entry) && (
                    <span className="absolute left-2 top-7 z-10 flex items-center gap-1 rounded-md bg-sky-500/90 px-1.5 py-0.5 text-[9px] font-black uppercase text-white shadow-sm backdrop-blur-sm">
                        <IconSparkle className="h-2.5 w-2.5" /> New
                    </span>
                )}
                {rel && (
                    <span className="absolute right-2 top-2 z-10 rounded-md bg-black/50 px-1.5 py-0.5 text-[9px] font-medium text-white/80 backdrop-blur-sm">
                        {rel}
                    </span>
                )}
                {complete && (
                    <span className="absolute left-2 bottom-10 z-10 flex items-center gap-1 rounded-md bg-primary/90 px-1.5 py-0.5 text-[9px] font-bold text-black">
                        <IconCheck className="h-2.5 w-2.5" /> Done
                    </span>
                )}
                {frac != null && (
                    <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/20">
                        <div className={`h-full ${complete ? 'bg-primary/60' : 'bg-primary'}`} style={{ width: `${Math.round(frac * 100)}%` }} />
                    </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                    <h3 className="line-clamp-2 text-[12px] font-bold leading-snug text-white drop-shadow">
                        {title || 'Untitled'}
                    </h3>
                </div>

                {/* Remove on hover */}
                <button
                    type="button" onClick={(e) => { e.stopPropagation(); void onRemove(entry) }} disabled={busy}
                    className="absolute right-2 bottom-2 z-10 flex h-6 w-6 items-center justify-center rounded-lg bg-black/50 text-white/70 opacity-0 backdrop-blur-sm transition group-hover:opacity-100 hover:bg-red-600/80 hover:text-white disabled:opacity-30"
                    aria-label="Remove"
                >
                    {busy ? <span className="text-[9px]">…</span> : <IconX className="h-3 w-3" />}
                </button>
            </button>

            {/* Footer */}
            <div className="flex items-center gap-1.5 px-2.5 py-2 border-t border-(--color-border-soft)">
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-(--color-text-secondary) tabular-nums">
                        {complete ? 'Finished' : `Ep ${current}${total != null ? ` / ${total}` : ''}`}
                    </p>
                </div>
                <Link
                    to={to} state={state}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-black transition hover:brightness-95 active:scale-95"
                    aria-label={`Play episode ${current}`}
                >
                    <IconPlay className="ml-px h-3 w-3" />
                </Link>
            </div>
        </MotionDiv>
    )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LifeSyncAnimeHistory() {
    const navigate = useNavigate()
    const { isLifeSyncConnected, lifeSyncUser } = useLifeSync()
    const prefs = lifeSyncUser?.preferences
    const animePluginOn = isPluginEnabled(prefs, 'pluginAnimeEnabled')
    const searchRef = useRef(null)
    const isMobile = useIsMobile()

    const { entries, loading, refresh } = useAnimeWatchHistory({
        enabled: isLifeSyncConnected && animePluginOn,
        limit: 100,
    })

    const [removeBusyKey, setRemoveBusyKey] = useState('')
    const [filter, setFilter] = useState('all')
    const [sortBy, setSortBy] = useState('recent')
    const [query, setQuery] = useState('')
    const [detailEntry, setDetailEntry] = useState(null)
    const [layout, setLayout] = useState('list') // 'list' | 'grid'

    // ── Sync job (async, mirrors the manga library sync UX) ──
    const [syncJob, setSyncJob] = useState(null)
    const [syncBusy, setSyncBusy] = useState(false)
    const [syncDismissed, setSyncDismissed] = useState(false)
    const syncPollRef = useRef(null)
    const syncDismissTimerRef = useRef(null)

    const syncRunning = syncJob != null && (syncJob.status === 'queued' || syncJob.status === 'running')
    const syncPercent = (() => {
        const t = Number(syncJob?.total || 0); const p = Number(syncJob?.processed || 0)
        return t > 0 ? Math.min(100, Math.round((p / t) * 100)) : (syncJob?.percent ?? 0)
    })()

    const stopSyncPoll = useCallback(() => {
        if (syncPollRef.current) { clearInterval(syncPollRef.current); syncPollRef.current = null }
    }, [])
    const scheduleSyncDismiss = useCallback(() => {
        if (syncDismissTimerRef.current) clearTimeout(syncDismissTimerRef.current)
        syncDismissTimerRef.current = window.setTimeout(() => { setSyncDismissed(true); syncDismissTimerRef.current = null }, 8000)
    }, [])

    const startSyncPoll = useCallback(() => {
        stopSyncPoll()
        setSyncDismissed(false)
        let inFlight = false
        const intervalId = setInterval(async () => {
            if (inFlight) return
            inFlight = true
            try {
                const data = await lifesyncFetch('/api/v1/anime/watch-history/sync', { method: 'GET' })
                const job = data?.job || null
                setSyncJob(job)
                if (!job || isSyncTerminal(job.status)) {
                    stopSyncPoll()
                    await refresh()
                    scheduleSyncDismiss()
                }
            } catch { /* keep polling; transient */ }
            finally { inFlight = false }
        }, 1200)
        syncPollRef.current = intervalId
    }, [refresh, scheduleSyncDismiss, stopSyncPoll])

    const runSync = useCallback(async () => {
        if (syncBusy || syncRunning) return
        setSyncBusy(true)
        try {
            const data = await lifesyncFetch('/api/v1/anime/watch-history/sync', { method: 'POST' })
            const job = data?.job || null
            setSyncJob(job)
            setSyncDismissed(false)
            if (job && !isSyncTerminal(job.status)) startSyncPoll()
            else { await refresh(); scheduleSyncDismiss() }
        } catch { /* surfaced via no job */ }
        finally { setSyncBusy(false) }
    }, [refresh, scheduleSyncDismiss, startSyncPoll, syncBusy, syncRunning])

    useEffect(() => () => {
        if (syncPollRef.current) clearInterval(syncPollRef.current)
        if (syncDismissTimerRef.current) clearTimeout(syncDismissTimerRef.current)
    }, [])

    const newEpisodeEntries = useMemo(() => entries.filter(hasNewEpisode), [entries])

    useEffect(() => {
        if (!isLifeSyncConnected) navigate('/dashboard/profile?tab=integrations', { replace: true })
    }, [isLifeSyncConnected, navigate])

    const onRemove = useCallback(async (entry) => {
        const key = entryKey(entry)
        if (!key || removeBusyKey) return false
        setRemoveBusyKey(key)
        try {
            await lifesyncFetch(`/api/v1/anime/watch-progress/${encodeURIComponent(key)}`, { method: 'DELETE' })
            window.dispatchEvent(new CustomEvent(LIFESYNC_ANIME_WATCH_HISTORY_UPDATED_EVENT))
            await refresh()
            return true
        } catch { return false }
        finally { setRemoveBusyKey('') }
    }, [refresh, removeBusyKey])

    const onOpenDetail = useCallback((entry) => setDetailEntry(entry || null), [])
    const onCloseDetail = useCallback(() => setDetailEntry(null), [])
    const onContinueFromDetail = useCallback((entry) => {
        const { to, state } = resumeWatchTarget(entry)
        setDetailEntry(null)
        navigate(to, { state: state || undefined })
    }, [navigate])
    const onRemoveFromDetail = useCallback(async (entry) => {
        const removed = await onRemove(entry)
        if (removed) setDetailEntry(null)
    }, [onRemove])

    const stats = useMemo(() => {
        const complete = entries.filter(isSeriesComplete).length
        return { total: entries.length, complete, inProgress: entries.length - complete }
    }, [entries])

    const filteredSorted = useMemo(() => {
        let list = [...entries]
        const q = query.trim().toLowerCase()
        if (q) list = list.filter((e) => cleanAnimeTitle(e.title).toLowerCase().includes(q))
        if (filter === 'watching') list = list.filter((e) => !isSeriesComplete(e))
        if (filter === 'done') list = list.filter(isSeriesComplete)
        list.sort(sortBy === 'recent'
            ? (a, b) => (b.updatedAt ? new Date(b.updatedAt).getTime() : 0) - (a.updatedAt ? new Date(a.updatedAt).getTime() : 0)
            : (a, b) => cleanAnimeTitle(a.title).localeCompare(cleanAnimeTitle(b.title), undefined, { sensitivity: 'base' })
        )
        return list
    }, [entries, filter, sortBy, query])

    if (!isLifeSyncConnected) return null

    if (!animePluginOn) {
        return (
            <MotionDiv
                className="rounded-3xl border border-dashed border-(--color-border-soft) bg-(--color-surface) px-6 py-14 text-center"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            >
                <p className="text-[17px] font-bold text-(--color-text-primary)">Anime streaming is off</p>
                <p className="mx-auto mt-2 max-w-md text-[14px] text-(--color-text-secondary)">
                    Turn on the anime plugin in LifeSync preferences to track watch history here.
                </p>
                <Link to="/dashboard/profile?tab=preferences" className="mt-8 inline-flex min-h-12 items-center justify-center rounded-2xl bg-(--color-text-primary) px-6 text-[14px] font-semibold text-(--color-surface) transition hover:opacity-90">
                    Open preferences
                </Link>
            </MotionDiv>
        )
    }

    return (
        <MotionDiv className="min-w-0 space-y-4" variants={lifeSyncSpringPageVariants} initial="initial" animate="animate" transition={lifeSyncSpringPageTransition}>

            {/* ── Header ── */}
            <div className="flex items-center gap-3">
                <Link to="/dashboard/lifesync/anime" className={`flex shrink-0 items-center justify-center rounded-xl border border-(--color-border-soft) bg-(--color-surface) text-(--color-text-primary) transition hover:bg-(--color-surface-muted) ${isMobile ? 'h-11 w-11' : 'h-9 w-9'}`} aria-label="Back">
                    <IconBack />
                </Link>
                <h1 className="min-w-0 flex-1 text-[20px] font-black leading-none text-(--color-text-primary)">Watch History</h1>
                <Link to={`${ANIME_BASE}/home/page/1`} className={`flex items-center justify-center rounded-xl bg-primary px-4 text-[12px] font-bold text-black transition hover:brightness-95 ${isMobile ? 'h-11' : 'h-9'}`}>
                    Browse
                </Link>
            </div>

            {/* ── Stats ── */}
            <MotionDiv
                className="grid grid-cols-3 gap-2"
                variants={lifeSyncStatBlockContainer}
                initial="hidden"
                animate="show"
            >
                {[
                    { label: 'Total', value: stats.total },
                    { label: 'Watching', value: stats.inProgress, accent: true },
                    { label: 'Finished', value: stats.complete },
                ].map((s) => (
                    <MotionDiv
                        key={s.label}
                        variants={lifeSyncStatBlockItem}
                        className={`rounded-2xl px-3 py-3 text-center ${s.accent ? 'bg-primary/10 ring-1 ring-primary/20' : 'bg-(--color-surface) border border-(--color-border-soft)'}`}
                    >
                        <p className={`text-[22px] font-black tabular-nums leading-none ${s.accent ? 'text-primary' : 'text-(--color-text-primary)'}`}>{loading ? '' : s.value}</p>
                        <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-(--color-text-secondary)">{s.label}</p>
                    </MotionDiv>
                ))}
            </MotionDiv>

            {/* ── New Episodes banner ── */}
            <AnimatePresence initial={false}>
                {newEpisodeEntries.length > 0 && (
                    <MotionDiv
                        key="new-episodes-banner"
                        initial={{ opacity: 0, y: -8, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -8, height: 0 }}
                        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                        className="overflow-hidden rounded-2xl border border-sky-400/30 bg-[linear-gradient(135deg,rgba(56,189,248,0.10),rgba(56,189,248,0.02))]"
                    >
                        <div className="flex items-center gap-2 px-4 pt-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500/20 text-sky-500 dark:text-sky-400">
                                <IconSparkle className="h-3.5 w-3.5" />
                            </span>
                            <p className="text-[13px] font-black text-(--color-text-primary)">
                                New Episodes
                                <span className="ml-1.5 rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-500 dark:text-sky-400 align-middle">{newEpisodeEntries.length}</span>
                            </p>
                        </div>
                        <div className="flex gap-2.5 overflow-x-auto px-4 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                            {newEpisodeEntries.map((entry) => {
                                const { to, state, ep } = newEpisodeTarget(entry)
                                const title = cleanAnimeTitle(entry.title)
                                return (
                                    <Link
                                        key={entryKey(entry)} to={to} state={state}
                                        className="group relative flex w-[116px] shrink-0 flex-col overflow-hidden rounded-xl border border-(--color-border-soft) bg-(--color-surface) shadow-sm transition hover:border-sky-400/50 hover:shadow-md"
                                    >
                                        <div className="relative aspect-2/3 w-full overflow-hidden bg-(--color-surface-muted)">
                                            {entry.imageUrl ? (
                                                <LifesyncEpisodeThumbnail
                                                    src={entry.imageUrl}
                                                    className="absolute inset-0 h-full w-full"
                                                    imgClassName="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                                    imgProps={{ referrerPolicy: 'no-referrer' }}
                                                />
                                            ) : (
                                                <div className="flex h-full items-center justify-center text-(--color-border-strong)"><IconPlay className="h-6 w-6" /></div>
                                            )}
                                            <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent" />
                                            <span className="absolute left-1.5 top-1.5 rounded-md bg-sky-500/90 px-1.5 py-0.5 text-[8px] font-black uppercase text-white backdrop-blur-sm">New</span>
                                            <span className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-black shadow opacity-0 transition group-hover:opacity-100">
                                                <IconPlay className="ml-px h-3 w-3" />
                                            </span>
                                        </div>
                                        <div className="px-2 py-1.5">
                                            <p className="truncate text-[11px] font-semibold text-(--color-text-primary)">{title || 'Untitled'}</p>
                                            <p className="text-[10px] font-medium text-sky-500 dark:text-sky-400 tabular-nums">Episode {ep}</p>
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    </MotionDiv>
                )}
            </AnimatePresence>

            {/* ── Controls ── */}
            <div className={`flex flex-wrap gap-2 ${isMobile ? 'sticky top-2 z-30 rounded-2xl border border-(--color-border-soft) bg-(--color-surface)/70 p-2 ring-1 ring-white/10 backdrop-blur-xl' : ''}`}>
                {/* Search */}
                <div className={`relative min-w-0 flex-1 ${isMobile ? 'basis-full' : 'basis-48'}`}>
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-secondary)">
                        <IconSearch className="h-3.5 w-3.5" />
                    </span>
                    <input
                        ref={searchRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search titles…"
                        className={`w-full rounded-xl border border-(--color-border-soft) bg-(--color-surface) pl-8 pr-3 text-[13px] text-(--color-text-primary) placeholder:text-(--color-text-secondary) focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15 transition ${isMobile ? 'min-h-11' : 'h-9'}`}
                    />
                </div>

                {/* Filter */}
                <div className={`flex rounded-xl border border-(--color-border-soft) bg-(--color-surface-muted) gap-0.5 ${isMobile ? 'p-1' : 'p-0.5'}`}>
                    {[{ id: 'all', label: 'All' }, { id: 'watching', label: 'Watching' }, { id: 'done', label: 'Done' }].map((f) => (
                        <button key={f.id} type="button" onClick={() => setFilter(f.id)}
                            className={`rounded-lg px-3 text-[11px] font-semibold transition ${isMobile ? 'min-h-11' : 'py-1.5'} ${filter === f.id ? 'bg-(--color-surface) text-(--color-text-primary) shadow-sm' : 'text-(--color-text-secondary) hover:text-(--color-text-primary)'}`}>
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Sort */}
                <div className={`flex rounded-xl border border-(--color-border-soft) bg-(--color-surface-muted) gap-0.5 ${isMobile ? 'p-1' : 'p-0.5'}`}>
                    {[{ id: 'recent', label: 'Recent' }, { id: 'title', label: 'A–Z' }].map((s) => (
                        <button key={s.id} type="button" onClick={() => setSortBy(s.id)}
                            className={`rounded-lg px-3 text-[11px] font-semibold transition ${isMobile ? 'min-h-11' : 'py-1.5'} ${sortBy === s.id ? 'bg-(--color-surface) text-(--color-text-primary) shadow-sm' : 'text-(--color-text-secondary) hover:text-(--color-text-primary)'}`}>
                            {s.label}
                        </button>
                    ))}
                </div>

                {/* Layout toggle */}
                <div className={`flex rounded-xl border border-(--color-border-soft) bg-(--color-surface-muted) gap-0.5 ${isMobile ? 'p-1' : 'p-0.5'}`}>
                    <button type="button" onClick={() => setLayout('list')}
                        className={`flex items-center justify-center rounded-lg transition ${isMobile ? 'h-9 w-9' : 'h-8 w-8'} ${layout === 'list' ? 'bg-(--color-surface) text-(--color-text-primary) shadow-sm' : 'text-(--color-text-secondary) hover:text-(--color-text-primary)'}`}
                        aria-label="List view">
                        <IconList className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => setLayout('grid')}
                        className={`flex items-center justify-center rounded-lg transition ${isMobile ? 'h-9 w-9' : 'h-8 w-8'} ${layout === 'grid' ? 'bg-(--color-surface) text-(--color-text-primary) shadow-sm' : 'text-(--color-text-secondary) hover:text-(--color-text-primary)'}`}
                        aria-label="Grid view">
                        <IconGrid className="h-3.5 w-3.5" />
                    </button>
                </div>

                {/* Sync — check tracked anime for new episodes */}
                <button type="button" onClick={() => void runSync()} disabled={syncBusy || syncRunning || entries.length === 0}
                    className={`flex items-center gap-1.5 shrink-0 rounded-xl bg-primary px-3 text-[12px] font-bold text-black transition hover:brightness-95 disabled:opacity-40 ${isMobile ? 'min-h-11' : 'h-9'}`}
                    aria-label="Sync episodes">
                    <IconSync className={`h-3.5 w-3.5 ${syncRunning ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">{syncRunning ? 'Syncing…' : 'Sync'}</span>
                </button>

                {/* Reload */}
                <button type="button" onClick={() => void refresh()} disabled={loading}
                    className={`flex shrink-0 items-center justify-center rounded-xl border border-(--color-border-soft) bg-(--color-surface) text-(--color-text-secondary) transition hover:bg-(--color-surface-muted) disabled:opacity-40 ${isMobile ? 'min-h-11 min-w-11' : 'h-9 w-9'}`}
                    aria-label="Reload">
                    <svg className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            {/* ── Sync progress card ── */}
            {syncJob && !syncDismissed && (
                <div className={`rounded-2xl border px-4 py-3 ${syncJob.status === 'failed' ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30' : isSyncTerminal(syncJob.status) ? 'border-primary/30 bg-primary/5' : 'border-(--color-border-soft) bg-(--color-surface-muted)'}`}>
                    <div className="flex items-center justify-between text-[12px]">
                        <span className="font-semibold text-(--color-text-primary)">
                            {syncJob.status === 'failed' ? 'Sync failed'
                                : isSyncTerminal(syncJob.status) ? (Number(syncJob.newEpisodeCount || 0) > 0 ? `Sync complete — ${syncJob.newEpisodeCount} new` : 'Sync complete — up to date')
                                : `Checking for new episodes ${Math.round(syncPercent)}%`}
                        </span>
                        <span className="text-(--color-text-secondary) tabular-nums">{Number(syncJob?.processed || 0)}/{Number(syncJob?.total || 0)}</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-(--color-border-soft)">
                        <div className={`h-full rounded-full transition-all ${syncJob.status === 'failed' ? 'bg-red-500' : 'bg-primary'}`} style={{ width: `${Math.round(syncPercent)}%` }} />
                    </div>
                </div>
            )}

            {/* ── Content ── */}
            {loading && entries.length === 0 ? (
                layout === 'list' ? (
                    <div className="overflow-hidden rounded-2xl border border-(--color-border-soft) bg-(--color-surface)">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className={i < 5 ? 'border-b border-(--color-border-soft)' : ''}><SkeletonRow /></div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                        {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                )
            ) : entries.length === 0 ? (
                <MotionDiv
                    className="rounded-2xl border border-dashed border-(--color-border-soft) bg-(--color-surface) px-6 py-16 text-center"
                    initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 26 }}
                >
                    <MotionDiv
                        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-(--color-surface-muted)"
                        initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 360, damping: 22, delay: 0.1 }}
                    >
                        <IconPlay className="h-5 w-5 text-(--color-text-secondary)" />
                    </MotionDiv>
                    <p className="text-[16px] font-bold text-(--color-text-primary)">Nothing here yet</p>
                    <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-(--color-text-secondary)">Start watching an episode  your progress saves automatically.</p>
                    <Link to={`${ANIME_BASE}/home/page/1`} className="mt-6 inline-flex min-h-10.5 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-[13px] font-bold text-(--color-ink-strong) transition hover:brightness-95">
                        <IconPlay className="h-3.5 w-3.5" /> Browse anime
                    </Link>
                </MotionDiv>
            ) : filteredSorted.length === 0 ? (
                <MotionDiv className="rounded-2xl border border-(--color-border-soft) bg-(--color-surface) px-6 py-12 text-center"
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 26 }}
                >
                    <p className="text-[14px] font-semibold text-(--color-text-primary)">No matches</p>
                    <p className="mt-1 text-[12px] text-(--color-text-secondary)">Try adjusting your filters or search.</p>
                    <button type="button" onClick={() => { setFilter('all'); setQuery('') }} className="mt-3 text-[12px] font-semibold text-primary hover:underline">Reset</button>
                </MotionDiv>
            ) : layout === 'list' ? (
                <div className="overflow-hidden rounded-2xl border border-(--color-border-soft) bg-(--color-surface)">
                    <AnimatePresence initial={false}>
                        {filteredSorted.map((entry, idx) => (
                            <FeedRow key={entryKey(entry)} entry={entry} onOpenDetail={onOpenDetail} onRemove={onRemove} removeBusyKey={removeBusyKey} isLast={idx === filteredSorted.length - 1} />
                        ))}
                    </AnimatePresence>
                    <div className="flex items-center justify-between border-t border-(--color-border-soft) px-4 py-2.5">
                        <p className="text-[10px] text-(--color-text-secondary)">
                            {filteredSorted.length} {filteredSorted.length === 1 ? 'title' : 'titles'}{filteredSorted.length !== entries.length ? ` of ${entries.length}` : ''}
                        </p>
                        {(query || filter !== 'all') && (
                            <button type="button" onClick={() => { setFilter('all'); setQuery('') }} className="text-[10px] font-semibold text-(--color-text-secondary) hover:text-(--color-text-primary) transition">Clear filters</button>
                        )}
                    </div>
                </div>
            ) : (
                <div>
                    <AnimatePresence initial={false}>
                        <MotionDiv
                            className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                            variants={lifeSyncCardGridContainer}
                            initial="hidden"
                            animate="show"
                        >
                            {filteredSorted.map((entry) => (
                                <GridCard key={entryKey(entry)} entry={entry} onOpenDetail={onOpenDetail} onRemove={onRemove} removeBusyKey={removeBusyKey} />
                            ))}
                        </MotionDiv>
                    </AnimatePresence>
                    <div className="mt-3 flex items-center justify-between px-1">
                        <p className="text-[10px] text-(--color-text-secondary)">
                            {filteredSorted.length} {filteredSorted.length === 1 ? 'title' : 'titles'}{filteredSorted.length !== entries.length ? ` of ${entries.length}` : ''}
                        </p>
                        {(query || filter !== 'all') && (
                            <button type="button" onClick={() => { setFilter('all'); setQuery('') }} className="text-[10px] font-semibold text-(--color-text-secondary) hover:text-(--color-text-primary) transition">Clear filters</button>
                        )}
                    </div>
                </div>
            )}

            <AnimatePresence>
                {detailEntry && (
                    <DetailDrawer entry={detailEntry} onClose={onCloseDetail} onContinue={onContinueFromDetail} onRemove={onRemoveFromDetail} removeBusy={removeBusyKey === entryKey(detailEntry)} />
                )}
            </AnimatePresence>
        </MotionDiv>
    )
}
