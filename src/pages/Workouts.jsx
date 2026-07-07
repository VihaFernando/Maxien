import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
    FaPlus, FaTimes, FaEdit, FaTrash, FaDumbbell, FaFileImport,
    FaCopy, FaCheck, FaCalendarWeek, FaRegClipboard, FaChevronRight, FaClock,
} from "react-icons/fa"
import { supabase } from "../lib/supabase"
import { useAuth } from "../context/AuthContext"
import {
    WEEKDAYS, WEEKDAY_LABELS, emptyDays, normalizeDays, parseWorkoutImport, countExercises,
    cloneDaysWithNewIds, mondayOf, toDateString, fromDateString, makeId,
    weekRangeLabel, CHATGPT_IMPORT_PROMPT, buildDaysFromSchedule, defaultWorkoutDays,
} from "../lib/workouts"
import WeekEditor from "../components/workouts/WeekEditor"
import WeekStrip from "../components/workouts/WeekStrip"
import DayView from "../components/workouts/DayView"

const PRIMARY_BTN =
    "inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-[var(--mx-color-c6ff00)] hover:bg-[var(--mx-color-b8f000)] text-black rounded-xl font-bold text-[13px] sm:text-[14px] transition-all active:scale-[0.98] shadow-sm disabled:opacity-60"
const GHOST_BTN =
    "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--mx-color-f5f5f7)] hover:bg-[var(--mx-color-e8e8ed)] text-[var(--mx-color-1d1d1f)] font-semibold text-sm transition-all"

// "create" | "import" — how the editor modal was opened.
const MODAL_STEP = { INPUT: "input", REVIEW: "review" }

