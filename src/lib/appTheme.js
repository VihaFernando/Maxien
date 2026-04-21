export const APP_THEME_PREFERENCE_CHANGED = 'maxien-app-theme-preference-changed'

const STORAGE_KEY = 'maxien.appTheme'
const ALLOWED = new Set(['system', 'light', 'dark'])

export function normalizeAppThemePreference(value) {
    const raw = String(value || '').trim().toLowerCase()
    return ALLOWED.has(raw) ? raw : null
}

export function readStoredAppThemePreference() {
    if (typeof localStorage === 'undefined') return null
    return normalizeAppThemePreference(localStorage.getItem(STORAGE_KEY))
}

export function writeStoredAppThemePreference(preference) {
    if (typeof localStorage === 'undefined') return
    const normalized = normalizeAppThemePreference(preference) || 'system'
    localStorage.setItem(STORAGE_KEY, normalized)
}

export function getAppThemePreference(prefs) {
    const serverValue = normalizeAppThemePreference(prefs?.appTheme)
    if (serverValue) return serverValue
    return readStoredAppThemePreference() || 'system'
}

export function resolveAppTheme(preference) {
    const normalized = normalizeAppThemePreference(preference) || 'system'
    if (normalized === 'light' || normalized === 'dark') return normalized

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'light'
}

export function applyAppThemePreference(preference) {
    const normalized = normalizeAppThemePreference(preference) || 'system'
    const resolved = resolveAppTheme(normalized)

    if (typeof document !== 'undefined') {
        const root = document.documentElement
        root.dataset.maxienThemePreference = normalized
        root.dataset.maxienTheme = resolved
        root.style.colorScheme = resolved
        root.classList.toggle('maxien-theme-dark', resolved === 'dark')
    }

    return { preference: normalized, resolved }
}

export function notifyAppThemePreferenceChanged() {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent(APP_THEME_PREFERENCE_CHANGED))
}

