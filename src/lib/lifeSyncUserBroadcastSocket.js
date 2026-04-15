import { getLifesyncApiBase, getLifesyncToken } from './lifesyncApi'

/**
 * Server-wide LifeSync messages (Native WebSocket namespace `/ws/lifesync-broadcast`).
 * Any authenticated LifeSync user may connect; only admins can POST a broadcast.
 * @param {{ onBroadcast?: (b: unknown) => void, onConnectError?: (err: Error) => void }} handlers
 * @returns {WebSocket | null}
 */
export function connectLifeSyncUserBroadcastSocket(handlers = {}) {
    if (typeof window === 'undefined') return null
    const token = getLifesyncToken()
    if (!token) return null

    let base = getLifesyncApiBase() || window.location.origin
    // Convert HTTP origin to WS origin
    base = base.replace(/^http/, 'ws')
    
    const url = `${base.replace(/\/$/, '')}/ws/lifesync-broadcast?token=${encodeURIComponent(token)}`

    const socket = new WebSocket(url)

    // Store named handlers for proper cleanup
    const handleMessage = (event) => {
        try {
            const data = JSON.parse(event.data)
            if (data.event === 'lifesync:broadcast' && handlers.onBroadcast) {
                handlers.onBroadcast(data.payload || data)
            }
        } catch {
            // ignore malformed messages
        }
    }

    const handleError = (err) => {
        if (handlers.onConnectError) {
            handlers.onConnectError(new Error('WebSocket connection error'))
        }
    }

    socket.addEventListener('message', handleMessage)
    socket.addEventListener('error', handleError)

    // Store handlers on socket for cleanup
    socket.__messageHandler = handleMessage
    socket.__errorHandler = handleError

    return socket
}
