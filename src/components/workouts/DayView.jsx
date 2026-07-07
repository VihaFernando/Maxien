import { useEffect, useMemo, useState } from "react"
import {
    FaTimes, FaBed, FaChevronLeft, FaChevronRight, FaCheck,
    FaRegCircle, FaCheckCircle, FaClock, FaFire, FaDumbbell,
} from "react-icons/fa"
import { WEEKDAYS, WEEKDAY_LABELS, fromDateString, addDays, toDateString } from "../../lib/workouts"
import { useAuth } from "../../context/AuthContext"
import { fetchCompletions, markCompletion, clearCompletion } from "../../lib/workoutCompletions"

const dayDateLabel = (startDateStr, offset) => {
    const start = fromDateString(startDateStr)
    if (!start) return ""
    return addDays(start, offset).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
}

/**
 * Full-screen, focused "do the workout" view for a single day. Lets you tick
 * exercises done (persisted per calendar date), and page across the week.
 * `week`   — the week row (with normalized .days)
 * `dayKey` — current weekday key
 * `onChangeDay(nextKey)` / `onClose`
 *
 * The parent remounts this per day (via key), so load-on-mount is safe.
 */
export default function DayView({ week, dayKey, onChangeDay, onClose }) {
    const { user } = useAuth()
    const dayIndex = WEEKDAYS.indexOf(dayKey)
    const day = week.days[dayKey]
    const exercises = useMemo(() => day?.exercises || [], [day])
    const isRest = day?.rest || exercises.length === 0

    // Calendar date this weekday maps to (for per-date persistence).
    const dateStr = useMemo(() => {
        const start = fromDateString(week.start_date)
        return start ? toDateString(addDays(start, dayIndex)) : ""
    }, [week.start_date, dayIndex])

    // Which exercises are checked off, loaded from the DB for this date.
    const [done, setDone] = useState(() => new Set())

    // Load saved completions for this day on mount / date change.
    useEffect(() => {
        let cancelled = false
        fetchCompletions(user?.id, week.id, dateStr)
            .then((set) => { if (!cancelled) setDone(set) })
            .catch(() => { /* keep empty on failure */ })
        return () => { cancelled = true }
    }, [user?.id, week.id, dateStr])

    const toggle = (id) => {
        const wasDone = done.has(id)
        // Optimistic update.
        setDone((prev) => {
            const n = new Set(prev)
            wasDone ? n.delete(id) : n.add(id)
            return n
        })
        const op = wasDone
            ? clearCompletion(user?.id, week.id, dateStr, id)
            : markCompletion(user?.id, week.id, dateStr, id)
        op.catch(() => {
            // Roll back on failure.
            setDone((prev) => {
                const n = new Set(prev)
                wasDone ? n.add(id) : n.delete(id)
                return n
            })
        })
    }

    const doneCount = useMemo(
        () => exercises.filter((ex) => done.has(ex.id)).length,
        [exercises, done],
    )
    const pct = exercises.length ? Math.round((doneCount / exercises.length) * 100) : 0
    const allDone = exercises.length > 0 && doneCount === exercises.length

    const prevKey = dayIndex > 0 ? WEEKDAYS[dayIndex - 1] : null
    const nextKey = dayIndex < 6 ? WEEKDAYS[dayIndex + 1] : null

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-surface)] animate-in fade-in duration-200">
            {/* Header — compact */}
            <header className="relative shrink-0 overflow-hidden bg-[var(--mx-color-151418)]">
                {/* Subtle lime glow + top hairline */}
                <div className="pointer-events-none absolute -right-20 -top-24 w-64 h-64 rounded-full bg-[var(--mx-color-c6ff00)]/15 blur-3xl" />
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[var(--mx-color-c6ff00)] via-[var(--mx-color-a8db00)] to-transparent" />

                <div className="relative max-w-[900px] mx-auto w-full px-4 sm:px-6 py-3 sm:py-3.5">
                    {/* Single row: close · identity · ring */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            aria-label="Close"
                            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-colors"
                        >
                            <FaTimes className="w-4 h-4" />
                        </button>

                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-black uppercase tracking-[0.15em] ${isRest ? "text-white/45" : "text-[var(--mx-color-c6ff00)]"}`}>
                                    {isRest ? "Rest Day" : "Session"}
                                </span>
                                <span className="text-white/25">·</span>
                                <span className="text-[11px] font-semibold text-white/45 truncate">
                                    {dayDateLabel(week.start_date, dayIndex)}
                                </span>
                            </div>
                            <div className="flex items-baseline gap-2.5 mt-0.5">
                                <h2 className="text-[22px] sm:text-[26px] font-black text-white leading-none tracking-tight">
                                    {WEEKDAY_LABELS[dayKey]}
                                </h2>
                                {!isRest && (
                                    <span className="hidden sm:inline text-[12px] font-bold text-white/40 truncate">
                                        {week.title || "Workout"}
                                    </span>
                                )}
                            </div>
                        </div>

                        {!isRest && (
                            <div className="shrink-0">
                                <ProgressRing pct={pct} />
                            </div>
                        )}
                    </div>

                    {/* Slim progress bar + inline stats */}
                    {!isRest && (
                        <div className="mt-3">
                            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-[var(--mx-color-a8db00)] to-[var(--mx-color-c6ff00)] transition-[width] duration-500"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 text-[11px] font-bold text-white/55">
                                <span className="inline-flex items-center gap-1 text-[var(--mx-color-c6ff00)]">
                                    <FaCheck className="w-2.5 h-2.5" /> {doneCount}/{exercises.length} done
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <FaFire className="w-2.5 h-2.5" /> {exercises.length} exercises
                                </span>
                                {week.total_time && (
                                    <span className="inline-flex items-center gap-1">
                                        <FaClock className="w-2.5 h-2.5" /> {week.total_time}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-[900px] mx-auto w-full px-4 sm:px-8 py-5 sm:py-7">
                    {isRest ? (
                        <div className="text-center py-20">
                            <div className="w-16 h-16 rounded-2xl bg-[var(--mx-color-f5f5f7)] text-[var(--mx-color-86868b)] flex items-center justify-center mx-auto mb-4">
                                <FaBed className="w-7 h-7" />
                            </div>
                            <p className="text-[20px] font-black text-[var(--mx-color-1d1d1f)]">Rest & recover</p>
                            <p className="text-[14px] font-medium text-[var(--mx-color-86868b)] mt-1.5 max-w-sm mx-auto">
                                No workout scheduled today. Recovery is where the gains happen — hydrate, stretch, sleep well.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3 sm:space-y-4">
                            {allDone && (
                                <div className="rounded-2xl bg-[var(--mx-color-c6ff00)]/20 border border-[var(--mx-color-c6ff00)]/50 px-4 py-3.5 flex items-center gap-3">
                                    <span className="w-9 h-9 rounded-xl bg-[var(--mx-color-c6ff00)] text-black flex items-center justify-center shrink-0">
                                        <FaCheck className="w-4 h-4" />
                                    </span>
                                    <div>
                                        <p className="font-black text-[15px] text-[var(--mx-color-1d1d1f)]">Session complete! 🔥</p>
                                        <p className="text-[13px] font-semibold text-[var(--mx-color-86868b)]">Great work — every exercise done.</p>
                                    </div>
                                </div>
                            )}

                            {exercises.map((ex, idx) => (
                                <ExerciseCard
                                    key={ex.id}
                                    ex={ex}
                                    index={idx + 1}
                                    done={done.has(ex.id)}
                                    onToggle={() => toggle(ex.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom nav — prev/next day */}
            <div className="shrink-0 border-t border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)]">
                <div className="max-w-[900px] mx-auto w-full px-4 sm:px-8 py-3 flex items-center justify-between gap-2">
                    <button
                        onClick={() => prevKey && onChangeDay(prevKey)}
                        disabled={!prevKey}
                        className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-[13px] text-[var(--mx-color-1d1d1f)] bg-[var(--mx-color-f5f5f7)] hover:bg-[var(--mx-color-e8e8ed)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        <FaChevronLeft className="w-3 h-3" />
                        {prevKey ? WEEKDAY_LABELS[prevKey].slice(0, 3) : "—"}
                    </button>

                    <div className="flex items-center gap-1.5">
                        {WEEKDAYS.map((k) => {
                            const active = k === dayKey
                            const kRest = week.days[k].rest || week.days[k].exercises.length === 0
                            return (
                                <button
                                    key={k}
                                    onClick={() => onChangeDay(k)}
                                    title={WEEKDAY_LABELS[k]}
                                    className={`h-2.5 rounded-full transition-all ${active
                                        ? "w-6 bg-[var(--mx-color-c6ff00)]"
                                        : kRest
                                            ? "w-2.5 bg-[var(--mx-color-d2d2d7)]"
                                            : "w-2.5 bg-[var(--mx-color-a8db00)]/60 hover:bg-[var(--mx-color-a8db00)]"
                                        }`}
                                />
                            )
                        })}
                    </div>

                    <button
                        onClick={() => nextKey && onChangeDay(nextKey)}
                        disabled={!nextKey}
                        className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-[13px] text-black bg-[var(--mx-color-c6ff00)] hover:bg-[var(--mx-color-b8f000)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        {nextKey ? WEEKDAY_LABELS[nextKey].slice(0, 3) : "—"}
                        <FaChevronRight className="w-3 h-3" />
                    </button>
                </div>
            </div>
        </div>
    )
}

function ProgressRing({ pct }) {
    const r = 22
    const c = 2 * Math.PI * r
    const offset = c - (pct / 100) * c
    return (
        <div className="relative w-12 h-12 sm:w-[52px] sm:h-[52px] shrink-0">
            <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
                <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" />
                <circle
                    cx="28" cy="28" r={r} fill="none" stroke="var(--mx-color-c6ff00)" strokeWidth="6"
                    strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
                    className="transition-[stroke-dashoffset] duration-500"
                />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[12px] sm:text-[13px] font-black text-white">
                {pct}%
            </span>
        </div>
    )
}

function ExerciseCard({ ex, index, done, onToggle }) {
    const steps = ex.points.filter((p) => p.kind === "point")
    const how = ex.points.find((p) => p.kind === "how")
    const why = ex.points.find((p) => p.kind === "why")

    return (
        <div
            className={`rounded-2xl border transition-all duration-200 ${done
                ? "border-[var(--mx-color-c6ff00)]/60 bg-[var(--mx-color-c6ff00)]/10"
                : "border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] shadow-sm"
                }`}
        >
            <div className="p-4 sm:p-5">
                <div className="flex items-start gap-3 sm:gap-4">
                    {/* Number badge */}
                    <span className={`shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-[15px] sm:text-[17px] ${done ? "bg-[var(--mx-color-c6ff00)] text-black" : "bg-[var(--mx-color-1d1d1f)] text-white"
                        }`}>
                        {index}
                    </span>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <h3 className={`font-black text-[17px] sm:text-[19px] leading-tight tracking-tight ${done ? "text-[var(--mx-color-1d1d1f)] line-through decoration-2 decoration-[var(--mx-color-a8db00)]" : "text-[var(--mx-color-1d1d1f)]"
                                }`}>
                                {ex.name}
                            </h3>
                            <button
                                onClick={onToggle}
                                className={`shrink-0 transition-colors ${done ? "text-[var(--mx-color-16a34a)]" : "text-[var(--mx-color-d2d2d7)] hover:text-[var(--mx-color-86868b)]"}`}
                                title={done ? "Mark not done" : "Mark done"}
                            >
                                {done
                                    ? <FaCheckCircle className="w-7 h-7" />
                                    : <FaRegCircle className="w-7 h-7" />}
                            </button>
                        </div>

                        {ex.amount && (
                            <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-[var(--mx-color-1d1d1f)] text-white text-[13px] font-bold">
                                <FaClock className="w-3 h-3" /> {ex.amount}
                            </span>
                        )}

                        {steps.length > 0 && (
                            <ol className="mt-3.5 space-y-2">
                                {steps.map((p, i) => (
                                    <li key={i} className="flex items-start gap-2.5 text-[14px] sm:text-[15px] leading-relaxed text-[var(--mx-color-1d1d1f)]">
                                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[var(--mx-color-a8db00)] shrink-0" />
                                        <span>{p.text}</span>
                                    </li>
                                ))}
                            </ol>
                        )}

                        {(how || why) && (
                            <div className="mt-3.5 grid gap-2">
                                {how && (
                                    <div className="rounded-xl bg-sky-50 border border-sky-100 px-3.5 py-2.5">
                                        <p className="text-[11px] font-black text-sky-700 uppercase tracking-wider mb-0.5">How</p>
                                        <p className="text-[14px] font-medium text-sky-950 leading-relaxed">{how.text}</p>
                                    </div>
                                )}
                                {why && (
                                    <div className="rounded-xl bg-amber-50 border border-amber-100 px-3.5 py-2.5">
                                        <p className="text-[11px] font-black text-amber-700 uppercase tracking-wider mb-0.5">Why</p>
                                        <p className="text-[14px] font-medium text-amber-950 leading-relaxed">{why.text}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
