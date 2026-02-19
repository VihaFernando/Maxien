import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Initial check for session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user || null)
            setLoading(false)
        }).catch((error) => {
            console.log('Session check: user not authenticated')
            setUser(null)
            setLoading(false)
        })

        // Subscribe to auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                setUser(session?.user || null)
                setLoading(false)
            }
        )

        return () => {
            if (subscription) subscription.unsubscribe()
        }
    }, [])

    const signUp = async (email, password, fullName) => {
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
    }

    const signIn = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })
        return { data, error }
    }

    const signInWithGoogle = async () => {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/dashboard',
            },
        })
        return { data, error }
    }

    const signOut = async () => {
        const { error } = await supabase.auth.signOut()
        return { error }
    }

    const value = {
        user,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
    }

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
