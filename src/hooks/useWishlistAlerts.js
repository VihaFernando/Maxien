import { useCallback, useEffect, useRef, useState } from 'react'
import { lifesyncFetch } from '../lib/lifesyncApi'

/**
 * Wishlist gaming alerts: trigger a price-drop scan and load the best-deals digest.
 *
 * @param {{ enabled?: boolean, autoLoadDigest?: boolean }} opts
 */
export function useWishlistAlerts({ enabled = true, autoLoadDigest = false } = {}) {
    const [digest, setDigest] = useState([])
    const [digestLoading, setDigestLoading] = useState(false)
    const [checking, setChecking] = useState(false)
    const [lastCheck, setLastCheck] = useState(null)
    const [error, setError] = useState('')
    const mountedRef = useRef(true)

    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
        }
    }, [])

    const loadDigest = useCallback(async ({ notify = false } = {}) => {
        if (!enabled) return
        setDigestLoading(true)
        setError('')
        try {
            const data = await lifesyncFetch(`/api/wishlist/alerts/deal-digest${notify ? '?notify=1' : ''}`)
            if (!mountedRef.current) return
            setDigest(Array.isArray(data?.entries) ? data.entries : [])
        } catch (err) {
            if (mountedRef.current) setError(String(err?.message || 'Failed to load deal digest'))
        } finally {
            if (mountedRef.current) setDigestLoading(false)
        }
    }, [enabled])

    const checkPriceDrops = useCallback(async () => {
        if (!enabled) return null
        setChecking(true)
        setError('')
        try {
            const result = await lifesyncFetch('/api/wishlist/alerts/price-drops', { method: 'POST' })
            if (mountedRef.current) setLastCheck(result)
            return result
        } catch (err) {
            if (mountedRef.current) setError(String(err?.message || 'Price-drop check failed'))
            return null
        } finally {
            if (mountedRef.current) setChecking(false)
        }
    }, [enabled])

    useEffect(() => {
        if (autoLoadDigest) void loadDigest()
    }, [autoLoadDigest, loadDigest])

    return { digest, digestLoading, checking, lastCheck, error, loadDigest, checkPriceDrops }
}
