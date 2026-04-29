import { MotionDiv } from '../../lib/lifesyncMotion'

/** Bottom pill for finished series — avoids ambiguous “fin” copy. */
export function SeriesCompleteBadge({ className = '' }) {
    return (
        <div
            className={`pointer-events-none absolute -bottom-3 left-1/2 z-50 -translate-x-1/2 ${className}`}
            aria-hidden
        >
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-800/25 bg-gradient-to-r from-black-500 via-[var(--color-surface)] to-black-200 px-3 py-1.5 shadow-[0_4px_16px_-4px_rgba(6,95,70,0.28)]">
                <svg className="h-3.5 w-3.5 shrink-0 text-emerald-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                    />
                </svg>
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-900">Complete</span>
            </div>
        </div>
    )
}

/** Spotlight-only: top banner on the cover (clearer than a tight diagonal ribbon). */
export function NewChapterSpotlightBanner() {
    return (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 overflow-hidden rounded-t-2xl" aria-hidden>
            <MotionDiv
                className="flex items-center gap-2 border-b border-lime-500/35 bg-gradient-to-r from-[var(--mx-color-f7ffce)] via-[var(--mx-color-d9f99d)] to-[var(--mx-color-fef08a)] px-3 py-2 sm:px-3.5 sm:py-2.5"
                initial={{ opacity: 0.92, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            >
                <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-35" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-600 ring-2 ring-[var(--color-border-strong)]/90" />
                </span>
                <span className="min-w-0 text-[10px] font-black uppercase leading-tight tracking-[0.08em] text-slate-900 sm:text-[11px] sm:tracking-[0.1em]">
                    New chapter ready
                </span>
            </MotionDiv>
        </div>
    )
}
