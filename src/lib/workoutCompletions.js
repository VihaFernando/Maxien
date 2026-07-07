// Supabase access for per-date workout exercise completions.
// Kept separate from workouts.js so the parser stays dependency-free/testable.

import { supabase } from "./supabase"

/**
 * Fetch the set of completed exercise ids for a given week + date.
 * Returns a Set<string> of exercise_id.
 */
export async function fetchCompletions(userId, weekId, dateStr) {
    if (!userId || !weekId || !dateStr) return new Set()
    const { data, error } = await supabase
        .from("workout_completions")
        .select("exercise_id")
        .eq("user_id", userId)
        .eq("week_id", weekId)
        .eq("completion_date", dateStr)
    if (error) throw error
    return new Set((data || []).map((r) => r.exercise_id))
}

/** Mark an exercise done for a date (idempotent via unique index). */
export async function markCompletion(userId, weekId, dateStr, exerciseId) {
    const { error } = await supabase
        .from("workout_completions")
        .upsert(
            { user_id: userId, week_id: weekId, completion_date: dateStr, exercise_id: exerciseId },
            { onConflict: "user_id,completion_date,exercise_id", ignoreDuplicates: true },
        )
    if (error) throw error
}

/** Remove a completion (un-check). */
export async function clearCompletion(userId, weekId, dateStr, exerciseId) {
    const { error } = await supabase
        .from("workout_completions")
        .delete()
        .eq("user_id", userId)
        .eq("week_id", weekId)
        .eq("completion_date", dateStr)
        .eq("exercise_id", exerciseId)
    if (error) throw error
}
