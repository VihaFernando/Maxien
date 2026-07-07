import { FaPlus, FaTrash, FaBed, FaDumbbell, FaGripVertical } from "react-icons/fa"
import { WEEKDAYS, WEEKDAY_LABELS, makeId } from "../../lib/workouts"

const KIND_META = {
    how: { label: "How", cls: "bg-sky-100 text-sky-800 border-sky-200" },
    why: { label: "Why", cls: "bg-amber-100 text-amber-800 border-amber-200" },
    point: { label: "Step", cls: "bg-[var(--mx-color-f5f5f7)] text-[var(--mx-color-86868b)] border-[var(--mx-color-d2d2d7)]" },
}

const fieldCls =
    "w-full px-3 py-2 rounded-lg border border-[var(--mx-color-d2d2d7)] text-sm bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/60 focus:border-transparent"

/**
 * Editable view of a week's `days`. Fully controlled: parent owns `days`
 * state and passes `onChange(newDays)`. Used by the create/import review
 * and the duplicate-week review so behaviour is identical everywhere.
 */
export default function WeekEditor({ days, onChange }) {
    const patchDay = (dayKey, patch) => {
        onChange({ ...days, [dayKey]: { ...days[dayKey], ...patch } })
    }

    const patchExercise = (dayKey, exId, patch) => {
        patchDay(dayKey, {
            exercises: days[dayKey].exercises.map((ex) =>
                ex.id === exId ? { ...ex, ...patch } : ex,
            ),
        })
    }

    const toggleRest = (dayKey) => {
        const day = days[dayKey]
        // Turning on rest keeps exercises (so it can be undone) but marks the day.
        patchDay(dayKey, { rest: !day.rest })
    }

    const addExercise = (dayKey) => {
        patchDay(dayKey, {
            rest: false,
            exercises: [
                ...days[dayKey].exercises,
                { id: makeId(), name: "", amount: "", points: [], raw: "" },
            ],
        })
    }

    const removeExercise = (dayKey, exId) => {
        patchDay(dayKey, {
            exercises: days[dayKey].exercises.filter((ex) => ex.id !== exId),
        })
    }

    const addPoint = (dayKey, exId, kind = "point") => {
        const ex = days[dayKey].exercises.find((e) => e.id === exId)
        if (!ex) return
        patchExercise(dayKey, exId, { points: [...ex.points, { text: "", kind }] })
    }

    const patchPoint = (dayKey, exId, idx, patch) => {
        const ex = days[dayKey].exercises.find((e) => e.id === exId)
        if (!ex) return
        patchExercise(dayKey, exId, {
            points: ex.points.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
        })
    }

    const removePoint = (dayKey, exId, idx) => {
        const ex = days[dayKey].exercises.find((e) => e.id === exId)
        if (!ex) return
        patchExercise(dayKey, exId, { points: ex.points.filter((_, i) => i !== idx) })
    }

    return (
        <div className="space-y-3">
            {WEEKDAYS.map((dayKey) => {
                const day = days[dayKey]
                const isRest = day.rest
                return (
                    <div
                        key={dayKey}
                        className={`rounded-2xl border p-3.5 sm:p-4 transition-colors ${isRest
                            ? "border-[var(--mx-color-d2d2d7)]/60 bg-[var(--mx-color-f5f5f7)]/50"
                            : "border-[var(--mx-color-d2d2d7)] bg-[var(--color-surface)]"
                            }`}
                    >
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                                <span
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${isRest ? "bg-[var(--mx-color-e8e8ed)] text-[var(--mx-color-86868b)]" : "bg-[var(--mx-color-c6ff00)]/60 text-black"
                                        }`}
                                >
                                    {isRest ? <FaBed className="w-3.5 h-3.5" /> : <FaDumbbell className="w-3.5 h-3.5" />}
                                </span>
                                <h4 className="font-bold text-[15px] text-[var(--mx-color-1d1d1f)]">
                                    {WEEKDAY_LABELS[dayKey]}
                                </h4>
                                {!isRest && (
                                    <span className="text-[11px] font-semibold text-[var(--mx-color-86868b)]">
                                        {day.exercises.length} {day.exercises.length === 1 ? "exercise" : "exercises"}
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => toggleRest(dayKey)}
                                className={`px-2.5 py-1.5 rounded-lg text-[12px] font-bold border transition-colors ${isRest
                                    ? "bg-[var(--mx-color-c6ff00)] text-black border-transparent"
                                    : "bg-[var(--color-surface)] text-[var(--mx-color-86868b)] border-[var(--mx-color-d2d2d7)] hover:bg-[var(--mx-color-f5f5f7)]"
                                    }`}
                            >
                                {isRest ? "Rest day" : "Mark rest"}
                            </button>
                        </div>

                        {isRest ? (
                            <p className="text-[13px] text-[var(--mx-color-86868b)] font-medium pl-1">
                                Rest & recover. {day.exercises.length > 0 && "(Exercises hidden — unmark rest to restore.)"}
                            </p>
                        ) : (
                            <div className="space-y-2.5">
                                {day.exercises.map((ex, exIdx) => (
                                    <div
                                        key={ex.id}
                                        className="rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafc)] p-3"
                                    >
                                        <div className="flex items-start gap-2">
                                            <span className="mt-2 text-[var(--mx-color-c9c9ce)]">
                                                <FaGripVertical className="w-3 h-3" />
                                            </span>
                                            <span className="mt-2 text-[13px] font-bold text-[var(--mx-color-86868b)] w-5 shrink-0">
                                                {exIdx + 1}.
                                            </span>
                                            <div className="flex-1 min-w-0 space-y-2">
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <input
                                                        value={ex.name}
                                                        onChange={(e) => patchExercise(dayKey, ex.id, { name: e.target.value })}
                                                        placeholder="Exercise name"
                                                        className={`${fieldCls} font-semibold sm:flex-1`}
                                                    />
                                                    <input
                                                        value={ex.amount}
                                                        onChange={(e) => patchExercise(dayKey, ex.id, { amount: e.target.value })}
                                                        placeholder="reps / time"
                                                        className={`${fieldCls} sm:w-40`}
                                                    />
                                                </div>

                                                {ex.points.length > 0 && (
                                                    <div className="space-y-1.5">
                                                        {ex.points.map((pt, idx) => {
                                                            const meta = KIND_META[pt.kind] || KIND_META.point
                                                            return (
                                                                <div key={idx} className="flex items-center gap-1.5">
                                                                    <select
                                                                        value={pt.kind}
                                                                        onChange={(e) => patchPoint(dayKey, ex.id, idx, { kind: e.target.value })}
                                                                        className={`text-[11px] font-bold rounded-md border px-1.5 py-1 shrink-0 ${meta.cls}`}
                                                                    >
                                                                        <option value="point">Step</option>
                                                                        <option value="how">How</option>
                                                                        <option value="why">Why</option>
                                                                    </select>
                                                                    <input
                                                                        value={pt.text}
                                                                        onChange={(e) => patchPoint(dayKey, ex.id, idx, { text: e.target.value })}
                                                                        placeholder="Instruction…"
                                                                        className={`${fieldCls} py-1.5 text-[13px]`}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removePoint(dayKey, ex.id, idx)}
                                                                        className="p-1.5 rounded-md text-[var(--mx-color-86868b)] hover:text-red-500 hover:bg-red-50 shrink-0"
                                                                        title="Remove"
                                                                    >
                                                                        <FaTrash className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}

                                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                                    <button type="button" onClick={() => addPoint(dayKey, ex.id, "point")}
                                                        className="text-[11px] font-bold px-2 py-1 rounded-md bg-[var(--mx-color-f5f5f7)] text-[var(--mx-color-1d1d1f)] hover:bg-[var(--mx-color-e8e8ed)]">
                                                        + Step
                                                    </button>
                                                    <button type="button" onClick={() => addPoint(dayKey, ex.id, "how")}
                                                        className="text-[11px] font-bold px-2 py-1 rounded-md bg-sky-50 text-sky-700 hover:bg-sky-100">
                                                        + How
                                                    </button>
                                                    <button type="button" onClick={() => addPoint(dayKey, ex.id, "why")}
                                                        className="text-[11px] font-bold px-2 py-1 rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100">
                                                        + Why
                                                    </button>
                                                    <button type="button" onClick={() => removeExercise(dayKey, ex.id)}
                                                        className="ml-auto text-[11px] font-bold px-2 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100 inline-flex items-center gap-1">
                                                        <FaTrash className="w-2.5 h-2.5" /> Remove
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={() => addExercise(dayKey)}
                                    className="w-full py-2 rounded-xl border border-dashed border-[var(--mx-color-d2d2d7)] text-[13px] font-bold text-[var(--mx-color-86868b)] hover:border-[var(--mx-color-c6ff00)] hover:text-[var(--mx-color-1d1d1f)] transition-colors inline-flex items-center justify-center gap-1.5"
                                >
                                    <FaPlus className="w-3 h-3" /> Add exercise
                                </button>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
