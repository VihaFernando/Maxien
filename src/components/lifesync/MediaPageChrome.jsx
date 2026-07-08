/* eslint-disable react-refresh/only-export-components -- design-system module: exports class-string helpers alongside components */
/**
 * Shared cinema-dark chrome for LifeSync media pages (anime / manga / hentai /
 * library / watch / calendar). One design language across every media surface:
 * accent-tinted page headers, accent-bar section titles, glass chips, and a
 * pill pager. Pages keep their own data logic and pass an accent id.
 *
 * Works on both light and dark app themes via the --color-* tokens; accents are
 * fixed hues so each hub keeps its identity in either theme.
 */
import { Link } from 'react-router-dom'

/** Per-hub accent identities  mirror the TV mode accents. */
export const MEDIA_ACCENTS = {
    anime: {
        text: 'text-sky-500 dark:text-sky-300',
        dot: 'bg-sky-400',
        bar: 'from-sky-400 to-sky-400/10',
        iconTile: 'bg-sky-500/10 text-sky-600 dark:text-sky-300 ring-sky-400/20',
        glow: 'rgba(56,189,248,0.18)',
        hairline: 'via-sky-400/50',
        chipActive: 'border-sky-400/60 bg-sky-500/12 text-sky-600 dark:text-sky-300 shadow-[0_4px_14px_-6px_rgba(56,189,248,0.4)]',
    },
    manga: {
        text: 'text-amber-500 dark:text-amber-300',
        dot: 'bg-amber-400',
        bar: 'from-amber-400 to-amber-400/10',
        iconTile: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 ring-amber-400/20',
        glow: 'rgba(251,191,36,0.18)',
        hairline: 'via-amber-400/50',
        chipActive: 'border-amber-400/60 bg-amber-500/12 text-amber-600 dark:text-amber-300 shadow-[0_4px_14px_-6px_rgba(251,191,36,0.4)]',
    },
    hmanhwa: {
        text: 'text-rose-500 dark:text-rose-300',
        dot: 'bg-rose-400',
        bar: 'from-rose-400 to-rose-400/10',
        iconTile: 'bg-rose-500/10 text-rose-600 dark:text-rose-300 ring-rose-400/20',
        glow: 'rgba(251,113,133,0.18)',
        hairline: 'via-rose-400/50',
        chipActive: 'border-rose-400/60 bg-rose-500/12 text-rose-600 dark:text-rose-300 shadow-[0_4px_14px_-6px_rgba(251,113,133,0.4)]',
    },
    hentai: {
        text: 'text-fuchsia-500 dark:text-fuchsia-300',
        dot: 'bg-fuchsia-400',
        bar: 'from-fuchsia-400 to-fuchsia-400/10',
        iconTile: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300 ring-fuchsia-400/20',
        glow: 'rgba(232,121,249,0.18)',
        hairline: 'via-fuchsia-400/50',
        chipActive: 'border-fuchsia-400/60 bg-fuchsia-500/12 text-fuchsia-600 dark:text-fuchsia-300 shadow-[0_4px_14px_-6px_rgba(232,121,249,0.4)]',
    },
    library: {
        text: 'text-lime-600 dark:text-lime-300',
        dot: 'bg-lime-400',
        bar: 'from-lime-400 to-lime-400/10',
        iconTile: 'bg-lime-500/10 text-lime-700 dark:text-lime-300 ring-lime-400/20',
        glow: 'rgba(198,255,0,0.18)',
        hairline: 'via-lime-400/50',
        chipActive: 'border-primary/60 bg-primary/12 text-lime-700 dark:text-lime-300 shadow-[0_4px_14px_-6px_rgba(198,255,0,0.4)]',
    },
    calendar: {
        text: 'text-violet-500 dark:text-violet-300',
        dot: 'bg-violet-400',
        bar: 'from-violet-400 to-violet-400/10',
        iconTile: 'bg-violet-500/10 text-violet-600 dark:text-violet-300 ring-violet-400/20',
        glow: 'rgba(167,139,250,0.18)',
        hairline: 'via-violet-400/50',
        chipActive: 'border-violet-400/60 bg-violet-500/12 text-violet-600 dark:text-violet-300 shadow-[0_4px_14px_-6px_rgba(167,139,250,0.4)]',
    },
}

export function mediaAccent(id) {
    return MEDIA_ACCENTS[id] || MEDIA_ACCENTS.anime
}

/**
 * Page header: icon tile with accent ring, kicker with live dot, display title,
 * optional subtitle, and a right-side actions slot.
 */