export default function Workouts() {
    const { user } = useAuth()

    const [weeks, setWeeks] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [message, setMessage] = useState("")
    const messageTimeoutRef = useRef(null)

    const [selectedWeek, setSelectedWeek] = useState(null)
    // Focused single-day workout view: { week, dayKey } or null.
    const [openDay, setOpenDay] = useState(null)

    // Editor modal state (shared by create / import / edit).
    const [editorOpen, setEditorOpen] = useState(false)
    const [editorMode, setEditorMode] = useState("create") // create | import | edit
    const [editorStep, setEditorStep] = useState(MODAL_STEP.INPUT)
    const [editingWeekId, setEditingWeekId] = useState(null)
    const [draftTitle, setDraftTitle] = useState("")
    const [draftTotal, setDraftTotal] = useState("")
    const [draftStart, setDraftStart] = useState(() => toDateString(mondayOf(new Date())))
    const [draftDays, setDraftDays] = useState(() => emptyDays())
    const [importText, setImportText] = useState("")
    const [importWarnings, setImportWarnings] = useState([])
    // The imported single-day schedule (flat exercise list) applied to workout days.
    const [schedule, setSchedule] = useState([])
    const [saving, setSaving] = useState(false)
    const [showPrompt, setShowPrompt] = useState(false)
    const [promptCopied, setPromptCopied] = useState(false)

    // Duplicate-week suggestion banner state.
    const [dupDismissed, setDupDismissed] = useState(false)

    const flash = useCallback((msg) => {
        setMessage(msg)
        if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current)
        messageTimeoutRef.current = setTimeout(() => setMessage(""), 2500)
    }, [])

    useEffect(() => () => {
        if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current)
    }, [])

    const fetchWeeks = useCallback(async () => {
        if (!user) return
        setLoading(true)
        setError("")
        try {
            const { data, error: fetchError } = await supabase
                .from("workout_weeks")
                .select("*")
                .eq("user_id", user.id)
                .order("start_date", { ascending: false })

            if (fetchError) {
                setError("Failed to load workout plans")
                setWeeks([])
            } else {
                setWeeks((data || []).map((w) => ({ ...w, days: normalizeDays(w.days) })))
            }
        } catch {
            setError("Failed to load workout plans")
            setWeeks([])
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => { fetchWeeks() }, [fetchWeeks])

    // ---- Current week + duplicate suggestion -------------------------------
    const thisMondayStr = useMemo(() => toDateString(mondayOf(new Date())), [])
    const currentWeek = useMemo(
        () => weeks.find((w) => w.start_date === thisMondayStr) || null,
        [weeks, thisMondayStr],
    )
    // Most recent past plan we could carry forward into this week.
    const lastPastWeek = useMemo(
        () => weeks.find((w) => w.start_date < thisMondayStr) || null,
        [weeks, thisMondayStr],
    )
    // Upcoming weeks first, then past — everything except the current week.
    const otherWeeks = useMemo(() => {
        const upcoming = weeks.filter((w) => w.start_date > thisMondayStr).sort((a, b) => a.start_date.localeCompare(b.start_date))
        const past = weeks.filter((w) => w.start_date < thisMondayStr) // already desc from query
        return { upcoming, past }
    }, [weeks, thisMondayStr])
    const showDuplicateSuggestion =
        !dupDismissed && !currentWeek && Boolean(lastPastWeek) && !editorOpen

    // ---- Modal openers -----------------------------------------------------
    const resetDraft = () => {
        setDraftTitle("")
        setDraftTotal("")
        setDraftStart(thisMondayStr)
        setDraftDays(emptyDays())
        setImportText("")
        setImportWarnings([])
        setSchedule([])
        setShowPrompt(false)
    }

    const openCreate = () => {
        resetDraft()
        setEditorMode("create")
        setEditorStep(MODAL_STEP.REVIEW) // create goes straight to the editor
        setEditingWeekId(null)
        setEditorOpen(true)
    }

    const openImport = () => {
        resetDraft()
        setEditorMode("import")
        setEditorStep(MODAL_STEP.INPUT)
        setEditingWeekId(null)
        setEditorOpen(true)
    }

    const openEdit = (week) => {
        setEditorMode("edit")
        setEditorStep(MODAL_STEP.REVIEW)
        setEditingWeekId(week.id)
        setDraftTitle(week.title || "")
        setDraftTotal(week.total_time || "")
        setDraftStart(week.start_date)
        setDraftDays(normalizeDays(week.days))
        setSchedule([])
        setImportWarnings([])
        setShowPrompt(false)
        setSelectedWeek(null)
        setEditorOpen(true)
    }

    /** Duplicate: pre-fill editor from a past week, targeting the current week. */
    const openDuplicate = (week) => {
        setEditorMode("create")
        setEditorStep(MODAL_STEP.REVIEW)
        setEditingWeekId(null)
        setDraftTitle(week.title || "")
        setDraftTotal(week.total_time || "")
        setDraftStart(thisMondayStr)
        setDraftDays(cloneDaysWithNewIds(week.days))
        setSchedule([])
        setImportWarnings([])
        setShowPrompt(false)
        setEditorOpen(true)
    }

    const closeEditor = () => {
        setEditorOpen(false)
        setEditingWeekId(null)
    }

    // ---- Import parse ------------------------------------------------------
    const runParse = () => {
        const parsed = parseWorkoutImport(importText)
        setSchedule(parsed.exercises)
        setDraftDays(buildDaysFromSchedule(parsed.exercises, defaultWorkoutDays()))
        if (parsed.title) setDraftTitle(parsed.title)
        if (parsed.totalTime) setDraftTotal(parsed.totalTime)
        setImportWarnings(parsed.warnings)
        setEditorStep(MODAL_STEP.REVIEW)
    }

    // Toggle a weekday between workout and rest. Derives intent from the day's
    // current state so it stays in sync with per-day edits in WeekEditor.
    // For imported plans (schedule present) an empty day is re-filled from the
    // shared schedule; otherwise we just flip the rest flag.
    const toggleWorkoutDay = (dayKey) => {
        setDraftDays((days) => {
            const day = days[dayKey]
            const isWorkoutNow = !day.rest && day.exercises.length > 0
            if (isWorkoutNow) {
                return { ...days, [dayKey]: { ...day, rest: true } }
            }
            const fill = day.exercises.length > 0
                ? day.exercises
                : schedule.map((ex) => ({ ...ex, id: makeId() }))
            return { ...days, [dayKey]: { rest: false, exercises: fill } }
        })
    }

    // ---- Save --------------------------------------------------------------
    const handleSave = async () => {
        setError("")
        const start = fromDateString(draftStart)
        if (!start) { setError("Pick a valid start date."); return }
        if (countExercises(draftDays) === 0 && !WEEKDAYS.some((d) => draftDays[d].rest)) {
            setError("Add at least one exercise or mark a rest day before saving.")
            return
        }

        setSaving(true)
        const now = new Date().toISOString()
        // Persist rest for empty non-rest days so the view is unambiguous.
        const cleanDays = { ...draftDays }
        for (const d of WEEKDAYS) {
            cleanDays[d] = {
                rest: draftDays[d].rest || draftDays[d].exercises.length === 0,
                exercises: draftDays[d].exercises,
            }
        }

        const payload = {
            user_id: user.id,
            title: draftTitle.trim() || null,
            start_date: toDateString(start),
            days: cleanDays,
            total_time: draftTotal.trim() || null,
            updated_at: now,
        }

        try {
            if (editingWeekId) {
                const { error: updErr } = await supabase
                    .from("workout_weeks")
                    .update(payload)
                    .eq("id", editingWeekId)
                    .eq("user_id", user.id)
                if (updErr) throw updErr
                flash("Workout plan updated")
            } else {
                // Upsert on (user_id, start_date) so re-saving the same week replaces it.
                const { error: insErr } = await supabase
                    .from("workout_weeks")
                    .upsert({ ...payload, created_at: now }, { onConflict: "user_id,start_date" })
                if (insErr) throw insErr
                flash("Workout plan saved")
            }
            closeEditor()
            await fetchWeeks()
        } catch (e) {
            const dup = e?.code === "23505"
            setError(dup ? "A plan already exists for that week. Edit it instead, or pick another start date." : "Failed to save workout plan")
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (weekId) => {
        if (!window.confirm("Delete this week's plan?")) return
        try {
            const { error: delErr } = await supabase
                .from("workout_weeks").delete().eq("id", weekId).eq("user_id", user.id)
            if (delErr) throw delErr
            if (selectedWeek?.id === weekId) setSelectedWeek(null)
            setWeeks((prev) => prev.filter((w) => w.id !== weekId))
            flash("Plan deleted")
        } catch {
            setError("Failed to delete plan")
        }
    }

    const copyPrompt = async () => {
        try {
            await navigator.clipboard.writeText(CHATGPT_IMPORT_PROMPT)
            setPromptCopied(true)
            setTimeout(() => setPromptCopied(false), 2000)
        } catch { /* clipboard unavailable */ }
    }

    const draftExerciseCount = countExercises(draftDays)
    const activeDayCount = WEEKDAYS.filter((d) => !draftDays[d].rest && draftDays[d].exercises.length > 0).length

    return (
        <div className="mx-auto max-w-[1320px] animate-in fade-in pb-10 duration-500">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
                <div>
                    <h2 className="text-[28px] sm:text-[34px] font-bold text-[var(--mx-color-1d1d1f)] tracking-tight">Workouts</h2>
                    <p className="text-[var(--mx-color-86868b)] text-sm sm:text-[17px] mt-1.5 font-medium">
                        Plan your training week by week. Import, duplicate, and adjust anytime.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={openImport} className={GHOST_BTN}>
                        <FaFileImport className="w-3.5 h-3.5" /> Import
                    </button>
                    <button onClick={openCreate} className={PRIMARY_BTN}>
                        <FaPlus className="w-3 h-3" /> New Week
                    </button>
                </div>
            </div>

            {(error || message) && (
                <div className={`mb-5 px-4 py-3 rounded-2xl text-sm font-semibold border ${error
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-[var(--mx-color-ecfdf3)] text-[var(--mx-color-166534)] border-[var(--mx-color-bbf7d0)]"
                    }`}>
                    {error || message}
                </div>
            )}

            {/* Duplicate-week suggestion at the start of a new week */}
            {showDuplicateSuggestion && (
                <div className="mb-5 rounded-2xl border border-[var(--mx-color-c6ff00)]/50 bg-[var(--mx-color-c6ff00)]/10 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--mx-color-c6ff00)] text-black flex items-center justify-center shrink-0">
                        <FaCalendarWeek className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-[15px] text-[var(--mx-color-1d1d1f)]">Start this week's plan?</p>
                        <p className="text-[13px] text-[var(--mx-color-86868b)] font-medium mt-0.5">
                            You don't have a plan for {weekRangeLabel(thisMondayStr)}. Duplicate “{lastPastWeek.title || "your last plan"}” and tweak it?
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => setDupDismissed(true)} className="px-3 py-2 rounded-lg text-[13px] font-semibold text-[var(--mx-color-86868b)] hover:text-[var(--mx-color-1d1d1f)]">
                            Not now
                        </button>
                        <button onClick={() => openDuplicate(lastPastWeek)} className={PRIMARY_BTN}>
                            <FaCopy className="w-3 h-3" /> Duplicate & edit
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="bg-[var(--color-surface)] rounded-[24px] sm:rounded-[32px] p-4 sm:p-8 border border-[var(--mx-color-d2d2d7)]/40 shadow-sm py-20 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-[var(--mx-color-c6ff00)] border-t-transparent rounded-full animate-spin" />
                </div>
            ) : weeks.length === 0 ? (
                <div className="bg-[var(--color-surface)] rounded-[24px] sm:rounded-[32px] p-4 sm:p-8 border border-[var(--mx-color-d2d2d7)]/40 shadow-sm">
                    <div className="text-center py-16 bg-[var(--mx-color-f5f5f7)]/60 border border-dashed border-[var(--mx-color-d2d2d7)] rounded-2xl">
                        <FaDumbbell className="w-7 h-7 text-[var(--mx-color-86868b)] mx-auto mb-3" />
                        <p className="text-[var(--mx-color-1d1d1f)] font-bold text-[15px]">No workout plans yet</p>
                        <p className="text-[var(--mx-color-86868b)] text-sm mt-1 mb-4">Create a week from scratch or import one from ChatGPT.</p>
                        <div className="flex items-center justify-center gap-2">
                            <button onClick={openImport} className={GHOST_BTN}><FaFileImport className="w-3.5 h-3.5" /> Import</button>
                            <button onClick={openCreate} className={PRIMARY_BTN}><FaPlus className="w-3 h-3" /> New Week</button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6 sm:space-y-8">
                    {/* ---- THIS WEEK hero ---- */}
                    {currentWeek ? (
                        <section className="rounded-[24px] sm:rounded-[32px] border border-[var(--mx-color-d2d2d7)]/50 bg-[var(--color-surface)] shadow-sm overflow-hidden">
                            <div className="relative px-4 sm:px-7 pt-5 pb-5 sm:pt-6 sm:pb-6 border-b border-[var(--mx-color-e5e5ea)]">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div className="min-w-0">
                                        <span className="text-[11px] font-black uppercase tracking-widest text-[var(--mx-color-a8db00)]">This Week</span>
                                        <h3 className="text-[22px] sm:text-[28px] font-black text-[var(--mx-color-1d1d1f)] tracking-tight leading-none mt-1">
                                            {currentWeek.title || "Workout week"}
                                        </h3>
                                        <p className="text-[13px] font-semibold text-[var(--mx-color-86868b)] mt-1.5">
                                            {weekRangeLabel(currentWeek.start_date)}
                                            {currentWeek.total_time && <span className="inline-flex items-center gap-1 ml-2"><FaClock className="w-3 h-3" /> {currentWeek.total_time}</span>}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button onClick={() => openEdit(currentWeek)} className={GHOST_BTN}>
                                            <FaEdit className="w-3 h-3" /> Edit
                                        </button>
                                        <button onClick={() => handleDelete(currentWeek.id)} title="Delete week"
                                            className="p-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                                            <FaTrash className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 sm:p-6">
                                <p className="text-[12px] font-bold text-[var(--mx-color-86868b)] uppercase tracking-wider mb-3">Tap a day to start</p>
                                <WeekStrip week={currentWeek} onOpenDay={(dayKey) => setOpenDay({ week: currentWeek, dayKey })} />
                            </div>
                        </section>
                    ) : (
                        <section className="rounded-[24px] sm:rounded-[32px] border border-dashed border-[var(--mx-color-d2d2d7)] bg-[var(--mx-color-f5f5f7)]/50 p-6 sm:p-8 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-[var(--mx-color-e8e8ed)] text-[var(--mx-color-86868b)] flex items-center justify-center mx-auto mb-3">
                                <FaCalendarWeek className="w-5 h-5" />
                            </div>
                            <p className="text-[16px] font-black text-[var(--mx-color-1d1d1f)]">No plan for this week yet</p>
                            <p className="text-[13px] font-medium text-[var(--mx-color-86868b)] mt-1 mb-4">
                                {weekRangeLabel(thisMondayStr)}
                            </p>
                            <div className="flex items-center justify-center gap-2">
                                {lastPastWeek && (
                                    <button onClick={() => openDuplicate(lastPastWeek)} className={GHOST_BTN}>
                                        <FaCopy className="w-3 h-3" /> Duplicate last week
                                    </button>
                                )}
                                <button onClick={openCreate} className={PRIMARY_BTN}>
                                    <FaPlus className="w-3 h-3" /> Plan this week
                                </button>
                            </div>
                        </section>
                    )}

                    {/* ---- Other weeks (upcoming + history) ---- */}
                    {(otherWeeks.upcoming.length > 0 || otherWeeks.past.length > 0) && (
                        <section className="rounded-[24px] sm:rounded-[32px] border border-[var(--mx-color-d2d2d7)]/40 bg-[var(--color-surface)] shadow-sm p-4 sm:p-6">
                            {otherWeeks.upcoming.length > 0 && (
                                <div className="mb-5">
                                    <p className="text-[12px] font-bold text-[var(--mx-color-86868b)] uppercase tracking-wider mb-2.5">Upcoming</p>
                                    <div className="space-y-2">
                                        {otherWeeks.upcoming.map((week) => (
                                            <WeekRow key={week.id} week={week} accent="sky"
                                                onOpen={() => setSelectedWeek(week)}
                                                onEdit={() => openEdit(week)}
                                                onDuplicate={() => openDuplicate(week)}
                                                onDelete={() => handleDelete(week.id)} />
                                        ))}
                                    </div>
                                </div>
                            )}
                            {otherWeeks.past.length > 0 && (
                                <div>
                                    <p className="text-[12px] font-bold text-[var(--mx-color-86868b)] uppercase tracking-wider mb-2.5">History</p>
                                    <div className="space-y-2">
                                        {otherWeeks.past.map((week) => (
                                            <WeekRow key={week.id} week={week} accent="muted"
                                                onOpen={() => setSelectedWeek(week)}
                                                onEdit={() => openEdit(week)}
                                                onDuplicate={() => openDuplicate(week)}
                                                onDelete={() => handleDelete(week.id)} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>
                    )}
                </div>
            )}

            {/* -------- Editor / Import modal -------- */}
            {editorOpen && (
                <div className="fixed inset-0 bg-[var(--mx-color-1d1d1f)]/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
                    <div className="bg-[var(--color-surface)] rounded-t-[32px] sm:rounded-[32px] w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:fade-in-20">
                        {/* Modal header */}
                        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-[var(--mx-color-e5e5ea)]">
                            <h3 className="text-xl sm:text-2xl font-bold text-[var(--mx-color-1d1d1f)] tracking-tight">
                                {editorMode === "edit" ? "Edit Week" : editorMode === "import" ? "Import Plan" : "New Week"}
                            </h3>
                            <button onClick={closeEditor} className="p-2 bg-[var(--mx-color-f5f5f7)] hover:bg-[var(--mx-color-e8e8ed)] rounded-full transition-colors">
                                <FaTimes className="w-4 h-4 text-[var(--mx-color-86868b)]" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
                            {/* INPUT step (import only) */}
                            {editorStep === MODAL_STEP.INPUT ? (
                                <>
                                    <div className="rounded-2xl border border-[var(--mx-color-d2d2d7)] bg-[var(--mx-color-fafafc)] p-4">
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <p className="text-[13px] font-bold text-[var(--mx-color-1d1d1f)]">Paste your JSON below</p>
                                            <button onClick={() => setShowPrompt((s) => !s)} className="text-[12px] font-bold text-sky-700 hover:underline inline-flex items-center gap-1.5">
                                                <FaRegClipboard className="w-3 h-3" /> {showPrompt ? "Hide" : "Get ChatGPT prompt"}
                                            </button>
                                        </div>
                                        {showPrompt && (
                                            <div className="mb-3 rounded-xl border border-[var(--mx-color-d2d2d7)] bg-[var(--color-surface)] p-3">
                                                <p className="text-[12px] text-[var(--mx-color-86868b)] font-medium mb-2">
                                                    Copy this, paste it into ChatGPT, then paste your workout after it. ChatGPT will return JSON that imports perfectly. Copy its JSON reply back here.
                                                </p>
                                                <pre className="text-[11px] leading-relaxed whitespace-pre-wrap text-[var(--mx-color-1d1d1f)] max-h-40 overflow-y-auto bg-[var(--mx-color-f5f5f7)] rounded-lg p-2.5">{CHATGPT_IMPORT_PROMPT}</pre>
                                                <button onClick={copyPrompt} className={`${GHOST_BTN} mt-2 !py-2`}>
                                                    {promptCopied ? <><FaCheck className="w-3 h-3 text-green-600" /> Copied</> : <><FaCopy className="w-3 h-3" /> Copy prompt</>}
                                                </button>
                                            </div>
                                        )}
                                        <textarea
                                            value={importText}
                                            onChange={(e) => setImportText(e.target.value)}
                                            placeholder={"{\n  \"title\": \"Home HIIT\",\n  \"totalTime\": \"30 minutes\",\n  \"exercises\": [\n    {\n      \"name\": \"Marching in Place\",\n      \"amount\": \"2 minutes\",\n      \"points\": [\"Stand normally.\", \"Lift one knee, then the other.\"],\n      \"how\": \"Basically walk without moving forward 😄\",\n      \"why\": \"Warm-up and gets your heart rate up.\"\n    }\n  ]\n}"}
                                            rows={12}
                                            className="w-full rounded-xl border border-[var(--mx-color-d2d2d7)] bg-[var(--color-surface)] p-3 text-[13px] font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/60"
                                        />
                                    </div>
                                    <p className="text-[12px] text-[var(--mx-color-86868b)] font-medium">
                                        Paste the <span className="font-bold">JSON</span> for <span className="font-bold">one day's</span> routine (use the ChatGPT prompt above) — it'll be applied to every workout day you pick next. We'll show a preview so you can review and edit before saving. Nothing is saved until you confirm.
                                    </p>
                                </>
                            ) : (
                                <>
                                    {/* REVIEW / edit step */}
                                    {editorMode === "import" && (
                                        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] text-sky-900 font-medium">
                                            Imported {draftExerciseCount} exercise{draftExerciseCount === 1 ? "" : "s"}. Review below, edit anything, then save.
                                        </div>
                                    )}
                                    {importWarnings.length > 0 && (
                                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900 font-medium space-y-1">
                                            {importWarnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="sm:col-span-1">
                                            <label className="text-[11px] font-bold text-[var(--mx-color-86868b)] uppercase tracking-wider mb-1.5 block">Plan name</label>
                                            <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="e.g. Home HIIT"
                                                className="w-full px-3 py-2.5 rounded-xl border border-[var(--mx-color-d2d2d7)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/60" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold text-[var(--mx-color-86868b)] uppercase tracking-wider mb-1.5 block">Week starts (Mon)</label>
                                            <input type="date" value={draftStart}
                                                onChange={(e) => {
                                                    const picked = fromDateString(e.target.value)
                                                    setDraftStart(picked ? toDateString(mondayOf(picked)) : e.target.value)
                                                }}
                                                className="w-full px-3 py-2.5 rounded-xl border border-[var(--mx-color-d2d2d7)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/60" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold text-[var(--mx-color-86868b)] uppercase tracking-wider mb-1.5 block">Total time</label>
                                            <input value={draftTotal} onChange={(e) => setDraftTotal(e.target.value)} placeholder="optional"
                                                className="w-full px-3 py-2.5 rounded-xl border border-[var(--mx-color-d2d2d7)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/60" />
                                        </div>
                                    </div>
                                    <p className="text-[11px] font-medium text-[var(--mx-color-86868b)] -mt-2">
                                        {weekRangeLabel(draftStart)} · dates auto-snap to Monday.
                                    </p>

                                    {/* Workout vs rest day selector */}
                                    <div className="rounded-2xl border border-[var(--mx-color-d2d2d7)] bg-[var(--mx-color-fafafc)] p-3.5">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[12px] font-bold text-[var(--mx-color-1d1d1f)] uppercase tracking-wider">Workout days</p>
                                            <p className="text-[11px] font-semibold text-[var(--mx-color-86868b)]">
                                                {activeDayCount} active · {7 - activeDayCount} rest
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {WEEKDAYS.map((dayKey) => {
                                                const on = !draftDays[dayKey].rest && draftDays[dayKey].exercises.length > 0
                                                return (
                                                    <button
                                                        key={dayKey}
                                                        type="button"
                                                        onClick={() => toggleWorkoutDay(dayKey)}
                                                        className={`px-3 py-2 rounded-xl text-[12px] font-bold transition-colors ${on
                                                            ? "bg-[var(--mx-color-c6ff00)] text-black"
                                                            : "bg-[var(--color-surface)] text-[var(--mx-color-86868b)] border border-[var(--mx-color-d2d2d7)] hover:bg-[var(--mx-color-f5f5f7)]"
                                                            }`}
                                                    >
                                                        {WEEKDAY_LABELS[dayKey].slice(0, 3)}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                        <p className="text-[11px] font-medium text-[var(--mx-color-86868b)] mt-2">
                                            {schedule.length > 0
                                                ? "Turning a day on fills it with the imported routine. You can still tweak each day below."
                                                : "Toggle which days are workouts. Edit each day's exercises below."}
                                        </p>
                                    </div>

                                    <WeekEditor days={draftDays} onChange={setDraftDays} />
                                </>
                            )}
                        </div>

                        {/* Modal footer */}
                        <div className="p-4 sm:p-5 border-t border-[var(--mx-color-e5e5ea)] flex items-center justify-between gap-2">
                            {editorStep === MODAL_STEP.REVIEW && editorMode !== "create" && editorMode !== "edit" ? (
                                <button onClick={() => setEditorStep(MODAL_STEP.INPUT)} className={GHOST_BTN}>← Back to paste</button>
                            ) : <span />}
                            <div className="flex items-center gap-2">
                                <button onClick={closeEditor} className={GHOST_BTN}>Cancel</button>
                                {editorStep === MODAL_STEP.INPUT ? (
                                    <button onClick={runParse} disabled={!importText.trim()} className={PRIMARY_BTN}>
                                        Parse & preview →
                                    </button>
                                ) : (
                                    <button onClick={handleSave} disabled={saving} className={PRIMARY_BTN}>
                                        {saving ? "Saving…" : "Does this look good? Save"}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* -------- Detail view -------- */}
            {selectedWeek && (
                <div className="fixed inset-0 bg-[var(--mx-color-1d1d1f)]/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
                    <div className="bg-[var(--color-surface)] rounded-t-[32px] sm:rounded-[32px] w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:fade-in-20">
                        <div className="flex items-start justify-between gap-3 p-5 sm:p-6 border-b border-[var(--mx-color-e5e5ea)]">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-xl bg-[var(--mx-color-c6ff00)] text-black flex items-center justify-center shrink-0">
                                        <FaDumbbell className="w-4 h-4" />
                                    </span>
                                    <h3 className="text-[18px] sm:text-[22px] font-bold text-[var(--mx-color-1d1d1f)] tracking-tight truncate">
                                        {selectedWeek.title || "Workout week"}
                                    </h3>
                                </div>
                                <p className="text-[12px] font-semibold text-[var(--mx-color-86868b)] mt-1.5">
                                    {weekRangeLabel(selectedWeek.start_date)}
                                    {selectedWeek.total_time && ` · ${selectedWeek.total_time}`}
                                </p>
                            </div>
                            <button onClick={() => setSelectedWeek(null)} className="p-2 bg-[var(--mx-color-f5f5f7)] hover:bg-[var(--mx-color-e8e8ed)] rounded-full transition-colors shrink-0">
                                <FaTimes className="w-4 h-4 text-[var(--mx-color-86868b)]" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                            <p className="text-[12px] font-bold text-[var(--mx-color-86868b)] uppercase tracking-wider mb-3">Tap a day to view</p>
                            <WeekStrip week={selectedWeek} onOpenDay={(dayKey) => setOpenDay({ week: selectedWeek, dayKey })} />
                        </div>

                        <div className="p-4 sm:p-5 border-t border-[var(--mx-color-e5e5ea)] flex items-center justify-between gap-2">
                            <button onClick={() => openDuplicate(selectedWeek)} className={GHOST_BTN}>
                                <FaCopy className="w-3 h-3" /> Duplicate to this week
                            </button>
                            <button onClick={() => openEdit(selectedWeek)} className={PRIMARY_BTN}>
                                <FaEdit className="w-3 h-3" /> Edit
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* -------- Focused single-day workout view -------- */}
            {openDay && (
                <DayView
                    key={openDay.dayKey}
                    week={openDay.week}
                    dayKey={openDay.dayKey}
                    onChangeDay={(dayKey) => setOpenDay((prev) => ({ ...prev, dayKey }))}
                    onClose={() => setOpenDay(null)}
                />
            )}
        </div>
    )
}

/** Compact one-line week summary used in the Upcoming / History lists. */
function WeekRow({ week, accent, onOpen, onEdit, onDuplicate, onDelete }) {
    const exCount = countExercises(week.days)
    const restCount = WEEKDAYS.filter((d) => week.days[d].rest || week.days[d].exercises.length === 0).length
    const badge = accent === "sky"
        ? "bg-sky-100 text-sky-700"
        : "bg-[var(--mx-color-e8e8ed)] text-[var(--mx-color-86868b)]"
    return (
        <div className="group flex items-center gap-3 rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-f5f5f7)]/40 hover:bg-[var(--mx-color-f5f5f7)] transition-colors p-2.5 sm:p-3">
            <button onClick={onOpen} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${badge}`}>
                    <FaDumbbell className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                    <p className="font-bold text-[14px] text-[var(--mx-color-1d1d1f)] truncate">{week.title || "Workout week"}</p>
                    <p className="text-[12px] font-semibold text-[var(--mx-color-86868b)]">
                        {weekRangeLabel(week.start_date)} · {exCount} exercises · {7 - restCount} active
                    </p>
                </div>
            </button>
            <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button onClick={onDuplicate} title="Duplicate to this week"
                    className="p-2 rounded-lg text-[var(--mx-color-86868b)] hover:text-[var(--mx-color-1d1d1f)] hover:bg-[var(--color-surface)]">
                    <FaCopy className="w-3.5 h-3.5" />
                </button>
                <button onClick={onEdit} title="Edit"
                    className="p-2 rounded-lg text-[var(--mx-color-86868b)] hover:text-[var(--mx-color-1d1d1f)] hover:bg-[var(--color-surface)]">
                    <FaEdit className="w-3.5 h-3.5" />
                </button>
                <button onClick={onDelete} title="Delete"
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50">
                    <FaTrash className="w-3.5 h-3.5" />
                </button>
            </div>
            <FaChevronRight className="w-3.5 h-3.5 text-[var(--mx-color-d2d2d7)] shrink-0 hidden sm:block" />
        </div>
    )
}
