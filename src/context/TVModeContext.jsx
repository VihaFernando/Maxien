import { useCallback, useEffect, useRef, useState } from 'react'
import { TVModeContext } from './TVModeContextObject'

export { TVModeContext } from './TVModeContextObject'

async function requestTVFullscreen() {
    try {
        if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
        }
    } catch {
        // NotAllowedError: gamepad events may not count as user gesture in all browsers.
    }
}

function exitTVFullscreen() {
    try {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {})
        }
    } catch { /* ignore */ }
}

const SESSION_INTRO_KEY = 'maxien_tv_intro_seen'

export function TVModeProvider({ children }) {
    const [tvActive, setTvActive] = useState(false)
    const [introPlayed, setIntroPlayed] = useState(() => {
        try { return sessionStorage.getItem(SESSION_INTRO_KEY) === '1' } catch { return false }
    })
    // Tracks whether the intro should play on the current entry
    const playIntroRef = useRef(false)
    // Set to true only when we intentionally call exitTV() so the fullscreenchange
    // handler knows not to fight the exit (e.g. user chose Exit from the menu).
    const intentionalExitRef = useRef(false)

    useEffect(() => {
        if (!tvActive) return
        const el = document.createElement('style')
        el.id = 'tv-mode-no-cursor'
        el.textContent = '*, *::before, *::after { cursor: none !important; }'
        document.head.appendChild(el)
        return () => { document.getElementById('tv-mode-no-cursor')?.remove() }
    }, [tvActive])

    useEffect(() => {
        const onFullscreenChange = () => {
            if (document.fullscreenElement || !tvActive) return
            // Fullscreen was lost while TV mode is active.
            if (intentionalExitRef.current) {
                // This was our own exitTV() call  accept it.
                intentionalExitRef.current = false
                setTvActive(false)
            } else {
                // Browser/OS forced fullscreen off (Xbox B button, system overlay, etc.)
                // Re-request fullscreen to stay in TV mode.
                requestTVFullscreen()
            }
        }
        document.addEventListener('fullscreenchange', onFullscreenChange)
        return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
    }, [tvActive])

    // Block Escape / browser-back key events while in TV mode so the Xbox B button
    // (which the browser maps to Escape) cannot exit fullscreen outside of our own
    // B-button handler in the TV UI.
    useEffect(() => {
        if (!tvActive) return
        const block = (e) => {
            if (e.key === 'Escape' || e.key === 'BrowserBack' || e.key === 'GoBack') {
                e.preventDefault()
                e.stopImmediatePropagation()
            }
        }
        document.addEventListener('keydown', block, true)
        return () => document.removeEventListener('keydown', block, true)
    }, [tvActive])

    const enterTV = useCallback(async () => {
        await requestTVFullscreen()
        playIntroRef.current = true
        setTvActive(true)
    }, [])

    const exitTV = useCallback(() => {
        intentionalExitRef.current = true
        exitTVFullscreen()
        setTvActive(false)
    }, [])

    const markIntroPlayed = useCallback(() => {
        try { sessionStorage.setItem(SESSION_INTRO_KEY, '1') } catch { /* ignore */ }
        setIntroPlayed(true)
        playIntroRef.current = false
    }, [])

    return (
        <TVModeContext.Provider value={{ tvActive, enterTV, exitTV, introPlayed, markIntroPlayed, playIntroRef }}>
            {children}
        </TVModeContext.Provider>
    )
}
