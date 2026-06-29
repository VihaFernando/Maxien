import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LifesyncEpisodeThumbnail } from './EpisodeLoadingSkeletons'
import { mangaImageProps, decodeHtmlEntities } from '../../lib/mangaChapterUtils'

const SOURCE_ORDER = ['roliascan', 'mangadistrict', 'mangadna']

function sourceLabel(source) {
    if (source === 'roliascan') return 'Roliascan'
    if (source === 'mangadistrict') return 'District'
    if (source === 'mangadna') return 'MangaDNA'
    return source || ''
}

function sourceAccent(source) {
    if (source === 'roliascan') return 'text-primary'
    if (source === 'mangadistrict') return 'text-sky-400'
    if (source === 'mangadna') return 'text-violet-400'
    return 'text-(--color-text-secondary)'
}

const IconSpinner = () => (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity=".3" />
        <path strokeLinecap="round" d="M12 2v4" />
    </svg>
)

/**
 * Floating dropdown that shows manga search suggestions grouped by source.
 * Renders into a portal (document.body) so it's never clipped.
 *
 * Props:
 *   suggestions  – bySource map from useMangaSearchSuggestions
 *   loading      – boolean, show spinner while fetching
 *   query        – current query string (for highlighting)
 *   anchorRef    – ref to the input element (used for positioning)
 *   onSelect     – (manga) => void, called when user clicks a suggestion
 *   onClose      – () => void, called on Escape or outside click
 */
export default function MangaSearchSuggestions({
    suggestions,
    loading,
    query,
    anchorRef,
    onSelect,
    onClose,
}) {
    const dropRef = useRef(null)

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (dropRef.current?.contains(e.target)) return
            if (anchorRef?.current?.contains(e.target)) return
            onClose?.()
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [anchorRef, onClose])

    // Close on Escape
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose?.() }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [onClose])

    const hasAny = suggestions && SOURCE_ORDER.some((s) => suggestions[s]?.length > 0)
    const showDropdown = loading || hasAny

    if (!showDropdown) return null

    // Build grouped list — only sources that returned results
    const groups = SOURCE_ORDER
        .map((source) => ({ source, items: suggestions?.[source] || [] }))
        .filter((g) => g.items.length > 0)

    // Highlight matching chars in title
    const highlight = (text, q) => {
        if (!q || !text) return text
        const idx = text.toLowerCase().indexOf(q.toLowerCase())
        if (idx === -1) return text
        return (
            <>
                {text.slice(0, idx)}
                <mark className="bg-primary/25 text-(--color-text-primary) rounded-sm px-px">{text.slice(idx, idx + q.length)}</mark>
                {text.slice(idx + q.length)}
            </>
        )
    }

    return (
        <AnimatePresence>
            <motion.div
                ref={dropRef}
                key="suggestions"
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 480, damping: 32 }}
                className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border border-(--color-border-soft) bg-(--color-surface) shadow-[0_16px_48px_-12px_rgba(0,0,0,0.35)] backdrop-blur-xl"
            >
                {/* Loading state */}
                {loading && !hasAny && (
                    <div className="flex items-center gap-2.5 px-4 py-3.5 text-[12px] text-(--color-text-secondary)">
                        <IconSpinner />
                        <span>Searching all sources…</span>
                    </div>
                )}

                {/* Results grouped by source */}
                {groups.map(({ source, items }, gi) => (
                    <div key={source} className={gi > 0 ? 'border-t border-(--color-border-soft)' : ''}>
                        {/* Source header */}
                        <div className="flex items-center gap-2 px-3.5 pt-2.5 pb-1">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${sourceAccent(source)}`}>
                                {sourceLabel(source)}
                            </span>
                            <span className="text-[10px] text-(--color-text-secondary) tabular-nums">{items.length}</span>
                            {loading && <IconSpinner />}
                        </div>

                        {/* Items */}
                        <ul role="listbox">
                            {items.slice(0, 6).map((manga, idx) => {
                                const id = String(manga?.id || manga?.slug || '')
                                const title = decodeHtmlEntities(String(manga?.title || ''))
                                const cover = manga?.coverUrl || manga?.posterUrl || ''
                                const status = manga?.status || ''
                                const chapterLabel = manga?.lastChapter?.title || manga?.latestChapter?.title || ''

                                return (
                                    <li key={`${source}-${id}-${idx}`} role="option">
                                        <button
                                            type="button"
                                            onClick={() => onSelect?.({ ...manga, id, source })}
                                            className="flex w-full items-center gap-3 px-3.5 py-2 text-left transition-colors hover:bg-(--color-surface-muted) active:bg-(--color-surface-muted) focus-visible:bg-(--color-surface-muted) focus-visible:outline-none"
                                        >
                                            {/* Cover thumbnail */}
                                            <div className="relative h-11 w-8 shrink-0 overflow-hidden rounded-lg bg-(--color-surface-muted)">
                                                {cover ? (
                                                    <LifesyncEpisodeThumbnail
                                                        src={cover}
                                                        className="absolute inset-0 h-full w-full"
                                                        imgClassName="h-full w-full object-cover"
                                                        imgProps={mangaImageProps(cover)}
                                                    />
                                                ) : (
                                                    <div className="flex h-full items-center justify-center text-(--color-border-strong)">
                                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75v14.25A8.987 8.987 0 0112 18c2.305 0 4.408.867 6 2.292V7.758c-1.063-.865-2.29-1.507-3.6-1.875" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-[12.5px] font-semibold leading-snug text-(--color-text-primary)">
                                                    {highlight(title, query)}
                                                </p>
                                                <div className="mt-0.5 flex items-center gap-1.5">
                                                    {status && (
                                                        <span className={`text-[10px] font-bold ${status.toLowerCase().includes('ongoing') || status.toLowerCase().includes('on going') ? 'text-primary' : 'text-(--color-text-secondary)'}`}>
                                                            {status}
                                                        </span>
                                                    )}
                                                    {chapterLabel && (
                                                        <span className="truncate text-[10px] text-(--color-text-secondary)">
                                                            {status ? '· ' : ''}{chapterLabel}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Arrow */}
                                            <svg className="h-3.5 w-3.5 shrink-0 text-(--color-border-strong)" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                ))}

                {/* No results */}
                {!loading && hasAny === false && (
                    <div className="px-4 py-3.5 text-[12px] text-(--color-text-secondary)">
                        No results for <span className="font-semibold text-(--color-text-primary)">"{query}"</span>
                    </div>
                )}

                {/* Footer hint */}
                {hasAny && (
                    <div className="border-t border-(--color-border-soft) px-3.5 py-2 text-[10px] text-(--color-text-secondary)">
                        Click any result to open details
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    )
}
