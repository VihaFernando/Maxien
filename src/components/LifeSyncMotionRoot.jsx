import { MotionConfig } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useLifeSync } from '../context/LifeSyncContext'
import {
    isLifeSyncReduceAnimationsEnabled,
    REDUCE_MOTION_PREFERENCE_CHANGED,
} from '../lib/lifeSyncReduceMotion'

/**
 * Global Framer Motion policy + `html` class for CSS. Wrap app content inside `LifeSyncProvider`.
 */
export function LifeSyncMotionRoot({ children }) {
    const { lifeSyncUser } = useLifeSync()
    const [tick, setTick] = useState(0)

    useEffect(() => {
        const on = () => setTick((t) => t + 1)
        window.addEventListener(REDUCE_MOTION_PREFERENCE_CHANGED, on)
        return () => window.removeEventListener(REDUCE_MOTION_PREFERENCE_CHANGED, on)
    }, [])

    const reduce = useMemo(
        () => isLifeSyncReduceAnimationsEnabled(lifeSyncUser?.preferences),
        [lifeSyncUser?.preferences, tick],
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
