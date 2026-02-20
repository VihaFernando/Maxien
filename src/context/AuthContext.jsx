import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Initial check for session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(prevUser => {
                const newUser = session?.user || null
                // Only update if user actually changed
                if (prevUser?.id !== newUser?.id) {
                    return newUser
                }
                return prevUser
            })
            setLoading(false)
        }).catch((error) => {
            console.log('Session check: user not authenticated')
            setUser(null)
            setLoading(false)
        })

        // Subscribe to auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                setUser(prevUser => {
                    const newUser = session?.user || null
                    // Only update if user actually changed (by ID comparison)
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
                redirectTo: window.location.origin + '/dashboard',
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
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
    }), [user, loading, signUp, signIn, signInWithGoogle, signOut])

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
