const STORAGE_PREFIX = 'maxien_lifesync_tv_filters:'

export function loadTVSectionFilters(sectionId, defaults) {
    const fallback = { ...defaults, search: defaults?.search || '' }
    if (typeof localStorage === 'undefined') return fallback
    try {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}${sectionId}`)
        if (!raw) return fallback
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed !== 'object') return fallback
        return { ...defaults, ...parsed, search: defaults?.search || '' }
    } catch {
        return fallback
    }
}

export function saveTVSectionFilters(sectionId, filters) {
    if (typeof localStorage === 'undefined') return
    try {
        const next = { ...(filters || {}) }
        delete next.search
        localStorage.setItem(`${STORAGE_PREFIX}${sectionId}`, JSON.stringify(next))
    } catch {
        // Ignore storage failures.
    }
}

export function resetTVSectionFilters(sectionId) {
    if (typeof localStorage === 'undefined') return
    try {
        localStorage.removeItem(`${STORAGE_PREFIX}${sectionId}`)
    } catch {
        // Ignore storage failures.
    }
}
