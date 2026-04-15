import { useCallback, useEffect, useRef } from "react"

export default function useTimeoutRegistry() {
    const timeoutsRef = useRef(new Set())

    const registerTimeout = useCallback((callback, delayMs) => {
        const timeoutId = window.setTimeout(() => {
            timeoutsRef.current.delete(timeoutId)
            callback()
        }, delayMs)
        timeoutsRef.current.add(timeoutId)
        return timeoutId
    }, [])

    const clearAllTimeouts = useCallback(() => {
        timeoutsRef.current.forEach((timeoutId) => {
            window.clearTimeout(timeoutId)
        })
        timeoutsRef.current.clear()
    }, [])

    const clearTimeoutById = useCallback((timeoutId) => {
        if (timeoutId == null) return
        window.clearTimeout(timeoutId)
        timeoutsRef.current.delete(timeoutId)
    }, [])

    useEffect(() => {
        return () => {
            clearAllTimeouts()
        }
    }, [clearAllTimeouts])

    return { registerTimeout, clearTimeoutById, clearAllTimeouts }
}
