import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLifeSync } from './LifeSyncContext'
import {
    APP_THEME_PREFERENCE_CHANGED,
    applyAppThemePreference,
    getAppThemePreference,
    normalizeAppThemePreference,
    notifyAppThemePreferenceChanged,
    resolveAppTheme,
    writeStoredAppThemePreference,
} from '../lib/appTheme'

const AppThemeContext = createContext(null)

export function AppThemeProvider({ children }) {
    const { lifeSyncUser } = useLifeSync()
    const [themeTick, setThemeTick] = useState(0)
    const [resolvedTheme, setResolvedTheme] = useState(() => (
        resolveAppTheme(getAppThemePreference(null))
    ))

    useEffect(() => {
        const onThemePreferenceChanged = () => setThemeTick((t) => t + 1)
        window.addEventListener(APP_THEME_PREFERENCE_CHANGED, onThemePreferenceChanged)
        return () => window.removeEventListener(APP_THEME_PREFERENCE_CHANGED, onThemePreferenceChanged)
    }, [])

    const themePreference = useMemo(
        () => getAppThemePreference(lifeSyncUser?.preferences),
        [lifeSyncUser?.preferences, themeTick],
    )

    useEffect(() => {
        writeStoredAppThemePreference(themePreference)
        const applied = applyAppThemePreference(themePreference)
        setResolvedTheme(applied.resolved)

        if (themePreference !== 'system') return undefined
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined

        const media = window.matchMedia('(prefers-color-scheme: dark)')
        const onSystemThemeChange = () => {
            const next = applyAppThemePreference('system')
            setResolvedTheme(next.resolved)
        }

        if (typeof media.addEventListener === 'function') {
            media.addEventListener('change', onSystemThemeChange)
            return () => media.removeEventListener('change', onSystemThemeChange)
        }

        media.addListener(onSystemThemeChange)
        return () => media.removeListener(onSystemThemeChange)
    }, [themePreference])

    const setThemePreference = useCallback((nextPreference) => {
        const normalized = normalizeAppThemePreference(nextPreference) || 'system'
        writeStoredAppThemePreference(normalized)
        const applied = applyAppThemePreference(normalized)
        setResolvedTheme(applied.resolved)
        notifyAppThemePreferenceChanged()
    }, [])

    const value = useMemo(() => ({
        themePreference,
        resolvedTheme,
        setThemePreference,
    }), [resolvedTheme, setThemePreference, themePreference])

    return (
        <AppThemeContext.Provider value={value}>
            {children}
        </AppThemeContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppTheme() {
    const ctx = useContext(AppThemeContext)
    if (!ctx) {
        throw new Error('useAppTheme must be used within an AppThemeProvider')
    }
    return ctx
}
