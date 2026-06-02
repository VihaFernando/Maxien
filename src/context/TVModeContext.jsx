import { useCallback, useEffect, useState } from 'react'
import { TVModeContext } from './TVModeContextObject'

export { TVModeContext } from './TVModeContextObject'

async function requestTVFullscreen() {
    try {
        if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
        }
    } catch {
        // NotAllowedError: gamepad events may not count as user gesture in all browsers.
        // TV mode proceeds without fullscreen in that case.
    }
}

function exitTVFullscreen() {
    try {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {})
        }
    } catch {
        // ignore
    }
}

export function TVModeProvider({ children }) {
    const [tvActive, setTvActive] = useState(false)

    // Inject cursor:none style tag when TV mode is active.
    // This wins over any inline style.cursor mutations from useHideCursorOnDpad.
    useEffect(() => {
        if (!tvActive) return
        const el = document.createElement('style')
        el.id = 'tv-mode-no-cursor'
        el.textContent = '*, *::before, *::after { cursor: none !important; }'
        document.head.appendChild(el)
        return () => {
            document.getElementById('tv-mode-no-cursor')?.remove()
        }
    }, [tvActive])

    // Sync with native fullscreen exit (e.g. user presses Escape)
    useEffect(() => {
        const onFullscreenChange = () => {
            if (!document.fullscreenElement && tvActive) {
                setTvActive(false)
            }
        }
        document.addEventListener('fullscreenchange', onFullscreenChange)
        return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
    }, [tvActive])

    const enterTV = useCallback(async () => {
        await requestTVFullscreen()
        setTvActive(true)
    }, [])

    const exitTV = useCallback(() => {
        exitTVFullscreen()
        setTvActive(false)
    }, [])

    return (
        <TVModeContext.Provider value={{ tvActive, enterTV, exitTV }}>
            {children}
        </TVModeContext.Provider>
    )
}

