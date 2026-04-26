import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FaBookOpen, FaExclamationTriangle, FaFilter, FaSyncAlt, FaTrashAlt } from 'react-icons/fa'
import { useLifeSync } from '../../context/LifeSyncContext'
import { isLifeSyncHManhwaVisible, isPluginEnabled, lifesyncFetch } from '../../lib/lifesyncApi'
import { useMangaReadingList } from '../../hooks/useMangaReadingList'
import { mangaImageProps, decodeHtmlEntities } from '../../lib/mangaChapterUtils'
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
const MotionUl = motion.ul

const MANGA_BASE = '/dashboard/lifesync/anime/manga'
const MANGA_READING_HISTORY_PATH = `${MANGA_BASE}/history`

const SOURCE_OPTIONS = [
    { id: 'all', label: 'All sources' },
    { id: 'comix', label: 'Comix' },
    { id: 'mangadistrict', label: 'Manga District' },
]
const PAGE_SIZE = 25
const SYNC_POLL_INTERVAL_MS = 1000

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
    { id: 'all', label: 'Any update state' },
    { id: 'new', label: 'New chapters' },
    { id: 'needs_sync', label: 'Needs sync' },
    { id: 'caught_up', label: 'Caught up' },
    { id: 'series_ended', label: 'Series ended' },
    { id: 'up_to_date', label: 'Up to date' },
]

const SORT_OPTIONS = [
    { id: 'updatedAt', label: 'Last updated' },
    { id: 'lastOpenedAt', label: 'Last opened' },
    { id: 'title', label: 'Title' },
    { id: 'source', label: 'Source' },
    { id: 'lastReadPercent', label: 'Read progress' },
    { id: 'lastChapterLabel', label: 'Last chapter label' },
]

function sourceLabel(source) {
    if (source === 'mangadistrict') return 'District'
    if (source === 'comix') return 'Comix'
    return source || 'Manga'
}

function entryKey(entry) {
    return `${entry?.source || ''}:${entry?.mangaId || ''}`
}

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
        const date = new Date(iso)
        const now = Date.now()
        const diff = now - date.getTime()
        const days = Math.floor(diff / 86400000)
        if (days <= 0) return 'Today'
        if (days === 1) return 'Yesterday'
        if (days < 7) return `${days}d ago`
        if (days < 30) return `${Math.floor(days / 7)}w ago`
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    } catch {
        return ''
    }
}

function isFinishedManga(entry) {
    return entry?.seriesEnded === true
}

function resolveResumeChapter(entry) {
    const lastChapterId = String(entry?.lastChapterId || '').trim()
    const latestChapterId = String(entry?.remoteLatestChapterId || '').trim()
    const chapterId = lastChapterId || latestChapterId
    return {
        chapterId,
        resumeChapterId: chapterId,
        resumePercent: Number(entry?.lastReadPercent || 0),
    }
}

function resumeTarget(entry, browseTranslatedLang) {
    const { chapterId, resumeChapterId, resumePercent } = resolveResumeChapter(entry)
    if (entry?.mangaId != null && entry?.source && chapterId) {
        const readerQuery = new URLSearchParams({
            source: String(entry.source),
            lang: browseTranslatedLang === 'all' ? 'all' : 'en',
        }).toString()
        return {
            to: `${MANGA_BASE}/read/${encodeURIComponent(String(entry.mangaId))}/${encodeURIComponent(chapterId)}?${readerQuery}`,
            state: {
                from: MANGA_READING_HISTORY_PATH,
                source: entry.source,
                browseTranslatedLang,
                resumeChapterId,
                resumePercent,
            },
        }
    }
    return {
        to: `${MANGA_BASE}`,
        state: { resumeEntry: entry },
    }
}

function statusLabel(status) {
    if (!status) return 'No status'
    const row = STATUS_OPTIONS.find((opt) => opt.id === status)
    return row?.label || status
}

function parseChapterNum(label) {
    if (!label) return NaN
    const match = String(label).match(/Ch\.?\s*([\d.]+)/i)
    return match ? parseFloat(match[1]) : NaN
}

function clampPercent(value) {
    const n = Number(value)
    if (!Number.isFinite(n)) return 0
    return Math.min(100, Math.max(0, n))
}

function formatChapterNum(value) {
    if (!Number.isFinite(value)) return ''
    if (Math.abs(value - Math.round(value)) < 0.001) return String(Math.round(value))
    return String(Math.round(value * 10) / 10)
}

function calculateProgressPercent(entry) {
    const lastNum = parseChapterNum(entry?.lastChapterLabel)
    const latestNum = parseChapterNum(entry?.remoteLatestChapterLabel)
    if (Number.isFinite(lastNum) && Number.isFinite(latestNum) && latestNum > 0) {
        return Math.round(clampPercent((lastNum / latestNum) * 100) * 10) / 10
    }

    if (entry?.caughtUp && !entry?.hasNewChapter) return 100
    return clampPercent(Number(entry?.lastReadPercent || 0))
}

