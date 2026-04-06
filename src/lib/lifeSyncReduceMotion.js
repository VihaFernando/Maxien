/** @type {string} */
export const REDUCE_MOTION_PREFERENCE_CHANGED = 'maxien-reduce-motion-preference-changed'

const STORAGE_KEY = 'maxien.reduceAnimations'

export function readStoredReduceAnimationsSetting() {
    if (typeof localStorage === 'undefined') return null
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === '1' || v === 'true') return true
    if (v === '0' || v === 'false') return false
    return null
}

export function writeStoredReduceAnimationsSetting(enabled) {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
}

/**
 * When true, Framer Motion uses reduced motion and hub CSS strips decorative animation.
 * Server preference wins when present; otherwise falls back to local storage (survives APIs that omit the field).
 */
export function isLifeSyncReduceAnimationsEnabled(prefs) {
    if (prefs && typeof prefs.reduceAnimations === 'boolean') return prefs.reduceAnimations
    const stored = readStoredReduceAnimationsSetting()
    if (stored != null) return stored
    return false
}

export function notifyReduceMotionPreferenceChanged() {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent(REDUCE_MOTION_PREFERENCE_CHANGED))
}
