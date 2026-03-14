import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)
const GOOGLE_TOKEN_CACHE_KEY = 'maxien_google_provider_token'
const GOOGLE_CALENDAR_DISCONNECTED_KEY = 'maxien_google_calendar_disconnected'

const getOAuthRedirectTo = (path = '/dashboard') => {
    const configuredOrigin = import.meta.env.VITE_AUTH_REDIRECT_ORIGIN
    const baseOrigin = configuredOrigin || window.location.origin
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return `${baseOrigin}${normalizedPath}`
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [session, setSession] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let isMounted = true

        const syncAuthState = (nextSession) => {
            if (!isMounted) return

            setSession(nextSession || null)
            setUser(prevUser => {
                const nextUser = nextSession?.user || null
                if (prevUser?.id !== nextUser?.id) {
                    return nextUser
                }
                return prevUser
            })
            setLoading(false)
        }

        const initializeSession = async () => {
            try {
                const { data: { session: currentSession } } = await supabase.auth.getSession()

                const isExpired = currentSession?.expires_at
                    ? currentSession.expires_at * 1000 <= Date.now()
                    : false

                if (isExpired) {
                    const { data, error } = await supabase.auth.refreshSession()
                    if (error) {
                        syncAuthState(null)
                        return
                    }
                    syncAuthState(data?.session || null)
                    return
                }

                syncAuthState(currentSession || null)
            } catch {
                syncAuthState(null)
            }
        }

        initializeSession()

        // Subscribe to auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, s) => {
                if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
                    syncAuthState(null)
                    return
                }

                syncAuthState(s || null)
            }
        )

        return () => {
            isMounted = false
            if (subscription) subscription.unsubscribe()
        }
    }, [])

    const signUp = useCallback(async (email, password, fullName) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                },
            },
        })

        // Set display_name in auth profile
        if (!error && data.user) {
            await supabase.auth.updateUser({
                data: { display_name: fullName }
            })
        }

        return { data, error }
    }, [])

    const signIn = useCallback(async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })
        return { data, error }
    }, [])

    const signInWithGoogle = useCallback(async () => {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                scopes: 'openid email profile',
                redirectTo: getOAuthRedirectTo('/dashboard'),
            },
        })
        return { data, error }
    }, [])

    const connectGoogleCalendar = useCallback(async () => {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                scopes: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
                redirectTo: getOAuthRedirectTo('/dashboard/calendar'),
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                    include_granted_scopes: 'true',
                },
            },
        })
        return { data, error }
    }, [])

    const signOut = useCallback(async () => {
        try {
            localStorage.removeItem(GOOGLE_TOKEN_CACHE_KEY)
            localStorage.removeItem(GOOGLE_CALENDAR_DISCONNECTED_KEY)
        } catch {
            // ignore local cache cleanup failures
        }
        const { error } = await supabase.auth.signOut()
        return { error }
    }, [])

    const value = useMemo(() => ({
        user,
        session,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        connectGoogleCalendar,
        signOut,
    }), [user, session, loading, signUp, signIn, signInWithGoogle, connectGoogleCalendar, signOut])

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
