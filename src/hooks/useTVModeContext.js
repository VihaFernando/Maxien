import { useContext } from 'react'
import { TVModeContext } from '../context/TVModeContextObject'

export function useTVModeContext() {
    const ctx = useContext(TVModeContext)
    if (!ctx) throw new Error('useTVModeContext must be used inside TVModeProvider')
    return ctx
}
