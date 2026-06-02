import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { getLifesyncApiBase, getLifesyncToken } from '../../lib/lifesyncApi'

/**
 * Connects to the server's socket.io progress namespace.
 * - onBatchResult: called when server emits `progress:batch` after a successful batch write
 * - onSyncJob: called when server emits `progress:sync` with sync job state updates
 *
 * @param {{ enabled: boolean, onBatchResult?: (result: object) => void, onSyncJob?: (job: object) => void }} opts
 */
export function useProgressSocket({ enabled, onBatchResult, onSyncJob }) {
    const onBatchResultRef = useRef(onBatchResult)
    const onSyncJobRef = useRef(onSyncJob)
    onBatchResultRef.current = onBatchResult
    onSyncJobRef.current = onSyncJob

    useEffect(() => {
        if (!enabled) return

        const token = getLifesyncToken()
        if (!token) return

        const base = getLifesyncApiBase() || window.location.origin

        const socket = io(base, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnectionDelay: 3000,
            reconnectionDelayMax: 30000,
        })

        socket.on('progress:batch', (data) => {
            onBatchResultRef.current?.(data)
        })

        socket.on('progress:sync', (data) => {
            onSyncJobRef.current?.(data)
        })

        return () => {
            socket.disconnect()
        }
    }, [enabled])
}
