import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useLifeSync } from '../../context/LifeSyncContext'
import { isLifeSyncHManhwaVisible, isPluginEnabled, lifesyncFetch } from '../../lib/lifesyncApi'
import useControllerSupportEnabled from '../../hooks/useControllerSupportEnabled'
import useLifeSyncGamepadInput from '../../hooks/useLifeSyncGamepadInput'
import { XBOX_GAMEPAD_BUTTONS } from '../../lib/lifeSyncControllerInput'
import { ControllerHintBar } from '../../components/lifesync/ControllerHintOverlay'
import { useMangaReadingList } from '../../hooks/useMangaReadingList'
import { mangaImageProps, decodeHtmlEntities } from '../../lib/mangaChapterUtils'
import { LifesyncEpisodeThumbnail } from '../../components/lifesync/EpisodeLoadingSkeletons'
import {
    MotionDiv,
    lifeSyncEaseOut,
    lifeSyncPageTransition,
} from '../../lib/lifesyncMotion'

const MANGA_BASE = '/dashboard/lifesync/anime/manga'
const MANGA_LIBRARY_PATH = `${MANGA_BASE}/library`
const PAGE_SIZE = 25

const SOURCE_OPTIONS = [
    { id: 'all', label: 'All sources' },
    { id: 'roliascan', label: 'Roliascan' },
    { id: 'mangadistrict', label: 'Manga District' },
]
const STATUS_OPTIONS = [
    { id: 'all', label: 'Any status' },
    { id: 'reading', label: 'Reading' },
    { id: 'on_hold', label: 'On hold' },
    { id: 'plan_to_read', label: 'Plan to read' },
    { id: 'completed', label: 'Completed' },
    { id: 'dropped', label: 'Dropped' },
    { id: 're_reading', label: 'Re-reading' },
]
const UPDATE_STATE_OPTIONS = [
    { id: 'all', label: 'Any update' },
    { id: 'new', label: 'New chapters' },
    { id: 'needs_sync', label: 'Needs sync' },
    { id: 'caught_up', label: 'Caught up' },
    { id: 'series_ended', label: 'Series ended' },
]
const SORT_OPTIONS = [
    { id: 'updatedAt', label: 'Last updated' },
    { id: 'lastOpenedAt', label: 'Last opened' },
    { id: 'title', label: 'Title A–Z' },
    { id: 'lastReadPercent', label: 'Progress' },
    { id: 'lastChapterLabel', label: 'Chapter' },
]
const SYNC_SCOPE_OPTIONS = [
    { id: 'needs_sync', label: 'Needs sync' },
    { id: 'all', label: 'All titles' },
]

