import { useState } from 'react'
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

const IconCatchUp = ({ className = 'h-3.5 w-3.5' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
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
 * Post-sync panel with two modes:
 *  - "New chapters" deck: manga with brand-new chapters (hasNewChapter)
 *  - "Catch up" deck: manga where the reader is behind (behind)
 *
 * A toggle button switches between the two decks. Only visible when either list
 * has items. Dismissals are handled by the parent via onRead / onDismiss.
 */
export default function NewMangaToReadPanel({
    items,
    catchUpItems = [],
    onRead,
    onDismiss,
    onDismissAll,
    onReadCatchUp,
    busy = false,
}) {
    const [mode, setMode] = useState('new')

    const newCount = Array.isArray(items) ? items.length : 0
    const catchCount = Array.isArray(catchUpItems) ? catchUpItems.length : 0

    if (newCount === 0 && catchCount === 0) return null

    // Auto-switch mode if the active tab becomes empty
    const activeMode = mode === 'new' && newCount === 0 ? 'catchup' : mode === 'catchup' && catchCount === 0 ? 'new' : mode
    const activeItems = activeMode === 'new' ? items : catchUpItems
    const count = activeMode === 'new' ? newCount : catchCount

    const isNew = activeMode === 'new'
    const accentGlow = isNew
        ? 'shadow-[0_24px_60px_-30px_rgba(198,255,0,0.45)]'
        : 'shadow-[0_24px_60px_-30px_rgba(251,191,36,0.35)]'
    const borderColor = isNew ? 'border-primary/25' : 'border-amber-400/30'
    const topSeam = isNew
        ? 'bg-linear-to-r from-transparent via-primary to-transparent'
        : 'bg-linear-to-r from-transparent via-amber-400 to-transparent'
    const cornerGlow = isNew ? 'bg-primary/15' : 'bg-amber-400/10'
    const badgeBg = isNew ? 'bg-primary text-black' : 'bg-amber-400 text-black'
    const iconBg = isNew
        ? 'bg-primary text-black shadow-[0_8px_20px_-8px_rgba(198,255,0,0.8)]'
        : 'bg-amber-400 text-black shadow-[0_8px_20px_-8px_rgba(251,191,36,0.6)]'
    const cardHoverGlow = isNew
        ? 'group-hover:shadow-[0_16px_36px_-18px_rgba(198,255,0,0.55)] group-hover:ring-primary/70'
        : 'group-hover:shadow-[0_16px_36px_-18px_rgba(251,191,36,0.45)] group-hover:ring-amber-400/60'
    const cardBadgeCls = isNew
        ? 'bg-primary text-black'
        : 'bg-amber-400 text-black'
    const readBtnCls = isNew
        ? 'bg-primary text-black'
        : 'bg-amber-400 text-black'

    const handleRead = (entry) => {
        if (isNew) onRead?.(entry)
        else onReadCatchUp?.(entry)
    }

    const handleDismiss = (entry) => {
        onDismiss?.(entry)
    }

    const handleDismissAll = () => {
        onDismissAll?.(activeItems)
    }

    return (
        <MotionSection
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className={`relative overflow-hidden rounded-3xl border ${borderColor} bg-(--color-surface) ${accentGlow}`}
        >
            {/* neon top seam */}
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-px ${topSeam}`} aria-hidden />
            <div className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full ${cornerGlow} blur-3xl`} aria-hidden />

            <div className="relative px-4 pt-4 pb-3 sm:px-6 sm:pt-5">
                {/* ── Header ── */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${iconBg}`}>
                            {isNew ? <IconSpark className="h-5 w-5" /> : <IconCatchUp className="h-5 w-5" />}
                            <span className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/10" aria-hidden />
                        </span>
                        <div className="min-w-0">
                            <h2 className="flex items-center gap-2 text-[15px] font-black tracking-tight text-(--color-text-primary) sm:text-[17px]">
                                {isNew ? 'New chapters waiting' : 'Catch up'}
                                <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full ${badgeBg} px-1.5 text-[11px] font-black tabular-nums`}>
                                    {count}
                                </span>
                            </h2>
                            <p className="mt-0.5 truncate text-[11px] text-(--color-text-secondary)">
                                {isNew
                                    ? 'Synced just now — open one to jump straight to the latest chapter.'
                                    : 'You\'re behind on these — jump in to catch up.'}
                            </p>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        {/* Toggle between New / Catch up */}
                        <div className="flex rounded-xl border border-(--color-border-soft) bg-(--color-surface-muted) p-0.5">
                            <button
                                type="button"
                                onClick={() => setMode('new')}
                                disabled={newCount === 0}
                                className={`flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold transition disabled:opacity-40 ${activeMode === 'new' ? 'bg-(--color-surface) text-primary shadow-sm' : 'text-(--color-text-secondary) hover:text-(--color-text-primary)'}`}
                            >
                                <IconSpark className="h-3 w-3" />
                                <span>New</span>
                                {newCount > 0 && (
                                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/20 px-1 text-[9px] font-black tabular-nums text-primary">
                                        {newCount}
                                    </span>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('catchup')}
                                disabled={catchCount === 0}
                                className={`flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold transition disabled:opacity-40 ${activeMode === 'catchup' ? 'bg-(--color-surface) text-amber-400 shadow-sm' : 'text-(--color-text-secondary) hover:text-(--color-text-primary)'}`}
                            >
                                <IconCatchUp className="h-3 w-3" />
                                <span>Catch up</span>
                                {catchCount > 0 && (
                                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400/20 px-1 text-[9px] font-black tabular-nums text-amber-400">
                                        {catchCount}
                                    </span>
                                )}
                            </button>
                        </div>

                        {count > 1 && (
                            <button
                                type="button"
                                onClick={handleDismissAll}
                                disabled={busy}
                                className="shrink-0 rounded-xl border border-(--color-border-soft) bg-(--color-surface) px-3 py-1.5 text-[11px] font-semibold text-(--color-text-secondary) transition hover:bg-(--color-surface-muted) hover:text-(--color-text-primary) disabled:opacity-50"
                            >
                                Clear all
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Cover deck  horizontal snap rail ── */}
                <div className="-mx-4 mt-4 sm:-mx-6">
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={activeMode}
                            initial={{ opacity: 0, x: activeMode === 'new' ? -12 : 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: activeMode === 'new' ? 12 : -12 }}
                            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <div className="flex gap-3.5 overflow-x-auto overflow-y-hidden px-4 pb-3 sm:gap-4 sm:px-6 hide-scrollbar overscroll-x-contain snap-x snap-mandatory scroll-pl-4 sm:scroll-pl-6">
                                <AnimatePresence mode="popLayout" initial={false}>
                                    {activeItems.map((entry) => {
                                        const key = `${entry.source}:${entry.mangaId}`
                                        const title = decodeHtmlEntities(entry.title) || 'Untitled'
                                        const latest = entry.remoteLatestChapterLabel || entry.lastChapterLabel || ''
                                        const chaptersBehind = entry.chaptersBehind
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
                                                    onClick={() => handleRead(entry)}
                                                    disabled={busy}
                                                    className="block w-full text-left outline-none disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-(--color-surface) rounded-[18px]"
                                                    title={isNew ? `Read ${title}` : `Catch up on ${title}`}
                                                >
                                                    <div className={`relative overflow-hidden rounded-[18px] bg-(--color-surface-muted) shadow-sm ring-1 ring-(--color-border-soft) transition duration-300 group-hover:-translate-y-1 ${cardHoverGlow} group-active:translate-y-0`}>
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

                                                            {/* Badge */}
                                                            <span className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full ${cardBadgeCls} px-2 py-0.5 text-[9px] font-black uppercase tracking-wide shadow-sm`}>
                                                                <span className="h-1.5 w-1.5 rounded-full bg-black/80" aria-hidden />
                                                                {isNew ? 'New' : chaptersBehind > 0 ? `+${chaptersBehind}` : 'Behind'}
                                                            </span>

                                                            {/* hover read affordance */}
                                                            <div className={`pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-linear-to-t from-black/85 via-black/35 to-transparent pb-2.5 pt-6 opacity-0 transition duration-200 group-hover:opacity-100`}>
                                                                <span className={`inline-flex items-center gap-1 rounded-full ${readBtnCls} px-2.5 py-1 text-[9px] font-black uppercase tracking-wide`}>
                                                                    {isNew ? 'Read' : 'Catch up'} <IconArrow className="h-3 w-3" />
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </button>

                                                {/* dismiss without reading */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleDismiss(entry)}
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
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </MotionSection>
    )
}
