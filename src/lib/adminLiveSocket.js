import { io } from 'socket.io-client'
import { getLifesyncApiBase, getLifesyncToken } from './lifesyncApi'

/**
 * Live admin dashboard stream: server time + process stats (Socket.IO namespace `/admin`).
 * @param {{ onProcess?: (p: unknown) => void, onHello?: (h: unknown) => void, onConnectError?: (err: Error) => void }} handlers
 * @returns {import('socket.io-client').Socket | null}
 */
export function connectAdminLiveSocket(handlers = {}) {
    if (typeof window === 'undefined') return null
    const token = getLifesyncToken()
    if (!token) return null

    const base = getLifesyncApiBase() || window.location.origin
    const url = `${String(base).replace(/\/$/, '')}/admin`

    const socket = io(url, {
        path: '/socket.io',
        auth: { token },
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 8,
        reconnectionDelay: 2000,
    })

    if (handlers.onProcess) socket.on('admin:process', handlers.onProcess)
    if (handlers.onHello) socket.on('admin:hello', handlers.onHello)
    if (handlers.onConnectError) {
        socket.on('connect_error', (err) => {
            handlers.onConnectError(err instanceof Error ? err : new Error(String(err?.message || err)))
        })
    }

    return socket
}
