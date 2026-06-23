import { useCallback, useEffect, useRef, useState } from 'react'
import { lifesyncFetch } from '../lib/lifesyncApi'

const POLL_INTERVAL_MS = 60_000

/**
 * In-app notifications: list + unread count with polling, plus read/delete actions.
 *
 * @param {{ enabled?: boolean, domain?: string, unreadOnly?: boolean, limit?: number, poll?: boolean }} opts
 */
export function useNotifications({ enabled = true, domain, unreadOnly = false, limit = 30, poll = true } = {}) {
    const [entries, setEntries] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const requestIdRef = useRef(0)

    const buildQuery = useCallback(() => {
        const params = new URLSearchParams()
        if (domain) params.set('domain', domain)
        if (unreadOnly) params.set('unreadOnly', '1')
        if (limit) params.set('limit', String(limit))
        return params.toString()
    }, [domain, unreadOnly, limit])

    const refresh = useCallback(async () => {
        if (!enabled) {
            setEntries([])
            setUnreadCount(0)
            return
        }
        const requestId = ++requestIdRef.current
        setLoading(true)
        setError('')
        try {
            const data = await lifesyncFetch(`/api/notifications?${buildQuery()}`)
            if (requestId !== requestIdRef.current) return
            setEntries(Array.isArray(data?.entries) ? data.entries : [])
            setUnreadCount(Number(data?.unreadCount || 0))
        } catch (err) {
            if (requestId !== requestIdRef.current) return
            setError(String(err?.message || 'Failed to load notifications'))
        } finally {
            if (requestId === requestIdRef.current) setLoading(false)
        }
    }, [enabled, buildQuery])

    const refreshUnreadCount = useCallback(async () => {
        if (!enabled) return
        try {
            const data = await lifesyncFetch('/api/notifications/unread-count')
            setUnreadCount(Number(data?.unreadCount || 0))
        } catch {
            // non-fatal
        }
    }, [enabled])

    useEffect(() => {
        void refresh()
    }, [refresh])

    useEffect(() => {
        if (!enabled || !poll) return undefined
        const id = setInterval(() => {
            void refreshUnreadCount()
        }, POLL_INTERVAL_MS)
        return () => clearInterval(id)
    }, [enabled, poll, refreshUnreadCount])

    const markRead = useCallback(async (id) => {
        setEntries((prev) => prev.map((n) => (n._id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)))
        setUnreadCount((c) => Math.max(0, c - 1))
        try {
            await lifesyncFetch(`/api/notifications/${id}/read`, { method: 'POST' })
        } catch {
            void refresh()
        }
    }, [refresh])

    const markAllRead = useCallback(async (scopeDomain) => {
        setEntries((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })))
        setUnreadCount(0)
        try {
            await lifesyncFetch('/api/notifications/read-all', {
                method: 'POST',
                json: scopeDomain ? { domain: scopeDomain } : {},
            })
        } catch {
            void refresh()
        }
    }, [refresh])

    const remove = useCallback(async (id) => {
        setEntries((prev) => prev.filter((n) => n._id !== id))
        try {
            await lifesyncFetch(`/api/notifications/${id}`, { method: 'DELETE' })
            void refreshUnreadCount()
        } catch {
            void refresh()
        }
    }, [refresh, refreshUnreadCount])

    return { entries, unreadCount, loading, error, refresh, markRead, markAllRead, remove }
}

export function useNotificationPreferences({ enabled = true } = {}) {
    const [prefs, setPrefs] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const refresh = useCallback(async () => {
        if (!enabled) return
        setLoading(true)
        setError('')
        try {
            setPrefs(await lifesyncFetch('/api/notifications/preferences'))
        } catch (err) {
            setError(String(err?.message || 'Failed to load preferences'))
        } finally {
            setLoading(false)
        }
    }, [enabled])

    useEffect(() => {
        void refresh()
    }, [refresh])

    const update = useCallback(async (patch) => {
        setPrefs((prev) => ({ ...(prev || {}), ...patch }))
        try {
            const next = await lifesyncFetch('/api/notifications/preferences', { method: 'PUT', json: patch })
            setPrefs(next)
            return next
        } catch (err) {
            void refresh()
            throw err
        }
    }, [refresh])

    return { prefs, loading, error, refresh, update }
}
