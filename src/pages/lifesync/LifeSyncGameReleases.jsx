import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FaChevronLeft, FaChevronRight, FaTimes } from 'react-icons/fa'
import { LifeSyncHubPageShell } from '../../components/lifesync/LifeSyncHubPageShell'
import { GameSearchDetailsPopup } from '../../components/lifesync/GameSearchDetailsPopup'
import { useLifeSync } from '../../context/LifeSyncContext'
import { useGameReleaseCalendar } from '../../hooks/useGameReleaseCalendar'
import { useGameSearch } from '../../hooks/useGameSearch'
import { buildGameDetailsFromSearchPayload } from '../../lib/gamesearchDetails'
import { isLifeSyncCrackGamesVisible } from '../../lib/lifesyncApi'
import {
    AnimatePresence,
    MotionDiv,
    lifeSyncDollyPageTransition,
    lifeSyncDollyPageVariants,
    lifeSyncModalSlideProps,
    lifeSyncStaggerContainerDense,
    lifeSyncStaggerItemFade,
} from '../../lib/lifesyncMotion'

function formatDate(value) {
    if (!value) return 'Unknown'
    try {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        }).format(new Date(value))
    } catch {
        return String(value)
    }
}

function isoDayKey(value) {
    if (!value) return ''

    if (typeof value === 'string') {
        const raw = value.trim()
        const m = raw.match(/^(\d{4}-\d{2}-\d{2})/)
        if (m) return m[1]
    }

    try {
        const d = value instanceof Date ? new Date(value) : new Date(value)
        if (Number.isNaN(d.getTime())) return ''
        const y = String(d.getFullYear())
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        return `${y}-${mm}-${dd}`
    } catch {
        return ''
    }
}

function isSameDay(a, b) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    )
}

function isToday(date) {
    return isSameDay(date, new Date())
}

function titleCaseStatus(status) {
    if (!status) return 'Unknown'
    return String(status)
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (x) => x.toUpperCase())
}

function statusChipClass(status) {
    if (status === 'cracked') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    if (status === 'not_cracked') return 'bg-rose-100 text-rose-700 border-rose-200'
    if (status === 'upcoming') return 'bg-amber-100 text-amber-800 border-amber-200'
    if (status === 'release_today') return 'bg-indigo-100 text-indigo-700 border-indigo-200'
    if (status === 'released') return 'bg-sky-100 text-sky-700 border-sky-200'
    return 'bg-slate-100 text-slate-700 border-slate-200'
}

function statusDotClass(status) {
    if (status === 'cracked') return 'bg-emerald-500'
    if (status === 'not_cracked') return 'bg-rose-500'
    if (status === 'upcoming') return 'bg-amber-500'
    if (status === 'release_today') return 'bg-indigo-500'
    if (status === 'released') return 'bg-sky-500'
    return 'bg-slate-400'
}

function gameTitle(item) {
    return String(item?.title || item?.name || item?.game || '').trim()
}

function LifeSyncConnectPrompt() {
    return (
        <div className="mx-auto max-w-4xl rounded-[22px] border border-[var(--color-border-strong)]/90 bg-[var(--color-surface)]/90 px-8 py-16 text-center shadow-sm ring-1 ring-[var(--mx-color-e8e4ef)]/70">
            <p className="text-[17px] font-bold text-[var(--mx-color-1a1628)]">LifeSync Not Connected</p>
            <p className="mt-2 text-[14px] text-[var(--mx-color-5b5670)]">
                Connect LifeSync in your profile to browse game release calendar data.
            </p>
            <Link
                to="/dashboard/profile?tab=integrations"
                className="mt-5 inline-flex items-center rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-[var(--mx-color-1a1628)] shadow-sm ring-1 ring-[var(--mx-color-1a1628)]/10 transition-all hover:brightness-95"
            >
                Go to Integrations
            </Link>
        </div>
    )
}

