import { useEffect } from 'react'
import { motion as M } from 'framer-motion'

/**
 * Cinematic logo reveal played once per session before the TV grid appears.
 * Total duration ~2.2s, then calls onComplete().
 */
export function TVIntroAnimation({ onComplete }) {
    useEffect(() => {
        const t = setTimeout(onComplete, 2300)
        return () => clearTimeout(t)
    }, [onComplete])

    return (
        <M.div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
        >
            {/* Ambient glow */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
                <M.div
                    className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--mx-color-c6ff00)]/10 blur-[160px]"
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1.2, opacity: 1 }}
                    transition={{ delay: 0.3, duration: 1.2, ease: 'easeOut' }}
                />
            </div>

            {/* Center content */}
            <div className="relative flex flex-col items-center gap-5">
                {/* Wordmark */}
                <M.div
                    className="flex items-center gap-4"
                    initial={{ scale: 0.75, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                    {/* Icon */}
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--mx-color-c6ff00)] shadow-[0_0_60px_rgba(198,255,0,0.4)]">
                        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="black" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                        </svg>
                    </div>
                    <span className="text-[52px] font-black tracking-tight text-white">LifeSync</span>
                </M.div>

                {/* "TV Mode" badge */}
                <M.div
                    className="flex items-center gap-2 rounded-full border border-[var(--mx-color-c6ff00)]/30 bg-[var(--mx-color-c6ff00)]/10 px-5 py-2"
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 1.0, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                    <span className="text-[18px] font-black uppercase tracking-[0.22em] text-[var(--mx-color-c6ff00)]">TV Mode</span>
                </M.div>

                {/* Scan line */}
                <M.div
                    className="absolute -inset-x-40 bottom-[-3rem] h-[2px] origin-left rounded-full bg-gradient-to-r from-transparent via-[var(--mx-color-c6ff00)] to-transparent"
                    initial={{ scaleX: 0, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: [0, 1, 0] }}
                    transition={{ delay: 1.4, duration: 0.5, ease: 'easeInOut', opacity: { times: [0, 0.3, 1] } }}
                />
            </div>

            {/* Fade out overlay */}
            <M.div
                className="pointer-events-none absolute inset-0 bg-black"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.85, duration: 0.45 }}
            />
        </M.div>
    )
}
