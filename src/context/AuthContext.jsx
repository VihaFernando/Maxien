import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

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
        // Initial check for session
        supabase.auth.getSession().then(({ data: { session: s } }) => {
            setSession(s || null)
            setUser(prevUser => {
                const newUser = s?.user || null
                if (prevUser?.id !== newUser?.id) {
                    return newUser
                }
                return prevUser
            })
            setLoading(false)
        }).catch(() => {
            console.log('Session check: user not authenticated')
            setSession(null)
            setUser(null)
            setLoading(false)
        })

        // Subscribe to auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, s) => {
                setSession(s || null)
                setUser(prevUser => {
                    const newUser = s?.user || null
                    if (prevUser?.id !== newUser?.id) {
                        return newUser
                    }
                    return prevUser
                })
                setLoading(false)
            }
        )

        return () => {
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

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