function progressDetailLabel(entry) {
    const lastNum = parseChapterNum(entry?.lastChapterLabel)
    const latestNum = parseChapterNum(entry?.remoteLatestChapterLabel)
    if (Number.isFinite(lastNum) && Number.isFinite(latestNum) && latestNum > 0) {
        return `Ch ${formatChapterNum(lastNum)} / ${formatChapterNum(latestNum)}`
    }
    if (entry?.remoteLatestChapterLabel) return `Latest: ${entry.remoteLatestChapterLabel}`
    return entry?.needsSync ? 'Latest chapter needs sync' : 'Latest chapter unavailable'
}

function isSyncTerminal(status) {
    const s = String(status || '').trim().toLowerCase()
    return s === 'completed' || s === 'completed_with_errors' || s === 'failed'
}

function syncStateLabel(state) {
    const s = String(state || '').trim().toLowerCase()
    if (s === 'queued') return 'Queued'
    if (s === 'syncing') return 'Syncing'
    if (s === 'done') return 'Done'
    if (s === 'error') return 'Error'
    if (s === 'skipped') return 'Skipped'
    return ''
}

function syncStateClass(state) {
    const s = String(state || '').trim().toLowerCase()
    if (s === 'queued') return 'border-slate-300 bg-slate-100 text-slate-700'
    if (s === 'syncing') return 'border-blue-300 bg-blue-100 text-blue-700'
    if (s === 'done') return 'border-lime-300 bg-lime-100 text-lime-700'
    if (s === 'error') return 'border-red-300 bg-red-100 text-red-700'
    if (s === 'skipped') return 'border-amber-300 bg-amber-100 text-amber-700'
    return 'border-slate-300 bg-slate-100 text-slate-700'
}

function normalizeSyncJobPayload(raw) {
    if (!raw || typeof raw !== 'object') return null
    const source = raw.job && typeof raw.job === 'object' ? raw.job : raw
    const jobId = String(source.jobId || '').trim()
    if (!jobId) return null
    return source
}

function syncJobStatusLabel(status) {
    const s = String(status || '').trim().toLowerCase()
    if (s === 'queued') return 'Queued'
    if (s === 'running') return 'Running'
    if (s === 'completed') return 'Completed'
    if (s === 'completed_with_errors') return 'Completed with errors'
    if (s === 'failed') return 'Failed'
    return 'Idle'
}

function StatusSelect({ value, onChange, disabled, className = '' }) {
    return (
        <select
            value={value || ''}
            onChange={(event) => onChange(event.target.value || null)}
            disabled={disabled}
            className={`min-h-[40px] rounded-lg border border-slate-200 bg-[var(--color-surface)] px-3 text-[12px] font-medium text-slate-700 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100 disabled:opacity-50 ${className}`}
        >
            <option value="">No status</option>
            {STATUS_OPTIONS.filter((opt) => opt.id !== 'all').map((opt) => (
                <option key={opt.id} value={opt.id}>
                    {opt.label}
                </option>
            ))}
        </select>
    )
}