export function MediaPageHeader({ accent = 'anime', icon = null, kicker, title, subtitle, actions = null }) {
    const a = mediaAccent(accent)
    return (
        <div className="relative pb-5">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div className="flex min-w-0 items-center gap-4">
                    {icon && (
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${a.iconTile}`}>
                            {icon}
                        </span>
                    )}
                    <div className="min-w-0">
                        {kicker && (
                            <p className={`mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] ${a.text}`}>
                                <span className={`inline-block h-1.5 w-1.5 rounded-full ${a.dot} animate-pulse`} aria-hidden />
                                {kicker}
                            </p>
                        )}
                        <h1 className="truncate text-[26px] font-black leading-none tracking-tight text-(--color-text-primary) sm:text-[30px]">
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="mt-1.5 text-[12px] leading-snug text-(--color-text-secondary)">{subtitle}</p>
                        )}
                    </div>
                </div>
                {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
            </div>
            {/* Accent hairline */}
            <div className={`absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent ${a.hairline} to-transparent`} aria-hidden />
        </div>
    )
}

/** Section title  accent bar + bold label. No all-caps kickers. */
export function MediaSectionTitle({ accent = 'anime', title, hint, action = null }) {
    const a = mediaAccent(accent)
    return (
        <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <span className={`h-5 w-0.75 rounded-full bg-linear-to-b ${a.bar}`} aria-hidden />
                <h2 className="text-[15px] font-black leading-none tracking-tight text-(--color-text-primary) sm:text-[17px]">{title}</h2>
                {hint && (
                    <span className="hidden rounded-full bg-(--color-surface-muted) px-2.5 py-0.5 text-[10px] font-semibold text-(--color-text-secondary) sm:inline-block">
                        {hint}
                    </span>
                )}
            </div>
            {action}
        </div>
    )
}

/** Round glass arrow button. */
export function MediaArrowButton({ onClick, disabled = false, direction = 'right', label, size = 'md' }) {
    const dims = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8'
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label || (direction === 'left' ? 'Previous' : 'Next')}
            className={`flex ${dims} items-center justify-center rounded-full border border-(--color-border-soft) bg-(--color-surface) text-(--color-text-secondary) shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-primary/45 hover:text-(--color-text-primary) hover:shadow-md active:scale-95 disabled:pointer-events-none disabled:opacity-30`}
        >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" aria-hidden>
                {direction === 'left'
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />}
            </svg>
        </button>
    )
}

/** Filter chip  primary accent when active. */
export function mediaChipClass(active) {
    return `whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[11px] font-bold transition-all duration-200 ${
        active
            ? 'border-primary bg-primary text-black shadow-[0_6px_18px_-6px_rgba(198,255,0,0.5)]'
            : 'border-(--color-border-soft) bg-(--color-surface) text-(--color-text-secondary) hover:-translate-y-px hover:border-(--color-border-strong) hover:text-(--color-text-primary)'
    }`
}

/** Neutral chip (for secondary filter rows). */
export function mediaChipNeutralClass(active) {
    return `whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[11px] font-bold transition-all duration-200 ${
        active
            ? 'border-(--color-text-primary) bg-(--color-text-primary) text-(--color-surface)'
            : 'border-(--color-border-soft) bg-(--color-surface) text-(--color-text-secondary) hover:-translate-y-px hover:border-(--color-border-strong) hover:text-(--color-text-primary)'
    }`
}

/** Search input shared by media pages. */
export const mediaSearchInputClass =
    'w-full rounded-2xl border border-(--color-border-soft) bg-(--color-surface) py-3 pl-10 pr-4 text-[13px] font-medium text-(--color-text-primary) shadow-sm transition-all duration-200 placeholder:text-(--color-text-secondary)/60 focus:border-primary/55 focus:outline-none focus:ring-4 focus:ring-primary/10'

export const mediaPrimaryButtonClass =
    'inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-[13px] font-black text-(--color-ink-strong) shadow-[0_8px_22px_-8px_rgba(198,255,0,0.55)] transition-all duration-200 hover:-translate-y-px hover:brightness-105 active:scale-[0.97] disabled:opacity-50'

/** Poster frame  hover lift + primary ring. */
export const mediaPosterFrameClass =
    'relative overflow-hidden rounded-[16px] ring-1 ring-(--color-border-soft) bg-(--color-surface-muted) shadow-sm transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-[0_22px_48px_-16px_rgba(0,0,0,0.5)] group-hover:ring-primary/65'

/** Pill pager. */
export function MediaPager({ page, canPrev, canNext, onPage }) {
    return (
        <div
            className="fixed inset-x-0 bottom-4 z-30 flex items-center justify-center px-4"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            <div className="flex items-center gap-2 rounded-full border border-(--color-border-soft) bg-(--color-surface)/90 backdrop-blur-xl p-1.5 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.4)]">
                <button
                    type="button"
                    disabled={!canPrev}
                    onClick={() => onPage(page - 1)}
                    className="rounded-full px-4 py-1.5 text-[12px] font-bold text-(--color-text-primary) transition-all hover:bg-(--color-surface-muted) disabled:opacity-30"
                >
                    ← Prev
                </button>
                <span className="px-2 text-[12px] font-black tabular-nums text-(--color-text-secondary)">
                    Page {page}
                </span>
                <button
                    type="button"
                    disabled={!canNext}
                    onClick={() => onPage(page + 1)}
                    className="rounded-full px-4 py-1.5 text-[12px] font-bold text-(--color-text-primary) transition-all hover:bg-(--color-surface-muted) disabled:opacity-30"
                >
                    Next →
                </button>
            </div>
        </div>
    )
}

/** Empty / error state. */
export function MediaEmptyState({ accent = 'anime', title = 'Nothing here yet', message, action = null }) {
    const a = mediaAccent(accent)
    return (
        <div className="relative overflow-hidden rounded-3xl border border-(--color-border-soft) bg-(--color-surface) px-6 py-14 text-center shadow-sm">
            <div className={`pointer-events-none absolute inset-x-12 top-0 h-px bg-linear-to-r from-transparent ${a.hairline} to-transparent`} aria-hidden />
            <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${a.iconTile}`}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
            </div>
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
