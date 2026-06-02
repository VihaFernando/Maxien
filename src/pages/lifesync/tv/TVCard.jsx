import { LifesyncEpisodeThumbnail } from '../../../components/lifesync/EpisodeLoadingSkeletons'

/**
 * TV-scale card for the fullscreen TV mode grid.
 * No hover states — no cursor in TV mode.
 * Focused state shows a lime ring + subtle scale.
 */
export function TVCard({ imageUrl, title, badge, focused, onSelect, aspectRatio = '2/3' }) {
    return (
        <div
            data-focused-card={focused ? 'true' : undefined}
            className={`group relative flex flex-col overflow-hidden rounded-2xl transition-all duration-150 select-none ${
                focused
                    ? 'ring-4 ring-[var(--mx-color-c6ff00)] scale-[1.05] shadow-[0_0_0_8px_rgba(198,255,0,0.18)] z-10'
                    : 'ring-0 scale-100'
            }`}
            onClick={onSelect}
        >
            {/* Cover image */}
            <div
                className="relative w-full overflow-hidden rounded-2xl bg-white/5"
                style={{ aspectRatio }}
            >
                {imageUrl ? (
                    <LifesyncEpisodeThumbnail
                        src={imageUrl}
                        className="absolute inset-0 h-full w-full"
                        imgClassName="h-full w-full object-cover"
                        imgProps={{ referrerPolicy: 'no-referrer' }}
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/20">
                        <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25M3.375 19.5V5.625A1.125 1.125 0 014.5 4.5h15a1.125 1.125 0 011.125 1.125v13.875" />
                        </svg>
                    </div>
                )}

                {/* Gradient overlay for title legibility */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                {/* Badge (episode / chapter label) */}
                {badge && (
                    <span className={`absolute right-2 top-2 rounded-lg px-2.5 py-1 text-[12px] font-black tabular-nums ${
                        focused
                            ? 'bg-[var(--mx-color-c6ff00)] text-black'
                            : 'bg-black/60 text-white/90 backdrop-blur-sm'
                    }`}>
                        {badge}
                    </span>
                )}

                {/* Focused indicator dot */}
                {focused && (
                    <div className="absolute left-2 top-2 h-3 w-3 rounded-full bg-[var(--mx-color-c6ff00)]" />
                )}
            </div>

            {/* Title below image */}
            <div className="mt-2 px-0.5">
                <p className={`line-clamp-2 text-[17px] font-bold leading-snug tracking-tight transition-colors ${
                    focused ? 'text-[var(--mx-color-c6ff00)]' : 'text-white/90'
                }`}>
                    {title || 'Untitled'}
                </p>
            </div>
        </div>
    )
}

/**
 * Skeleton placeholder for TVCard loading state.
 */
export function TVCardSkeleton() {
    return (
        <div className="flex flex-col overflow-hidden rounded-2xl">
            <div className="w-full animate-pulse rounded-2xl bg-white/8" style={{ aspectRatio: '2/3' }} />
            <div className="mt-2 space-y-1.5 px-0.5">
                <div className="h-4 w-3/4 animate-pulse rounded-md bg-white/8" />
                <div className="h-4 w-1/2 animate-pulse rounded-md bg-white/8" />
            </div>
        </div>
    )
}
