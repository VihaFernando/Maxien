import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase environment variables. Please check your .env.local file.')
}

const createSafeStorage = () => {
    const memoryStore = new Map()

    const getNativeStorage = () => {
        if (typeof window === 'undefined' || !window.localStorage) return null
        return window.localStorage
    }

    return {
        getItem: (key) => {
            try {
                const storage = getNativeStorage()
                return storage ? storage.getItem(key) : memoryStore.get(key) ?? null
            } catch {
                return null
            }
        },
        setItem: (key, value) => {
            try {
                const storage = getNativeStorage()
                if (storage) {
                    storage.setItem(key, value)
                    return
                }
            } catch {
                // fall back to in-memory storage
            }
            memoryStore.set(key, value)
        },
        removeItem: (key) => {
            try {
                const storage = getNativeStorage()
                if (storage) {
                    storage.removeItem(key)
                }
            } catch {
                // ignore and clear memory fallback
            }
            memoryStore.delete(key)
        },
    }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'maxien.auth.token',
        storage: createSafeStorage(),
    },
})
