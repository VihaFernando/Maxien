import { useEffect, useMemo, useState } from 'react'
import {
    ensureProgressStoreReady,
    flushProgressQueue,
    persistProgressLocal,
    pickLocalResumeCandidate,
    scheduleProgressFlush,
    startProgressBackgroundSync,
    stopProgressBackgroundSync,
} from './progressSyncService'

/**
 * Local-first manga progress hook.
 * - In-memory state for instant updates
 * - IndexedDB-backed queue persistence
 * - Background / online flush orchestration
 */
export function useMangaProgress({ enabled }) {
    const [ready, setReady] = useState(false)

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            await ensureProgressStoreReady()
            if (!cancelled) setReady(true)
        })()
        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        if (!enabled) return undefined

        startProgressBackgroundSync()

        const onOnline = () => {
            void flushProgressQueue().catch(() => {})
        }
        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                void flushProgressQueue().catch(() => {})
            }
        }

        window.addEventListener('online', onOnline)
        document.addEventListener('visibilitychange', onVisible)

        return () => {
            window.removeEventListener('online', onOnline)
            document.removeEventListener('visibilitychange', onVisible)
            stopProgressBackgroundSync()
        }
    }, [enabled])

    return useMemo(() => ({
        ready,
        persistLocal: persistProgressLocal,
        flushNow: flushProgressQueue,
        scheduleFlush: scheduleProgressFlush,
        pickLocalResume: pickLocalResumeCandidate,
    }), [ready])
}