function ConfirmationModal({ isOpen, title, message, confirmLabel, cancelLabel, onConfirm, onCancel }) {
    if (!isOpen) return null

    return (
        <MotionDiv
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onCancel}
        >
            <MotionDiv
                className="w-full max-w-md rounded-2xl border border-slate-200 bg-[var(--color-surface)] p-5 shadow-2xl"
                initial={{ scale: 0.94, y: 14 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.94, y: 14 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                onClick={(event) => event.stopPropagation()}
            >
                <div className="mb-3 flex justify-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                        <FaExclamationTriangle className="h-4 w-4" />
                    </span>
                </div>
                <h2 className="text-center text-[18px] font-bold text-slate-900">{title}</h2>
                <p className="mt-2 text-center text-[14px] leading-relaxed text-slate-600">{message}</p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="min-h-[42px] rounded-xl border border-slate-200 bg-[var(--color-surface)] px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                        {cancelLabel || 'Cancel'}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="min-h-[42px] rounded-xl border border-red-200 bg-red-600 px-4 text-[13px] font-semibold text-white transition hover:bg-red-700"
                    >
                        {confirmLabel || 'Confirm'}
                    </button>
                </div>
            </MotionDiv>
        </MotionDiv>
    )
}

function LibraryMangaCard({
    entry,
    browseTranslatedLang,
    selected,
    busy,
    removeBusy,
    syncState,
    syncMessage,
    onToggleSelect,
    onStatusChange,
    onRequestRemove,
}) {
    const { to, state } = resumeTarget(entry, browseTranslatedLang)
    const progressPercent = calculateProgressPercent(entry)

    return (
        <MotionLi
            variants={lifeSyncStaggerItemFade}
            className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[var(--color-surface)] shadow-sm transition hover:shadow-md"
            whileHover={{ y: -2, transition: { type: 'tween', duration: 0.2, ease: lifeSyncEaseOut } }}
        >
            <div className="relative aspect-[2/3] w-full overflow-hidden bg-slate-100">
                <Link to={to} state={state} className="absolute inset-0 block">
                    {entry.coverUrl ? (
                        <LifesyncEpisodeThumbnail
                            src={entry.coverUrl}
                            className="absolute inset-0 h-full w-full"
                            imgClassName="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]"
                            imgProps={mangaImageProps(entry.coverUrl)}
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center text-slate-300">
                            <FaBookOpen className="h-12 w-12" />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                </Link>

                <div className="absolute left-2 top-2 z-20 flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => onToggleSelect(entry)}
                        className={`flex h-6 w-6 items-center justify-center rounded border text-[11px] ${
                            selected
                                ? 'border-[var(--mx-color-c6ff00)] bg-[var(--mx-color-c6ff00)] text-black'
                                : 'border-[var(--color-border-strong)]/70 bg-[var(--color-surface)]/90 text-transparent hover:border-[var(--color-border-strong)]'
                        }`}
                        aria-label={selected ? 'Unselect' : 'Select'}
                    >
                        ✓
                    </button>
                    {entry.hasNewChapter ? (
                        <span className="lifesync-manga-history-accent rounded-full bg-[var(--mx-color-c6ff00)] px-2 py-0.5 text-[9px] font-bold text-slate-900">New</span>
                    ) : null}
                    {syncState ? (
                        <span
                            className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${syncStateClass(syncState)}`}
                            title={syncMessage || syncStateLabel(syncState)}
                        >
                            {syncStateLabel(syncState)}
                        </span>
                    ) : null}
                </div>

                <button
                    type="button"
                    onClick={() => onRequestRemove(entry)}
                    disabled={removeBusy}
                    className="lifesync-manga-history-accent absolute right-2 top-2 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--mx-color-c6ff00)]/90 text-black opacity-0 shadow-sm ring-1 ring-[var(--mx-color-c6ff00)]/50 transition group-hover:opacity-100 hover:bg-[var(--mx-color-c6ff00)] disabled:opacity-50"
                    aria-label="Remove"
                >
                    {removeBusy ? '…' : '✕'}
                </button>

                <div className="absolute inset-x-0 bottom-0 p-3">
                    <h3 className="line-clamp-2 text-[13px] font-bold leading-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
                        {decodeHtmlEntities(entry.title) || 'Untitled'}
                    </h3>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white/85">{sourceLabel(entry.source)}</p>
                </div>

                {entry.seriesEnded ? <SeriesCompleteBadge /> : null}
            </div>

            <div className="flex flex-1 flex-col gap-2 border-t border-slate-100 px-3 pb-2 pt-3">
                {/* Reading Status & Progress */}
                <div>
                    <div className="flex items-center justify-between gap-2 text-[10px] font-semibold">
                        <span className="text-slate-600">{statusLabel(entry.readingStatus)}</span>
                        <span className="text-slate-800">{Math.round(progressPercent)}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                            className="lifesync-manga-history-progress-fill h-full rounded-full"
                            style={{ width: `${progressPercent}%`, backgroundColor: 'var(--mx-color-c6ff00)' }}
                        />
                    </div>
                    <p className="mt-0.5 text-[9px] text-slate-500">{progressDetailLabel(entry)}</p>
                </div>

                {/* Chapter Info Compact */}
                <div className="flex gap-2 text-[9px]">
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-500 uppercase tracking-wide">Last read</p>
                        <p className="mt-0.5 truncate text-slate-700 font-medium">{entry.lastChapterLabel || '—'}</p>
                        <p className="text-slate-400">{relativeTouch(entry.updatedAt)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-500 uppercase tracking-wide">Latest</p>
                        <p className="mt-0.5 truncate text-slate-700 font-medium">
                            {entry.remoteLatestChapterLabel || (entry.needsSync ? 'Sync needed' : '—')}
                        </p>
                        <p className="text-slate-400">{entry.needsSync ? 'pending' : 'up to date'}</p>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <Link
                        to={to}
                        state={state}
                        className="lifesync-manga-history-accent inline-flex items-center justify-center rounded-lg px-3 py-2 text-[11px] font-bold text-black transition hover:shadow-lg active:scale-95"
                        style={{ backgroundColor: 'var(--mx-color-c6ff00)' }}
                    >
                        Continue
                    </Link>
                    <StatusSelect
                        value={entry.readingStatus}
                        onChange={(value) => onStatusChange(entry, value)}
                        disabled={busy}
                        className="min-h-[32px] text-[10px]"
                    />
                </div>
            </div>
        </MotionLi>
    )
}

export default function LifeSyncMangaLibrary() {
    const navigate = useNavigate()
    const { isLifeSyncConnected, lifeSyncUser } = useLifeSync()
    const prefs = lifeSyncUser?.preferences
    const nsfwEnabled = Boolean(prefs?.nsfwContentEnabled)
    const mangaPluginOn = isPluginEnabled(prefs, 'pluginMangaEnabled')
    const hManhwaEnabled = isLifeSyncHManhwaVisible(prefs)
    const mangaEnglishReleasesOnly = prefs?.mangaEnglishReleasesOnly !== false
    const browseTranslatedLang = mangaEnglishReleasesOnly ? 'en' : 'all'

    const [queryInput, setQueryInput] = useState('')
    const [query, setQuery] = useState('')
    const [sourceFilter, setSourceFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')
    const [updateStateFilter, setUpdateStateFilter] = useState('all')
    const [sortBy, setSortBy] = useState('updatedAt')
    const [sortOrder, setSortOrder] = useState('desc')
    const [page, setPage] = useState(1)
    const limit = PAGE_SIZE

    const [syncBusy, setSyncBusy] = useState(false)
    const [syncJob, setSyncJob] = useState(null)
    const [syncError, setSyncError] = useState('')
    const syncPollingBusyRef = useRef(false)
    const syncTerminalRefreshKeyRef = useRef('')
    const [actionBusyKeys, setActionBusyKeys] = useState(() => new Set())
    const [removeBusyKey, setRemoveBusyKey] = useState('')
    const [bulkBusy, setBulkBusy] = useState(false)
    const [selectedKeys, setSelectedKeys] = useState(() => new Set())

    const [deleteConfirmation, setDeleteConfirmation] = useState({ isOpen: false, entry: null })

    const sourceOptions = useMemo(() => {
        if (hManhwaEnabled) return SOURCE_OPTIONS
        return SOURCE_OPTIONS.filter((opt) => opt.id !== 'mangadistrict')
    }, [hManhwaEnabled])

    useEffect(() => {
        if (!isLifeSyncConnected) {
            navigate('/dashboard/profile?tab=integrations', { replace: true })
        }
    }, [isLifeSyncConnected, navigate])

    useEffect(() => {
        const id = window.setTimeout(() => setQuery(queryInput.trim()), 260)
        return () => window.clearTimeout(id)
    }, [queryInput])

    useEffect(() => {
        setPage(1)
    }, [query, sourceFilter, statusFilter, updateStateFilter, sortBy, sortOrder])

    useEffect(() => {
        if (!hManhwaEnabled && sourceFilter === 'mangadistrict') {
            setSourceFilter('all')
        }
    }, [hManhwaEnabled, sourceFilter])

    const listFilters = useMemo(
        () => ({
            q: query,
            source: sourceFilter,
            status: statusFilter,
            updateState: updateStateFilter,
            sortBy,
            order: sortOrder,
            page,
            limit,
        }),
        [query, sourceFilter, statusFilter, updateStateFilter, sortBy, sortOrder, page, limit],
    )

    const {
        entries: listEntries,
        visibleEntries,
        visibleSummary,
        pageInfo,
        error,
        initialLoading,
        refreshing,
        refresh: refreshList,
        patchEntry,
        removeEntry,
        bulkPatch,
        bulkDelete,
    } = useMangaReadingList({
        enabled: isLifeSyncConnected && mangaPluginOn,
        nsfwEnabled,
        hManhwaEnabled,
        filters: listFilters,
    })



    useEffect(() => {
        const totalPages = Math.max(1, Number(pageInfo?.totalPages || 1))
        if (page > totalPages) setPage(totalPages)
    }, [page, pageInfo?.totalPages])

    const selectableEntries = useMemo(() => {
        const byKey = new Map()
        for (const entry of visibleEntries) {
            const key = entryKey(entry)
            if (key && key !== ':') byKey.set(key, entry)
        }
        return [...byKey.values()]
    }, [visibleEntries])

    const selectableKeySet = useMemo(() => new Set(selectableEntries.map(entryKey)), [selectableEntries])
    useEffect(() => {
        setSelectedKeys((prev) => {
            const next = new Set([...prev].filter((key) => selectableKeySet.has(key)))
            if (next.size === prev.size) return prev
            return next
        })
    }, [selectableKeySet])

    const selectedEntries = useMemo(
        () => selectableEntries.filter((entry) => selectedKeys.has(entryKey(entry))),
        [selectedKeys, selectableEntries],
    )

    const hiddenByPreferencesCount = Math.max(0, listEntries.length - visibleEntries.length)

    const anyRefreshing = refreshing
    const syncStatus = String(syncJob?.status || '').trim().toLowerCase()
    const syncRunning = syncStatus === 'queued' || syncStatus === 'running'
    const syncTotal = Math.max(0, Number(syncJob?.total || 0))
    const syncProcessed = Math.max(0, Number(syncJob?.processed || 0))
    const syncPercent = Math.max(0, Math.min(100, Number(syncJob?.percent || 0)))
    const syncItemStates = syncJob?.itemStates && typeof syncJob.itemStates === 'object' ? syncJob.itemStates : {}

    const refreshAll = useCallback(async () => {
        await refreshList()
    }, [refreshList])

    useEffect(() => {
        if (!isLifeSyncConnected || !mangaPluginOn) return
        let cancelled = false
        ;(async () => {
            try {
                const data = await lifesyncFetch('/api/v1/manga/reading/sync/jobs/current?view=full')
                if (cancelled) return
                const next = normalizeSyncJobPayload(data)
                setSyncJob(next || null)
                if (next) setSyncError('')
            } catch {
                if (!cancelled) setSyncJob(null)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [isLifeSyncConnected, mangaPluginOn])

    useEffect(() => {
        const jobId = String(syncJob?.jobId || '').trim()
        if (!jobId || isSyncTerminal(syncJob?.status)) return
        let cancelled = false
        const poll = async () => {
            if (cancelled || syncPollingBusyRef.current) return
            syncPollingBusyRef.current = true
            try {
                const data = await lifesyncFetch(`/api/v1/manga/reading/sync/jobs/${encodeURIComponent(jobId)}?view=full`)
                if (cancelled) return
                const next = normalizeSyncJobPayload(data)
                if (next) {
                    setSyncJob(next)
                    setSyncError('')
                }
            } catch (err) {
                if (!cancelled) setSyncError(String(err?.message || 'Failed to fetch sync progress'))
            } finally {
                syncPollingBusyRef.current = false
            }
        }
        const timer = window.setInterval(() => {
            void poll()
        }, SYNC_POLL_INTERVAL_MS)
        void poll()
        return () => {
            cancelled = true
            window.clearInterval(timer)
        }
    }, [syncJob?.jobId, syncJob?.status])

    useEffect(() => {
        const jobId = String(syncJob?.jobId || '').trim()
        if (!jobId || !isSyncTerminal(syncJob?.status)) return
        const marker = `${jobId}:${String(syncJob?.status || '')}`
        if (syncTerminalRefreshKeyRef.current === marker) return
        syncTerminalRefreshKeyRef.current = marker
        void refreshAll()
    }, [syncJob?.jobId, syncJob?.status, refreshAll])

    const runEntryAction = useCallback(async (entry, action) => {
        const key = entryKey(entry)
        setActionBusyKeys((prev) => {
            const next = new Set(prev)
            next.add(key)
            return next
        })
        try {
            await action()
            return true
        } catch {
            return false
        } finally {
            setActionBusyKeys((prev) => {
                const next = new Set(prev)
                next.delete(key)
                return next
            })
        }
    }, [])

    const onStatusChange = useCallback(
        async (entry, nextStatus) => {
            await runEntryAction(entry, async () => {
                await patchEntry(entry, { readingStatus: nextStatus || null })
                await refreshList()
            })
        },
        [patchEntry, refreshList, runEntryAction],
    )

    const onRequestDelete = useCallback((entry) => {
        setDeleteConfirmation({ isOpen: true, entry })
    }, [])

    const onCancelDelete = useCallback(() => {
        setDeleteConfirmation({ isOpen: false, entry: null })
    }, [])

    const onRemove = useCallback(
        async (entry) => {
            const key = entryKey(entry)
            if (!entry || removeBusyKey) return false
            setRemoveBusyKey(key)
            try {
                await removeEntry(entry)
                setSelectedKeys((prev) => {
                    const next = new Set(prev)
                    next.delete(key)
                    return next
                })
                return true
            } catch {
                return false
            } finally {
                setRemoveBusyKey('')
            }
        },
        [removeBusyKey, removeEntry],
    )

    const onConfirmDelete = useCallback(async () => {
        if (!deleteConfirmation.entry) return
        await onRemove(deleteConfirmation.entry)
        setDeleteConfirmation({ isOpen: false, entry: null })
    }, [deleteConfirmation.entry, onRemove])

    const onSync = useCallback(async () => {
        if (syncBusy || syncRunning) return
        setSyncBusy(true)
        setSyncError('')
        syncTerminalRefreshKeyRef.current = ''
        try {
            const data = await lifesyncFetch('/api/v1/manga/reading/sync?mode=async&view=full', {
                method: 'POST',
                json: {},
            })
            const next = normalizeSyncJobPayload(data)
            if (next) setSyncJob(next)
        } catch (err) {
            setSyncError(String(err?.message || 'Failed to start sync'))
        } finally {
            setSyncBusy(false)
        }
    }, [syncBusy, syncRunning])

    const onToggleSelect = useCallback((entry) => {
        const key = entryKey(entry)
        setSelectedKeys((prev) => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }, [])

    const onSelectAllVisible = useCallback(() => {
        setSelectedKeys(new Set(selectableEntries.map(entryKey)))
    }, [selectableEntries])

    const onClearSelection = useCallback(() => {
        setSelectedKeys(new Set())
    }, [])

    const onBulkDelete = useCallback(async () => {
        if (bulkBusy || selectedEntries.length === 0) return
        setBulkBusy(true)
        try {
            await bulkDelete(selectedEntries)
            setSelectedKeys(new Set())
        } catch {
            // ignored for now
        } finally {
            setBulkBusy(false)
        }
    }, [bulkBusy, bulkDelete, selectedEntries])

    const onBulkSetStatus = useCallback(
        async (status) => {
            if (bulkBusy || selectedEntries.length === 0) return
            setBulkBusy(true)
            try {
                await bulkPatch(selectedEntries, { readingStatus: status || null })
                setSelectedKeys(new Set())
            } catch {
                // ignored for now
            } finally {
                setBulkBusy(false)
            }
        },
        [bulkBusy, bulkPatch, selectedEntries],
    )

    if (!isLifeSyncConnected) return null

    if (!mangaPluginOn) {
        return (
            <MotionDiv
                className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-[var(--color-surface)] to-lime-50/40 px-6 py-14 text-center shadow-sm"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={lifeSyncPageTransition}
            >
                <FaBookOpen className="mx-auto h-10 w-10 text-amber-600" aria-hidden />
                <p className="mt-4 text-[19px] font-bold text-slate-900">Manga is turned off</p>
                <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-slate-600">
                    Turn on the Manga plugin in LifeSync preferences to see your shelf and reading progress here.
                </p>
                <Link
                    to="/dashboard/profile"
                    className="mt-7 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-amber-600 px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-amber-700"
                >
                    Open preferences
                </Link>
            </MotionDiv>
        )
    }

    return (
        <MotionDiv
            className="lifesync-manga-history relative min-w-0 space-y-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={lifeSyncPageTransition}
        >
            <section className="rounded-2xl border border-slate-200 bg-[var(--color-surface)] p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">Library</p>
                        <h1 className="text-[22px] font-black leading-tight text-slate-900">Reading History</h1>
                        <p className="mt-1 text-[13px] text-slate-600">Track progress, manage status, and continue reading quickly.</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => void onSync()}
                            disabled={syncBusy || syncRunning || anyRefreshing || Number(pageInfo?.total || 0) === 0}
                            className="lifesync-manga-history-accent inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-[var(--mx-color-c6ff00)] px-3 text-[12px] font-bold text-slate-900 transition hover:brightness-95 disabled:opacity-50"
                        >
                            <FaSyncAlt className={`h-3 w-3 ${syncBusy || syncRunning ? 'animate-spin' : ''}`} />
                            {syncBusy ? 'Starting sync' : syncRunning ? `Syncing ${Math.round(syncPercent)}%` : 'Sync latest'}
                        </button>
                        <button
                            type="button"
                            onClick={() => void refreshAll()}
                            disabled={syncBusy || anyRefreshing}
                            className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-slate-200 bg-[var(--color-surface)] px-3 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                            {anyRefreshing ? 'Refreshing' : 'Reload'}
                        </button>
                    </div>
                </div>

                {syncJob ? (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            <p className="font-semibold text-slate-700">
                                Sync {syncJobStatusLabel(syncJob.status)} · {syncProcessed}/{syncTotal}
                            </p>
                            <p className="font-semibold text-slate-600">{Math.round(syncPercent)}%</p>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200">
                            <div
                                className={`h-full rounded-full ${syncRunning ? 'animate-pulse' : ''}`}
                                style={{ width: `${syncPercent}%`, backgroundColor: 'var(--mx-color-c6ff00)' }}
                            />
                        </div>
                        {Number(syncJob?.errorCount || 0) > 0 ? (
                            <p className="mt-1 text-[10px] font-semibold text-amber-700">
                                {Number(syncJob.errorCount)} item{Number(syncJob.errorCount) === 1 ? '' : 's'} failed
                            </p>
                        ) : null}
                    </div>
                ) : null}

                {syncError ? (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">
                        {syncError}
                    </div>
                ) : null}

                <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center">
                        <p className="text-[20px] font-black text-slate-900">{initialLoading ? '…' : visibleEntries.length}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Visible</p>
                    </div>
                    <div className="rounded-xl border border-lime-200 bg-lime-50 px-3 py-2.5 text-center">
                        <p className="text-[20px] font-black text-slate-900">{initialLoading ? '…' : visibleSummary.withNewChapter}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-lime-700">New</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-center">
                        <p className="text-[20px] font-black text-slate-900">{initialLoading ? '…' : visibleSummary.needsSync}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Needs sync</p>
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-[var(--color-surface)] p-4 shadow-sm sm:p-5">
                <div className="flex items-center justify-between gap-2">
                    <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                        <FaFilter className="h-3 w-3" />
                        Filter and Search
                    </p>
                    <Link
                        to={`${MANGA_BASE}`}
                        className="text-[12px] font-semibold text-amber-700 transition hover:text-amber-900"
                    >
                        Browse manga
                    </Link>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                    <input
                        type="search"
                        value={queryInput}
                        onChange={(event) => setQueryInput(event.target.value)}
                        placeholder="Search titles, chapters, notes"
                        className="min-h-[40px] rounded-lg border border-slate-200 bg-[var(--color-surface)] px-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100 sm:col-span-2 lg:col-span-3 xl:col-span-2"
                    />
                    <select
                        value={sourceFilter}
                        onChange={(event) => setSourceFilter(event.target.value)}
                        className="min-h-[40px] rounded-lg border border-slate-200 bg-[var(--color-surface)] px-3 text-[12px] font-medium text-slate-700 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100"
                    >
                        {sourceOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        className="min-h-[40px] rounded-lg border border-slate-200 bg-[var(--color-surface)] px-3 text-[12px] font-medium text-slate-700 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100"
                    >
                        {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <select
                        value={updateStateFilter}
                        onChange={(event) => setUpdateStateFilter(event.target.value)}
                        className="min-h-[40px] rounded-lg border border-slate-200 bg-[var(--color-surface)] px-3 text-[12px] font-medium text-slate-700 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100"
                    >
                        {UPDATE_STATE_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <select
                        value={sortBy}
                        onChange={(event) => setSortBy(event.target.value)}
                        className="min-h-[40px] rounded-lg border border-slate-200 bg-[var(--color-surface)] px-3 text-[12px] font-medium text-slate-700 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100"
                    >
                        {SORT_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                        className="min-h-[34px] rounded-lg border border-slate-200 bg-[var(--color-surface)] px-3 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                        Order: {sortOrder === 'desc' ? 'Desc' : 'Asc'}
                    </button>
                    <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700">
                        25 per page
                    </span>
                    {hiddenByPreferencesCount > 0 ? (
                        <span className="ml-auto rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800">
                            {hiddenByPreferencesCount} hidden by preferences
                        </span>
                    ) : null}
                </div>
            </section>

            {anyRefreshing && !initialLoading ? (
                <div className="overflow-hidden rounded-lg border border-amber-100 bg-[var(--color-surface)]">
                    <div className="h-1 w-full animate-pulse bg-gradient-to-r from-amber-200 via-[var(--mx-color-c6ff00)] to-amber-200" />
                </div>
            ) : null}

            {selectedEntries.length > 0 ? (
                <section className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[13px] font-semibold text-amber-900">{selectedEntries.length} selected</p>
                        <div className="flex flex-wrap gap-2">
                            <select
                                defaultValue=""
                                onChange={(event) => {
                                    const value = event.target.value
                                    if (!value) return
                                    void onBulkSetStatus(value)
                                    event.target.value = ''
                                }}
                                disabled={bulkBusy}
                                className="min-h-[34px] rounded-lg border border-amber-300 bg-[var(--color-surface)] px-3 text-[11px] font-semibold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:opacity-50"
                            >
                                <option value="">Set status</option>
                                {STATUS_OPTIONS.filter((opt) => opt.id !== 'all').map((opt) => (
                                    <option key={opt.id} value={opt.id}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={() => void onBulkDelete()}
                                disabled={bulkBusy}
                                className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-red-200 bg-[var(--color-surface)] px-3 text-[11px] font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                            >
                                <FaTrashAlt className="h-3 w-3" />
                                Remove
                            </button>
                            <button
                                type="button"
                                onClick={onClearSelection}
                                className="min-h-[34px] rounded-lg border border-slate-200 bg-[var(--color-surface)] px-3 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                </section>
            ) : null}

            {initialLoading && listEntries.length === 0 ? (
                <div className="rounded-2xl border border-slate-100 bg-[var(--color-surface)]/60 p-5 sm:p-6">
                    <LifesyncMediaLibraryPageSkeleton
                        gridCount={Math.max(8, limit)}
                        showSpotlight={false}
                        spotlightHistoryRows={2}
                        cardHistoryRows={2}
                    />
                </div>
            ) : error ? (
                <MotionDiv
                    className="rounded-2xl border border-red-200 bg-red-50/70 px-6 py-10 text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    <p className="text-[17px] font-semibold text-red-900">Failed to load reading history</p>
                    <p className="mt-2 text-[13px] text-red-700">{error}</p>
                    <button
                        type="button"
                        onClick={() => void refreshList({ forceInitial: true })}
                        className="mt-4 rounded-lg border border-red-200 bg-[var(--color-surface)] px-4 py-2 text-[12px] font-semibold text-red-700 transition hover:bg-red-100"
                    >
                        Retry
                    </button>
                </MotionDiv>
            ) : listEntries.length === 0 ? (
                <MotionDiv
                    className="rounded-2xl border border-dashed border-amber-200 bg-gradient-to-br from-[var(--color-surface)] via-amber-50/40 to-lime-50/25 px-6 py-14 text-center"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                >
                    <FaBookOpen className="mx-auto h-10 w-10 text-amber-400" />
                    <p className="mt-4 text-[18px] font-bold text-slate-900">
                        {query || sourceFilter !== 'all' || statusFilter !== 'all' || updateStateFilter !== 'all'
                            ? 'No matches for current filters'
                            : 'Your shelf is empty'}
                    </p>
                    <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-slate-600">
                        Open any chapter in the reader to track progress here.
                    </p>
                    <Link
                        to={`${MANGA_BASE}`}
                        className="mt-7 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-slate-800"
                    >
                        Browse popular manga
                    </Link>
                </MotionDiv>
            ) : visibleEntries.length === 0 ? (
                <div className="space-y-3">
                    <MotionDiv
                        className="rounded-2xl border border-amber-200 bg-amber-50/70 px-6 py-10 text-center"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    >
                        <p className="text-[17px] font-bold text-amber-900">This page is hidden by your preferences</p>
                        <p className="mx-auto mt-2 max-w-md text-[13px] text-amber-800">
                            Move to another page, change source filters, or enable Manga District in preferences.
                        </p>
                    </MotionDiv>
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-[var(--color-surface)] px-4 py-3 shadow-sm">
                        <button
                            type="button"
                            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                            disabled={pageInfo.page <= 1 || refreshing}
                            className="rounded-lg border border-slate-200 bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                        >
                            Previous
                        </button>
                        <p className="text-[12px] font-semibold text-slate-700">
                            Page {pageInfo.page} of {pageInfo.totalPages}
                        </p>
                        <button
                            type="button"
                            onClick={() => setPage((prev) => prev + 1)}
                            disabled={!pageInfo.hasMore || refreshing}
                            className="rounded-lg border border-slate-200 bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-slate-600">
                        <p>
                            Showing {visibleEntries.length} of {pageInfo.total} results · Page {pageInfo.page} of {pageInfo.totalPages}
                        </p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={onSelectAllVisible}
                                className="rounded-lg border border-slate-200 bg-[var(--color-surface)] px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                                Select all
                            </button>
                            <button
                                type="button"
                                onClick={onClearSelection}
                                className="rounded-lg border border-slate-200 bg-[var(--color-surface)] px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                                Clear
                            </button>
                        </div>
                    </div>

                    <MotionUl
                        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                        variants={lifeSyncStaggerContainerDense}
                        initial="hidden"
                        animate="show"
                    >
                        {visibleEntries.map((entry) => {
                            const key = entryKey(entry)
                            const itemState = syncItemStates[key]
                            return (
                                <LibraryMangaCard
                                    key={key}
                                    entry={entry}
                                    browseTranslatedLang={browseTranslatedLang}
                                    selected={selectedKeys.has(key)}
                                    busy={actionBusyKeys.has(key)}
                                    removeBusy={removeBusyKey === key}
                                    syncState={itemState?.state}
                                    syncMessage={itemState?.message}
                                    onToggleSelect={onToggleSelect}
                                    onStatusChange={onStatusChange}
                                    onRequestRemove={onRequestDelete}
                                />
                            )
                        })}
                    </MotionUl>

                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-[var(--color-surface)] px-4 py-3 shadow-sm">
                        <button
                            type="button"
                            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                            disabled={pageInfo.page <= 1 || refreshing}
                            className="rounded-lg border border-slate-200 bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                        >
                            Previous
                        </button>
                        <p className="text-[12px] font-semibold text-slate-700">
                            Page {pageInfo.page} of {pageInfo.totalPages}
                        </p>
                        <button
                            type="button"
                            onClick={() => setPage((prev) => prev + 1)}
                            disabled={!pageInfo.hasMore || refreshing}
                            className="rounded-lg border border-slate-200 bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                </>
            )}

            <ConfirmationModal
                isOpen={deleteConfirmation.isOpen}
                title="Remove from reading history"
                message={`Remove "${decodeHtmlEntities(deleteConfirmation.entry?.title) || 'this manga'}" from your shelf?`}
                confirmLabel="Remove"
                cancelLabel="Cancel"
                onConfirm={onConfirmDelete}
                onCancel={onCancelDelete}
            />
        </MotionDiv>
    )
}