// ─── Icons ────────────────────────────────────────────────────────────────────
const IconBook = ({ className = 'h-4 w-4' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
)
const IconX = ({ className = 'h-3.5 w-3.5' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
)
const IconSearch = ({ className = 'h-3.5 w-3.5' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
    </svg>
)
const IconSync = ({ className = 'h-3.5 w-3.5' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
)
const IconGrid = ({ className = 'h-3.5 w-3.5' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
)
const IconList = ({ className = 'h-3.5 w-3.5' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
)
const IconCheck = ({ className = 'h-3 w-3' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
)
const IconChevronLeft = ({ className = 'h-3.5 w-3.5' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
)
const IconChevronRight = ({ className = 'h-3.5 w-3.5' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
)
const IconAlert = ({ className = 'h-4 w-4' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
)

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sourceLabel(source) {
    if (source === 'mangadistrict') return 'District'
    if (source === 'roliascan') return 'Roliascan'
    return source || 'Manga'
}
function entryKey(entry) { return `${entry?.source || ''}:${entry?.mangaId || ''}` }
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
function formatDateLabel(iso) {
    if (!iso) return '—'
    try { return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }) } catch { return '—' }
}
function statusLabel(status) {
    return STATUS_OPTIONS.find((o) => o.id === status)?.label || (status ? status : 'No status')
}
function parseChapterNum(label) {
    if (!label) return NaN
    const m = String(label).match(/Ch\.?\s*([\d.]+)/i)
    return m ? parseFloat(m[1]) : NaN
}
function clampPct(v) { const n = Number(v); return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0 }
function fmtChapter(v) {
    if (!Number.isFinite(v)) return ''
    return Math.abs(v - Math.round(v)) < 0.001 ? String(Math.round(v)) : String(Math.round(v * 10) / 10)
}
function chapterSnapshot(entry) {
    const last = parseChapterNum(entry?.lastChapterLabel)
    const latest = parseChapterNum(entry?.remoteLatestChapterLabel)
    if (Number.isFinite(last) && Number.isFinite(latest) && latest > 0) {
        const cur = Math.min(last, latest)
        return { currentLabel: `Ch ${fmtChapter(cur)}`, latestLabel: `Ch ${fmtChapter(latest)}`, percent: Math.round(clampPct((cur / latest) * 100) * 10) / 10 }
    }
    return {
        currentLabel: entry?.lastChapterLabel || '—',
        latestLabel: entry?.remoteLatestChapterLabel || (entry?.needsSync ? 'Sync needed' : '—'),
        percent: clampPct(Number(entry?.caughtUp && !entry?.hasNewChapter ? 100 : entry?.lastReadPercent || 0)),
    }
}
function latestChapterDate(entry) {
    const candidates = [entry?.remoteLatestChapterReleaseAt, entry?.remoteLatestChapterReadableAt, entry?.remoteLatestChapterPublishAt]
    let best = 0, bestIso = ''
    for (const iso of candidates) {
        const t = Date.parse(String(iso || ''))
        if (t && t >= best) { best = t; bestIso = String(iso) }
    }
    return bestIso
}
function isSyncTerminal(s) { const v = String(s || '').toLowerCase(); return v === 'completed' || v === 'completed_with_errors' || v === 'failed' }
function syncStateChip(state) {
    const s = String(state || '').toLowerCase()
    const map = { queued: 'bg-[--color-surface-muted] text-(--color-text-secondary)', syncing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', done: 'bg-primary/10 text-primary', error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', skipped: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' }
    const label = { queued: 'Queued', syncing: 'Syncing', done: 'Done', error: 'Error', skipped: 'Skip' }
    return { cls: map[s] || map.queued, label: label[s] || '' }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonRow() {
    return (
        <div className="flex items-center gap-3 px-4 py-3 animate-pulse">
            <div className="h-[54px] w-[38px] shrink-0 rounded-lg bg-(--color-surface-muted)" />
            <div className="flex-1 space-y-2">
                <div className="h-3 w-2/3 rounded bg-(--color-surface-muted)" />
                <div className="h-1.5 w-full rounded-full bg-(--color-surface-muted)" />
                <div className="h-2 w-1/3 rounded bg-(--color-surface-muted)" />
            </div>
            <div className="h-8 w-20 shrink-0 rounded-xl bg-(--color-surface-muted)" />
        </div>
    )
}
function SkeletonCard() {
    return (
        <div className="animate-pulse overflow-hidden rounded-2xl border border-(--color-border-soft) bg-(--color-surface)">
            <div className="aspect-2/3 w-full bg-(--color-surface-muted)" />
            <div className="p-2.5 space-y-1.5">
                <div className="h-3 w-3/4 rounded bg-(--color-surface-muted)" />
                <div className="h-1.5 w-full rounded-full bg-(--color-surface-muted)" />
                <div className="h-2 w-1/2 rounded bg-(--color-surface-muted)" />
            </div>
        </div>
    )
}

// ─── Status select ────────────────────────────────────────────────────────────
function StatusSelect({ value, onChange, disabled, className = '' }) {
    return (
        <select
            value={value || ''} onChange={(e) => onChange(e.target.value || null)} disabled={disabled}
            className={`rounded-lg border border-(--color-border-soft) bg-(--color-surface) px-2 text-[11px] font-medium text-(--color-text-secondary) focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:opacity-50 ${className}`}
        >
            <option value="">No status</option>
            {STATUS_OPTIONS.filter((o) => o.id !== 'all').map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
    )
}

// ─── Detail drawer ────────────────────────────────────────────────────────────
function DetailDrawer({ entry, onClose, onContinue, browseTranslatedLang }) {
    if (!entry) return null
    const snap = chapterSnapshot(entry)
    const heroUrl = entry.backgroundImageUrl || entry.coverUrl || ''
    const releaseDate = latestChapterDate(entry)

    useEffect(() => {
        const fn = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', fn)
        return () => window.removeEventListener('keydown', fn)
    }, [onClose])

    return (
        <MotionDiv
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <MotionDiv
                className="relative w-full max-w-sm overflow-hidden rounded-t-3xl sm:rounded-3xl bg-(--color-surface) shadow-2xl"
                initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 340, damping: 32 }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-center pt-3 pb-1 sm:hidden">
                    <div className="h-1 w-10 rounded-full bg-(--color-border-soft)" />
                </div>
                {/* Cover + meta */}
                <div className="flex gap-4 px-5 pt-4 pb-3">
                    <div className="relative h-[88px] w-[60px] shrink-0 overflow-hidden rounded-xl bg-(--color-surface-muted)">
                        {entry.coverUrl && (
                            <LifesyncEpisodeThumbnail src={entry.coverUrl} className="absolute inset-0 h-full w-full" imgClassName="h-full w-full object-cover" imgProps={mangaImageProps(entry.coverUrl)} />
                        )}
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-primary">{sourceLabel(entry.source)}</p>
                        <h2 className="mt-0.5 line-clamp-3 text-[15px] font-bold leading-snug text-(--color-text-primary)">{decodeHtmlEntities(entry.title) || 'Untitled'}</h2>
                        <p className="mt-1 text-[10px] text-(--color-text-secondary)">{statusLabel(entry.readingStatus)}</p>
                    </div>
                    <button type="button" onClick={onClose} className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-(--color-surface-muted) text-(--color-text-secondary) hover:text-(--color-text-primary) transition">
                        <IconX className="h-3 w-3" />
                    </button>
                </div>
                {/* Progress */}
                <div className="px-5 pb-3">
                    <div className="rounded-2xl bg-(--color-surface-muted) p-3.5 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-(--color-text-secondary)">Chapter progress</span>
                            <span className="font-bold text-(--color-text-primary)">{snap.currentLabel} / {snap.latestLabel}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-(--color-border-soft)">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${snap.percent}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-(--color-text-secondary)">
                            <span>{snap.percent}% complete</span>
                            {releaseDate && <span>Latest: {formatDateLabel(releaseDate)}</span>}
                        </div>
                    </div>
                </div>
                {/* Actions */}
                <div className="flex gap-2.5 px-5 pb-6">
                    <button type="button" onClick={() => onContinue(entry)}
                        className="flex flex-1 min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary text-[13px] font-bold text-black transition hover:brightness-95 active:scale-[0.98]">
                        <IconBook className="h-4 w-4" /> Continue
                    </button>
                    <Link to={MANGA_BASE}
                        className="flex min-h-12 items-center justify-center rounded-2xl border border-(--color-border-soft) px-4 text-[13px] font-semibold text-(--color-text-secondary) transition hover:bg-(--color-surface-muted)">
                        Browse
                    </Link>
                </div>
            </MotionDiv>
        </MotionDiv>
    )
}

// ─── Confirm modal ────────────────────────────────────────────────────────────
function ConfirmModal({ isOpen, title, message, onConfirm, onCancel }) {
    if (!isOpen) return null
    return (
        <MotionDiv className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
            <MotionDiv className="w-full max-w-sm rounded-3xl bg-(--color-surface) p-5 shadow-2xl" initial={{ scale: 0.94, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 14 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }} onClick={(e) => e.stopPropagation()}>
                <div className="mb-3 flex justify-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30">
                        <IconAlert className="h-5 w-5" />
                    </span>
                </div>
                <h2 className="text-center text-[17px] font-bold text-(--color-text-primary)">{title}</h2>
                <p className="mt-2 text-center text-[13px] text-(--color-text-secondary)">{message}</p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                    <button type="button" onClick={onCancel} className="min-h-11 rounded-2xl border border-(--color-border-soft) text-[13px] font-semibold text-(--color-text-secondary) transition hover:bg-(--color-surface-muted)">Cancel</button>
                    <button type="button" onClick={onConfirm} className="min-h-11 rounded-2xl bg-red-600 text-[13px] font-semibold text-white transition hover:bg-red-700">Remove</button>
                </div>
            </MotionDiv>
        </MotionDiv>
    )
}

// ─── List row ─────────────────────────────────────────────────────────────────
function MangaRow({ entry, browseTranslatedLang, busy, removeBusy, syncState, selected, onToggleSelect, onStatusChange, onRequestRemove, onOpenDetail, isLast }) {
    const snap = chapterSnapshot(entry)
    const rel = relativeTouch(entry.updatedAt)
    const title = decodeHtmlEntities(entry.title) || 'Untitled'
    const chip = syncState ? syncStateChip(syncState) : null

    return (
        <motion.div
            layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -12 }}
            transition={{ type: 'tween', duration: 0.18, ease: lifeSyncEaseOut }}
            className={`group relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-(--color-surface-muted) ${!isLast ? 'border-b border-(--color-border-soft)' : ''}`}
        >
            {/* Select checkbox */}
            <button type="button" onClick={() => onToggleSelect(entry)}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${selected ? 'border-primary bg-primary text-(--color-ink-strong)' : 'border-(--color-border-strong) bg-(--color-surface) hover:border-primary'}`}
                aria-label={selected ? 'Deselect' : 'Select'}>
                {selected && <IconCheck className="h-2.5 w-2.5" />}
            </button>

            {/* Cover */}
            <button type="button" onClick={() => onOpenDetail(entry)}
                className="relative h-[54px] w-[38px] shrink-0 overflow-hidden rounded-lg bg-(--color-surface-muted) shadow-sm transition group-hover:shadow-md">
                {entry.coverUrl ? (
                    <LifesyncEpisodeThumbnail src={entry.coverUrl} className="absolute inset-0 h-full w-full" imgClassName="h-full w-full object-cover transition duration-300 group-hover:scale-105" imgProps={mangaImageProps(entry.coverUrl)} />
                ) : (
                    <div className="flex h-full items-center justify-center text-(--color-border-strong)"><IconBook className="h-4 w-4" /></div>
                )}
                {entry.hasNewChapter && (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-(--color-surface)" />
                )}
            </button>

            {/* Info */}
            <button type="button" onClick={() => onOpenDetail(entry)} className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-1.5">
                    <p className="truncate text-[13px] font-semibold leading-snug text-(--color-text-primary)">{title}</p>
                    {chip && <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold ${chip.cls}`}>{chip.label}</span>}
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-[10px] text-(--color-text-secondary)">{snap.currentLabel} / {snap.latestLabel}</span>
                    {rel && <span className="text-[10px] text-(--color-text-secondary)">· {rel}</span>}
                </div>
                <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-(--color-border-soft)">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${snap.percent}%` }} />
                </div>
            </button>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-1.5 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                <StatusSelect value={entry.readingStatus} onChange={(v) => onStatusChange(entry, v)} disabled={busy} className="h-8 min-w-[84px]" />
                <button type="button" onClick={() => onRequestRemove(entry)} disabled={removeBusy}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-(--color-text-secondary) transition hover:bg-red-50 hover:text-red-500 disabled:opacity-30 dark:hover:bg-red-900/20"
                    aria-label="Remove">
                    {removeBusy ? <span className="text-[10px]">…</span> : <IconX className="h-3.5 w-3.5" />}
                </button>
                <Link to={resumeTarget(entry, browseTranslatedLang).to} state={resumeTarget(entry, browseTranslatedLang).state}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-(--color-ink-strong) transition hover:brightness-95 active:scale-95"
                    aria-label="Continue reading">
                    <IconBook className="h-3.5 w-3.5" />
                </Link>
            </div>
        </motion.div>
    )
}

// ─── Grid card ────────────────────────────────────────────────────────────────
function MangaCard({ entry, browseTranslatedLang, busy, removeBusy, syncState, selected, onToggleSelect, onStatusChange, onRequestRemove, onOpenDetail }) {
    const snap = chapterSnapshot(entry)
    const title = decodeHtmlEntities(entry.title) || 'Untitled'
    const chip = syncState ? syncStateChip(syncState) : null
    const { to, state } = resumeTarget(entry, browseTranslatedLang)

    return (
        <motion.div
            layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
            transition={{ type: 'tween', duration: 0.18, ease: lifeSyncEaseOut }}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-(--color-border-soft) bg-(--color-surface) shadow-sm transition-shadow hover:shadow-md"
        >
            {/* Cover */}
            <button type="button" onClick={() => onOpenDetail(entry)} className="relative block w-full aspect-2/3 overflow-hidden bg-(--color-surface-muted)">
                {entry.coverUrl ? (
                    <LifesyncEpisodeThumbnail src={entry.coverUrl} className="absolute inset-0 h-full w-full" imgClassName="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" imgProps={mangaImageProps(entry.coverUrl)} />
                ) : (
                    <div className="flex h-full items-center justify-center text-(--color-border-strong)"><IconBook className="h-8 w-8" /></div>
                )}
                <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/10 to-transparent" />

                {/* Select */}
                <button type="button" onClick={(e) => { e.stopPropagation(); onToggleSelect(entry) }}
                    className={`absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-md border transition ${selected ? 'border-primary bg-primary text-(--color-ink-strong)' : 'border-white/60 bg-black/30 text-transparent hover:border-white'}`}>
                    {selected && <IconCheck className="h-2.5 w-2.5" />}
                </button>

                {entry.hasNewChapter && (
                    <span className="absolute right-2 top-2 z-10 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-(--color-ink-strong)">New</span>
                )}
                {chip && (
                    <span className={`absolute left-2 top-8 z-10 rounded-md px-1.5 py-0.5 text-[9px] font-bold ${chip.cls}`}>{chip.label}</span>
                )}

                {/* Remove on hover */}
                <button type="button" onClick={(e) => { e.stopPropagation(); onRequestRemove(entry) }} disabled={removeBusy}
                    className="absolute right-2 bottom-10 z-10 flex h-6 w-6 items-center justify-center rounded-lg bg-black/50 text-white/70 opacity-0 backdrop-blur-sm transition group-hover:opacity-100 hover:bg-red-600/80 hover:text-white disabled:opacity-30">
                    {removeBusy ? <span className="text-[9px]">…</span> : <IconX className="h-3 w-3" />}
                </button>

                {/* Progress + title */}
                <div className="absolute bottom-0 left-0 right-0">
                    {snap.percent > 0 && (
                        <div className="h-[3px] bg-black/20">
                            <div className="h-full bg-primary" style={{ width: `${snap.percent}%` }} />
                        </div>
                    )}
                    <div className="p-2.5">
                        <h3 className="line-clamp-2 text-[12px] font-bold leading-snug text-white drop-shadow">{title}</h3>
                    </div>
                </div>
            </button>

            {/* Footer */}
            <div className="flex items-center gap-1.5 border-t border-(--color-border-soft) px-2.5 py-2">
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[9px] text-(--color-text-secondary)">{snap.currentLabel}</p>
                </div>
                <StatusSelect value={entry.readingStatus} onChange={(v) => onStatusChange(entry, v)} disabled={busy} className="h-6 min-w-[60px] text-[9px]" />
                <Link to={to} state={state} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-(--color-ink-strong) transition hover:brightness-95 active:scale-95" aria-label="Continue reading">
                    <IconBook className="h-3 w-3" />
                </Link>
            </div>
        </motion.div>
    )
}

function resumeTarget(entry, browseTranslatedLang) {
    const lastChapterId = String(entry?.lastChapterId || '').trim()
    const latestChapterId = String(entry?.remoteLatestChapterId || '').trim()
    const chapterId = lastChapterId || latestChapterId
    if (entry?.mangaId != null && entry?.source && chapterId) {
        const q = new URLSearchParams({ source: String(entry.source), lang: browseTranslatedLang === 'all' ? 'all' : 'en' }).toString()
        return {
            to: `${MANGA_BASE}/read/${encodeURIComponent(String(entry.mangaId))}/${encodeURIComponent(chapterId)}?${q}`,
            state: { from: MANGA_LIBRARY_PATH, source: entry.source, browseTranslatedLang, resumeChapterId: chapterId, resumePercent: Number(entry?.lastReadPercent || 0) },
        }
    }
    return { to: MANGA_BASE, state: { resumeEntry: entry } }
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LifeSyncMangaLibrary() {
    const navigate = useNavigate()
    const { isLifeSyncConnected, lifeSyncUser } = useLifeSync()
    const prefs = lifeSyncUser?.preferences
    const nsfwEnabled = Boolean(prefs?.nsfwContentEnabled)
    const mangaPluginOn = isPluginEnabled(prefs, 'pluginMangaEnabled')
    const hManhwaEnabled = isLifeSyncHManhwaVisible(prefs)
    const mangaEnglishReleasesOnly = prefs?.mangaEnglishReleasesOnly !== false
    const browseTranslatedLang = mangaEnglishReleasesOnly ? 'en' : 'all'
    const searchRef = useRef(null)

    const [queryInput, setQueryInput] = useState('')
    const [query, setQuery] = useState('')
    const [sourceFilter, setSourceFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')
    const [updateStateFilter, setUpdateStateFilter] = useState('all')
    const [sortBy, setSortBy] = useState('updatedAt')
    const [sortOrder, setSortOrder] = useState('desc')
    const [page, setPage] = useState(1)
    const [layout, setLayout] = useState('list')
    const [focusedCardIndex, setFocusedCardIndex] = useState(-1)
    const controllerSupportEnabled = useControllerSupportEnabled()

    const [syncBusy, setSyncBusy] = useState(false)
    const [syncError, setSyncError] = useState('')
    const [syncScope, setSyncScope] = useState('needs_sync')
    const [syncJob, setSyncJob] = useState(null)
    const [syncDismissed, setSyncDismissed] = useState(false)
    const syncPollRef = useRef(null)
    const syncDismissTimerRef = useRef(null)

    const [actionBusyKeys, setActionBusyKeys] = useState(() => new Set())
    const [removeBusyKey, setRemoveBusyKey] = useState('')
    const [bulkBusy, setBulkBusy] = useState(false)
    const [selectedKeys, setSelectedKeys] = useState(() => new Set())
    const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, entry: null })
    const [detailEntry, setDetailEntry] = useState(null)

    const sourceOptions = useMemo(
        () => hManhwaEnabled ? SOURCE_OPTIONS : SOURCE_OPTIONS.filter((o) => o.id !== 'mangadistrict'),
        [hManhwaEnabled],
    )

    useEffect(() => { if (!isLifeSyncConnected) navigate('/dashboard/profile?tab=integrations', { replace: true }) }, [isLifeSyncConnected, navigate])
    useEffect(() => { const id = setTimeout(() => setQuery(queryInput.trim()), 260); return () => clearTimeout(id) }, [queryInput])
    useEffect(() => { setPage(1) }, [query, sourceFilter, statusFilter, updateStateFilter, sortBy, sortOrder])
    useEffect(() => { if (!hManhwaEnabled && sourceFilter === 'mangadistrict') setSourceFilter('all') }, [hManhwaEnabled, sourceFilter])

    const listFilters = useMemo(() => ({ q: query, source: sourceFilter, status: statusFilter, updateState: updateStateFilter, sortBy, order: sortOrder, page, limit: PAGE_SIZE }), [query, sourceFilter, statusFilter, updateStateFilter, sortBy, sortOrder, page])

    const { entries: listEntries, visibleEntries, visibleSummary, pageInfo, error, initialLoading, refreshing, refresh: refreshList, patchEntry, removeEntry, bulkPatch, bulkDelete } = useMangaReadingList({ enabled: isLifeSyncConnected && mangaPluginOn, nsfwEnabled, hManhwaEnabled, filters: listFilters })

    useEffect(() => {
        const total = Math.max(1, Number(pageInfo?.totalPages || 1))
        if (page > total) setPage(total)
    }, [page, pageInfo?.totalPages])

    const selectableEntries = useMemo(() => {
        const m = new Map()
        for (const e of visibleEntries) { const k = entryKey(e); if (k && k !== ':') m.set(k, e) }
        return [...m.values()]
    }, [visibleEntries])

    const selectableKeySet = useMemo(() => new Set(selectableEntries.map(entryKey)), [selectableEntries])
    useEffect(() => {
        setSelectedKeys((prev) => {
            const next = new Set([...prev].filter((k) => selectableKeySet.has(k)))
            return next.size === prev.size ? prev : next
        })
    }, [selectableKeySet])

    const selectedEntries = useMemo(() => selectableEntries.filter((e) => selectedKeys.has(entryKey(e))), [selectedKeys, selectableEntries])
    const hiddenCount = Math.max(0, listEntries.length - visibleEntries.length)
    const syncRunning = syncJob != null && (syncJob.status === 'queued' || syncJob.status === 'running')
    const syncPercent = (() => { const t = Number(syncJob?.total || 0); const p = Number(syncJob?.processed || 0); return t > 0 ? Math.min(100, Math.round((p / t) * 100)) : (syncJob?.percent ?? 0) })()

    const stopSyncPoll = useCallback(() => { if (syncPollRef.current) { clearInterval(syncPollRef.current); syncPollRef.current = null } }, [])
    const scheduleSyncDismiss = useCallback(() => {
        if (syncDismissTimerRef.current) clearTimeout(syncDismissTimerRef.current)
        syncDismissTimerRef.current = window.setTimeout(() => { setSyncDismissed(true); syncDismissTimerRef.current = null }, 8000)
    }, [])

    const refreshAll = useCallback(async () => { await refreshList() }, [refreshList])

    const startSyncPoll = useCallback(() => {
        stopSyncPoll()
        setSyncDismissed(false)
        syncPollRef.current = setInterval(async () => {
            try {
                const data = await lifesyncFetch('/api/v1/progress/sync', { method: 'GET' })
                const job = data?.job || null
                setSyncJob(job)
                if (!job || isSyncTerminal(job.status)) { stopSyncPoll(); await refreshAll(); scheduleSyncDismiss() }
            } catch { stopSyncPoll(); scheduleSyncDismiss() }
        }, 2000)
    }, [refreshAll, scheduleSyncDismiss, stopSyncPoll])

    useEffect(() => () => { stopSyncPoll(); if (syncDismissTimerRef.current) clearTimeout(syncDismissTimerRef.current) }, [stopSyncPoll])

    const onSync = useCallback(async () => {
        if (syncBusy || syncRunning) return
        setSyncBusy(true); setSyncError(''); setSyncDismissed(false)
        if (syncDismissTimerRef.current) { clearTimeout(syncDismissTimerRef.current); syncDismissTimerRef.current = null }
        try {
            const data = await lifesyncFetch('/api/v1/progress/sync', { method: 'POST', json: { scope: syncScope } })
            const job = data?.job || null; setSyncJob(job)
            if (job && !isSyncTerminal(job.status)) startSyncPoll(); else { await refreshAll(); scheduleSyncDismiss() }
        } catch (err) { setSyncError(String(err?.message || 'Failed to start sync')) }
        finally { setSyncBusy(false) }
    }, [refreshAll, scheduleSyncDismiss, startSyncPoll, syncBusy, syncRunning, syncScope])

    const runEntryAction = useCallback(async (entry, action) => {
        const k = entryKey(entry)
        setActionBusyKeys((p) => new Set([...p, k]))
        try { await action(); return true } catch { return false }
        finally { setActionBusyKeys((p) => { const n = new Set(p); n.delete(k); return n }) }
    }, [])

    const onStatusChange = useCallback(async (entry, nextStatus) => {
        await runEntryAction(entry, async () => { await patchEntry(entry, { readingStatus: nextStatus || null }); await refreshList() })
    }, [patchEntry, refreshList, runEntryAction])

    const onRemove = useCallback(async (entry) => {
        const k = entryKey(entry)
        if (!entry || removeBusyKey) return false
        setRemoveBusyKey(k)
        try { await removeEntry(entry); setSelectedKeys((p) => { const n = new Set(p); n.delete(k); return n }); return true }
        catch { return false }
        finally { setRemoveBusyKey('') }
    }, [removeBusyKey, removeEntry])

    const onRequestDelete = useCallback((entry) => setDeleteConfirm({ isOpen: true, entry }), [])
    const onCancelDelete = useCallback(() => setDeleteConfirm({ isOpen: false, entry: null }), [])
    const onConfirmDelete = useCallback(async () => {
        if (!deleteConfirm.entry) return
        await onRemove(deleteConfirm.entry)
        setDeleteConfirm({ isOpen: false, entry: null })
    }, [deleteConfirm.entry, onRemove])

    const onOpenDetail = useCallback((entry) => setDetailEntry(entry || null), [])
    const onCloseDetail = useCallback(() => setDetailEntry(null), [])
    const onContinueFromDetail = useCallback((entry) => {
        const { to, state } = resumeTarget(entry, browseTranslatedLang)
        setDetailEntry(null); navigate(to, { state: state || undefined })
    }, [browseTranslatedLang, navigate])

    const onToggleSelect = useCallback((entry) => {
        const k = entryKey(entry)
        setSelectedKeys((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n })
    }, [])
    const onSelectAll = useCallback(() => setSelectedKeys(new Set(selectableEntries.map(entryKey))), [selectableEntries])
    const onClearSelection = useCallback(() => setSelectedKeys(new Set()), [])

    const onBulkDelete = useCallback(async () => {
        if (bulkBusy || !selectedEntries.length) return
        setBulkBusy(true)
        try { await bulkDelete(selectedEntries); setSelectedKeys(new Set()) } catch { } finally { setBulkBusy(false) }
    }, [bulkBusy, bulkDelete, selectedEntries])

    const onBulkSetStatus = useCallback(async (status) => {
        if (bulkBusy || !selectedEntries.length) return
        setBulkBusy(true)
        try { await bulkPatch(selectedEntries, { readingStatus: status || null }); setSelectedKeys(new Set()) } catch { } finally { setBulkBusy(false) }
    }, [bulkBusy, bulkPatch, selectedEntries])

    const libGamepadHandlers = useMemo(() => ({
        [XBOX_GAMEPAD_BUTTONS.Y]: () => {
            setLayout(l => l === 'list' ? 'grid' : 'list')
            setFocusedCardIndex(-1)
        },
        [XBOX_GAMEPAD_BUTTONS.LB]: () => {
            setPage(p => Math.max(1, p - 1))
            setFocusedCardIndex(0)
        },
        [XBOX_GAMEPAD_BUTTONS.RB]: () => {
            if (pageInfo?.hasMore) {
                setPage(p => p + 1)
                setFocusedCardIndex(0)
            }
        },
        [XBOX_GAMEPAD_BUTTONS.X]: () => {
            if (searchRef.current) searchRef.current.focus()
        },
        [XBOX_GAMEPAD_BUTTONS.DPAD_LEFT]: () => {
            setFocusedCardIndex(prev => Math.max(0, prev <= 0 ? visibleEntries.length - 1 : prev - 1))
        },
        [XBOX_GAMEPAD_BUTTONS.DPAD_RIGHT]: () => {
            setFocusedCardIndex(prev => (prev + 1) % Math.max(1, visibleEntries.length))
        },
        [XBOX_GAMEPAD_BUTTONS.DPAD_UP]: () => {
            setFocusedCardIndex(prev => layout === 'grid' ? Math.max(0, prev - 3) : Math.max(0, prev - 1))
        },
        [XBOX_GAMEPAD_BUTTONS.DPAD_DOWN]: () => {
            setFocusedCardIndex(prev => layout === 'grid'
                ? Math.min(visibleEntries.length - 1, prev + 3)
                : Math.min(visibleEntries.length - 1, prev + 1))
        },
        [XBOX_GAMEPAD_BUTTONS.A]: () => {
            const entry = visibleEntries[focusedCardIndex]
            if (entry) onOpenDetail(entry)
        },
    }), [focusedCardIndex, layout, onOpenDetail, pageInfo?.hasMore, visibleEntries])

    useLifeSyncGamepadInput({
        enabled: controllerSupportEnabled && !detailEntry && !deleteConfirm.isOpen,
        handlers: libGamepadHandlers,
        repeatableButtons: [
            XBOX_GAMEPAD_BUTTONS.DPAD_LEFT,
            XBOX_GAMEPAD_BUTTONS.DPAD_RIGHT,
            XBOX_GAMEPAD_BUTTONS.DPAD_UP,
            XBOX_GAMEPAD_BUTTONS.DPAD_DOWN,
        ],
    })

    if (!isLifeSyncConnected) return null

    if (!mangaPluginOn) {
        return (
            <MotionDiv className="rounded-3xl border border-dashed border-(--color-border-soft) bg-(--color-surface) px-6 py-14 text-center" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={lifeSyncPageTransition}>
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-(--color-surface-muted)">
                    <IconBook className="h-5 w-5 text-(--color-text-secondary)" />
                </div>
                <p className="text-[17px] font-bold text-(--color-text-primary)">Manga is turned off</p>
                <p className="mx-auto mt-2 max-w-md text-[14px] text-(--color-text-secondary)">Turn on the manga plugin in LifeSync preferences to see your shelf here.</p>
                <Link to="/dashboard/profile?tab=preferences" className="mt-8 inline-flex min-h-12 items-center justify-center rounded-2xl bg-(--color-text-primary) px-6 text-[14px] font-semibold text-(--color-surface) transition hover:opacity-90">Open preferences</Link>
            </MotionDiv>
        )
    }

    return (
        <MotionDiv className="min-w-0 space-y-4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={lifeSyncPageTransition}>

            {/* ── Header ── */}
            <div className="flex items-center gap-3">
                <Link to={MANGA_BASE} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-(--color-border-soft) bg-(--color-surface) text-(--color-text-primary) transition hover:bg-(--color-surface-muted)" aria-label="Back">
                    <IconChevronLeft />
                </Link>
                <h1 className="min-w-0 flex-1 text-[20px] font-black leading-none text-(--color-text-primary)">Manga Library</h1>
                <ControllerHintBar
                    cols={2}
                    hints={[
                        { btns: ['Y'], label: 'Grid / List' },
                        { btns: ['X'], label: 'Search' },
                        { btns: ['LB'], label: 'Prev page' },
                        { btns: ['RB'], label: 'Next page' },
                        { btns: ['←→'], label: 'Navigate cards' },
                        { btns: ['A'], label: 'Open detail' },
                    ]}
                />
                <Link to={MANGA_BASE} className="flex h-9 items-center justify-center rounded-xl bg-primary px-4 text-[12px] font-bold text-black transition hover:brightness-95">
                    Browse
                </Link>
            </div>

            {/* ── Stats ── */}
            <div className="grid grid-cols-3 gap-2">
                {[
                    { label: 'Total', value: initialLoading ? '—' : visibleEntries.length },
                    { label: 'New chapters', value: initialLoading ? '—' : visibleSummary.withNewChapter, accent: true },
                    { label: 'Needs sync', value: initialLoading ? '—' : visibleSummary.needsSync, warn: true },
                ].map((s) => (
                    <div key={s.label} className={`rounded-2xl px-3 py-3 text-center ${s.accent ? 'bg-primary/10 ring-1 ring-primary/20' : s.warn ? 'bg-(--color-surface) border border-(--color-border-soft)' : 'bg-(--color-surface) border border-(--color-border-soft)'}`}>
                        <p className={`text-[22px] font-black tabular-nums leading-none ${s.accent ? 'text-primary' : 'text-(--color-text-primary)'}`}>{s.value}</p>
                        <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-(--color-text-secondary)">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* ── Sync bar ── */}
            <div className="flex flex-wrap items-center gap-2">
                <select value={syncScope} onChange={(e) => setSyncScope(e.target.value)} disabled={syncBusy || syncRunning || !Number(pageInfo?.total || 0)}
                    className="h-9 rounded-xl border border-(--color-border-soft) bg-(--color-surface) px-3 text-[12px] font-semibold text-(--color-text-secondary) focus:border-primary/60 focus:outline-none transition disabled:opacity-50">
                    {SYNC_SCOPE_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <button type="button" onClick={() => void onSync()} disabled={syncBusy || syncRunning || !Number(pageInfo?.total || 0)}
                    className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[12px] font-bold text-black transition hover:brightness-95 disabled:opacity-50">
                    <IconSync className={syncBusy || syncRunning ? 'animate-spin' : ''} />
                    {syncBusy ? 'Starting…' : syncRunning ? `Syncing ${Math.round(syncPercent)}%` : 'Sync latest'}
                </button>
                <button type="button" onClick={() => void refreshAll()} disabled={refreshing}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-(--color-border-soft) bg-(--color-surface) text-(--color-text-secondary) transition hover:bg-(--color-surface-muted) disabled:opacity-40"
                    aria-label="Reload">
                    <IconSync className={refreshing ? 'animate-spin h-3.5 w-3.5' : 'h-3.5 w-3.5'} />
                </button>
            </div>

            {/* Sync progress */}
            {syncJob && !syncDismissed && (
                <div className={`rounded-2xl border px-4 py-3 ${syncJob.status === 'failed' ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30' : syncJob.status === 'completed' ? 'border-primary/30 bg-primary/5' : 'border-(--color-border-soft) bg-(--color-surface-muted)'}`}>
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-semibold text-(--color-text-primary)">{syncJob.status === 'failed' ? 'Sync failed' : syncJob.status === 'completed' ? 'Sync complete' : `Syncing ${Math.round(syncPercent)}%`}</span>
                        <div className="flex items-center gap-2">
                            <span className="text-(--color-text-secondary)">{Number(syncJob?.processed || 0)}/{Number(syncJob?.total || 0)}</span>
                            {!syncRunning && <button type="button" onClick={() => setSyncDismissed(true)} className="text-(--color-text-secondary) hover:text-(--color-text-primary)"><IconX className="h-3 w-3" /></button>}
                        </div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-(--color-border-soft)">
                        <div className={`h-full rounded-full bg-primary transition-all ${syncRunning ? 'animate-pulse' : ''}`} style={{ width: `${syncPercent}%` }} />
                    </div>
                </div>
            )}
            {syncError && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">{syncError}</div>}

            {/* ── Controls ── */}
            <div className="flex flex-wrap gap-2">
                {/* Search */}
                <div className="relative min-w-0 flex-1 basis-48">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-secondary)"><IconSearch /></span>
                    <input ref={searchRef} type="search" value={queryInput} onChange={(e) => setQueryInput(e.target.value)} placeholder="Search titles…"
                        className="h-9 w-full rounded-xl border border-(--color-border-soft) bg-(--color-surface) pl-8 pr-3 text-[13px] text-(--color-text-primary) placeholder:text-(--color-text-secondary) focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15 transition" />
                </div>

                {/* Source */}
                <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}
                    className="h-9 rounded-xl border border-(--color-border-soft) bg-(--color-surface) px-3 text-[12px] font-medium text-(--color-text-secondary) focus:border-primary/60 focus:outline-none transition">
                    {sourceOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>

                {/* Status */}
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-9 rounded-xl border border-(--color-border-soft) bg-(--color-surface) px-3 text-[12px] font-medium text-(--color-text-secondary) focus:border-primary/60 focus:outline-none transition">
                    {STATUS_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>

                {/* Update state */}
                <select value={updateStateFilter} onChange={(e) => setUpdateStateFilter(e.target.value)}
                    className="h-9 rounded-xl border border-(--color-border-soft) bg-(--color-surface) px-3 text-[12px] font-medium text-(--color-text-secondary) focus:border-primary/60 focus:outline-none transition">
                    {UPDATE_STATE_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>

                {/* Sort */}
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                    className="h-9 rounded-xl border border-(--color-border-soft) bg-(--color-surface) px-3 text-[12px] font-medium text-(--color-text-secondary) focus:border-primary/60 focus:outline-none transition">
                    {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>

                {/* Sort order */}
                <div className="flex rounded-xl border border-(--color-border-soft) bg-(--color-surface-muted) p-0.5 gap-0.5">
                    {[{ id: 'desc', label: '↓' }, { id: 'asc', label: '↑' }].map((o) => (
                        <button key={o.id} type="button" onClick={() => setSortOrder(o.id)}
                            className={`flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-bold transition ${sortOrder === o.id ? 'bg-(--color-surface) text-(--color-text-primary) shadow-sm' : 'text-(--color-text-secondary) hover:text-(--color-text-primary)'}`}>
                            {o.label}
                        </button>
                    ))}
                </div>

                {/* Layout toggle */}
                <div className="flex rounded-xl border border-(--color-border-soft) bg-(--color-surface-muted) p-0.5 gap-0.5">
                    <button type="button" onClick={() => setLayout('list')}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${layout === 'list' ? 'bg-(--color-surface) text-(--color-text-primary) shadow-sm' : 'text-(--color-text-secondary) hover:text-(--color-text-primary)'}`}
                        aria-label="List view"><IconList /></button>
                    <button type="button" onClick={() => setLayout('grid')}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${layout === 'grid' ? 'bg-(--color-surface) text-(--color-text-primary) shadow-sm' : 'text-(--color-text-secondary) hover:text-(--color-text-primary)'}`}
                        aria-label="Grid view"><IconGrid /></button>
                </div>
            </div>

            {/* Bulk action bar */}
            {selectedEntries.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-(--color-border-soft) bg-(--color-surface-muted) px-4 py-2.5">
                    <p className="text-[12px] font-semibold text-(--color-text-primary)">{selectedEntries.length} selected</p>
                    <div className="flex flex-1 flex-wrap justify-end gap-2">
                        <select defaultValue="" onChange={(e) => { if (e.target.value) { void onBulkSetStatus(e.target.value); e.target.value = '' } }} disabled={bulkBusy}
                            className="h-8 rounded-xl border border-(--color-border-soft) bg-(--color-surface) px-2 text-[11px] font-semibold text-(--color-text-secondary) focus:outline-none disabled:opacity-50">
                            <option value="">Set status…</option>
                            {STATUS_OPTIONS.filter((o) => o.id !== 'all').map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                        </select>
                        <button type="button" onClick={() => void onBulkDelete()} disabled={bulkBusy}
                            className="flex h-8 items-center gap-1.5 rounded-xl border border-red-200 bg-(--color-surface) px-3 text-[11px] font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-950/30">
                            <IconX className="h-3 w-3" /> Remove
                        </button>
                        <button type="button" onClick={onClearSelection}
                            className="h-8 rounded-xl border border-(--color-border-soft) bg-(--color-surface) px-3 text-[11px] font-semibold text-(--color-text-secondary) transition hover:bg-(--color-surface-muted)">
                            Clear
                        </button>
                    </div>
                </div>
            )}

            {/* Loading indicator */}
            {refreshing && !initialLoading && (
                <div className="overflow-hidden rounded-lg">
                    <div className="h-0.5 w-full animate-pulse bg-linear-to-r from-transparent via-primary to-transparent" />
                </div>
            )}

            {/* ── Content ── */}
            {initialLoading && listEntries.length === 0 ? (
                layout === 'list' ? (
                    <div className="overflow-hidden rounded-2xl border border-(--color-border-soft) bg-(--color-surface)">
                        {Array.from({ length: 8 }).map((_, i) => <div key={i} className={i < 7 ? 'border-b border-(--color-border-soft)' : ''}><SkeletonRow /></div>)}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                        {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                )
            ) : error ? (
                <MotionDiv className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center dark:border-red-800 dark:bg-red-950/20" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <p className="text-[16px] font-semibold text-red-900 dark:text-red-300">Failed to load library</p>
                    <p className="mt-2 text-[13px] text-red-700 dark:text-red-400">{error}</p>
                    <button type="button" onClick={() => void refreshList({ forceInitial: true })} className="mt-4 rounded-xl border border-red-200 px-4 py-2 text-[12px] font-semibold text-red-700 transition hover:bg-red-100">Retry</button>
                </MotionDiv>
            ) : listEntries.length === 0 ? (
                <MotionDiv className="rounded-2xl border border-dashed border-(--color-border-soft) bg-(--color-surface) px-6 py-16 text-center" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={lifeSyncPageTransition}>
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-(--color-surface-muted)">
                        <IconBook className="h-5 w-5 text-(--color-text-secondary)" />
                    </div>
                    <p className="text-[16px] font-bold text-(--color-text-primary)">{query || sourceFilter !== 'all' || statusFilter !== 'all' || updateStateFilter !== 'all' ? 'No matches' : 'Your shelf is empty'}</p>
                    <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-(--color-text-secondary)">Open any chapter in the reader to track progress here.</p>
                    <Link to={MANGA_BASE} className="mt-6 inline-flex min-h-[42px] items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-[13px] font-bold text-(--color-ink-strong) transition hover:brightness-95">
                        <IconBook className="h-3.5 w-3.5" /> Browse manga
                    </Link>
                </MotionDiv>
            ) : visibleEntries.length === 0 ? (
                <MotionDiv className="rounded-2xl border border-(--color-border-soft) bg-(--color-surface) px-6 py-12 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <p className="text-[14px] font-semibold text-(--color-text-primary)">Hidden by preferences</p>
                    <p className="mt-1 text-[12px] text-(--color-text-secondary)">Change source filters or enable Manga District in preferences.</p>
                </MotionDiv>
            ) : (
                <>
                    {/* Count + select row */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] text-(--color-text-secondary)">
                            {visibleEntries.length} of {pageInfo.total} · Page {pageInfo.page}/{pageInfo.totalPages}
                            {hiddenCount > 0 && <span className="ml-2 text-(--color-text-secondary)">({hiddenCount} hidden)</span>}
                        </p>
                        <div className="flex gap-1.5">
                            <button type="button" onClick={onSelectAll} className="rounded-lg border border-(--color-border-soft) bg-(--color-surface) px-3 py-1 text-[11px] font-semibold text-(--color-text-secondary) transition hover:bg-(--color-surface-muted)">Select all</button>
                            <button type="button" onClick={onClearSelection} className="rounded-lg border border-(--color-border-soft) bg-(--color-surface) px-3 py-1 text-[11px] font-semibold text-(--color-text-secondary) transition hover:bg-(--color-surface-muted)">Clear</button>
                        </div>
                    </div>

                    {/* List */}
                    {layout === 'list' ? (
                        <div className="overflow-hidden rounded-2xl border border-(--color-border-soft) bg-(--color-surface)">
                            <AnimatePresence initial={false}>
                                {visibleEntries.map((entry, idx) => {
                                    const k = entryKey(entry)
                                    return (
                                        <div key={k} className={focusedCardIndex === idx ? 'ring-2 ring-primary ring-inset' : ''}>
                                            <MangaRow entry={entry} browseTranslatedLang={browseTranslatedLang}
                                                busy={actionBusyKeys.has(k)} removeBusy={removeBusyKey === k}
                                                syncState={syncJob?.itemStates?.[k]?.state} selected={selectedKeys.has(k)}
                                                onToggleSelect={onToggleSelect} onStatusChange={onStatusChange}
                                                onRequestRemove={onRequestDelete} onOpenDetail={onOpenDetail}
                                                isLast={idx === visibleEntries.length - 1} />
                                        </div>
                                    )
                                })}
                            </AnimatePresence>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                            <AnimatePresence initial={false}>
                                {visibleEntries.map((entry, idx) => {
                                    const k = entryKey(entry)
                                    return (
                                        <div key={k} className={focusedCardIndex === idx ? 'rounded-2xl ring-2 ring-primary ring-offset-2' : ''}>
                                            <MangaCard entry={entry} browseTranslatedLang={browseTranslatedLang}
                                                busy={actionBusyKeys.has(k)} removeBusy={removeBusyKey === k}
                                                syncState={syncJob?.itemStates?.[k]?.state} selected={selectedKeys.has(k)}
                                                onToggleSelect={onToggleSelect} onStatusChange={onStatusChange}
                                                onRequestRemove={onRequestDelete} onOpenDetail={onOpenDetail} />
                                        </div>
                                    )
                                })}
                            </AnimatePresence>
                        </div>
                    )}

                    {/* Pagination */}
                    <div className="flex items-center justify-between rounded-2xl border border-(--color-border-soft) bg-(--color-surface) px-4 py-2.5">
                        <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pageInfo.page <= 1 || refreshing}
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-(--color-border-soft) text-(--color-text-secondary) transition hover:bg-(--color-surface-muted) disabled:opacity-40">
                            <IconChevronLeft />
                        </button>
                        <p className="text-[12px] font-semibold text-(--color-text-primary)">Page {pageInfo.page} of {pageInfo.totalPages}</p>
                        <button type="button" onClick={() => setPage((p) => p + 1)} disabled={!pageInfo.hasMore || refreshing}
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-(--color-border-soft) text-(--color-text-secondary) transition hover:bg-(--color-surface-muted) disabled:opacity-40">
                            <IconChevronRight />
                        </button>
                    </div>
                </>
            )}

            {/* ── Modals ── */}
            <AnimatePresence>
                {detailEntry && <DetailDrawer entry={detailEntry} onClose={onCloseDetail} onContinue={onContinueFromDetail} browseTranslatedLang={browseTranslatedLang} />}
            </AnimatePresence>
            <AnimatePresence>
                {deleteConfirm.isOpen && (
                    <ConfirmModal isOpen title="Remove from library" message={`Remove "${decodeHtmlEntities(deleteConfirm.entry?.title) || 'this manga'}" from your shelf?`} onConfirm={onConfirmDelete} onCancel={onCancelDelete} />
                )}
            </AnimatePresence>
        </MotionDiv>
    )
}
