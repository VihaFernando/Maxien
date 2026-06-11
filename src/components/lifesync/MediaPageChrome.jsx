/* eslint-disable react-refresh/only-export-components -- design-system module: exports class-string helpers alongside components */
/**
 * Shared "cinema glass" chrome for LifeSync media pages (anime / manga / hentai /
 * library / watch / calendar). One design language across every media surface:
 * accent-tinted page headers, accent-bar section titles, glass chips, and a
 * pill pager. Pages keep their own data logic and pass an accent id.
 *
 * Works on both light and dark app themes via the --color-* tokens; accents are
 * fixed hues so each hub keeps its identity in either theme.
 */
import { Link } from 'react-router-dom'

/** Per-hub accent identities — mirror the TV mode accents. */
export const MEDIA_ACCENTS = {
    anime: {
        text: 'text-sky-500 dark:text-sky-300',
        dot: 'bg-sky-400',
        bar: 'from-sky-400 to-sky-400/10',
        iconTile: 'bg-sky-500/12 text-sky-600 dark:text-sky-300 ring-sky-400/25',
        glow: 'rgba(56,189,248,0.22)',
        hairline: 'via-sky-400/60',
    },
    manga: {
        text: 'text-amber-500 dark:text-amber-300',
        dot: 'bg-amber-400',
        bar: 'from-amber-400 to-amber-400/10',
        iconTile: 'bg-amber-500/12 text-amber-600 dark:text-amber-300 ring-amber-400/25',
        glow: 'rgba(251,191,36,0.22)',
        hairline: 'via-amber-400/60',
    },
    hmanhwa: {
        text: 'text-rose-500 dark:text-rose-300',
        dot: 'bg-rose-400',
        bar: 'from-rose-400 to-rose-400/10',
        iconTile: 'bg-rose-500/12 text-rose-600 dark:text-rose-300 ring-rose-400/25',
        glow: 'rgba(251,113,133,0.22)',
        hairline: 'via-rose-400/60',
    },
    hentai: {
        text: 'text-fuchsia-500 dark:text-fuchsia-300',
        dot: 'bg-fuchsia-400',
        bar: 'from-fuchsia-400 to-fuchsia-400/10',
        iconTile: 'bg-fuchsia-500/12 text-fuchsia-600 dark:text-fuchsia-300 ring-fuchsia-400/25',
        glow: 'rgba(232,121,249,0.22)',
        hairline: 'via-fuchsia-400/60',
    },
    library: {
        text: 'text-lime-600 dark:text-lime-300',
        dot: 'bg-lime-400',
        bar: 'from-lime-400 to-lime-400/10',
        iconTile: 'bg-lime-500/12 text-lime-700 dark:text-lime-300 ring-lime-400/25',
        glow: 'rgba(198,255,0,0.22)',
        hairline: 'via-lime-400/60',
    },
    calendar: {
        text: 'text-violet-500 dark:text-violet-300',
        dot: 'bg-violet-400',
        bar: 'from-violet-400 to-violet-400/10',
        iconTile: 'bg-violet-500/12 text-violet-600 dark:text-violet-300 ring-violet-400/25',
        glow: 'rgba(167,139,250,0.22)',
        hairline: 'via-violet-400/60',
    },
}

export function mediaAccent(id) {
    return MEDIA_ACCENTS[id] || MEDIA_ACCENTS.anime
}

/**
 * Page header: icon tile with accent ring, kicker with live dot, display title,
 * optional subtitle, and a right-side actions slot. An accent hairline closes it.
 */
export function MediaPageHeader({ accent = 'anime', icon = null, kicker, title, subtitle, actions = null }) {
    const a = mediaAccent(accent)
    return (
        <div className="relative">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div className="flex min-w-0 items-center gap-3.5">
                    {icon && (
                        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${a.iconTile}`}>
                            {icon}
                        </span>
                    )}
                    <div className="min-w-0">
                        {kicker && (
                            <p className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] ${a.text}`}>
                                <span className={`inline-block h-1.5 w-1.5 rounded-full ${a.dot}`} aria-hidden />
                                {kicker}
                            </p>
                        )}
                        <h1 className="mt-0.5 truncate text-[28px] font-black leading-none tracking-tight text-(--color-text-primary) sm:text-[32px]">
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="mt-1.5 text-[12px] leading-snug text-(--color-text-secondary)">{subtitle}</p>
                        )}
                    </div>
                </div>
                {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
            </div>
            <div className={`mt-4 h-px w-full bg-linear-to-r from-transparent ${a.hairline} to-transparent`} aria-hidden />
        </div>
    )
}

/** Section title with accent bar — replaces tiny uppercase labels. */
export function MediaSectionTitle({ accent = 'anime', title, hint, action = null }) {
    const a = mediaAccent(accent)
    return (
        <div className="mb-3 flex items-end justify-between gap-4">
            <div className="flex items-center gap-2.5">
                <span className={`h-5 w-1 rounded-full bg-linear-to-b ${a.bar}`} aria-hidden />
                <h2 className="text-[16px] font-black leading-none tracking-tight text-(--color-text-primary) sm:text-[18px]">{title}</h2>
                {hint && <span className="text-[11px] font-semibold text-(--color-text-secondary)">{hint}</span>}
            </div>
            {action}
        </div>
    )
}

