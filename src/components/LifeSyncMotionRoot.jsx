import { MotionConfig } from 'framer-motion'
import { useEffect, useSyncExternalStore } from 'react'
import { useLifeSync } from '../context/LifeSyncContext'
import {
    isLifeSyncReduceAnimationsEnabled,
    REDUCE_MOTION_PREFERENCE_CHANGED,
} from '../lib/lifeSyncReduceMotion'

function subscribeReduceMotionPreference(onStoreChange) {
    if (typeof window === 'undefined') return () => {}
    window.addEventListener(REDUCE_MOTION_PREFERENCE_CHANGED, onStoreChange)
    return () => window.removeEventListener(REDUCE_MOTION_PREFERENCE_CHANGED, onStoreChange)
}

function getServerSnapshot() {
    return false
}

/**
 * Global Framer Motion policy + `html` class for CSS. Wrap app content inside `LifeSyncProvider`.
 */
export function LifeSyncMotionRoot({ children }) {
    const { lifeSyncUser } = useLifeSync()
    const reduce = useSyncExternalStore(
        subscribeReduceMotionPreference,
        () => isLifeSyncReduceAnimationsEnabled(lifeSyncUser?.preferences),
        getServerSnapshot,
    )

    useEffect(() => {
        document.documentElement.classList.toggle('maxien-reduce-motion', reduce)
        return () => document.documentElement.classList.remove('maxien-reduce-motion')
    }, [reduce])

    return (
        <MotionConfig reducedMotion={reduce ? 'always' : 'user'}>
            {children}
        </MotionConfig>
    )
}
