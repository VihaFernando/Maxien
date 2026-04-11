/**
 * Roles come from `GET /api/auth/me` and auth login responses (`roles.lifeSyncAdmin` / legacy `animeDataAdmin`).
 * The API still enforces admin on every `/api/admin/*` call — never trust the client alone.
 */
export function isLifeSyncAdmin(user) {
    if (!user || typeof user !== 'object') return false
    return Boolean(user.roles?.lifeSyncAdmin || user.roles?.animeDataAdmin)
}
