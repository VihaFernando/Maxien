import { MotionConfig } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useLifeSync } from '../context/LifeSyncContext'
import {
    isLifeSyncReduceAnimationsEnabled,
    REDUCE_MOTION_PREFERENCE_CHANGED,
} from '../lib/lifeSyncReduceMotion'
import {
    APP_THEME_PREFERENCE_CHANGED,
    applyAppThemePreference,
    getAppThemePreference,
    writeStoredAppThemePreference,
} from '../lib/appTheme'

/**
 * Global Framer Motion policy + `html` class for CSS. Wrap app content inside `LifeSyncProvider`.
 */
export function LifeSyncMotionRoot({ children }) {
    const { lifeSyncUser } = useLifeSync()
    const [tick, setTick] = useState(0)
    const [themeTick, setThemeTick] = useState(0)

    useEffect(() => {
        const on = () => setTick((t) => t + 1)
        window.addEventListener(REDUCE_MOTION_PREFERENCE_CHANGED, on)
        return () => window.removeEventListener(REDUCE_MOTION_PREFERENCE_CHANGED, on)
    }, [])

    useEffect(() => {
        const on = () => setThemeTick((t) => t + 1)
        window.addEventListener(APP_THEME_PREFERENCE_CHANGED, on)
        return () => window.removeEventListener(APP_THEME_PREFERENCE_CHANGED, on)
    }, [])

    const reduce = useMemo(
        () => isLifeSyncReduceAnimationsEnabled(lifeSyncUser?.preferences),
        [lifeSyncUser?.preferences, tick],
    )
    const appThemePreference = useMemo(
        () => getAppThemePreference(lifeSyncUser?.preferences),
        [lifeSyncUser?.preferences, themeTick],
    )

    useEffect(() => {
        document.documentElement.classList.toggle('maxien-reduce-motion', reduce)
        return () => document.documentElement.classList.remove('maxien-reduce-motion')
    }, [reduce])

    useEffect(() => {
        writeStoredAppThemePreference(appThemePreference)
        applyAppThemePreference(appThemePreference)

        if (appThemePreference !== 'system') return undefined
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined

        const media = window.matchMedia('(prefers-color-scheme: dark)')
        const onSystemThemeChange = () => applyAppThemePreference('system')

        if (typeof media.addEventListener === 'function') {
            media.addEventListener('change', onSystemThemeChange)
            return () => media.removeEventListener('change', onSystemThemeChange)
        }

        media.addListener(onSystemThemeChange)
        return () => media.removeListener(onSystemThemeChange)
    }, [appThemePreference])

    return (
        <MotionConfig reducedMotion={reduce ? 'always' : 'user'}>
            {children}
        </MotionConfig>
    )
}
