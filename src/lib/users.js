import { supabase } from "./supabase"

export async function getUsersByIds(ids) {
    if (!ids || ids.length === 0) return []
    const { data, error } = await supabase
        .from("user_profiles")
        .select("id, email, user_metadata")
        .in("id", ids)

    if (error) throw error
    return data || []
}

export function getDisplayName(user) {
    return (
        user?.user_metadata?.display_name ||
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        user?.email ||
        user?.id
    )
}
