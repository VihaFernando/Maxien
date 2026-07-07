import { FaBed, FaDumbbell, FaCheck } from "react-icons/fa"
import { WEEKDAYS, WEEKDAY_LABELS, fromDateString, addDays, toDateString } from "../../lib/workouts"

const todayStr = () => toDateString(new Date())

/**
 * Row of 7 clickable day tiles for a week. Rest days are muted; today is
 * ringed; workout days show their exercise count and open on click.
 */
export default function WeekStrip({ week, onOpenDay }) {
    const today = todayStr()
    return (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
            {WEEKDAYS.map((dayKey, i) => {
                const day = week.days[dayKey]
                const isRest = day.rest || day.exercises.length === 0
                const dateObj = fromDateString(week.start_date)
                const thisDate = dateObj ? addDays(dateObj, i) : null
                const isToday = thisDate && toDateString(thisDate) === today
                const dateLabel = thisDate ? thisDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""

                return (
                    <button
                        key={dayKey}
                        onClick={() => onOpenDay(dayKey)}
                        className={`group relative text-left rounded-2xl border p-3 sm:p-3.5 transition-all duration-200 active:scale-[0.98] ${isRest
                            ? "border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-f5f5f7)]/60 hover:bg-[var(--mx-color-f5f5f7)]"
                            : "border-[var(--mx-color-d2d2d7)] bg-[var(--color-surface)] hover:border-[var(--mx-color-a8db00)] hover:shadow-md"
                        } ${isToday ? "ring-2 ring-[var(--mx-color-c6ff00)] ring-offset-1 ring-offset-[var(--color-surface)]" : ""}`}
                    >
                        <div className="flex items-center justify-between">
                            <span className={`text-[12px] font-black uppercase tracking-wider ${isToday ? "text-[var(--mx-color-1d1d1f)]" : "text-[var(--mx-color-86868b)]"}`}>
                                {WEEKDAY_LABELS[dayKey].slice(0, 3)}
                            </span>
                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${isRest
                                ? "bg-[var(--mx-color-e8e8ed)] text-[var(--mx-color-86868b)]"
                                : "bg-[var(--mx-color-c6ff00)] text-black"
                                }`}>
                                {isRest ? <FaBed className="w-3 h-3" /> : <FaDumbbell className="w-3 h-3" />}
                            </span>
                        </div>

                        <p className="text-[11px] font-semibold text-[var(--mx-color-86868b)] mt-1">{dateLabel}</p>

                        {isRest ? (
                            <p className="mt-3 text-[13px] font-bold text-[var(--mx-color-86868b)]">Rest</p>
                        ) : (
                            <>
                                <p className="mt-3 text-[22px] sm:text-[26px] font-black text-[var(--mx-color-1d1d1f)] leading-none">
                                    {day.exercises.length}
                                </p>
                                <p className="text-[11px] font-bold text-[var(--mx-color-86868b)] mt-0.5">
                                    {day.exercises.length === 1 ? "exercise" : "exercises"}
                                </p>
                            </>
                        )}

                        {isToday && (
                            <span className="absolute top-2 right-2 sm:static sm:mt-2 sm:inline-block text-[9px] font-black px-1.5 py-0.5 rounded-full bg-[var(--mx-color-c6ff00)] text-black">
                                TODAY
                            </span>
                        )}
                    </button>
                )
            })}
        </div>
    )
}
