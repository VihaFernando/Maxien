import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase environment variables. Please check your .env.local file.')
}

const memoryStore = new Map()
const memoryStorage = {
    getItem: (key) => memoryStore.get(key) ?? null,
    setItem: (key, value) => {
        memoryStore.set(key, value)
    },
    removeItem: (key) => {
        memoryStore.delete(key)
    },
}

const browserStorage = typeof window !== 'undefined' && window.localStorage
    ? window.localStorage
    : memoryStorage

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'maxien.auth.token',
        storage: browserStorage,
    },
})
