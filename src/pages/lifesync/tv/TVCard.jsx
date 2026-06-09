import { LifesyncEpisodeThumbnail } from '../../../components/lifesync/EpisodeLoadingSkeletons'

function resolveRatingLabel(contentRating) {
    if (!contentRating) return null
    const r = String(contentRating).toLowerCase()
    if (r === 'mature' || r === 'adult' || r === '18+' || r === 'pornographic') return '18+'
    if (r === 'suggestive' || r === 'erotica' || r === '16+') return '16+'
    return null
}

export function TVCard({ imageUrl, title, badge, ratingBadge, score, subtitle, focused, onSelect, aspectRatio = '2/3' }) {
    const ratingLabel = resolveRatingLabel(ratingBadge)
    return (
        <div
            data-focused-card={focused ? 'true' : undefined}
            className={`group relative flex flex-col overflow-hidden rounded-2xl transition-all duration-150 select-none ${
                focused
                    ? 'ring-4 ring-(--mx-color-c6ff00) scale-[1.05] shadow-[0_0_0_8px_rgba(198,255,0,0.18)] z-10'
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
                        imgProps={{ referrerPolicy: 'no-referrer', style: { willChange: 'transform' } }}
                        noFade={focused}
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/20">
                        <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25M3.375 19.5V5.625A1.125 1.125 0 014.5 4.5h15a1.125 1.125 0 011.125 1.125v13.875" />
                        </svg>
                    </div>
                )}

                {/* Gradient overlay for title legibility */}
                <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/80 via-black/10 to-transparent" />

                {/* Badge (episode / chapter label) — top-right */}
                {badge && (
                    <span className={`absolute right-2 top-2 rounded-lg px-2.5 py-1 text-[12px] font-black tabular-nums ${
                        focused
                            ? 'bg-(--mx-color-c6ff00) text-black'
                            : 'bg-black/80 text-white/90'
                    }`}>
                        {badge}
                    </span>
                )}

                {/* Score pill — top-left, only when no badge or when there's room */}
                {score && !badge && (
                    <span className="absolute left-2 top-2 rounded-lg bg-black/70 px-2 py-0.5 text-[11px] font-black text-amber-300 tabular-nums">
                        ★ {score}
                    </span>
                )}

                {/* Rating badge — bottom-left */}
                {ratingLabel && (
                    <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-black tracking-wide text-amber-300">
                        {ratingLabel}
                    </span>
                )}

                {/* Score badge — bottom-right (when badge is occupying top-right) */}
                {score && badge && (
                    <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-black text-amber-300 tabular-nums">
                        ★ {score}
                    </span>
                )}

                {/* Focused indicator dot */}
                {focused && (
                    <div className="absolute left-2 top-2 h-3 w-3 rounded-full bg-[var(--mx-color-c6ff00)]" />
                )}
            </div>

            {/* Title + subtitle below image */}
            <div className="mt-2 px-0.5">
                <p className={`line-clamp-2 text-[17px] font-bold leading-snug tracking-tight transition-colors ${
                    focused ? 'text-(--mx-color-c6ff00)' : 'text-white/90'
                }`}>
                    {title || 'Untitled'}
                </p>
                {subtitle && (
                    <p className={`mt-0.5 truncate text-[12px] font-medium leading-tight ${
                        focused ? 'text-(--mx-color-c6ff00)/70' : 'text-white/40'
                    }`}>
                        {subtitle}
                    </p>
                )}
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
                <div className="h-3 w-2/5 animate-pulse rounded-md bg-white/5" />
            </div>
        </div>
    )
}
