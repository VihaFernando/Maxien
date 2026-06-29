import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useLifeSync } from '../../context/LifeSyncContext'
import { isLifeSyncHManhwaVisible, isPluginEnabled, lifesyncFetch } from '../../lib/lifesyncApi'
import useControllerSupportEnabled from '../../hooks/useControllerSupportEnabled'
import useLifeSyncGamepadInput from '../../hooks/useLifeSyncGamepadInput'
import { XBOX_GAMEPAD_BUTTONS } from '../../lib/lifeSyncControllerInput'
import { ControllerHintBar } from '../../components/lifesync/ControllerHintOverlay'
import { MediaPageHeader } from '../../components/lifesync/MediaPageChrome'
import { useFocusedCardScroll } from '../../hooks/useFocusedCardScroll'
import { useHideCursorOnDpad } from '../../hooks/useHideCursorOnDpad'
import { useMangaReadingList } from '../../hooks/useMangaReadingList'
import { useNewMangaToRead } from '../../hooks/useNewMangaToRead'
import { useMangaSearchSuggestions } from '../../hooks/useMangaSearchSuggestions'
import { useMangaDetailPortal } from '../../components/lifesync/MangaDetailPortal'
import NewMangaToReadPanel from '../../components/lifesync/NewMangaToReadPanel'
import MangaSearchSuggestions from '../../components/lifesync/MangaSearchSuggestions'
import { mangaImageProps, decodeHtmlEntities } from '../../lib/mangaChapterUtils'
import { LifesyncEpisodeThumbnail } from '../../components/lifesync/EpisodeLoadingSkeletons'
import {
    MotionDiv,
    lifeSyncEaseOut,
    lifeSyncPageTransition,
    lifeSyncDetailOverlayFadeTransition,
} from '../../lib/lifesyncMotion'

const MANGA_BASE = '/dashboard/lifesync/anime/manga'
const MANGA_LIBRARY_PATH = `${MANGA_BASE}/library`
const FETCH_LIMIT = 100
const RENDER_BATCH = 40

