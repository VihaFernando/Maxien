import { AnimatePresence, motion } from 'framer-motion'
import { LifesyncEpisodeThumbnail } from './EpisodeLoadingSkeletons'
import { mangaImageProps, decodeHtmlEntities } from '../../lib/mangaChapterUtils'

const MotionSection = motion.section
const MotionArticle = motion.article

const cardMotion = {
    initial: { opacity: 0, y: 16, scale: 0.96 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, scale: 0.9, transition: { duration: 0.18 } },
}

function sourceLabel(source) {
    if (source === 'mangadistrict') return 'District'
    if (source === 'mangadna') return 'MangaDNA'
    if (source === 'roliascan') return 'RoliaScan'
    return source || 'Manga'
}

const IconSpark = ({ className = 'h-3.5 w-3.5' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3m9-9h-3M6 12H3m13.5-6.5L14 8M8 14l-2.5 2.5m11 0L14 14M8 8L5.5 5.5" />
    </svg>
)

const IconClose = ({ className = 'h-3 w-3' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
)

const IconArrow = ({ className = 'h-3.5 w-3.5' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
    </svg>
)

/**
 * Post-sync "New chapters waiting" deck. Cover art leads; the card is a single
 * affordance  pressing it opens the reader and the parent drops it from the deck.
 * The ✕ dismisses without reading. Both are persisted by the caller's hook.
 */
export default function NewMangaToReadPanel({ items, onRead, onDismiss, onDismissAll, busy = false }) {
    const count = Array.isArray(items) ? items.length : 0
    if (count === 0) return null

    return (
        <MotionSection
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-3xl border border-primary/25 bg-(--color-surface) shadow-[0_24px_60px_-30px_rgba(198,255,0,0.45)]"
        >
            {/* neon top seam + ambient corner glow  the "fresh" signal */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary to-transparent" aria-hidden />
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl" aria-hidden />

            <div className="relative px-4 pt-4 pb-3 sm:px-6 sm:pt-5">
                {/* ── Header ── */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-black shadow-[0_8px_20px_-8px_rgba(198,255,0,0.8)]">
                            <IconSpark className="h-5 w-5" />
                            <span className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/10" aria-hidden />
                        </span>
                        <div className="min-w-0">
                            <h2 className="flex items-center gap-2 text-[15px] font-black tracking-tight text-(--color-text-primary) sm:text-[17px]">
                                New chapters waiting
                                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-black tabular-nums text-black">
                                    {count}
                                </span>
                            </h2>
                            <p className="mt-0.5 truncate text-[11px] text-(--color-text-secondary)">
                                Synced just now  open one to jump straight to the latest chapter.
                            </p>
                        </div>
                    </div>
                    {count > 1 && (
                        <button
                            type="button"
                            onClick={onDismissAll}
                            disabled={busy}
                            className="shrink-0 rounded-xl border border-(--color-border-soft) bg-(--color-surface) px-3 py-1.5 text-[11px] font-semibold text-(--color-text-secondary) transition hover:bg-(--color-surface-muted) hover:text-(--color-text-primary) disabled:opacity-50"
                        >
                            Clear all
                        </button>
                    )}
                </div>

                {/* ── Cover deck  horizontal snap rail ── */}
                <div className="-mx-4 mt-4 sm:-mx-6">
                    <div className="flex gap-3.5 overflow-x-auto overflow-y-hidden px-4 pb-3 sm:gap-4 sm:px-6 hide-scrollbar overscroll-x-contain snap-x snap-mandatory scroll-pl-4 sm:scroll-pl-6">
                        <AnimatePresence mode="popLayout" initial={false}>
                            {items.map((entry) => {
                                const key = `${entry.source}:${entry.mangaId}`
                                const title = decodeHtmlEntities(entry.title) || 'Untitled'
                                const latest = entry.remoteLatestChapterLabel || entry.lastChapterLabel || ''
                                return (
                                    <MotionArticle
                                        key={key}
                                        layout
                                        {...cardMotion}
                                        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                                        className="group relative w-31 shrink-0 snap-start sm:w-34"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => onRead?.(entry)}
                                            disabled={busy}
                                            className="block w-full text-left outline-none disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-(--color-surface) rounded-[18px]"
                                            title={`Read ${title}`}
                                        >
                                            <div className="relative overflow-hidden rounded-[18px] bg-(--color-surface-muted) shadow-sm ring-1 ring-(--color-border-soft) transition duration-300 group-hover:-translate-y-1 group-hover:ring-primary/70 group-hover:shadow-[0_16px_36px_-18px_rgba(198,255,0,0.55)] group-active:translate-y-0">
                                                <div className="relative aspect-2/3 w-full">
                                                    {entry.coverUrl ? (
                                                        <LifesyncEpisodeThumbnail
                                                            src={entry.coverUrl}
                                                            className="absolute inset-0 h-full w-full"
                                                            imgClassName="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]"
                                                            imgProps={mangaImageProps(entry.coverUrl)}
                                                        />
                                                    ) : (
                                                        <div className="flex h-full items-center justify-center text-(--color-border-strong)">
                                                            <svg className="h-9 w-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" aria-hidden>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75v14.25A8.987 8.987 0 0112 18c2.305 0 4.408.867 6 2.292V7.758c-1.063-.865-2.29-1.507-3.6-1.875" />
                                                            </svg>
                                                        </div>
                                                    )}

                                                    {/* NEW badge */}
                                                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-black shadow-sm">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-black/80" aria-hidden />
                                                        New
                                                    </span>

                                                    {/* hover read affordance */}
                                                    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-linear-to-t from-black/85 via-black/35 to-transparent pb-2.5 pt-6 opacity-0 transition duration-200 group-hover:opacity-100">
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-black">
                                                            Read <IconArrow className="h-3 w-3" />
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </button>

                                        {/* dismiss without reading */}
                                        <button
                                            type="button"
                                            onClick={() => onDismiss?.(entry)}
                                            disabled={busy}
                                            className="absolute right-1.5 top-1.5 z-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white opacity-0 ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-black/85 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
                                            aria-label={`Dismiss ${title}`}
                                        >
                                            <IconClose />
                                        </button>

                                        <p className="mt-2 line-clamp-2 text-[11px] font-bold leading-tight text-(--color-text-primary)">
                                            {title}
                                        </p>
                                        <p className="mt-0.5 line-clamp-1 text-[9.5px] font-semibold text-(--color-text-secondary)">
                                            {sourceLabel(entry.source)}
                                            {latest ? ` · ${latest}` : ''}
                                        </p>
                                    </MotionArticle>
                                )
                            })}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </MotionSection>
    )
}
