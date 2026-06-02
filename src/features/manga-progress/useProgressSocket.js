import { useEffect, useRef } from 'react'
import { getLifesyncApiBase, getLifesyncToken } from '../../lib/lifesyncApi'

const RECONNECT_DELAY_MS = 3000
const MAX_RECONNECT_DELAY_MS = 30000

function getWsUrl(token) {
    const base = getLifesyncApiBase()
    const httpBase = base || window.location.origin
    const wsBase = httpBase.replace(/^http/, 'ws')
    return `${wsBase}/ws/progress?token=${encodeURIComponent(token)}`
}

/**
 * Connects to the server's progress WebSocket and calls onBatchResult whenever
 * the server pushes a `progress:batch` event (i.e., after a batch write).
 *
 * @param {{ enabled: boolean, onBatchResult: (result: object) => void }} opts
 */
export function useProgressSocket({ enabled, onBatchResult }) {
    const onBatchResultRef = useRef(onBatchResult)
    onBatchResultRef.current = onBatchResult

    useEffect(() => {
        if (!enabled) return

        let ws = null
        let reconnectTimer = null
        let destroyed = false
        let delay = RECONNECT_DELAY_MS

        const connect = () => {
            const token = getLifesyncToken()
            if (!token) return

            ws = new WebSocket(getWsUrl(token))

            ws.onopen = () => {
                delay = RECONNECT_DELAY_MS
            }

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data)
                    if (msg?.event === 'progress:batch' && msg?.data) {
                        onBatchResultRef.current?.(msg.data)
                    }
                } catch {
                    // ignore malformed messages
                }
            }

            ws.onclose = () => {
                if (destroyed) return
                reconnectTimer = window.setTimeout(() => {
                    if (!destroyed) connect()
                }, delay)
                delay = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS)
            }

            ws.onerror = () => {
                ws?.close()
            }
        }

        connect()

        return () => {
            destroyed = true
            if (reconnectTimer) window.clearTimeout(reconnectTimer)
            ws?.close()
        }
    }, [enabled])
}
