export const CONTROLLER_SUPPORT_STORAGE_KEY = 'maxien.controllerSupportEnabled'
export const CONTROLLER_SUPPORT_PREFERENCE_CHANGED = 'maxien-controller-support-preference-changed'

export function readControllerSupportEnabled() {
    if (typeof localStorage === 'undefined') return false
    const raw = localStorage.getItem(CONTROLLER_SUPPORT_STORAGE_KEY)
    return raw === '1' || raw === 'true'
}

export function notifyControllerSupportPreferenceChanged() {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent(CONTROLLER_SUPPORT_PREFERENCE_CHANGED))
}

export function writeControllerSupportEnabled(enabled) {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(CONTROLLER_SUPPORT_STORAGE_KEY, enabled ? '1' : '0')
    notifyControllerSupportPreferenceChanged()
}