export default function LifeSyncGameReleases() {
    const { isLifeSyncConnected, lifeSyncUser } = useLifeSync()
    const crackGamesPluginOn = isLifeSyncCrackGamesVisible(lifeSyncUser?.preferences)
    const [currentDate, setCurrentDate] = useState(() => new Date())
    const [selectedDate, setSelectedDate] = useState(() => new Date())
    const [showDayOverlay, setShowDayOverlay] = useState(false)

    const [detailsOpen, setDetailsOpen] = useState(false)
    const [detailsLoading, setDetailsLoading] = useState(false)
    const [detailsError, setDetailsError] = useState('')
    const [details, setDetails] = useState(null)

    const calendar = useGameReleaseCalendar({
        limit: 2500,
        groupByDate: true,
        includePast: true,
        view: 'standard',
        enabled: isLifeSyncConnected,
    })

    const search = useGameSearch({
        query: '',
        provider: 'all',
        limit: 12,
        offset: 0,
        view: 'full',
        enabled: false,
    })

    const groupedByDate = Array.isArray(calendar.data?.by_date) ? calendar.data.by_date : []

    const itemsByDay = useMemo(() => {
        const map = new Map()

        for (const group of groupedByDate) {
            const key = isoDayKey(group?.date)
            if (!key) continue

            const rows = Array.isArray(group?.items) ? group.items : []
            const normalizedRows = rows
                .map((row, idx) => ({
                    ...row,
                    _title: gameTitle(row),
                    _sortIdx: idx,
                }))
                .filter((row) => Boolean(row._title))

            normalizedRows.sort((a, b) => a._title.localeCompare(b._title))
            map.set(key, normalizedRows)
        }

        return map
    }, [groupedByDate])

    const selectedDayKey = isoDayKey(selectedDate)
    const itemsForSelectedDay = useMemo(() => {
        const rows = itemsByDay.get(selectedDayKey)
        return Array.isArray(rows) ? rows : []
    }, [itemsByDay, selectedDayKey])

    const monthLabel = currentDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
    })

    const monthCellData = useMemo(() => {
        const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        const start = new Date(firstDay)
        start.setDate(firstDay.getDate() - firstDay.getDay())

        return Array.from({ length: 42 }).map((_, idx) => {
            const d = new Date(start)
            d.setDate(start.getDate() + idx)
            const key = isoDayKey(d)
            const list = itemsByDay.get(key) || []
            return {
                key,
                date: d,
                inCurrentMonth: d.getMonth() === currentDate.getMonth(),
                items: list,
            }
        })
    }, [currentDate, itemsByDay])

    const monthReleaseCount = useMemo(() => {
        const monthYear = currentDate.getFullYear()
        const monthNumber = currentDate.getMonth() + 1

        let count = 0
        for (const [key, list] of itemsByDay.entries()) {
            const [yy, mm] = key.split('-')
            if (Number(yy) === monthYear && Number(mm) === monthNumber) {
                count += list.length
            }
        }

        return count
    }, [currentDate, itemsByDay])

    useEffect(() => {
        if (!showDayOverlay) return undefined

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                setShowDayOverlay(false)
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [showDayOverlay])

    async function openDetailsForTitle(title) {
        const safeTitle = String(title || '').trim()
        if (!safeTitle) return

        setDetailsOpen(true)
        setDetailsLoading(true)
        setDetailsError('')
        setDetails(null)

        try {
            const payload = await search.search({
                q: safeTitle,
                provider: 'all',
                limit: 12,
                offset: 0,
                view: 'full',
            })
            const data = payload?.data
            const normalized = data && typeof data === 'object' ? data : {}
            const built = buildGameDetailsFromSearchPayload(normalized, {
                fallbackTitle: safeTitle,
            })

            if (!built) {
                throw new Error('No details found for this game yet')
            }

            setDetails(built)
        } catch (err) {
            setDetailsError(err?.message || 'Failed to load game details')
        } finally {
            setDetailsLoading(false)
        }
    }

    function moveMonth(step) {
        setCurrentDate((prev) => {
            const next = new Date(prev)
            next.setMonth(next.getMonth() + step)
            return next
        })
    }

    function goToToday() {
        const now = new Date()
        setCurrentDate(now)
        setSelectedDate(now)
        setShowDayOverlay(false)
    }

    function openDay(date, inCurrentMonth) {
        const next = new Date(date)
        setSelectedDate(next)
        setShowDayOverlay(true)

        if (!inCurrentMonth) {
            setCurrentDate(new Date(next.getFullYear(), next.getMonth(), 1))
        }
    }

    function moveSelectedDay(step) {
        setSelectedDate((prev) => {
            const next = new Date(prev)
            next.setDate(next.getDate() + step)
            setCurrentDate(new Date(next.getFullYear(), next.getMonth(), 1))
            return next
        })
    }

    if (!isLifeSyncConnected) {
        return (
            <LifeSyncHubPageShell>
                <LifeSyncConnectPrompt />
            </LifeSyncHubPageShell>
        )
    }

    return (
        <LifeSyncHubPageShell>
            <MotionDiv
                className="space-y-6"
                initial="initial"
                animate="animate"
                variants={lifeSyncDollyPageVariants}
                transition={lifeSyncDollyPageTransition}
            >
                <header className="lifesync-games-glass rounded-[20px] border border-apple-border/60 bg-[var(--color-surface)]/95 p-5 shadow-sm">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--mx-color-6e6e73)]">LifeSync • GameStatus</p>
                    <h1 className="mt-1 text-[30px] font-bold tracking-tight text-apple-text">Game Release Calendar</h1>
                    <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-[var(--mx-color-515154)]">
                        Anime-style monthly calendar view for upcoming and released games. Click a day to open game details and stores.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        {crackGamesPluginOn && (
                            <>
                                <Link
                                    to="/dashboard/lifesync/games/search"
                                    className="inline-flex items-center rounded-lg border border-apple-border bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-semibold text-apple-text transition hover:border-[var(--mx-color-0071e3)]"
                                >
                                    Game Search
                                </Link>
                                <Link
                                    to="/dashboard/lifesync/games/crack-status"
                                    className="inline-flex items-center rounded-lg border border-apple-border bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-semibold text-apple-text transition hover:border-[var(--mx-color-0071e3)]"
                                >
                                    Crack Status
                                </Link>
                            </>
                        )}
                    </div>
                </header>

                {calendar.error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                        {calendar.error?.message || 'Failed to load release calendar'}
                    </div>
                )}

                <section className="lifesync-games-glass rounded-[20px] border border-apple-border/60 bg-[var(--color-surface)]/95 p-4 shadow-sm sm:p-5">
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center justify-between gap-2 rounded-xl bg-apple-bg p-1.5 sm:w-fit">
                            <button
                                type="button"
                                onClick={() => moveMonth(-1)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-apple-text transition hover:border-apple-border hover:bg-[var(--color-surface)]"
                                aria-label="Previous month"
                            >
                                <FaChevronLeft className="h-3.5 w-3.5" />
                            </button>
                            <p className="min-w-[155px] text-center text-[16px] font-bold tracking-tight text-apple-text sm:min-w-[210px] sm:text-[18px]">
                                {monthLabel}
                            </p>
                            <button
                                type="button"
                                onClick={() => moveMonth(1)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-apple-text transition hover:border-apple-border hover:bg-[var(--color-surface)]"
                                aria-label="Next month"
                            >
                                <FaChevronRight className="h-3.5 w-3.5" />
                            </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-apple-border bg-apple-bg px-3 py-1 text-[11px] font-semibold text-[var(--mx-color-515154)]">
                                {monthReleaseCount} games this month
                            </span>
                            <button
                                type="button"
                                onClick={goToToday}
                                className="rounded-lg border border-apple-border bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-semibold text-apple-text transition hover:border-[var(--mx-color-0071e3)]"
                            >
                                Today
                            </button>
                            <button
                                type="button"
                                onClick={() => void calendar.refetch()}
                                disabled={calendar.loading}
                                className="rounded-lg border border-apple-border bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-semibold text-apple-text transition hover:border-[var(--mx-color-0071e3)] disabled:opacity-60"
                            >
                                {calendar.loading ? 'Refreshing...' : 'Refresh'}
                            </button>
                        </div>
                    </div>

                    <MotionDiv
                        variants={lifeSyncStaggerContainerDense}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-7 gap-1 sm:gap-2"
                    >
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                            <MotionDiv
                                key={day}
                                variants={lifeSyncStaggerItemFade}
                                className="py-1 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-apple-subtext sm:text-[11px]"
                            >
                                <span className="hidden sm:inline">{day}</span>
                                <span className="sm:hidden">{day.charAt(0)}</span>
                            </MotionDiv>
                        ))}

                        {monthCellData.map((cell, idx) => {
                            const { date, inCurrentMonth, items } = cell
                            const selected = isSameDay(date, selectedDate)
                            const today = isToday(date)

                            return (
                                <MotionDiv
                                    key={`${cell.key}-${idx}`}
                                    variants={lifeSyncStaggerItemFade}
                                    transition={{ delay: Math.min(idx * 0.002, 0.08) }}
                                    className="min-w-0"
                                >
                                    <button
                                        type="button"
                                        onClick={() => openDay(date, inCurrentMonth)}
                                        className={`lifesync-games-glass w-full rounded-xl border p-2 text-left transition-all sm:min-h-[124px] sm:p-2.5 ${
                                            selected
                                                ? 'border-[var(--mx-color-151418)]/20 bg-[var(--color-surface)] shadow-sm ring-2 ring-primary/45'
                                                : inCurrentMonth
                                                    ? 'border-[var(--mx-color-dbe4ef)] bg-[var(--color-surface)] hover:shadow-sm'
                                                    : 'border-[var(--mx-color-e2e8f0)] bg-[var(--mx-color-f8fafc)] text-[var(--mx-color-94a3b8)]'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span
                                                className={`inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold sm:text-[11px] ${
                                                    today
                                                        ? 'bg-primary text-[var(--mx-color-1a1628)]'
                                                        : inCurrentMonth
                                                            ? 'text-[var(--mx-color-1e293b)]'
                                                            : 'text-[var(--mx-color-94a3b8)]'
                                                }`}
                                            >
                                                {date.getDate()}
                                            </span>

                                            {items.length > 0 && (
                                                <span className="rounded-full bg-[var(--mx-color-eef2ff)] px-2 py-0.5 text-[10px] font-semibold text-[var(--mx-color-334155)]">
                                                    {items.length}
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-1.5 hidden space-y-1 overflow-hidden sm:block">
                                            {items.slice(0, 2).map((item, rowIdx) => (
                                                <div
                                                    key={`${item._title}-${rowIdx}`}
                                                    className="w-full truncate rounded-md bg-[var(--mx-color-f8fafc)] px-2 py-1 text-[10px] font-medium text-[var(--mx-color-334155)]"
                                                >
                                                    {item._title}
                                                </div>
                                            ))}
                                            {items.length > 2 && (
                                                <div className="px-1 text-[10px] font-medium text-[var(--mx-color-64748b)]">
                                                    +{items.length - 2} more
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-2 flex flex-wrap gap-1 sm:hidden">
                                            {items.slice(0, 4).map((item, rowIdx) => (
                                                <span
                                                    key={`${item._title}-${rowIdx}-dot`}
                                                    className={`h-1.5 w-1.5 rounded-full ${statusDotClass(item?.status_key)}`}
                                                />
                                            ))}
                                            {items.length > 4 && (
                                                <span className="h-1.5 w-1.5 rounded-full bg-apple-border" />
                                            )}
                                        </div>
                                    </button>
                                </MotionDiv>
                            )
                        })}
                    </MotionDiv>
                </section>

                <AnimatePresence mode="sync">
                    {showDayOverlay && (
                        <MotionDiv
                            className="fixed inset-0 z-70 flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <MotionDiv
                                {...lifeSyncModalSlideProps}
                                className="lifesync-games-glass relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[30px] border border-[var(--color-border-strong)]/70 bg-[var(--color-surface)] shadow-2xl sm:rounded-[28px]"
                            >
                                <div className="border-b border-[var(--mx-color-dbe4ef)] bg-[linear-gradient(120deg,rgba(240,249,255,0.92),rgba(248,250,252,0.96),rgba(255,255,255,0.98))] px-5 py-4 sm:px-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowDayOverlay(false)}
                                        className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--mx-color-dbe4ef)] bg-[var(--color-surface)] text-[var(--mx-color-475569)] transition-colors hover:bg-[var(--mx-color-f8fafc)]"
                                        aria-label="Close"
                                    >
                                        <FaTimes className="h-4 w-4" />
                                    </button>

                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--mx-color-64748b)]">
                                        Game release day
                                    </p>
                                    <h3 className="mt-1 pr-10 text-[20px] font-black tracking-tight text-[var(--mx-color-151418)] sm:text-[23px]">
                                        {selectedDate.toLocaleDateString('en-US', {
                                            weekday: 'long',
                                            month: 'long',
                                            day: 'numeric',
                                            year: 'numeric',
                                        })}
                                    </h3>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                                        <span className="rounded-full border border-[var(--mx-color-dbe4ef)] bg-[var(--color-surface)] px-2.5 py-1 font-semibold text-[var(--mx-color-1e293b)]">
                                            {itemsForSelectedDay.length
                                                ? `${itemsForSelectedDay.length} games`
                                                : 'No games'}
                                        </span>
                                        {calendar.loading && (
                                            <span className="inline-flex items-center gap-2 font-medium text-[var(--mx-color-64748b)]">
                                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                                Loading calendar...
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="grid min-h-0 flex-1 lg:grid-cols-[220px_1fr]">
                                    <aside className="lifesync-games-glass border-b border-[var(--mx-color-dbe4ef)] bg-[var(--mx-color-fbfdff)] px-5 py-4 sm:px-6 lg:border-b-0 lg:border-r">
                                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">Day controls</p>
                                        <div className="mt-3 grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => moveSelectedDay(-1)}
                                                className="inline-flex items-center justify-center rounded-xl border border-[var(--mx-color-dbe4ef)] bg-[var(--color-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--mx-color-334155)] transition hover:bg-[var(--mx-color-f8fafc)]"
                                            >
                                                Prev Day
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => moveSelectedDay(1)}
                                                className="inline-flex items-center justify-center rounded-xl border border-[var(--mx-color-dbe4ef)] bg-[var(--color-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--mx-color-334155)] transition hover:bg-[var(--mx-color-f8fafc)]"
                                            >
                                                Next Day
                                            </button>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                goToToday()
                                                setShowDayOverlay(true)
                                            }}
                                            className="mt-3 w-full rounded-xl border border-[var(--mx-color-dbe4ef)] bg-[var(--color-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--mx-color-334155)] transition hover:bg-[var(--mx-color-f8fafc)]"
                                        >
                                            Jump to today
                                        </button>

                                        <div className="lifesync-games-glass mt-4 rounded-2xl border border-[var(--mx-color-dbe4ef)] bg-[var(--color-surface)] p-3">
                                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">Summary</p>
                                            <p className="mt-1 text-[13px] font-bold text-[var(--mx-color-151418)]">
                                                {selectedDate.toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                })}
                                            </p>
                                            <p className="mt-2 text-[11px] text-[var(--mx-color-64748b)]">
                                                Click any game to open the details popup with description, images, and direct stores.
                                            </p>
                                        </div>
                                    </aside>

                                    <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
                                        {itemsForSelectedDay.length > 0 ? (
                                            <MotionDiv
                                                variants={lifeSyncStaggerContainerDense}
                                                initial="hidden"
                                                animate="show"
                                                className="space-y-3"
                                            >
                                                {itemsForSelectedDay.map((item, idx) => (
                                                    <MotionDiv key={`${item._title}-${idx}`} variants={lifeSyncStaggerItemFade}>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setShowDayOverlay(false)
                                                                void openDetailsForTitle(item._title)
                                                            }}
                                                            className="lifesync-games-glass w-full rounded-2xl border border-[var(--mx-color-dbe4ef)] bg-[var(--color-surface)] p-4 text-left transition hover:shadow-sm"
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="truncate text-[15px] font-bold tracking-tight text-[var(--mx-color-151418)]">
                                                                        {item._title}
                                                                    </p>
                                                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                                                        <span
                                                                            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${statusChipClass(item?.status_key)}`}
                                                                        >
                                                                            {titleCaseStatus(item?.status_key)}
                                                                        </span>
                                                                        {item?.release_date && (
                                                                            <span className="rounded-full bg-[var(--mx-color-f8fafc)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--mx-color-475569)] ring-1 ring-[var(--mx-color-e2e8f0)]">
                                                                                {formatDate(item.release_date)}
                                                                            </span>
                                                                        )}
                                                                        {item?.source_section && (
                                                                            <span className="rounded-full bg-[var(--mx-color-f8fafc)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--mx-color-475569)] ring-1 ring-[var(--mx-color-e2e8f0)]">
                                                                                {item.source_section}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <span className="shrink-0 rounded-lg border border-[var(--mx-color-dbe4ef)] bg-[var(--color-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--mx-color-334155)]">
                                                                    View
                                                                </span>
                                                            </div>
                                                        </button>
                                                    </MotionDiv>
                                                ))}
                                            </MotionDiv>
                                        ) : (
                                            <div className="lifesync-games-glass rounded-2xl border border-dashed border-[var(--mx-color-cbd5e1)] bg-[var(--color-surface)]/70 px-4 py-12 text-center text-[var(--mx-color-64748b)]">
                                                <p className="text-[14px] font-semibold">No releases on this day</p>
                                                <p className="mt-1 text-[12px]">Try another day or month.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </MotionDiv>
                        </MotionDiv>
                    )}
                </AnimatePresence>

                <GameSearchDetailsPopup
                    open={detailsOpen}
                    onClose={() => setDetailsOpen(false)}
                    detail={details}
                    loading={detailsLoading}
                    error={detailsError}
                />
            </MotionDiv>
        </LifeSyncHubPageShell>
    )
}
