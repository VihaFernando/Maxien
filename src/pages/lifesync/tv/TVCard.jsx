import { LifesyncEpisodeThumbnail } from '../../../components/lifesync/EpisodeLoadingSkeletons'
import useLifeSyncInputSource from '../../../hooks/useLifeSyncInputSource'
import { tvHintLabel } from '../../../lib/lifeSyncKeyboardGamepad'

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
            className={`group relative flex flex-col transition-all duration-200 select-none ${
                focused ? 'z-10 -translate-y-1 scale-[1.045]' : 'scale-100'
            }`}
            onClick={onSelect}
        >
            {/* Cover image */}
            <div
                className={`relative w-full overflow-hidden rounded-[18px] bg-white/5 ring-1 transition-all duration-200 ${
                    focused
                        ? 'ring-(--mx-color-c6ff00) shadow-[0_0_0_4px_rgba(198,255,0,0.22),0_0_40px_rgba(198,255,0,0.18),0_24px_50px_-16px_rgba(0,0,0,0.85)]'
                        : 'ring-white/8'
                }`}
                style={{ aspectRatio }}
            >
                {imageUrl ? (
                    <LifesyncEpisodeThumbnail
                        src={imageUrl}
                        className="absolute inset-0 h-full w-full"
                        imgClassName={`h-full w-full object-cover transition-transform duration-300 ${focused ? 'scale-[1.06]' : 'scale-100'}`}
                        imgProps={{ referrerPolicy: 'no-referrer', style: { willChange: 'transform' } }}
                        noFade={focused}
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-white/6 to-transparent text-white/20">
                        <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25M3.375 19.5V5.625A1.125 1.125 0 014.5 4.5h15a1.125 1.125 0 011.125 1.125v13.875" />
                        </svg>
                    </div>
                )}

                {/* Gradient overlay for legibility  deepens slightly when focused */}
                <div className={`pointer-events-none absolute inset-0 bg-linear-to-t transition-opacity duration-200 ${
                    focused ? 'from-black/70 via-black/5 to-transparent' : 'from-black/80 via-black/10 to-transparent'
                }`} />

                {/* Badge (episode / chapter label)  top-right */}
                {badge && (
                    <span className={`absolute right-2 top-2 rounded-lg px-2.5 py-1 text-[12px] font-black tabular-nums ring-1 transition-colors ${
                        focused
                            ? 'bg-(--mx-color-c6ff00) text-black ring-transparent'
                            : 'bg-black/65 text-white/90 ring-white/12'
                    }`}>
                        {badge}
                    </span>
                )}

                {/* Score pill  top-left, only when no badge or when there's room */}
                {score && !badge && (
                    <span className="absolute left-2 top-2 rounded-lg bg-black/65 px-2 py-0.5 text-[11px] font-black tabular-nums text-amber-300 ring-1 ring-white/12">
                        ★ {score}
                    </span>
                )}

                {/* Rating badge  bottom-left */}
                {ratingLabel && (
                    <span className="absolute bottom-2 left-2 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-black tracking-wide text-amber-300 ring-1 ring-white/12">
                        {ratingLabel}
                    </span>
                )}

                {/* Score badge  bottom-right (when badge is occupying top-right) */}
                {score && badge && (
                    <span className="absolute bottom-2 right-2 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-black tabular-nums text-amber-300 ring-1 ring-white/12">
                        ★ {score}
                    </span>
                )}

                {/* Focused accent bar along the bottom edge */}
                <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-linear-to-r from-(--mx-color-c6ff00) via-lime-200 to-(--mx-color-c6ff00) transition-opacity duration-200 ${
                    focused ? 'opacity-100' : 'opacity-0'
                }`} aria-hidden />
            </div>

            {/* Title + subtitle below image */}
            <div className="mt-2.5 px-0.5">
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
 * Page indicator + prev/next hint chips shown under section grids.
 * Labels follow the active input device (controller vs keyboard).
 */
export function TVPageHints({ page, hasMore }) {
    const inputSource = useLifeSyncInputSource()
    return (
        <div className="mt-4 flex items-center justify-center gap-3 text-[13px] text-white/40">
            {page > 1 && <span className="rounded bg-white/8 px-2 py-1 text-[11px] font-black">{tvHintLabel('LT', inputSource)} prev</span>}
            <span>Page {page}</span>
            {hasMore && <span className="rounded bg-white/8 px-2 py-1 text-[11px] font-black">{tvHintLabel('RT', inputSource)} next</span>}
        </div>
    )
}

/**
 * Skeleton placeholder for TVCard loading state.
 */
export function TVCardSkeleton() {
    return (
        <div className="flex flex-col">
            <div className="relative w-full animate-pulse overflow-hidden rounded-[18px] bg-white/6 ring-1 ring-white/6" style={{ aspectRatio: '2/3' }}>
                <div className="absolute inset-0 bg-linear-to-t from-white/4 to-transparent" />
            </div>
            <div className="mt-2.5 space-y-1.5 px-0.5">
                <div className="h-4 w-3/4 animate-pulse rounded-md bg-white/8" />
                <div className="h-4 w-1/2 animate-pulse rounded-md bg-white/8" />
                <div className="h-3 w-2/5 animate-pulse rounded-md bg-white/5" />
            </div>
        </div>
    )
}
