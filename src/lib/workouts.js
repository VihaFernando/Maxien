// Workouts feature helpers: week model, the paste-import parser, and the
// ChatGPT prompt that produces text the parser understands.

export const WEEKDAYS = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
]

export const WEEKDAY_LABELS = {
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
}

// Cheap client-side id for exercises inside JSONB (crypto.randomUUID where available).
export const makeId = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
    return `x_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

/** A fresh, empty week structure: every day present, all resting, no exercises. */
export const emptyDays = () => {
    const days = {}
    for (const day of WEEKDAYS) {
        days[day] = { rest: false, exercises: [] }
    }
    return days
}

/** Normalize a possibly-partial days object from the DB into the full shape. */
export const normalizeDays = (raw) => {
    const base = emptyDays()
    if (!raw || typeof raw !== "object") return base
    for (const day of WEEKDAYS) {
        const src = raw[day]
        if (!src || typeof src !== "object") continue
        base[day] = {
            rest: Boolean(src.rest),
            exercises: Array.isArray(src.exercises)
                ? src.exercises.map((ex) => ({
                    id: ex?.id || makeId(),
                    name: String(ex?.name || "").trim(),
                    amount: ex?.amount ? String(ex.amount).trim() : "",
                    points: Array.isArray(ex?.points)
                        ? ex.points.map((p) => ({
                            text: String(p?.text || ""),
                            kind: p?.kind === "how" || p?.kind === "why" ? p.kind : "point",
                        }))
                        : [],
                    raw: ex?.raw ? String(ex.raw) : "",
                }))
                : [],
        }
    }
    return base
}

// ---------------------------------------------------------------------------
// Date helpers — weeks are Monday-anchored.
// ---------------------------------------------------------------------------

/** Given any Date, return the Monday (local) of that week as a Date at midnight. */
export const mondayOf = (date) => {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    const dow = d.getDay() // 0=Sun … 6=Sat
    const diff = dow === 0 ? -6 : 1 - dow // shift back to Monday
    d.setDate(d.getDate() + diff)
    return d
}

/** "YYYY-MM-DD" in local time (Supabase `date` column, no timezone drift). */
export const toDateString = (date) => {
    const d = new Date(date)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
}

/** Parse a "YYYY-MM-DD" string into a local Date at midnight. */
export const fromDateString = (str) => {
    if (!str) return null
    const [y, m, d] = String(str).split("-").map(Number)
    if (!y || !m || !d) return null
    return new Date(y, m - 1, d)
}

export const addDays = (date, n) => {
    const d = new Date(date)
    d.setDate(d.getDate() + n)
    return d
}

/** Human label for a week, e.g. "Jul 7 – Jul 13, 2026". */
export const weekRangeLabel = (startDateStr) => {
    const start = fromDateString(startDateStr)
    if (!start) return ""
    const end = addDays(start, 6)
    const opts = { month: "short", day: "numeric" }
    const startLabel = start.toLocaleDateString("en-US", opts)
    const endLabel = end.toLocaleDateString("en-US", { ...opts, year: "numeric" })
    return `${startLabel} – ${endLabel}`
}

// ---------------------------------------------------------------------------
// Import parser — ONE day's schedule as JSON from ChatGPT. No day names.
//
// The imported schedule is applied to every workout day the user selects.
// Expected JSON shape (extra text around it, and ```json fences, are tolerated):
//
//   {
//     "title": "My Home HIIT",              // optional
//     "totalTime": "30 minutes",            // optional
//     "exercises": [
//       {
//         "name": "Marching in Place",
//         "amount": "2 minutes",            // optional reps/time
//         "points": [                       // instruction steps (optional)
//           "Stand normally.",
//           "Lift one knee, then the other."
//         ],
//         "how": "Basically walk without moving forward 😂",  // optional
//         "why": "Warm-up and gets your heart rate up."       // optional
//       }
//     ]
//   }
//
// `points` items may also be objects like { "text": "...", "kind": "how" }.
// ---------------------------------------------------------------------------

