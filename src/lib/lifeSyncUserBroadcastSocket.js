import { io } from 'socket.io-client'
import { getLifesyncApiBase, getLifesyncToken } from './lifesyncApi'

/**
 * Server-wide LifeSync messages (Socket.IO namespace `/lifesync-broadcast`).
 * Any authenticated LifeSync user may connect; only admins can POST a broadcast.
 * @param {{ onBroadcast?: (b: unknown) => void, onConnectError?: (err: Error) => void }} handlers
 * @returns {import('socket.io-client').Socket | null}
 */
export function connectLifeSyncUserBroadcastSocket(handlers = {}) {
    if (typeof window === 'undefined') return null
    const token = getLifesyncToken()
    if (!token) return null

    const base = getLifesyncApiBase() || window.location.origin
    const url = `${String(base).replace(/\/$/, '')}/lifesync-broadcast`

    const socket = io(url, {
        path: '/socket.io',
        auth: { token },
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 8,
        reconnectionDelay: 2000,
    })

    if (handlers.onBroadcast) socket.on('lifesync:broadcast', handlers.onBroadcast)
    if (handlers.onConnectError) {
        socket.on('connect_error', (err) => {
            handlers.onConnectError(err instanceof Error ? err : new Error(String(err?.message || err)))
        })
    }

    return socket
}