/** Round glass arrow button used by rails and pagers. */
export function MediaArrowButton({ onClick, disabled = false, direction = 'right', label, size = 'md' }) {
    const dims = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9'
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label || (direction === 'left' ? 'Previous' : 'Next')}
            className={`flex ${dims} items-center justify-center rounded-full border border-(--color-border-soft) bg-(--color-surface) text-(--color-text-secondary) shadow-sm transition-all hover:-translate-y-px hover:border-primary/50 hover:text-(--color-text-primary) hover:shadow-md disabled:pointer-events-none disabled:opacity-35`}
        >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" aria-hidden>
                {direction === 'left'
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />}
            </svg>
        </button>
    )
}

/** Filter chip class helper — active chips fill with the brand primary. */
export function mediaChipClass(active) {
    return `whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[11px] font-bold transition-all ${
        active
            ? 'border-primary bg-primary text-(--color-ink-strong) shadow-[0_6px_16px_-6px_rgba(198,255,0,0.55)]'
            : 'border-(--color-border-soft) bg-(--color-surface) text-(--color-text-secondary) hover:-translate-y-px hover:border-(--color-border-strong) hover:text-(--color-text-primary)'
    }`
}

/** Neutral-variant chip (for secondary filter rows). */
export function mediaChipNeutralClass(active) {
    return `whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[11px] font-bold transition-all ${
        active
            ? 'border-(--color-text-primary) bg-(--color-text-primary) text-(--color-surface)'
            : 'border-(--color-border-soft) bg-(--color-surface) text-(--color-text-secondary) hover:-translate-y-px hover:border-(--color-border-strong) hover:text-(--color-text-primary)'
    }`
}

/** Search input + submit styling shared by the media pages. */
export const mediaSearchInputClass =
    'w-full rounded-2xl border border-(--color-border-soft) bg-(--color-surface) py-3 pl-10 pr-4 text-[13px] font-medium text-(--color-text-primary) shadow-sm transition-all placeholder:text-(--color-text-secondary)/70 focus:border-primary/60 focus:outline-none focus:ring-4 focus:ring-primary/12'

export const mediaPrimaryButtonClass =
    'inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-[13px] font-black text-(--color-ink-strong) shadow-[0_10px_24px_-10px_rgba(198,255,0,0.6)] transition-all hover:-translate-y-px hover:brightness-105 active:scale-[0.98] disabled:opacity-50'

/** Poster frame treatment shared by media cards (hover lift + primary ring). */
export const mediaPosterFrameClass =
    'relative overflow-hidden rounded-[18px] ring-1 ring-(--color-border-soft) bg-(--color-surface-muted) shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_20px_44px_-16px_rgba(0,0,0,0.45)] group-hover:ring-primary/70'

/** Modern pill pager. */
export function MediaPager({ page, canPrev, canNext, onPage }) {
    const pages = []
    const start = Math.max(1, page - 2)
    if (start > 1) pages.push(1, '…')
    for (let p = start; p <= page + 2; p += 1) pages.push(p)
    if (canNext) pages.push('…')
    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="rounded-full bg-(--color-surface-muted) px-3 py-1 text-[11px] font-bold tabular-nums text-(--color-text-secondary)">
                Page {page}
            </p>
            <div className="flex items-center gap-1.5 rounded-full border border-(--color-border-soft) bg-(--color-surface) p-1 shadow-sm">
                <MediaArrowButton size="sm" direction="left" disabled={!canPrev} onClick={() => onPage(page - 1)} label="Previous page" />
                {pages.map((p, idx) =>
                    typeof p === 'number' ? (
                        <button
                            key={p}
                            type="button"
                            onClick={() => onPage(p)}
                            aria-current={p === page ? 'page' : undefined}
                            className={`min-w-7 rounded-full px-2 py-1 text-[11px] font-black tabular-nums transition-all ${
                                p === page
                                    ? 'bg-primary text-(--color-ink-strong) shadow-[0_4px_12px_-4px_rgba(198,255,0,0.6)]'
                                    : 'text-(--color-text-secondary) hover:bg-(--color-surface-muted) hover:text-(--color-text-primary)'
                            }`}
                        >
                            {p}
                        </button>
                    ) : (
                        <span key={`dots-${idx}`} className="px-0.5 text-[11px] text-(--color-text-secondary)">…</span>
                    ),
                )}
                <MediaArrowButton size="sm" direction="right" disabled={!canNext} onClick={() => onPage(page + 1)} label="Next page" />
            </div>
        </div>
    )
}

/** Empty / error state card. */
export function MediaEmptyState({ accent = 'anime', title = 'Nothing here yet', message, action = null }) {
    const a = mediaAccent(accent)
    return (
        <div className="relative overflow-hidden rounded-3xl border border-(--color-border-soft) bg-(--color-surface) px-6 py-14 text-center shadow-sm">
            <div className={`pointer-events-none absolute inset-x-12 top-0 h-px bg-linear-to-r from-transparent ${a.hairline} to-transparent`} aria-hidden />
            <p className="text-[15px] font-black tracking-tight text-(--color-text-primary)">{title}</p>
            {message && <p className="mx-auto mt-1.5 max-w-sm text-[12px] leading-relaxed text-(--color-text-secondary)">{message}</p>}
            {action && <div className="mt-5 flex justify-center">{action}</div>}
        </div>
    )
}

/** Connect prompt shown when LifeSync isn't linked. */
export function MediaConnectPrompt({ accent = 'anime', title, body }) {
    return (
        <div className="mx-auto max-w-4xl">
            <MediaEmptyState
                accent={accent}
                title={title || 'LifeSync not connected'}
                message={body || 'Connect LifeSync in your profile to use this hub.'}
                action={
                    <Link to="/dashboard/profile?tab=integrations" className={mediaPrimaryButtonClass}>
                        Go to Integrations
                    </Link>
                }
            />
        </div>
    )
}