const SOURCE_OPTIONS = [
    { id: 'all', label: 'All sources' },
    { id: 'roliascan', label: 'Roliascan' },
    { id: 'mangadistrict', label: 'Manga District' },
    { id: 'mangadna', label: 'MangaDNA' },
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
    { id: 'all', label: 'Everything' },
    { id: 'new', label: 'New chapters' },
    { id: 'behind', label: 'Catching up' },
    { id: 'needs_sync', label: 'Check for updates' },
    { id: 'caught_up', label: 'All caught up' },
    { id: 'series_ended', label: 'Completed series' },
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
const IconFilter = ({ className = 'h-3.5 w-3.5' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h18l-7 8v6l-4 2v-8l-7-8z" />
    </svg>
)
const IconChevronDown = ({ className = 'h-3 w-3' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
)
// Reading-status status icons — one glyph per state so the dropdown reads at a glance.
const IconBookmark = ({ className = 'h-3.5 w-3.5' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
)
const IconPause = ({ className = 'h-3.5 w-3.5' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6v12M15 6v12" />
    </svg>
)
const IconClock = ({ className = 'h-3.5 w-3.5' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
    </svg>
)
const IconCheckCircle = ({ className = 'h-3.5 w-3.5' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M8.5 12.5l2.5 2.5 4.5-5" />
    </svg>
)
const IconDrop = ({ className = 'h-3.5 w-3.5' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 9l6 6M15 9l-6 6" />
    </svg>
)
const IconReread = ({ className = 'h-3.5 w-3.5' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
)
const IconDot = ({ className = 'h-3.5 w-3.5' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <circle cx="12" cy="12" r="4" />
    </svg>
)

// Per-status visual identity: icon + accent color used by the status dropdown,
// its trigger, and the menu rows. Colors stay readable on dark surfaces.
const STATUS_META = {
    reading: { icon: IconBookmark, dot: 'bg-primary', text: 'text-primary', soft: 'bg-primary/12' },
    on_hold: { icon: IconPause, dot: 'bg-amber-400', text: 'text-amber-400', soft: 'bg-amber-400/12' },
    plan_to_read: { icon: IconClock, dot: 'bg-sky-400', text: 'text-sky-400', soft: 'bg-sky-400/12' },
    completed: { icon: IconCheckCircle, dot: 'bg-emerald-400', text: 'text-emerald-400', soft: 'bg-emerald-400/12' },
    dropped: { icon: IconDrop, dot: 'bg-rose-400', text: 'text-rose-400', soft: 'bg-rose-400/12' },
    re_reading: { icon: IconReread, dot: 'bg-violet-400', text: 'text-violet-400', soft: 'bg-violet-400/12' },
}
function statusMeta(status) {
    return STATUS_META[status] || { icon: IconDot, dot: 'bg-(--color-border-strong)', text: 'text-(--color-text-secondary)', soft: 'bg-(--color-surface-muted)' }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sourceLabel(source) {
    if (source === 'mangadistrict') return 'District'
    if (source === 'roliascan') return 'Roliascan'
    if (source === 'mangadna') return 'MangaDNA'
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
    if (!iso) return ''
    try { return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }) } catch { return '' }
}
function statusLabel(status) {
    return STATUS_OPTIONS.find((o) => o.id === status)?.label || (status ? status : 'No status')
}
function parseChapterNum(label) {
    if (!label) return NaN
    const s = String(label)
    // "Ch. 11", "Ch 90.5"
    const m = s.match(/Ch\.?\s*([\d.]+)/i)
    if (m) return parseFloat(m[1])
    // "chapter-11", "chapter-90.5" raw slugs from MangaDNA/MangaDistrict
    const slug = s.match(/chapter-(\d+(?:\.\d+)?)/i)
    if (slug) return parseFloat(slug[1])
    // bare number
    const bare = s.match(/^[\s#]*(\d+(?:\.\d+)?)[\s]*$/)
    if (bare) return parseFloat(bare[1])
    return NaN
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
        currentLabel: entry?.lastChapterLabel || '',
        latestLabel: entry?.remoteLatestChapterLabel || (entry?.needsSync ? 'Checking…' : ''),
        percent: clampPct(Number(entry?.caughtUp && !entry?.hasNewChapter ? 100 : entry?.lastReadPercent || 0)),
    }
}
// Friendly, state-aware copy for the "resume" point. Because progress auto-advances to the
// next chapter once you finish one, the stored position is really "where you'll pick up",
// not "what you last read" — so we phrase it as "Up next" / "Continue".
function resumeMeta(entry) {
    const pct = Number(entry?.lastReadPercent || 0)
    const chapterLabel = entry?.lastChapterLabel || ''
    const behind = entry?.behind
    const chaptersBehind = Number(entry?.chaptersBehind || 0)
    if (entry?.hasNewChapter) {
        return { rowLabel: 'Up next', rowValue: entry?.remoteLatestChapterLabel || chapterLabel, button: 'Read new chapter', callout: 'New chapter ready for you' }
    }
    if (behind) {
        const callout = chaptersBehind > 1 ? `${chaptersBehind} chapters to catch up` : 'Behind — catch up'
        return { rowLabel: 'Continue from', rowValue: chapterLabel, button: 'Catch up', callout }
    }
    if (pct >= 100 || (entry?.caughtUp && pct === 0)) {
        return { rowLabel: 'Up next', rowValue: chapterLabel || 'All caught up', button: 'Read again', callout: '' }
    }
    if (pct > 0 && pct < 97) {
        return { rowLabel: 'Continue from', rowValue: chapterLabel, button: 'Continue reading', callout: '' }
    }
    return { rowLabel: 'Up next', rowValue: chapterLabel, button: chapterLabel ? 'Start next chapter' : 'Start reading', callout: '' }
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
    const map = { queued: 'bg-(--color-surface-muted) text-(--color-text-secondary)', syncing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', done: 'bg-primary/10 text-primary', error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', skipped: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' }
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

// ─── Status menu ──────────────────────────────────────────────────────────────
// Icon-triggered reading-status control. Click the status glyph → an animated
// popover lists every status with its own icon + accent colour and a check on the
// active one. Replaces the old native <select> so the resting card stays calm and
// the choice feels tactile. Portaled + anchored so it never clips inside cards.
const STATUS_MENU_ITEMS = STATUS_OPTIONS.filter((o) => o.id !== 'all')

function StatusMenu({ value, onChange, disabled, tone = 'surface' }) {
    const [open, setOpen] = useState(false)
    const [coords, setCoords] = useState(null)
    const btnRef = useRef(null)
    const meta = statusMeta(value)
    const Glyph = meta.icon
    const label = value ? statusLabel(value) : 'Set status'

    const place = useCallback(() => {
        const el = btnRef.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const menuW = 184
        const menuH = 322
        // Prefer below-right; flip up / left near the viewport edges.
        const below = r.bottom + menuH + 8 <= window.innerHeight || r.top - menuH - 8 < 0
        const left = Math.min(r.left, window.innerWidth - menuW - 8)
        setCoords({
            top: below ? r.bottom + 6 : r.top - menuH - 6,
            left: Math.max(8, left),
            origin: below ? 'top' : 'bottom',
        })
    }, [])

    const toggle = useCallback((e) => {
        e.stopPropagation(); e.preventDefault()
        if (disabled) return
        if (open) { setOpen(false); return }
        place(); setOpen(true)
    }, [disabled, open, place])

    useEffect(() => {
        if (!open) return undefined
        const close = () => setOpen(false)
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
        window.addEventListener('resize', place)
        window.addEventListener('scroll', close, true)
        window.addEventListener('keydown', onKey)
        return () => {
            window.removeEventListener('resize', place)
            window.removeEventListener('scroll', close, true)
            window.removeEventListener('keydown', onKey)
        }
    }, [open, place])

    const pick = useCallback((id) => {
        setOpen(false)
        onChange(id || null)
    }, [onChange])

    const triggerCls = tone === 'overlay'
        ? `border-white/20 bg-black/55 text-white/90 backdrop-blur-sm hover:border-white/45`
        : `border-(--color-border-soft) bg-(--color-surface) text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary)`

    return (
        <>
            <button
                ref={btnRef} type="button" onClick={toggle} disabled={disabled}
                aria-haspopup="listbox" aria-expanded={open} aria-label={`Reading status: ${label}`}
                className={`group/st flex h-8 items-center gap-1 rounded-xl border pl-1.5 pr-1.5 text-[11px] font-semibold transition active:scale-95 disabled:opacity-50 ${triggerCls} ${open ? 'ring-2 ring-primary/40' : ''}`}
            >
                <motion.span
                    key={value || 'none'}
                    initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                    className={value ? meta.text : ''}
                >
                    <Glyph className="h-3.5 w-3.5" />
                </motion.span>
                <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 26 }} className="opacity-60">
                    <IconChevronDown className="h-2.5 w-2.5" />
                </motion.span>
            </button>

            {createPortal(
                <AnimatePresence>
                    {open && coords && (
                        <>
                            <motion.div
                                className="fixed inset-0 z-9998"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                onClick={(e) => { e.stopPropagation(); setOpen(false) }}
                            />
                            <motion.div
                                role="listbox"
                                className="fixed z-9999 w-46 overflow-hidden rounded-2xl border border-(--color-border-soft) bg-(--color-surface) p-1.5 backdrop-blur-xl"
                                style={{ top: coords.top, left: coords.left, transformOrigin: coords.origin }}
                                initial={{ opacity: 0, scale: 0.92, y: coords.origin === 'top' ? -6 : 6 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.94, y: coords.origin === 'top' ? -6 : 6 }}
                                transition={{ type: 'spring', stiffness: 480, damping: 32 }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {STATUS_MENU_ITEMS.map((o, i) => {
                                    const m = statusMeta(o.id)
                                    const Ico = m.icon
                                    const active = value === o.id
                                    return (
                                        <motion.button
                                            key={o.id} type="button" role="option" aria-selected={active}
                                            onClick={() => pick(o.id)}
                                            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.025, type: 'tween', duration: 0.18, ease: lifeSyncEaseOut }}
                                            whileHover={{ x: 2 }}
                                            className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[12.5px] font-semibold transition-colors ${active ? `${m.soft} ${m.text}` : 'text-(--color-text-secondary) hover:bg-(--color-surface-muted) hover:text-(--color-text-primary)'}`}
                                        >
                                            <span className={active ? m.text : 'text-(--color-text-secondary)'}><Ico className="h-4 w-4" /></span>
                                            <span className="flex-1 truncate">{o.label}</span>
                                            <AnimatePresence>
                                                {active && (
                                                    <motion.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}>
                                                        <IconCheck className="h-3 w-3" />
                                                    </motion.span>
                                                )}
                                            </AnimatePresence>
                                        </motion.button>
                                    )
                                })}
                                {value && (
                                    <>
                                        <div className="my-1 h-px bg-(--color-border-soft)" />
                                        <motion.button
                                            type="button" onClick={() => pick(null)}
                                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: STATUS_MENU_ITEMS.length * 0.025 }}
                                            whileHover={{ x: 2 }}
                                            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[12.5px] font-semibold text-(--color-text-secondary) transition-colors hover:bg-(--color-surface-muted) hover:text-(--color-text-primary)"
                                        >
                                            <span className="text-(--color-text-secondary)"><IconX className="h-3.5 w-3.5" /></span>
                                            <span className="flex-1 truncate">Clear status</span>
                                        </motion.button>
                                    </>
                                )}
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>,
                document.body,
            )}
        </>
    )
}

// ─── Filter drawer ────────────────────────────────────────────────────────────
// A labeled segmented chip group used inside the filter drawer. Tactile, larger
// hit targets than native selects, and keeps everything inline (no nested menus).
function FilterGroup({ label, options, value, onChange }) {
    return (
        <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-(--color-text-secondary)">{label}</p>
            <div className="flex flex-wrap gap-1.5">
                {options.map((o) => {
                    const active = value === o.id
                    return (
                        <button
                            key={o.id} type="button" onClick={() => onChange(o.id)}
                            className={`rounded-xl border px-3 py-1.5 text-[12px] font-semibold transition ${active
                                ? 'border-primary bg-primary text-black'
                                : 'border-(--color-border-soft) bg-(--color-surface) text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary)'}`}
                        >
                            {o.label}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

function LibraryFilterDrawer({ open, onClose, count, onReset, children }) {
    useEffect(() => {
        if (!open) return undefined
        const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])

    return createPortal(
        <AnimatePresence>
            {open && (
                <MotionDiv className="fixed inset-0 z-9997 flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={lifeSyncDetailOverlayFadeTransition}>
                    <MotionDiv className="absolute inset-0 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
                    <MotionDiv
                        className="relative flex h-dvh w-full max-w-sm flex-col bg-(--color-surface)"
                        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                        transition={{ type: 'spring', stiffness: 360, damping: 36 }}
                    >
                        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-(--color-border-soft) px-5 py-4">
                            <div className="flex min-w-0 items-center gap-2">
                                <h2 className="truncate text-[15px] font-black text-(--color-text-primary)">Filter & sort</h2>
                                {count > 0 && (
                                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-black tabular-nums text-(--color-ink-strong)">{count}</span>
                                )}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                {count > 0 && onReset && (
                                    <button type="button" onClick={onReset} className="rounded-lg border border-(--color-border-soft) px-2.5 py-1 text-[11px] font-semibold text-(--color-text-secondary) transition hover:bg-(--color-surface-muted) hover:text-(--color-text-primary)">Reset</button>
                                )}
                                <button type="button" onClick={onClose} aria-label="Close filters" className="flex h-8 w-8 items-center justify-center rounded-xl text-(--color-text-secondary) transition hover:bg-(--color-surface-muted) hover:text-(--color-text-primary)">
                                    <IconX className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">{children}</div>
                    </MotionDiv>
                </MotionDiv>
            )}
        </AnimatePresence>,
        document.body,
    )
}

// ─── Detail drawer ────────────────────────────────────────────────────────────
function DetailDrawer({ entry, onClose, onContinue }) {
    useEffect(() => {
        const fn = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', fn)
        return () => window.removeEventListener('keydown', fn)
    }, [onClose])

    if (!entry) return null
    const snap = chapterSnapshot(entry)
    const rm = resumeMeta(entry)
    const heroUrl = entry.backgroundImageUrl || entry.coverUrl || ''
    const releaseDate = latestChapterDate(entry)
    const title = decodeHtmlEntities(entry.title) || 'Untitled'

    return (
        <MotionDiv
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <MotionDiv
                className="relative w-full max-w-lg overflow-hidden rounded-t-3xl sm:rounded-3xl bg-(--color-surface)"
                initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 340, damping: 32 }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Hero banner ── */}
                <div className="relative h-48 sm:h-52 overflow-hidden">
                    {/* Blurred backdrop */}
                    {heroUrl && (
                        <img
                            src={heroUrl}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover opacity-40 blur-2xl scale-110 pointer-events-none select-none"
                        />
                    )}
                    {/* Lime radial glow — ties the hero to the brand accent */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(198,255,0,0.14),transparent_70%)] pointer-events-none" />
                    {/* Accent hairline at top */}
                    <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/55 to-transparent pointer-events-none" />
                    {/* Dark gradient overlay so the cover + title read */}
                    <div className="absolute inset-0 bg-linear-to-t from-(--color-surface) via-(--color-surface)/75 to-transparent pointer-events-none" />
                    {/* Close button */}
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white/80 hover:text-white transition backdrop-blur-sm active:scale-95"
                    >
                        <IconX className="h-4 w-4" />
                    </button>
                    {/* Cover + title row overlaid on hero */}
                    <div className="absolute bottom-0 inset-x-0 flex gap-4 px-5 pb-5 pt-12 items-end">
                        <div className="relative w-24 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/10 aspect-2/3 bg-(--color-surface-muted)">
                            {entry.coverUrl && (
                                <LifesyncEpisodeThumbnail
                                    src={entry.coverUrl}
                                    className="absolute inset-0 h-full w-full"
                                    imgClassName="h-full w-full object-cover"
                                    imgProps={mangaImageProps(entry.coverUrl)}
                                />
                            )}
                        </div>
                        <div className="min-w-0 flex-1 pb-1">
                            <h2 className="line-clamp-3 text-[20px] font-black leading-tight text-white">{title}</h2>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                {entry.source && (
                                    <span className="rounded-md bg-primary/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-primary">
                                        {[entry.source, ...(Array.isArray(entry.mirrorSources) ? entry.mirrorSources.map(m => m?.source) : [])].filter(Boolean).map(sourceLabel).join(' + ')}
                                    </span>
                                )}
                                {entry.readingStatus && (
                                    <span className="rounded-md bg-white/12 px-2 py-0.5 text-[9px] font-semibold text-white/75">
                                        {statusLabel(entry.readingStatus)}
                                    </span>
                                )}
                                {entry.updatedAt && (
                                    <span className="text-[10px] text-white/55">· {relativeTouch(entry.updatedAt)}</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Scrollable body ── */}
                <div className="max-h-[min(70vh,480px)] overflow-y-auto px-5 py-5 space-y-5">
                    {/* New chapter callout — promoted to the top, it's the reason to act */}
                    {entry.hasNewChapter && (
                        <div className="flex items-center gap-2.5 rounded-2xl border border-primary/35 bg-primary/10 px-4 py-3">
                            <span className="relative flex h-2.5 w-2.5 shrink-0">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                            </span>
                            <span className="text-[13px] font-bold text-(--color-text-primary)">{rm.callout || 'New chapter ready for you'}</span>
                        </div>
                    )}

                    {/* Reading progress — one unified block, current → latest with inline bar */}
                    <div>
                        <div className="mb-2 flex items-end justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-(--color-text-secondary)">Reading progress</p>
                                <p className="mt-0.5 truncate text-[15px] font-black text-(--color-text-primary)">
                                    {snap.currentLabel || '—'}
                                    {snap.latestLabel && <span className="text-(--color-text-secondary)"> / {snap.latestLabel}</span>}
                                </p>
                            </div>
                            <p className="shrink-0 text-[22px] font-black tabular-nums leading-none text-primary">{snap.percent}%</p>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-(--color-surface-muted)">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${snap.percent}%` }} />
                        </div>
                    </div>

                    {/* Metadata — compact inline rows, not a spreadsheet grid */}
                    <div className="divide-y divide-(--color-border-soft) rounded-2xl bg-(--color-surface-muted)/60">
                        {[
                            { label: 'Source', value: [entry.source, ...(Array.isArray(entry.mirrorSources) ? entry.mirrorSources.map(m => m?.source) : [])].filter(Boolean).map(sourceLabel).join(' + ') },
                            { label: 'My status', value: entry.readingStatus ? statusLabel(entry.readingStatus) : '' },
                            { label: 'Series', value: entry.seriesStatus ? (entry.seriesStatus.charAt(0).toUpperCase() + entry.seriesStatus.slice(1).toLowerCase()) : '' },
                            { label: rm.rowLabel, value: rm.rowValue },
                            { label: 'Newest chapter', value: entry.remoteLatestChapterLabel },
                            { label: 'Released', value: releaseDate ? formatDateLabel(releaseDate) : '' },
                        ].filter((r) => r.value).map((r) => (
                            <div key={r.label} className="flex items-center justify-between gap-4 px-4 py-2.5">
                                <span className="shrink-0 text-[12px] text-(--color-text-secondary)">{r.label}</span>
                                <span className="truncate text-right text-[12.5px] font-semibold text-(--color-text-primary)">{r.value}</span>
                            </div>
                        ))}
                    </div>

                    {/* Tags as chips */}
                    {entry.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {entry.tags.map((t) => (
                                <span key={t} className="rounded-full bg-(--color-surface-muted) px-2.5 py-1 text-[11px] font-medium text-(--color-text-secondary)">{t}</span>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Action footer ── */}
                <div className="flex gap-2.5 border-t border-(--color-border-soft) px-5 py-4">
                    <MotionDiv
                        className="flex-1"
                        whileTap={{ scale: 0.97 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    >
                        <button
                            type="button"
                            onClick={() => onContinue(entry)}
                            className="flex w-full min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary text-[13px] font-black text-black transition hover:brightness-105"
                        >
                            <IconBook className="h-4 w-4" /> {rm.button}
                        </button>
                    </MotionDiv>
                    <Link
                        to={MANGA_BASE}
                        className="flex min-h-12 shrink-0 items-center justify-center rounded-2xl border border-(--color-border-soft) px-5 text-[13px] font-semibold text-(--color-text-secondary) transition hover:border-(--color-border-strong) hover:bg-(--color-surface-muted)"
                    >
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
            <MotionDiv className="w-full max-w-sm rounded-3xl bg-(--color-surface) p-5" initial={{ scale: 0.94, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 14 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }} onClick={(e) => e.stopPropagation()}>
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
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${selected ? 'border-primary bg-primary text-black' : 'border-(--color-border-strong) bg-(--color-surface) hover:border-primary'}`}
                aria-label={selected ? 'Deselect' : 'Select'}>
                {selected && <IconCheck className="h-2.5 w-2.5" />}
            </button>

            {/* Cover */}
            <button type="button" onClick={() => onOpenDetail(entry)}
                className="relative h-[54px] w-[38px] shrink-0 overflow-hidden rounded-lg bg-(--color-surface-muted) transition">
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
                    {entry.seriesStatus && (
                        <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold ${entry.seriesEnded ? 'bg-emerald-400/12 text-emerald-400' : 'bg-(--color-surface-muted) text-(--color-text-secondary)'}`}>
                            {entry.seriesStatus.charAt(0).toUpperCase() + entry.seriesStatus.slice(1).toLowerCase()}
                        </span>
                    )}
                </div>
                <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-(--color-border-soft)">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${snap.percent}%` }} />
                </div>
            </button>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-1.5 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                <StatusMenu value={entry.readingStatus} onChange={(v) => onStatusChange(entry, v)} disabled={busy} />
                <button type="button" onClick={() => onRequestRemove(entry)} disabled={removeBusy}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-(--color-text-secondary) transition hover:bg-red-50 hover:text-red-500 disabled:opacity-30 dark:hover:bg-red-900/20"
                    aria-label="Remove">
                    {removeBusy ? <span className="text-[10px]">…</span> : <IconX className="h-3.5 w-3.5" />}
                </button>
                <Link to={resumeTarget(entry, browseTranslatedLang).to} state={resumeTarget(entry, browseTranslatedLang).state}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-black transition hover:brightness-95 active:scale-95"
                    aria-label="Continue reading">
                    <IconBook className="h-3.5 w-3.5" />
                </Link>
            </div>
        </motion.div>
    )
}

// ─── Grid card ────────────────────────────────────────────────────────────────
// The poster IS the card: edge-to-edge cover, no footer strip, no outer border.
// Metadata and actions ride as overlays on the artwork and surface on hover —
// content advances, chrome recedes.
function MangaCard({ entry, browseTranslatedLang, busy, removeBusy, syncState, selected, onToggleSelect, onStatusChange, onRequestRemove, onOpenDetail }) {
    const snap = chapterSnapshot(entry)
    const title = decodeHtmlEntities(entry.title) || 'Untitled'
    const chip = syncState ? syncStateChip(syncState) : null
    const { to, state } = resumeTarget(entry, browseTranslatedLang)
    const src = sourceLabel(entry.source)

    return (
        <motion.div
            layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
            transition={{ type: 'tween', duration: 0.18, ease: lifeSyncEaseOut }}
            className={`group relative aspect-2/3 overflow-hidden rounded-2xl bg-(--color-surface-muted) ring-1 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${selected ? 'ring-2 ring-primary' : 'ring-(--color-border-soft) hover:ring-primary/55'}`}
        >
            {/* Cover (opens detail) */}
            <button type="button" onClick={() => onOpenDetail(entry)} className="absolute inset-0 block h-full w-full text-left" aria-label={title}>
                {entry.coverUrl ? (
                    <LifesyncEpisodeThumbnail src={entry.coverUrl} className="absolute inset-0 h-full w-full" imgClassName="h-full w-full object-cover transition duration-500 group-hover:scale-105" imgProps={mangaImageProps(entry.coverUrl)} />
                ) : (
                    <div className="flex h-full items-center justify-center text-(--color-border-strong)"><IconBook className="h-8 w-8" /></div>
                )}
                {/* Base gradient — always present so the title is legible */}
                <div className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-black/90 via-black/45 to-transparent" />
                {/* Hover scrim — deepens on hover to let actions read */}
                <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/25" />
            </button>

            {/* ── Top overlays ── */}
            {/* Select — hidden until hover or when selected/any-selected context */}
            <button type="button" onClick={(e) => { e.stopPropagation(); onToggleSelect(entry) }}
                aria-label={selected ? 'Deselect' : 'Select'}
                className={`absolute left-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-lg border backdrop-blur-sm transition active:scale-90 ${selected
                    ? 'border-primary bg-primary text-black opacity-100'
                    : 'border-white/50 bg-black/40 text-transparent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:border-white'}`}>
                <IconCheck className="h-3 w-3" />
            </button>

            <div className="absolute right-2 top-2 z-20 flex flex-col items-end gap-1">
                {entry.hasNewChapter && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-black">New chapter</span>
                )}
                {entry.behind && !entry.hasNewChapter && (
                    <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
                        {entry.chaptersBehind ? `${entry.chaptersBehind} to catch up` : 'Catching up'}
                    </span>
                )}
                {entry.syncedFromOtherDevice && (
                    <span className="rounded-md bg-sky-500/85 px-1.5 py-0.5 text-[9px] font-bold text-white" title={`Updated on another device${entry.lastDevice ? ` (${entry.lastDevice})` : ''}`}>
                        Synced ⇄
                    </span>
                )}
                {chip && (
                    <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${chip.cls}`}>{chip.label}</span>
                )}
                {/* Remove — hover only */}
                <button type="button" onClick={(e) => { e.stopPropagation(); onRequestRemove(entry) }} disabled={removeBusy}
                    aria-label="Remove from library"
                    className="flex h-6 w-6 items-center justify-center rounded-lg bg-black/45 text-white/70 opacity-0 backdrop-blur-sm transition active:scale-90 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-red-600/85 hover:text-white disabled:opacity-30">
                    {removeBusy ? <span className="text-[9px]">…</span> : <IconX className="h-3 w-3" />}
                </button>
            </div>

            {/* ── Bottom content ── */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-2.5">
                {/* Source + chapter + series status line */}
                <div className="mb-1 flex items-center gap-1.5">
                    <span className="rounded bg-white/15 px-1.5 py-px text-[8px] font-black uppercase tracking-wide text-white/80 backdrop-blur-sm">{src}</span>
                    {snap.currentLabel && <span className="truncate text-[10px] font-semibold text-white/85">{snap.currentLabel}</span>}
                    {entry.seriesStatus && (
                        <span className={`ml-auto shrink-0 rounded px-1.5 py-px text-[8px] font-bold backdrop-blur-sm ${entry.seriesEnded ? 'bg-emerald-500/30 text-emerald-300' : 'bg-white/10 text-white/60'}`}>
                            {entry.seriesStatus.charAt(0).toUpperCase() + entry.seriesStatus.slice(1).toLowerCase()}
                        </span>
                    )}
                </div>
                <h3 className="line-clamp-2 text-[12.5px] font-bold leading-tight text-white">{title}</h3>

                {/* Progress bar */}
                {snap.percent > 0 && (
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/20">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${snap.percent}%` }} />
                    </div>
                )}

                {/* Action row — Read is always visible (touch-reachable, not hover-gated).
                    The status menu is an icon trigger that opens a portaled popover, so it
                    stays compact at rest and never clips against the card edge. */}
                <div className="pointer-events-auto mt-2 flex items-center gap-1.5">
                    <Link to={to} state={state} onClick={(e) => e.stopPropagation()}
                        className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-[11px] font-black text-black transition hover:brightness-95 active:scale-[0.97]">
                        <IconBook className="h-3 w-3" /> Read
                    </Link>
                    <StatusMenu value={entry.readingStatus} onChange={(v) => onStatusChange(entry, v)} disabled={busy} tone="overlay" />
                </div>
            </div>
        </motion.div>
    )
}

function resumeTarget(entry, browseTranslatedLang) {
    const lastChapterId = String(entry?.lastChapterId || '').trim()
    const latestChapterId = String(entry?.remoteLatestChapterId || '').trim()
    const chapterId = lastChapterId || latestChapterId
    if (entry?.mangaId != null && entry?.source && chapterId) {
        // When a new chapter exists on a mirror source (e.g. mangadna has ch 309 but user read on
        // mangadistrict at ch 306), deep-link to the mirror source so they can read the latest.
        const readSource = (entry?.hasNewChapter && entry?.remoteLatestChapterSource && entry.remoteLatestChapterSource !== entry.source)
            ? String(entry.remoteLatestChapterSource)
            : String(entry.source)
        const readChapterId = (readSource !== entry.source && latestChapterId) ? latestChapterId : chapterId
        const q = new URLSearchParams({ source: readSource, lang: browseTranslatedLang === 'all' ? 'all' : 'en' }).toString()
        return {
            to: `${MANGA_BASE}/read/${encodeURIComponent(String(entry.mangaId))}/${encodeURIComponent(readChapterId)}?${q}`,
            state: { from: MANGA_LIBRARY_PATH, source: readSource, browseTranslatedLang, resumeChapterId: readChapterId, resumePercent: Number(entry?.lastReadPercent || 0) },
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
    const [renderCount, setRenderCount] = useState(RENDER_BATCH)
    const sentinelRef = useRef(null)
    const [layout, setLayout] = useState(() => {
        try { return localStorage.getItem('lifesync.mangaLibrary.layout') === 'grid' ? 'grid' : 'list' } catch { return 'list' }
    })
    const [focusedCardIndex, setFocusedCardIndex] = useState(-1)
    useFocusedCardScroll(focusedCardIndex)
    useHideCursorOnDpad()
    useEffect(() => {
        const onMove = () => setFocusedCardIndex(-1)
        window.addEventListener('mousemove', onMove, { passive: true })
        return () => window.removeEventListener('mousemove', onMove)
    }, [])
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
    const [filtersOpen, setFiltersOpen] = useState(false)
    const [suggestionsOpen, setSuggestionsOpen] = useState(false)

    // Unified search suggestions (all sources, fired after user stops typing)
    const { suggestions, loading: suggestionsLoading } = useMangaSearchSuggestions(queryInput, {
        enabled: isLifeSyncConnected && mangaPluginOn && suggestionsOpen,
    })

    // Detail portal for suggestion clicks — opens the full MangaDetailPortal
    const { openManga: openSuggestionDetail, portal: suggestionDetailPortal } = useMangaDetailPortal({
        isLifeSyncConnected,
        browseTranslatedLang,
        onStartRead: (manga, chapter) => {
            const src = String(manga?.source || '').trim()
            const q = new URLSearchParams({ source: src, lang: browseTranslatedLang === 'all' ? 'all' : 'en' }).toString()
            navigate(`${MANGA_BASE}/read/${encodeURIComponent(String(manga.id))}/${encodeURIComponent(String(chapter.id))}?${q}`)
        },
    })

    const onSuggestionSelect = useCallback((manga) => {
        setSuggestionsOpen(false)
        openSuggestionDetail(manga, manga.source)
    }, [openSuggestionDetail])

    const onSuggestionClose = useCallback(() => setSuggestionsOpen(false), [])

    const sourceOptions = useMemo(
        () => hManhwaEnabled ? SOURCE_OPTIONS : SOURCE_OPTIONS.filter((o) => o.id !== 'mangadistrict' && o.id !== 'mangadna'),
        [hManhwaEnabled],
    )

    useEffect(() => { if (!isLifeSyncConnected) navigate('/dashboard/profile?tab=integrations', { replace: true }) }, [isLifeSyncConnected, navigate])
    useEffect(() => { const id = setTimeout(() => setQuery(queryInput.trim()), 260); return () => clearTimeout(id) }, [queryInput])
    useEffect(() => { setRenderCount(RENDER_BATCH) }, [query, sourceFilter, statusFilter, updateStateFilter, sortBy, sortOrder])
    useEffect(() => { if (!hManhwaEnabled && (sourceFilter === 'mangadistrict' || sourceFilter === 'mangadna')) setSourceFilter('all') }, [hManhwaEnabled, sourceFilter])

    const listFilters = useMemo(() => ({ q: query, source: sourceFilter, status: statusFilter, updateState: updateStateFilter, sortBy, order: sortOrder, limit: FETCH_LIMIT }), [query, sourceFilter, statusFilter, updateStateFilter, sortBy, sortOrder])

    const { entries: listEntries, visibleEntries, visibleSummary, pageInfo, error, initialLoading, refreshing, refresh: refreshList, patchEntry, removeEntry, bulkPatch, bulkDelete } = useMangaReadingList({ enabled: isLifeSyncConnected && mangaPluginOn, nsfwEnabled, hManhwaEnabled, filters: listFilters })

    // Grow the rendered slice as the sentinel scrolls into view
    useEffect(() => {
        const el = sentinelRef.current
        if (!el) return undefined
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) setRenderCount((c) => c + RENDER_BATCH) },
            { rootMargin: '200px' },
        )
        observer.observe(el)
        return () => observer.disconnect()
    }, [visibleEntries])

    // Post-sync "new chapters to read" deck  derived from the full list (not the
    // paginated/filtered view), persisted dismissals in localStorage via the hook.
    const { newItems, dismissOne, dismissAll } = useNewMangaToRead(listEntries)

    // Catch-up items: entries where the reader is behind (backlog of chapters).
    const catchUpItems = useMemo(() => {
        const list = Array.isArray(listEntries) ? listEntries : []
        const seen = new Set()
        const out = []
        for (const entry of list) {
            if (!entry?.behind) continue
            const k = entryKey(entry)
            if (!k || k === ':' || seen.has(k)) continue
            seen.add(k)
            out.push(entry)
        }
        return out
    }, [listEntries])

    // Slice for progressive scroll rendering — grows as sentinel fires
    const renderedEntries = useMemo(
        () => visibleEntries.slice(0, renderCount),
        [visibleEntries, renderCount],
    )

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
    const activeFilterCount = (sourceFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0) + (updateStateFilter !== 'all' ? 1 : 0) + (sortBy !== 'updatedAt' ? 1 : 0) + (sortOrder !== 'desc' ? 1 : 0)
    const resetFilters = useCallback(() => {
        setSourceFilter('all'); setStatusFilter('all'); setUpdateStateFilter('all'); setSortBy('updatedAt'); setSortOrder('desc')
    }, [])
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
        // Skip ticks while a previous poll request is still in flight, and drop
        // responses that resolve after this poll generation was stopped.
        let inFlight = false
        const intervalId = setInterval(async () => {
            if (inFlight) return
            inFlight = true
            try {
                const data = await lifesyncFetch('/api/v1/progress/sync', { method: 'GET' })
                if (syncPollRef.current !== intervalId) return
                const job = data?.job || null
                setSyncJob(job)
                if (!job || isSyncTerminal(job.status)) { stopSyncPoll(); await refreshAll(); scheduleSyncDismiss() }
            } catch {
                if (syncPollRef.current !== intervalId) return
                stopSyncPoll(); scheduleSyncDismiss()
            } finally { inFlight = false }
        }, 2000)
        syncPollRef.current = intervalId
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

    // Opening a "new chapter" card jumps straight to the latest chapter and drops
    // it from the deck for good (until a genuinely newer chapter lands).
    const onReadNew = useCallback((entry) => {
        if (!entry) return
        dismissOne(entry)
        const { to, state } = resumeTarget(entry, browseTranslatedLang)
        navigate(to, { state: state || undefined })
    }, [browseTranslatedLang, dismissOne, navigate])
    const onReadCatchUp = useCallback((entry) => {
        if (!entry) return
        const { to, state } = resumeTarget(entry, browseTranslatedLang)
        navigate(to, { state: state || undefined })
    }, [browseTranslatedLang, navigate])
    const onDismissNew = useCallback((entry) => dismissOne(entry), [dismissOne])
    const onDismissAllNew = useCallback((activeItems) => dismissAll(activeItems ?? newItems), [dismissAll, newItems])

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
            setLayout(l => {
                const next = l === 'list' ? 'grid' : 'list'
                try { localStorage.setItem('lifesync.mangaLibrary.layout', next) } catch { /* ignore */ }
                return next
            })
            setFocusedCardIndex(-1)
        },
        [XBOX_GAMEPAD_BUTTONS.LB]: () => {
            setFocusedCardIndex((p) => Math.max(0, p - 1))
        },
        [XBOX_GAMEPAD_BUTTONS.RB]: () => {
            setFocusedCardIndex((p) => Math.min(visibleEntries.length - 1, p + 1))
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
        [XBOX_GAMEPAD_BUTTONS.B]: () => {
            if (detailEntry) {
                onCloseDetail()
            } else if (focusedCardIndex >= 0) {
                setFocusedCardIndex(-1)
            } else {
                navigate(-1)
            }
        },
    }), [detailEntry, focusedCardIndex, layout, navigate, onCloseDetail, onOpenDetail, visibleEntries])

    useLifeSyncGamepadInput({
        enabled: controllerSupportEnabled && !detailEntry && !deleteConfirm.isOpen && !filtersOpen,
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
            <MediaPageHeader
                accent="library"
                kicker="LifeSync · Shelf"
                title="Manga Library"
                subtitle="Your synced reading shelf  progress, statuses, and new-chapter alerts."
                icon={
                    <Link to={MANGA_BASE} aria-label="Back to manga" className="flex h-full w-full items-center justify-center transition-transform hover:-translate-x-0.5">
                        <IconChevronLeft className="h-4.5 w-4.5" />
                    </Link>
                }
                actions={
                    <>
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
                        <Link to={MANGA_BASE} className="flex h-9 items-center justify-center rounded-full bg-primary px-5 text-[12px] font-black text-black transition-all hover:-translate-y-px hover:brightness-95">
                            Browse
                        </Link>
                    </>
                }
            />

            {/* ── Shelf summary (inline pills, not metric cards) ── */}
            {!initialLoading && (
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-(--color-border-soft) bg-(--color-surface) px-3 py-1 font-semibold text-(--color-text-secondary)">
                        <span className="tabular-nums font-black text-(--color-text-primary)">{pageInfo?.total ?? visibleEntries.length}</span> in your library
                    </span>
                    {visibleSummary.withNewChapter > 0 && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-bold text-primary">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                            {visibleSummary.withNewChapter} new to read
                        </span>
                    )}
                    {visibleSummary.behind > 0 && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-bold text-amber-400">
                            {visibleSummary.behind} to catch up
                        </span>
                    )}
                    {visibleSummary.needsSync > 0 && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-(--color-border-soft) bg-(--color-surface) px-3 py-1 font-semibold text-(--color-text-secondary)">
                            {visibleSummary.needsSync} to check
                        </span>
                    )}
                    {hiddenCount > 0 && (
                        <span className="inline-flex items-center rounded-full px-1 py-1 font-medium text-(--color-text-secondary)">{hiddenCount} hidden by preferences</span>
                    )}
                </div>
            )}

            {/* ── New chapters / Catch-up deck ── */}
            <AnimatePresence>
                {(newItems.length > 0 || catchUpItems.length > 0) && (
                    <NewMangaToReadPanel
                        items={newItems}
                        catchUpItems={catchUpItems}
                        onRead={onReadNew}
                        onReadCatchUp={onReadCatchUp}
                        onDismiss={onDismissNew}
                        onDismissAll={onDismissAllNew}
                    />
                )}
            </AnimatePresence>

            {/* ── Command bar: search · filters · view · sync ── */}
            <div className="sticky top-2 z-30 flex flex-wrap items-center gap-2 rounded-2xl border border-(--color-border-soft) bg-(--color-surface)/85 px-2 py-2 backdrop-blur-md">
                {/* Search */}
                <div className="relative min-w-0 flex-1 basis-44">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-secondary)"><IconSearch /></span>
                    <input ref={searchRef} type="search" value={queryInput} onChange={(e) => setQueryInput(e.target.value)} placeholder="Search your shelf…"
                        className="h-9 w-full rounded-xl border border-(--color-border-soft) bg-(--color-surface-muted) pl-8 pr-3 text-[13px] text-(--color-text-primary) placeholder:text-(--color-text-secondary) focus:border-primary/60 focus:bg-(--color-surface) focus:outline-none focus:ring-2 focus:ring-primary/15 transition" />
                </div>

                {/* Filters */}
                <button type="button" onClick={() => setFiltersOpen(true)}
                    className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-bold transition ${activeFilterCount > 0
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'border-(--color-border-soft) bg-(--color-surface) text-(--color-text-secondary) hover:border-(--color-border-strong) hover:text-(--color-text-primary)'}`}>
                    <IconFilter />
                    <span className="hidden sm:inline">Filters</span>
                    {activeFilterCount > 0 && (
                        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black tabular-nums text-(--color-ink-strong)">{activeFilterCount}</span>
                    )}
                </button>

                {/* View toggle */}
                <div className="flex rounded-xl border border-(--color-border-soft) bg-(--color-surface-muted) p-0.5 gap-0.5">
                    <button type="button" onClick={() => { setLayout('list'); try { localStorage.setItem('lifesync.mangaLibrary.layout', 'list') } catch { /* ignore */ } }}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${layout === 'list' ? 'bg-(--color-surface) text-(--color-text-primary)' : 'text-(--color-text-secondary) hover:text-(--color-text-primary)'}`}
                        aria-label="List view"><IconList /></button>
                    <button type="button" onClick={() => { setLayout('grid'); try { localStorage.setItem('lifesync.mangaLibrary.layout', 'grid') } catch { /* ignore */ } }}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${layout === 'grid' ? 'bg-(--color-surface) text-(--color-text-primary)' : 'text-(--color-text-secondary) hover:text-(--color-text-primary)'}`}
                        aria-label="Grid view"><IconGrid /></button>
                </div>

                <span className="mx-0.5 hidden h-6 w-px bg-(--color-border-soft) sm:block" aria-hidden />

                {/* Sync (split: scope select + action) */}
                <div className="flex h-9 items-center overflow-hidden rounded-xl bg-primary">
                    <button type="button" onClick={() => void onSync()} disabled={syncBusy || syncRunning || !Number(pageInfo?.total || 0)}
                        className="flex h-full items-center gap-1.5 px-3 text-[12px] font-bold text-black transition hover:brightness-95 disabled:opacity-50">
                        <IconSync className={syncBusy || syncRunning ? 'animate-spin' : ''} />
                        <span className="hidden sm:inline">{syncBusy ? 'Starting…' : syncRunning ? `${Math.round(syncPercent)}%` : 'Sync'}</span>
                    </button>
                    <select value={syncScope} onChange={(e) => setSyncScope(e.target.value)} disabled={syncBusy || syncRunning || !Number(pageInfo?.total || 0)} aria-label="Sync scope"
                        className="h-full border-l border-black/15 bg-primary px-1.5 text-[11px] font-bold text-black focus:outline-none disabled:opacity-50">
                        {SYNC_SCOPE_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                </div>

                {/* Refresh */}
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

            {/* ── Filter & sort drawer ── */}
            <LibraryFilterDrawer open={filtersOpen} onClose={() => setFiltersOpen(false)} count={activeFilterCount} onReset={resetFilters}>
                <FilterGroup label="Source" options={sourceOptions} value={sourceFilter} onChange={setSourceFilter} />
                <FilterGroup label="Status" options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
                <FilterGroup label="Updates" options={UPDATE_STATE_OPTIONS} value={updateStateFilter} onChange={setUpdateStateFilter} />
                <FilterGroup label="Sort by" options={SORT_OPTIONS} value={sortBy} onChange={setSortBy} />
                <FilterGroup label="Order" options={[{ id: 'desc', label: 'Newest first' }, { id: 'asc', label: 'Oldest first' }]} value={sortOrder} onChange={setSortOrder} />
            </LibraryFilterDrawer>

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
                    <button type="button" onClick={() => void refreshList({ forceInitial: true })} className="mt-4 rounded-xl border border-red-200 px-4 py-2 text-[12px] font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10">Retry</button>
                </MotionDiv>
            ) : listEntries.length === 0 ? (
                <MotionDiv className="rounded-2xl border border-dashed border-(--color-border-soft) bg-(--color-surface) px-6 py-16 text-center" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={lifeSyncPageTransition}>
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-(--color-surface-muted)">
                        <IconBook className="h-5 w-5 text-(--color-text-secondary)" />
                    </div>
                    {query || activeFilterCount > 0 ? (
                        <>
                            <p className="text-[16px] font-bold text-(--color-text-primary)">No matches</p>
                            <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-(--color-text-secondary)">No titles match your search or filters.</p>
                            <button type="button" onClick={() => { setQueryInput(''); resetFilters() }} className="mt-6 inline-flex min-h-10.5 items-center justify-center gap-2 rounded-2xl border border-(--color-border-soft) px-5 text-[13px] font-bold text-(--color-text-primary) transition hover:bg-(--color-surface-muted)">
                                Clear search & filters
                            </button>
                        </>
                    ) : (
                        <>
                            <p className="text-[16px] font-bold text-(--color-text-primary)">Your shelf is empty</p>
                            <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-(--color-text-secondary)">Open any chapter in the reader to track progress here.</p>
                            <Link to={MANGA_BASE} className="mt-6 inline-flex min-h-10.5 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-[13px] font-bold text-(--color-ink-strong) transition hover:brightness-95">
                                <IconBook className="h-3.5 w-3.5" /> Browse manga
                            </Link>
                        </>
                    )}
                </MotionDiv>
            ) : visibleEntries.length === 0 ? (
                <MotionDiv className="rounded-2xl border border-(--color-border-soft) bg-(--color-surface) px-6 py-12 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <p className="text-[14px] font-semibold text-(--color-text-primary)">Hidden by preferences</p>
                    <p className="mt-1 text-[12px] text-(--color-text-secondary)">Change source filters or enable Manga District in preferences.</p>
                </MotionDiv>
            ) : (
                <>
                    {/* Select row */}
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-medium text-(--color-text-secondary)">
                            {visibleEntries.length} title{visibleEntries.length === 1 ? '' : 's'}
                        </p>
                        <button type="button" onClick={onSelectAll} className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-(--color-text-secondary) transition hover:bg-(--color-surface-muted) hover:text-(--color-text-primary)">Select all</button>
                    </div>

                    {/* List — grouped by reading status when no status filter is active */}
                    {layout === 'list' ? (
                        statusFilter === 'all' && !query ? (
                            // Group by reading status with section headers
                            (() => {
                                const STATUS_ORDER = ['reading', 're_reading', 'on_hold', 'plan_to_read', 'completed', 'dropped', '']
                                const groups = new Map()
                                for (const entry of renderedEntries) {
                                    const s = entry.readingStatus || ''
                                    if (!groups.has(s)) groups.set(s, [])
                                    groups.get(s).push(entry)
                                }
                                const ordered = STATUS_ORDER.filter((s) => groups.has(s))
                                let globalIdx = 0
                                return ordered.map((statusKey) => {
                                    const groupEntries = groups.get(statusKey)
                                    const meta = statusMeta(statusKey)
                                    const GlyphIcon = meta.icon
                                    const sectionLabel = statusKey ? statusLabel(statusKey) : 'No status'
                                    return (
                                        <div key={statusKey || '__none'} className="space-y-1">
                                            {/* Section header */}
                                            <div className="flex items-center gap-2 px-1 py-1.5">
                                                <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${statusKey ? meta.soft : 'bg-(--color-surface-muted)'}`}>
                                                    <GlyphIcon className={`h-3.5 w-3.5 ${statusKey ? meta.text : 'text-(--color-text-secondary)'}`} />
                                                </span>
                                                <span className={`text-[12px] font-black tracking-wide ${statusKey ? meta.text : 'text-(--color-text-secondary)'}`}>{sectionLabel}</span>
                                                <span className="ml-auto rounded-full bg-(--color-surface-muted) px-2 py-0.5 text-[10px] font-bold tabular-nums text-(--color-text-secondary)">{groupEntries.length}</span>
                                            </div>
                                            <div className="overflow-hidden rounded-2xl border border-(--color-border-soft) bg-(--color-surface)">
                                                <AnimatePresence initial={false}>
                                                    {groupEntries.map((entry) => {
                                                        const k = entryKey(entry)
                                                        const idx = globalIdx++
                                                        return (
                                                            <div key={k} data-focused-card={focusedCardIndex === idx ? 'true' : undefined} className={focusedCardIndex === idx ? 'ring-2 ring-primary ring-inset' : ''}>
                                                                <MangaRow entry={entry} browseTranslatedLang={browseTranslatedLang}
                                                                    busy={actionBusyKeys.has(k)} removeBusy={removeBusyKey === k}
                                                                    syncState={syncJob?.itemStates?.[k]?.state} selected={selectedKeys.has(k)}
                                                                    onToggleSelect={onToggleSelect} onStatusChange={onStatusChange}
                                                                    onRequestRemove={onRequestDelete} onOpenDetail={onOpenDetail}
                                                                    isLast={groupEntries[groupEntries.length - 1] === entry} />
                                                            </div>
                                                        )
                                                    })}
                                                </AnimatePresence>
                                            </div>
                                        </div>
                                    )
                                })
                            })()
                        ) : (
                            <div className="overflow-hidden rounded-2xl border border-(--color-border-soft) bg-(--color-surface)">
                                <AnimatePresence initial={false}>
                                    {renderedEntries.map((entry, idx) => {
                                        const k = entryKey(entry)
                                        return (
                                            <div key={k} data-focused-card={focusedCardIndex === idx ? 'true' : undefined} className={focusedCardIndex === idx ? 'ring-2 ring-primary ring-inset' : ''}>
                                                <MangaRow entry={entry} browseTranslatedLang={browseTranslatedLang}
                                                    busy={actionBusyKeys.has(k)} removeBusy={removeBusyKey === k}
                                                    syncState={syncJob?.itemStates?.[k]?.state} selected={selectedKeys.has(k)}
                                                    onToggleSelect={onToggleSelect} onStatusChange={onStatusChange}
                                                    onRequestRemove={onRequestDelete} onOpenDetail={onOpenDetail}
                                                    isLast={idx === renderedEntries.length - 1} />
                                            </div>
                                        )
                                    })}
                                </AnimatePresence>
                            </div>
                        )
                    ) : (
                        statusFilter === 'all' && !query ? (
                            // Grid grouped by reading status
                            (() => {
                                const STATUS_ORDER = ['reading', 're_reading', 'on_hold', 'plan_to_read', 'completed', 'dropped', '']
                                const groups = new Map()
                                for (const entry of renderedEntries) {
                                    const s = entry.readingStatus || ''
                                    if (!groups.has(s)) groups.set(s, [])
                                    groups.get(s).push(entry)
                                }
                                const ordered = STATUS_ORDER.filter((s) => groups.has(s))
                                let globalIdx = 0
                                return ordered.map((statusKey) => {
                                    const groupEntries = groups.get(statusKey)
                                    const meta = statusMeta(statusKey)
                                    const GlyphIcon = meta.icon
                                    const sectionLabel = statusKey ? statusLabel(statusKey) : 'No status'
                                    return (
                                        <div key={statusKey || '__none'} className="space-y-2">
                                            {/* Section header */}
                                            <div className="flex items-center gap-2 px-1 py-1">
                                                <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${statusKey ? meta.soft : 'bg-(--color-surface-muted)'}`}>
                                                    <GlyphIcon className={`h-3.5 w-3.5 ${statusKey ? meta.text : 'text-(--color-text-secondary)'}`} />
                                                </span>
                                                <span className={`text-[12px] font-black tracking-wide ${statusKey ? meta.text : 'text-(--color-text-secondary)'}`}>{sectionLabel}</span>
                                                <span className="ml-auto rounded-full bg-(--color-surface-muted) px-2 py-0.5 text-[10px] font-bold tabular-nums text-(--color-text-secondary)">{groupEntries.length}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                                                <AnimatePresence initial={false}>
                                                    {groupEntries.map((entry) => {
                                                        const k = entryKey(entry)
                                                        const idx = globalIdx++
                                                        return (
                                                            <div key={k} data-focused-card={focusedCardIndex === idx ? 'true' : undefined} className={focusedCardIndex === idx ? 'rounded-2xl ring-2 ring-primary ring-offset-2' : ''}>
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
                                        </div>
                                    )
                                })
                            })()
                        ) : (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                                <AnimatePresence initial={false}>
                                    {renderedEntries.map((entry, idx) => {
                                        const k = entryKey(entry)
                                        return (
                                            <div key={k} data-focused-card={focusedCardIndex === idx ? 'true' : undefined} className={focusedCardIndex === idx ? 'rounded-2xl ring-2 ring-primary ring-offset-2' : ''}>
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
                        )
                    )}

                    {/* Scroll sentinel — triggers next batch when it enters the viewport */}
                    {renderCount < visibleEntries.length && (
                        <div ref={sentinelRef} className="flex justify-center py-4">
                            <span className="h-1 w-12 animate-pulse rounded-full bg-(--color-border-soft)" />
                        </div>
                    )}
                </>
            )}

            {/* ── Modals ── */}
            <AnimatePresence>
                {detailEntry && <DetailDrawer entry={detailEntry} onClose={onCloseDetail} onContinue={onContinueFromDetail} />}
            </AnimatePresence>
            <AnimatePresence>
                {deleteConfirm.isOpen && (
                    <ConfirmModal isOpen title="Remove from library" message={`Remove "${decodeHtmlEntities(deleteConfirm.entry?.title) || 'this manga'}" from your shelf?`} onConfirm={onConfirmDelete} onCancel={onCancelDelete} />
                )}
            </AnimatePresence>
        </MotionDiv>
    )
}
