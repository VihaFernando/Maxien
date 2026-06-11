import { useEffect, useState } from 'react'
import { motion as M, AnimatePresence } from 'framer-motion'
import useControllerSupportEnabled from '../../hooks/useControllerSupportEnabled'


const SESSION_KEY = 'maxien_tv_prompt_dismissed'

/**
 * Small bottom-right badge shown when controller support is enabled and TV mode is inactive.
 * Appears after 1.5s, auto-hides after 6s. Dismissed forever this session on first TV entry
 * or when the user ignores it.
 */
export function TVModeStartPrompt({ tvActive }) {
    const controllerEnabled = useControllerSupportEnabled()
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        if (!controllerEnabled || tvActive) return
        try { if (sessionStorage.getItem(SESSION_KEY) === '1') return } catch { /* ignore */ }

        const show = setTimeout(() => setVisible(true), 1500)
        const hide = setTimeout(() => {
            setVisible(false)
            try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* ignore */ }
        }, 7500)
        return () => { clearTimeout(show); clearTimeout(hide) }
    }, [controllerEnabled, tvActive])

    if (!controllerEnabled || tvActive) return null

    return (
        <AnimatePresence>
            {visible && (
                <M.div
                    className="pointer-events-none fixed bottom-6 right-6 z-9990"
                    initial={{ opacity: 0, y: 12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                >
                    <div className="flex items-center gap-3 rounded-2xl border border-(--color-border-strong)/20 bg-[var(--color-surface)]/90 px-4 py-3 shadow-xl backdrop-blur-xl">
                        {/* Controller icon */}
                        <svg className="h-5 w-5 shrink-0 text-(--mx-color-1d1d1f)/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                            <rect x="2" y="6" width="20" height="12" rx="5" />
                            <path strokeLinecap="round" d="M8 12h4M10 10v4" />
                            <circle cx="16" cy="11" r="0.8" fill="currentColor" />
                            <circle cx="14" cy="13" r="0.8" fill="currentColor" />
                        </svg>

                        <span className="text-[12px] font-semibold text-(--mx-color-1d1d1f)/70">
                            Press
                        </span>

                        {/* START button chip */}
                        <span className="inline-flex items-center rounded-lg bg-(--mx-color-1d1d1f) px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-(--color-surface) shadow-sm">
                            START
                        </span>

                        <span className="text-[12px] font-semibold text-(--mx-color-1d1d1f)/50">
                            or
                        </span>

                        {/* Keyboard shortcut chip */}
                        <span className="inline-flex items-center rounded-lg bg-(--mx-color-1d1d1f) px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-(--color-surface) shadow-sm">
                            ⇧ Tab
                        </span>

                        <span className="text-[12px] font-semibold text-(--mx-color-1d1d1f)/70">
                            for TV Mode
                        </span>

                        {/* Lime dot */}
                        <div className="h-2 w-2 rounded-full bg-(--mx-color-c6ff00) shadow-[0_0_6px_rgba(198,255,0,0.7)]" />
                    </div>
                </M.div>
            )}
        </AnimatePresence>
    )
}
