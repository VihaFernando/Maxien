import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from './AuthContext'
import {
    getLifesyncToken,
    lifesyncGetMe,
    lifesyncLogin as apiLogin,
    lifesyncLoginWithSupabase,
    lifesyncPatchPreferences,
    lifesyncPostPlugins,
    lifesyncRegister as apiRegister,
    setLifesyncToken,
} from '../lib/lifesyncApi'
import {
    notifyReduceMotionPreferenceChanged,
    writeStoredReduceAnimationsSetting,
} from '../lib/lifeSyncReduceMotion'
import { lifeSyncQueryKeys } from '../lib/lifeSyncQueryKeys'
import { connectLifeSyncUserBroadcastSocket } from '../lib/lifeSyncUserBroadcastSocket'

const LifeSyncContext = createContext(null)
const LIFESYNC_USER_SNAPSHOT_KEY = 'maxien_lifesync_user_snapshot_v1'

function readLifeSyncUserSnapshot() {
    try {
        const raw = localStorage.getItem(LIFESYNC_USER_SNAPSHOT_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' ? parsed : null
    } catch {
        return null
    }
}

function writeLifeSyncUserSnapshot(user) {
    try {
        if (user && typeof user === 'object') {
            localStorage.setItem(LIFESYNC_USER_SNAPSHOT_KEY, JSON.stringify(user))
            return
        }
        localStorage.removeItem(LIFESYNC_USER_SNAPSHOT_KEY)
    } catch {
        // ignore storage failures
    }
}

export function LifeSyncProvider({ children }) {
    const { session, user: authUser, loading: authLoading } = useAuth()
    const queryClient = useQueryClient()
    const [lifeSyncUser, setLifeSyncUser] = useState(() => (
        getLifesyncToken() ? readLifeSyncUserSnapshot() : null
    ))
    const [loading, setLoading] = useState(true)
    const [lastError, setLastError] = useState(null)
    /** Bumped when the LifeSync token is cleared so the no-token effect can re-run (e.g. invalid JWT on mount). */
    const [lifeSyncTokenClears, setLifeSyncTokenClears] = useState(0)
    /** Server broadcast (operators → all connected LifeSync clients). */
    const [lifeSyncBroadcast, setLifeSyncBroadcast] = useState(null)

    const clearLifeSyncQueries = useCallback(() => {
        queryClient.removeQueries({ queryKey: lifeSyncQueryKeys.root })
    }, [queryClient])

    const syncLifeSyncUserQuery = useCallback((user) => {
        queryClient.setQueryData(lifeSyncQueryKeys.user(), user || null)
    }, [queryClient])

    const invalidateLifeSyncQueries = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: lifeSyncQueryKeys.root })
    }, [queryClient])

    /** Same `roles` as `GET /api/auth/me`, included on login/register/Supabase exchange so the UI can show Admin before `/me` returns. */
    const applyLifesyncAuthSnapshot = useCallback((data) => {
        if (!data || typeof data !== 'object') return
        const u = data.user
        const roles = data.roles
        if (!u || typeof u !== 'object' || !roles || typeof roles !== 'object') return
        setLifeSyncUser((prev) => ({
            ...(prev && typeof prev === 'object' ? prev : {}),
            id: u.id,
            email: u.email,
            name: u.name,
            roles,
        }))
    }, [])

    const refreshMe = useCallback(async () => {
        const token = getLifesyncToken()
        if (!token) {
            setLifeSyncUser(null)
            syncLifeSyncUserQuery(null)
            clearLifeSyncQueries()
            setLoading(false)
            notifyReduceMotionPreferenceChanged()
            return null
        }
        try {
            setLastError(null)
            const me = await lifesyncGetMe()
            if (me?.preferences && typeof me.preferences.reduceAnimations === 'boolean') {
                writeStoredReduceAnimationsSetting(me.preferences.reduceAnimations)
            }
            setLifeSyncUser(me)
            syncLifeSyncUserQuery(me)
            notifyReduceMotionPreferenceChanged()
            return me
        } catch (e) {
            setLastError(e)
            if (e.status === 401 || e.status === 404) {
                setLifesyncToken(null)
                setLifeSyncUser(null)
                syncLifeSyncUserQuery(null)
                clearLifeSyncQueries()
                setLifeSyncTokenClears((n) => n + 1)
                notifyReduceMotionPreferenceChanged()
            }
            throw e
        } finally {
            setLoading(false)
        }
    }, [clearLifeSyncQueries, syncLifeSyncUserQuery])

    useEffect(() => {
        writeLifeSyncUserSnapshot(lifeSyncUser)
    }, [lifeSyncUser])

    /** Hydrate from a LifeSync JWT already in storage (mount only). */
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            if (!getLifesyncToken()) return
            try {
                // Source-of-truth preferences come from DB-backed `/api/auth/me`.
                await refreshMe()
            } catch (e) {
                if (!cancelled) setLastError(e)
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [refreshMe])

    /**
     * No stored LifeSync token: after Maxien auth is ready, exchange Supabase access token for LifeSync JWT
     * (login or server-side account create). Fails quietly into lastError except caller can use Connect retry.
     */
    useEffect(() => {
        if (authLoading) return
        let cancelled = false
        ;(async () => {
            if (getLifesyncToken()) return

            if (session?.access_token && authUser?.id && authUser?.email) {
                try {
                    setLastError(null)
                    if (!cancelled) setLoading(true)
                    const data = await lifesyncLoginWithSupabase(session.access_token)
                    if (cancelled) return
                    if (data?.token) {
                        setLifesyncToken(data.token)
                        applyLifesyncAuthSnapshot(data)
                        await refreshMe()
                    }
                } catch (e) {
                    if (!cancelled) setLastError(e)
                } finally {
                    if (!cancelled) setLoading(false)
                }
                return
            }

            if (!cancelled) setLoading(false)
        })()
        return () => {
            cancelled = true
        }
    }, [
        authLoading,
        session?.access_token,
        authUser?.id,
        authUser?.email,
        lifeSyncTokenClears,
        applyLifesyncAuthSnapshot,
        refreshMe,
    ])

    /** Connect / Integrations: passwordless link using current Supabase session (creates LifeSync user if needed). */
    const connectWithSupabase = useCallback(async () => {
        const t = session?.access_token
        if (!t) {
            const err = new Error('Sign in to Maxien first.')
            err.status = 400
            throw err
        }
        if (!authUser?.email) {
            const err = new Error('Your Maxien account has no email.')
            throw err
        }
        setLastError(null)
        const data = await lifesyncLoginWithSupabase(t)
        if (data?.token) {
            setLifesyncToken(data.token)
            applyLifesyncAuthSnapshot(data)
            await refreshMe()
        }
        return data
    }, [session?.access_token, authUser?.email, refreshMe, applyLifesyncAuthSnapshot])

    const login = useCallback(async (email, password) => {
        setLastError(null)
        const data = await apiLogin(email, password)
        if (data?.token) {
            setLifesyncToken(data.token)
            applyLifesyncAuthSnapshot(data)
        }
        await refreshMe()
        return data
    }, [refreshMe, applyLifesyncAuthSnapshot])

    const register = useCallback(async ({ email, password, name }) => {
        setLastError(null)
        const data = await apiRegister({ email, password, name })
        if (data?.token) {
            setLifesyncToken(data.token)
            applyLifesyncAuthSnapshot(data)
        }
        await refreshMe()
        return data
    }, [refreshMe, applyLifesyncAuthSnapshot])

    /**
     * After Maxien has verified the user: log in to LifeSync, or register if no account exists.
     * Login 401 → try register; register 409 → password wrong for an existing LifeSync user.
     */
    const ensureAccount = useCallback(
        async (email, password, name) => {
            setLastError(null)
            const trimmedEmail = String(email).trim()
            const trimmedName =
                name != null && String(name).trim() !== '' ? String(name).trim() : undefined
            try {
                const data = await apiLogin(trimmedEmail, password)
                if (data?.token) {
                    setLifesyncToken(data.token)
                    applyLifesyncAuthSnapshot(data)
                }
                await refreshMe()
                return { created: false, data }
            } catch (e) {
                if (e.status !== 401) throw e
                try {
                    const data = await apiRegister({
                        email: trimmedEmail,
                        password,
                        ...(trimmedName ? { name: trimmedName } : {}),
                    })
                    if (data?.token) {
                        setLifesyncToken(data.token)
                        applyLifesyncAuthSnapshot(data)
                    }
                    await refreshMe()
                    return { created: true, data }
                } catch (regErr) {
                    if (regErr.status === 409) {
                        const err = new Error(
                            'A LifeSync account already exists for this email, but the password did not match.'
                        )
                        err.status = 401
                        err.body = regErr.body
                        throw err
                    }
                    throw regErr
                }
            }
        },
        [refreshMe, applyLifesyncAuthSnapshot]
    )

    const logout = useCallback(() => {
        setLifesyncToken(null)
        setLifeSyncUser(null)
        syncLifeSyncUserQuery(null)
        clearLifeSyncQueries()
        setLastError(null)
        setLifeSyncBroadcast(null)
        setLifeSyncTokenClears((n) => n + 1)
    }, [clearLifeSyncQueries, syncLifeSyncUserQuery])

    const dismissLifeSyncBroadcast = useCallback(() => {
        setLifeSyncBroadcast(null)
    }, [])

    /** Receive operator broadcasts on `/lifesync-broadcast` while a LifeSync JWT is present. */
    useEffect(() => {
        if (typeof window === 'undefined') return undefined
        const token = getLifesyncToken()
        if (!token) {
            setLifeSyncBroadcast(null)
            return undefined
        }
        const socket = connectLifeSyncUserBroadcastSocket({
            onBroadcast: (payload) => {
                if (payload && typeof payload === 'object') {
                    setLifeSyncBroadcast({
                        message: String(payload.message ?? ''),
                        sentAt: payload.sentAt ? String(payload.sentAt) : new Date().toISOString(),
                        fromUserId: payload.fromUserId != null ? String(payload.fromUserId) : '',
                    })
                }
                window.dispatchEvent(new CustomEvent('maxien:lifesync-broadcast', { detail: payload }))
            },
            onConnectError: (err) => {
                console.warn('LifeSync broadcast connection error:', err)
                setLifeSyncBroadcast(null)
                // Close socket immediately on error to prevent stale connections
                socket?.close?.()
            },
        })
        if (!socket) return undefined
        return () => {
            // Remove event listeners to prevent memory leaks
            if (socket.__messageHandler) {
                socket.removeEventListener('message', socket.__messageHandler)
            }
            if (socket.__errorHandler) {
                socket.removeEventListener('error', socket.__errorHandler)
            }
            socket.close()
        }
    }, [lifeSyncUser?.id, lifeSyncTokenClears])

    const updatePlugins = useCallback(async (partial) => {
        const data = await lifesyncPostPlugins(partial)
        await refreshMe()
        await invalidateLifeSyncQueries()
        return data
    }, [invalidateLifeSyncQueries, refreshMe])

    const updatePreferences = useCallback(async (partial) => {
        setLifeSyncUser((u) => {
            if (!u) return u
            return { ...u, preferences: { ...(u.preferences || {}), ...partial } }
        })
        if (typeof partial.reduceAnimations === 'boolean') {
            writeStoredReduceAnimationsSetting(partial.reduceAnimations)
            notifyReduceMotionPreferenceChanged()
        }
        try {
            const data = await lifesyncPatchPreferences(partial)
            await refreshMe()
            await invalidateLifeSyncQueries()
            return data
        } catch (e) {
            await refreshMe().catch(() => {})
            await invalidateLifeSyncQueries()
            throw e
        }
    }, [invalidateLifeSyncQueries, refreshMe])

    const refreshPreferencesFromDb = useCallback(async () => {
        const me = await refreshMe()
        return me?.preferences || null
    }, [refreshMe])

    const value = useMemo(
        () => ({
            lifeSyncUser,
            lifeSyncLoading: loading,
            lifeSyncError: lastError,
            refreshLifeSyncMe: refreshMe,
            refreshLifeSyncPreferencesFromDb: refreshPreferencesFromDb,
            lifeSyncLogin: login,
            lifeSyncRegister: register,
            lifeSyncEnsureAccount: ensureAccount,
            lifeSyncConnectWithSupabase: connectWithSupabase,
            lifeSyncLogout: logout,
            lifeSyncUpdatePlugins: updatePlugins,
            lifeSyncUpdatePreferences: updatePreferences,
            isLifeSyncConnected: Boolean(lifeSyncUser),
            lifeSyncBroadcast,
            dismissLifeSyncBroadcast,
        }),
        [
            lifeSyncUser,
            loading,
            lastError,
            refreshMe,
            refreshPreferencesFromDb,
            login,
            register,
            ensureAccount,
            connectWithSupabase,
            logout,
            updatePlugins,
            updatePreferences,
            lifeSyncBroadcast,
            dismissLifeSyncBroadcast,
        ]
    )

    return (
        <LifeSyncContext.Provider value={value}>
            {children}
        </LifeSyncContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLifeSync() {
    const ctx = useContext(LifeSyncContext)
    if (!ctx) {
        throw new Error('useLifeSync must be used within a LifeSyncProvider')
    }
    return ctx
}