/** Pull the first balanced JSON object out of arbitrary pasted text. */
const extractJsonObject = (text) => {
    if (!text) return null
    // Strip markdown code fences if present.
    let s = text.replace(/```(?:json)?/gi, "").trim()

    const start = s.indexOf("{")
    if (start === -1) return null

    // Walk to the matching closing brace, respecting strings/escapes.
    let depth = 0
    let inStr = false
    let esc = false
    for (let i = start; i < s.length; i++) {
        const ch = s[i]
        if (inStr) {
            if (esc) esc = false
            else if (ch === "\\") esc = true
            else if (ch === '"') inStr = false
            continue
        }
        if (ch === '"') inStr = true
        else if (ch === "{") depth++
        else if (ch === "}") {
            depth--
            if (depth === 0) return s.slice(start, i + 1)
        }
    }
    return null
}

const normalizePoints = (rawPoints) => {
    if (!Array.isArray(rawPoints)) return []
    return rawPoints
        .map((p) => {
            if (typeof p === "string") return { text: p.trim(), kind: "point" }
            if (p && typeof p === "object") {
                const kind = p.kind === "how" || p.kind === "why" ? p.kind : "point"
                return { text: String(p.text ?? "").trim(), kind }
            }
            return null
        })
        .filter((p) => p && p.text)
}

/**
 * Parse pasted JSON into { title, totalTime, exercises, warnings }.
 * `exercises` is a flat list applied to every workout day.
 * Never throws; problems are surfaced via `warnings`.
 */
export function parseWorkoutImport(rawText) {
    const result = { title: "", totalTime: "", exercises: [], warnings: [] }

    const jsonStr = extractJsonObject(String(rawText || ""))
    if (!jsonStr) {
        result.warnings.push("Couldn't find any JSON. Paste the JSON object ChatGPT gives you (it should start with \"{\").")
        return result
    }

    let data
    try {
        data = JSON.parse(jsonStr)
    } catch {
        result.warnings.push("The text isn't valid JSON. Re-copy ChatGPT's reply, or ask it to \"return only valid JSON\".")
        return result
    }

    if (data && typeof data.title === "string") result.title = data.title.trim()
    if (data && typeof data.totalTime === "string") result.totalTime = data.totalTime.trim()
    // Tolerate common alternate key.
    if (!result.totalTime && data && typeof data.total_time === "string") result.totalTime = data.total_time.trim()

    const list = Array.isArray(data?.exercises) ? data.exercises : null
    if (!list) {
        result.warnings.push("JSON is missing an \"exercises\" array.")
        return result
    }

    for (const raw of list) {
        if (!raw || typeof raw !== "object") continue
        const name = String(raw.name ?? raw.exercise ?? "").trim()
        if (!name) continue

        const points = normalizePoints(raw.points)
        // how/why may be given as top-level fields; append them as tagged points.
        if (typeof raw.how === "string" && raw.how.trim()) points.push({ text: raw.how.trim(), kind: "how" })
        if (typeof raw.why === "string" && raw.why.trim()) points.push({ text: raw.why.trim(), kind: "why" })

        result.exercises.push({
            id: makeId(),
            name,
            amount: String(raw.amount ?? raw.reps ?? raw.time ?? "").trim(),
            points,
            raw: JSON.stringify(raw),
        })
    }

    if (!result.exercises.length) {
        result.warnings.push("No exercises with a \"name\" were found in the JSON.")
    }

    return result
}

/** Build a days object: fill `exercises` into each selected workout day. */
export const buildDaysFromSchedule = (exercises, workoutDaySet) => {
    const days = emptyDays()
    for (const day of WEEKDAYS) {
        const isWorkout = workoutDaySet.has(day)
        days[day] = {
            rest: !isWorkout,
            // Fresh ids per day so each day edits independently.
            exercises: isWorkout ? exercises.map((ex) => ({ ...ex, id: makeId() })) : [],
        }
    }
    return days
}

/** Default workout-day selection: Mon–Fri on, weekend rest. */
export const defaultWorkoutDays = () =>
    new Set(["monday", "tuesday", "wednesday", "thursday", "friday"])

/** Count exercises across a days object (for summaries). */
export const countExercises = (days) =>
    WEEKDAYS.reduce((sum, d) => sum + (days?.[d]?.exercises?.length || 0), 0)

/** Deep-clone days and assign fresh exercise ids (used when duplicating). */
export const cloneDaysWithNewIds = (days) => {
    const norm = normalizeDays(days)
    for (const day of WEEKDAYS) {
        norm[day].exercises = norm[day].exercises.map((ex) => ({ ...ex, id: makeId() }))
    }
    return norm
}

// The prompt the user pastes into ChatGPT so its output matches this parser.
// ChatGPT returns ONE day's routine as strict JSON — it gets applied to every
// workout day. No day names. Keep the user's content, emoji, and links intact.
export const CHATGPT_IMPORT_PROMPT = `Convert my daily workout routine into JSON that exactly matches the schema below, so I can import it into my app. This is ONE day's routine that I'll repeat across the week — do NOT add day names or weekdays. Keep my content, symbols, emoji, and links exactly as they are.

Return ONLY the JSON object — no explanation, no markdown, no code fences.

Schema:
{
  "title": "short name for the routine (optional)",
  "totalTime": "total time for the routine, e.g. \\"30 minutes\\" (optional)",
  "exercises": [
    {
      "name": "Exercise name",
      "amount": "reps or time, e.g. \\"2 minutes\\" or \\"20 reps\\" (optional, empty string if none)",
      "points": [
        "First instruction step",
        "Second instruction step"
      ],
      "how": "the How explanation (optional)",
      "why": "the Why explanation (optional)"
    }
  ]
}

Rules:
- "exercises" is an array with one object per exercise, in order.
- Put each instruction as a separate string in "points".
- Put the How/Why explanations in the "how" and "why" fields (not inside "points").
- Use "" for any optional field that doesn't apply. Do not invent content.
- Output must be valid JSON (double-quoted keys and strings).

Here is my workout:
`
