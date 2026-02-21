// Utility functions for formatting timestamps in local device time

/**
 * Format ISO timestamp to readable local date+time
 * Example: "Feb 21, 2026 — 3:45 PM"
 * @param {string} timestamp - ISO timestamp string
 * @returns {string} Formatted date and time
 */
export function formatTimestamp(timestamp) {
    if (!timestamp) return "—"
    try {
        const date = new Date(timestamp)
        const dateStr = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        })
        const timeStr = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        })
        return `${dateStr} — ${timeStr}`
    } catch {
        return "—"
    }
}

/**
 * Format ISO timestamp to date only
 * Example: "Feb 21, 2026"
 * @param {string} timestamp - ISO timestamp string
 * @returns {string} Formatted date
 */
export function formatDate(timestamp) {
    if (!timestamp) return "—"
    try {
        const date = new Date(timestamp)
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        })
    } catch {
        return "—"
    }
}

/**
 * Format ISO timestamp to time only
 * Example: "3:45 PM"
 * @param {string} timestamp - ISO timestamp string
 * @returns {string} Formatted time
 */
export function formatTime(timestamp) {
    if (!timestamp) return "—"
    try {
        const date = new Date(timestamp)
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        })
    } catch {
        return "—"
    }
}

/**
 * Get current local time in HH:MM format (for form inputs)
 * @returns {string} Current time in HH:MM format
 */
export function getCurrentTime() {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
}

/**
 * Check if date is today
 * @param {string} timestamp - ISO timestamp string
 * @returns {boolean}
 */
export function isToday(timestamp) {
    if (!timestamp) return false
    const today = new Date()
    const date = new Date(timestamp)
    return today.getFullYear() === date.getFullYear() &&
        today.getMonth() === date.getMonth() &&
        today.getDate() === date.getDate()
}

/**
 * Check if date is in the past
 * @param {string} timestamp - ISO timestamp string
 * @returns {boolean}
 */
export function isPast(timestamp) {
    if (!timestamp) return false
    return new Date(timestamp) < new Date()
}

/**
 * Check if date is in the future
 * @param {string} timestamp - ISO timestamp string
 * @returns {boolean}
 */
export function isFuture(timestamp) {
    if (!timestamp) return false
    return new Date(timestamp) > new Date()
}

/**
 * Get relative time description
 * Example: "2 hours ago", "in 3 days"
 * @param {string} timestamp - ISO timestamp string
 * @returns {string}
 */
export function getRelativeTime(timestamp) {
    if (!timestamp) return "—"
    try {
        const date = new Date(timestamp)
        const now = new Date()
        const diffMs = now - date
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMs < 0) {
            // Future
            const absMins = Math.floor(-diffMs / 60000)
            const absHours = Math.floor(-diffMs / 3600000)
            const absDays = Math.floor(-diffMs / 86400000)

            if (absDays > 0) return `in ${absDays} day${absDays > 1 ? 's' : ''}`
            if (absHours > 0) return `in ${absHours} hour${absHours > 1 ? 's' : ''}`
            if (absMins > 0) return `in ${absMins} min${absMins > 1 ? 's' : ''}`
            return 'just now'
        } else {
            // Past
            if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
            if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
            if (diffMins > 0) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
            return 'just now'
        }
    } catch {
        return "—"
    }
}
