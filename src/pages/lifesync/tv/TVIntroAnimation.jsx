import { useEffect } from 'react'
import { motion as M } from 'framer-motion'
import { readStoredReduceAnimationsSetting } from '../../../lib/lifeSyncReduceMotion'

const LOW_END = readStoredReduceAnimationsSetting() === true

/**
 * Cinematic logo reveal played once per session before the TV grid appears.
 * Total duration ~2.2s, then calls onComplete().
 * Skipped entirely on low-end devices (Xbox One, low RAM/CPU).
 */
export function TVIntroAnimation({ onComplete }) {
    useEffect(() => {
        if (LOW_END) {
            onComplete()
            return
        }
        const t = setTimeout(onComplete, 2300)
        return () => clearTimeout(t)
    }, [onComplete])

    if (LOW_END) return null

    return (
        <M.div
            className="fixed inset-0 z-10000 flex items-center justify-center bg-[#050508]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
        >
            {/* Ambient glow */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
                <M.div
                    className="absolute left-1/2 top-1/2 h-150 w-150 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--mx-color-c6ff00)/10 blur-[160px]"
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1.2, opacity: 1 }}
                    transition={{ delay: 0.3, duration: 1.2, ease: 'easeOut' }}
                />
                <M.div
                    className="absolute left-1/4 bottom-0 h-100 w-100 rounded-full bg-indigo-500/8 blur-[140px]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 1 }}
                />
            </div>

            {/* Expanding accent ring */}
            <M.div
                className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-(--mx-color-c6ff00)/40"
                initial={{ scale: 0.2, opacity: 0 }}
                animate={{ scale: 5, opacity: [0, 0.6, 0] }}
                transition={{ delay: 0.45, duration: 1.4, ease: 'easeOut', opacity: { times: [0, 0.25, 1] } }}
                aria-hidden
            />

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
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-(--mx-color-c6ff00) shadow-[0_0_60px_rgba(198,255,0,0.45)]">
                        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="black" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                        </svg>
                    </div>
                    <span className="text-[52px] font-black tracking-tight text-white">
                        Life<span className="bg-linear-to-r from-(--mx-color-c6ff00) to-lime-200 bg-clip-text text-transparent">Sync</span>
                    </span>
                </M.div>

                {/* "TV Mode" badge */}
                <M.div
                    className="flex items-center gap-2 rounded-full border border-(--mx-color-c6ff00)/30 bg-(--mx-color-c6ff00)/10 px-5 py-2 backdrop-blur-sm"
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 1.0, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-(--mx-color-c6ff00)" aria-hidden />
                    <span className="text-[18px] font-black uppercase tracking-[0.22em] text-(--mx-color-c6ff00)">TV Mode</span>
                </M.div>

                {/* Scan line */}
                <M.div
                    className="absolute -inset-x-40 -bottom-12 h-0.5 origin-left rounded-full bg-linear-to-r from-transparent via-(--mx-color-c6ff00) to-transparent"
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
