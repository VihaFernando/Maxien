import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react'
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

const LifeSyncContext = createContext(null)

export function LifeSyncProvider({ children }) {
    const { session, user: authUser, loading: authLoading } = useAuth()
    const [lifeSyncUser, setLifeSyncUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [lastError, setLastError] = useState(null)
    /** Bumped when the LifeSync token is cleared so the no-token effect can re-run (e.g. invalid JWT on mount). */
    const [lifeSyncTokenClears, setLifeSyncTokenClears] = useState(0)

    const refreshMe = useCallback(async () => {
        const token = getLifesyncToken()
        if (!token) {
            setLifeSyncUser(null)
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
            notifyReduceMotionPreferenceChanged()
            return me
        } catch (e) {
            setLastError(e)
            if (e.status === 401 || e.status === 404) {
                setLifesyncToken(null)
                setLifeSyncUser(null)
                setLifeSyncTokenClears((n) => n + 1)
                notifyReduceMotionPreferenceChanged()
            }
            throw e
        } finally {
            setLoading(false)
        }
    }, [])

    /** Hydrate from a LifeSync JWT already in storage (mount only). */
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            if (!getLifesyncToken()) return
            try {
                const me = await lifesyncGetMe()
                if (!cancelled) {
                    if (me?.preferences && typeof me.preferences.reduceAnimations === 'boolean') {
                        writeStoredReduceAnimationsSetting(me.preferences.reduceAnimations)
                    }
                    setLifeSyncUser(me)
                    setLastError(null)
                    notifyReduceMotionPreferenceChanged()
                }
            } catch (e) {
                if (!cancelled) {
                    setLastError(e)
                    if (e.status === 401 || e.status === 404) {
                        setLifesyncToken(null)
                        setLifeSyncUser(null)
                        setLifeSyncTokenClears((n) => n + 1)
                        notifyReduceMotionPreferenceChanged()
                    }
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [])

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
                        const me = await lifesyncGetMe()
                        if (!cancelled) {
                            if (me?.preferences && typeof me.preferences.reduceAnimations === 'boolean') {
                                writeStoredReduceAnimationsSetting(me.preferences.reduceAnimations)
                            }
                            setLifeSyncUser(me)
                            notifyReduceMotionPreferenceChanged()
                        }
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
            await refreshMe()
        }
        return data
    }, [session?.access_token, authUser?.email, refreshMe])

    const login = useCallback(async (email, password) => {
        setLastError(null)
        const data = await apiLogin(email, password)
        if (data?.token) {
            setLifesyncToken(data.token)
        }
        await refreshMe()
        return data
    }, [refreshMe])

    const register = useCallback(async ({ email, password, name }) => {
        setLastError(null)
        const data = await apiRegister({ email, password, name })
        if (data?.token) {
            setLifesyncToken(data.token)
        }
        await refreshMe()
        return data
    }, [refreshMe])

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
        [refreshMe]
    )

    const logout = useCallback(() => {
        setLifesyncToken(null)
        setLifeSyncUser(null)
        setLastError(null)
        setLifeSyncTokenClears((n) => n + 1)
    }, [])

    const updatePlugins = useCallback(async (partial) => {
        const data = await lifesyncPostPlugins(partial)
        await refreshMe()
        return data
    }, [refreshMe])

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
            return data
        } catch (e) {
            await refreshMe().catch(() => {})
            throw e
        }
    }, [refreshMe])

    const value = useMemo(
        () => ({
            lifeSyncUser,
            lifeSyncLoading: loading,
            lifeSyncError: lastError,
            refreshLifeSyncMe: refreshMe,
            lifeSyncLogin: login,
            lifeSyncRegister: register,
            lifeSyncEnsureAccount: ensureAccount,
            lifeSyncConnectWithSupabase: connectWithSupabase,
            lifeSyncLogout: logout,
            lifeSyncUpdatePlugins: updatePlugins,
            lifeSyncUpdatePreferences: updatePreferences,
            isLifeSyncConnected: Boolean(lifeSyncUser),
        }),
        [lifeSyncUser, loading, lastError, refreshMe, login, register, ensureAccount, connectWithSupabase, logout, updatePlugins, updatePreferences]
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
