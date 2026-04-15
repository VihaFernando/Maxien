/**
 * Roles come from `GET /api/v1/auth/me` and auth login responses (`roles.lifeSyncAdmin` / legacy `animeDataAdmin`).
 * Server-side authorization is always source-of-truth.
 */
export function isLifeSyncAdmin(user) {
    if (!user || typeof user !== 'object') return false
    return Boolean(user.roles?.lifeSyncAdmin || user.roles?.animeDataAdmin)
}
