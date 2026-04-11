import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LifesyncEpisodeThumbnail, LifesyncHubMangaRailSkeleton, LifesyncMangaRailSkeleton } from './EpisodeLoadingSkeletons'
import { mangadexImageProps } from '../../lib/mangaChapterUtils'

function sourceLabel(source) {
    if (source === 'mangadistrict') return 'District'
    if (source === 'hentaifox') return 'HentaiFox'
    return source || 'MangaDex'
}

/** Full-width horizontal “shelf” for the Manga page — not a generic grid. */
export function MangaReadingShelf({
    entries,
    loading,
    syncBusy,
    nsfwHiddenCount = 0,
    suggestions = [],
    onPickSuggestion,
    onRefresh,
    onSync,
    onContinue,
    onRemove,
    continueDisabled,
}) {
    const [expanded, setExpanded] = useState(false)
    const hasItems = entries.length > 0

    const statusLine = hasItems
        ? `${entries.length} title${entries.length === 1 ? '' : 's'} on your shelf`
        : loading
          ? 'Loading your shelf…'
          : 'Pick a manga below — progress saves automatically'

    const compactSubtitle = (() => {
        let s = statusLine
        if (nsfwHiddenCount > 0) {
            s += ` · ${nsfwHiddenCount} hidden (NSFW off)`
        }
        return s
    })()

    const showSuggestions = !loading && !hasItems && Array.isArray(suggestions) && suggestions.length > 0

    return (
        <section className="relative overflow-hidden rounded-[24px] border border-white/90 bg-gradient-to-br from-white via-[#faf8ff] to-[#fff7ed] shadow-[0_12px_40px_-14px_rgba(100,90,130,0.12)] ring-1 ring-[#e8e4ef]/70 sm:rounded-[28px]">
            <div
                className="pointer-events-none absolute right-0 top-0 h-40 w-40 translate-x-1/4 -translate-y-1/4 rounded-full bg-[#a78bfa]/15 blur-3xl"
                aria-hidden
            />
            <div className={expanded ? 'relative px-4 py-4 sm:px-6 sm:py-5' : 'relative px-4 py-2.5 sm:px-5'}>
                {!expanded ? (
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#fef3c7] to-[#d9f99d] text-[#1a1628] shadow-sm ring-1 ring-white">
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75" aria-hidden>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                                    </svg>
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-[13px] font-bold tracking-tight text-[#1d1d1f]">Continue reading</h2>
                                    <p className="truncate text-[10px] text-[#86868b]">{compactSubtitle}</p>
                                </div>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                                <button
                                    type="button"
                                    onClick={onRefresh}
                                    disabled={loading || syncBusy}
                                    className="rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] px-2.5 py-1.5 text-[10px] font-semibold text-[#1d1d1f] transition-colors hover:bg-[#ebebed] disabled:opacity-50"
                                >
                                    {loading ? '…' : 'Refresh'}
                                </button>
                                <button
                                    type="button"
                                    onClick={onSync}
                                    disabled={loading || syncBusy || !hasItems}
                                    className="rounded-lg bg-[#C6FF00] px-2.5 py-1.5 text-[10px] font-semibold text-[#1d1d1f] shadow-sm transition-colors hover:brightness-95 disabled:opacity-50"
                                >
                                    {syncBusy ? '…' : 'Sync'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setExpanded(true)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-[#e5e5ea] bg-white px-2.5 py-1.5 text-[10px] font-semibold text-[#1d1d1f] transition-colors hover:bg-[#fafafa]"
                                    aria-expanded={false}
                                >
                                    Expand
                                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {hasItems && (
                            <div className="-mx-4 sm:-mx-5 sm:hidden">
                                <div className="flex max-w-full min-w-0 gap-3 overflow-x-auto overflow-y-hidden px-4 sm:px-5 pb-0.5 hide-scrollbar overscroll-x-contain snap-x snap-mandatory scroll-pl-4 scroll-pr-4">
                                    {entries.slice(0, 12).map((entry) => (
                                        <button
                                            key={`${entry.source}-${entry.mangaId}-${entry.lastChapterId || 'unknown'}`}
                                            type="button"
                                            onClick={() => onContinue?.(entry)}
                                            disabled={continueDisabled}
                                            className="group w-[92px] shrink-0 snap-start text-left disabled:opacity-60"
                                            title="Resume"
                                        >
                                            <div className="overflow-hidden rounded-xl border border-[#d2d2d7]/50 bg-white shadow-sm ring-2 ring-transparent transition-all group-hover:ring-[#C6FF00]/60 group-hover:shadow-md">
                                                <div className="relative aspect-[2/3] bg-[#f5f5f7]">
                                                    {entry.coverUrl ? (
                                                        <LifesyncEpisodeThumbnail
                                                            src={entry.coverUrl}
                                                            className="absolute inset-0 h-full w-full"
                                                            imgClassName="h-full w-full object-cover"
                                                            imgProps={mangadexImageProps(entry.coverUrl)}
                                                        />
                                                    ) : null}
                                                    <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/55 via-black/10 to-transparent pb-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                                                        <span className="rounded-full bg-[#C6FF00] px-2.5 py-1 text-[8px] font-bold uppercase tracking-wide text-[#1a1628] shadow-md ring-1 ring-black/10">
                                                            Resume
                                                        </span>
                                                    </div>
                                                    {entry.hasNewChapter && (
                                                        <span className="absolute left-1 top-1 h-2 w-2 rounded-full bg-[#C6FF00] ring-2 ring-white" title="New chapter" />
                                                    )}
                                                </div>
                                            </div>
                                            <p className="mt-1.5 line-clamp-2 text-[9px] font-medium leading-tight text-[#1d1d1f]">
                                                {entry.title}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-2 px-4 flex items-center justify-between">
                                    <p className="text-[10px] text-[#86868b]">Tap a cover to resume</p>
                                    <button
                                        type="button"
                                        onClick={() => setExpanded(true)}
                                        className="text-[10px] font-semibold text-[#1d1d1f] hover:underline"
                                    >
                                        View all
                                    </button>
                                </div>
                            </div>
                        )}

                        {showSuggestions && (
                            <div className="-mx-4 sm:-mx-5">
                                <div className="flex max-w-full min-w-0 gap-3 overflow-x-auto overflow-y-hidden px-4 sm:px-5 pb-0.5 hide-scrollbar overscroll-x-contain snap-x snap-mandatory scroll-pl-4 scroll-pr-4 sm:scroll-pl-5 sm:scroll-pr-5">
                                    {suggestions.slice(0, 10).map((m) => (
                                        <button
                                            key={`${m.source || 'mangadex'}-${m.id}`}
                                            type="button"
                                            onClick={() => onPickSuggestion?.(m)}
                                            className="group w-[92px] shrink-0 snap-start text-left"
                                        >
                                            <div className="overflow-hidden rounded-xl border border-[#d2d2d7]/50 bg-white shadow-sm ring-2 ring-transparent transition-all group-hover:ring-[#C6FF00]/60 group-hover:shadow-md">
                                                <div className="relative aspect-[2/3] bg-[#f5f5f7]">
                                                    {m.coverUrl ? (
                                                        <LifesyncEpisodeThumbnail
                                                            src={m.coverUrl}
                                                            className="absolute inset-0 h-full w-full"
                                                            imgClassName="h-full w-full object-cover"
                                                            imgProps={mangadexImageProps(m.coverUrl)}
                                                        />
                                                    ) : null}
                                                    <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/55 via-black/10 to-transparent pb-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                                                        <span className="rounded-full bg-[#a78bfa] px-2.5 py-1 text-[8px] font-bold uppercase tracking-wide text-white shadow-md ring-1 ring-black/20">
                                                            Open
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="mt-1.5 line-clamp-2 text-[9px] font-medium leading-tight text-[#1d1d1f]">
                                                {m.title}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-2 px-4 sm:px-5 flex items-center justify-between">
                                    <p className="text-[10px] text-[#86868b]">
                                        Suggestions — pick one to start tracking
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setExpanded(true)}
                                        className="text-[10px] font-semibold text-[#1d1d1f] hover:underline"
                                    >
                                        Browse
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#fef3c7] to-[#bfdbfe] text-[#1a1628] shadow-sm ring-2 ring-white">
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75" aria-hidden>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0112 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                                    </svg>
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-[15px] font-bold tracking-tight text-[#1d1d1f] sm:text-[17px]">Continue reading</h2>
                                    <p className="text-[11px] text-[#86868b]">{statusLine}</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={onRefresh}
                                    disabled={loading || syncBusy}
                                    className="rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] px-3 py-2 text-[11px] font-semibold text-[#1d1d1f] transition-colors hover:bg-[#ebebed] disabled:opacity-50"
                                >
                                    {loading ? 'Refreshing…' : 'Refresh'}
                                </button>
                                <button
                                    type="button"
                                    onClick={onSync}
                                    disabled={loading || syncBusy || !hasItems}
                                    className="rounded-xl bg-[#C6FF00] px-3 py-2 text-[11px] font-semibold text-[#1d1d1f] shadow-sm transition-colors hover:brightness-95 disabled:opacity-50"
                                >
                                    {syncBusy ? 'Syncing…' : 'Sync updates'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setExpanded(false)}
                                    className="inline-flex items-center gap-1 rounded-xl border border-[#e5e5ea] bg-white px-3 py-2 text-[11px] font-semibold text-[#1d1d1f] transition-colors hover:bg-[#fafafa]"
                                    aria-expanded
                                >
                                    Compact
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {nsfwHiddenCount > 0 && (
                            <p className="mb-3 text-[10px] text-[#86868b]">
                                NSFW is off — {nsfwHiddenCount} saved title{nsfwHiddenCount === 1 ? '' : 's'} hidden.
                            </p>
                        )}

                        {loading && !hasItems ? (
                    <LifesyncMangaRailSkeleton count={5} />
                ) : !hasItems ? (
                    <div className="rounded-[18px] border border-dashed border-[#e5e5ea] bg-[#fafafa] px-5 py-8 text-center">
                        <p className="text-[13px] font-medium text-[#1d1d1f]">Nothing on your shelf yet</p>
                        <p className="mt-1 text-[12px] text-[#86868b]">Browse Popular or Recent, open a chapter, and we’ll save your place.</p>
                    </div>
                ) : (
                    <div className="-mx-1 flex gap-4 overflow-x-auto pb-2 pt-1 px-1 snap-x snap-mandatory">
                        {entries.map(entry => (
                            <article
                                key={`${entry.source}-${entry.mangaId}-${entry.lastChapterId || 'unknown'}`}
                                className="group relative w-[148px] shrink-0 snap-start sm:w-[164px]"
                            >
                                <div className="overflow-hidden rounded-[18px] border border-[#d2d2d7]/50 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md">
                                    <div className="relative aspect-[2/3] w-full bg-[#f5f5f7]">
                                        {entry.coverUrl ? (
                                            <LifesyncEpisodeThumbnail
                                                src={entry.coverUrl}
                                                className="absolute inset-0 h-full w-full"
                                                imgClassName="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                                                imgProps={mangadexImageProps(entry.coverUrl)}
                                            />
                                        ) : (
                                            <div className="flex h-full items-center justify-center text-[#86868b]">
                                                <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75v14.25A8.987 8.987 0 0112 18c2.305 0 4.408.867 6 2.292V7.758c-1.063-.865-2.29-1.507-3.6-1.875" />
                                                </svg>
                                            </div>
                                        )}
                                        {entry.hasNewChapter && (
                                            <span className="absolute left-2 top-2 rounded-full bg-[#C6FF00]/90 px-2 py-0.5 text-[9px] font-bold text-[#1d1d1f]">
                                                New
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => onRemove?.(entry)}
                                            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-[#86868b] opacity-0 shadow-sm ring-1 ring-[#e5e5ea] transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                                            aria-label="Remove from shelf"
                                        >
                                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className="border-t border-[#f0f0f0] p-2.5">
                                        <p className="line-clamp-2 text-[11px] font-semibold leading-tight text-[#1d1d1f]">{entry.title}</p>
                                        <p className="mt-1 line-clamp-1 text-[9px] text-[#86868b]">
                                            {sourceLabel(entry.source)}
                                            {entry.lastChapterLabel ? ` · ${entry.lastChapterLabel}` : ''}
                                        </p>
                                        <button
                                            type="button"
                                            disabled={continueDisabled}
                                            onClick={() => onContinue?.(entry)}
                                            className="mt-2 w-full rounded-xl bg-gradient-to-r from-[#C6FF00] to-[#bef264] py-2 text-[11px] font-bold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 transition hover:brightness-95 disabled:opacity-50"
                                        >
                                            Resume
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
                    </>
                )}
            </div>
        </section>
    )
}

const MANGA_HUB_PATH = '/dashboard/lifesync/anime/manga'

function hubMangaResumeTarget(entry) {
    if (entry?.mangaId != null && entry?.source && entry?.lastChapterId != null) {
        return {
            to: `${MANGA_HUB_PATH}/read/${encodeURIComponent(String(entry.mangaId))}/${encodeURIComponent(String(entry.lastChapterId))}`,
            state: {
                from: MANGA_HUB_PATH,
                source: entry.source,
            },
        }
    }
    return { to: MANGA_HUB_PATH, state: { resumeEntry: entry } }
}

const hubRailFocusRing =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white'

/** Hub rail — manga resume strip (matches anime rail structure). */
export function LifeSyncHubMangaReading({ entries, loading, className = '' }) {
    if (!loading && entries.length === 0) return null

    return (
        <div className={`relative border-l-4 border-l-amber-400 pl-4 sm:pl-5 ${className}`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-900 shadow-sm ring-1 ring-amber-200/80">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75v14.25A8.987 8.987 0 0112 18c2.305 0 4.408.867 6 2.292V7.758a8.982 8.982 0 00-6-1.508z" />
                        </svg>
                    </span>
                    <div className="min-w-0 pt-0.5">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Reading</p>
                        <h3 className="text-[16px] font-black leading-tight tracking-tight text-slate-900 sm:text-[17px]">Manga shelf</h3>
                        <p className="mt-1 text-[12px] leading-snug text-slate-600">Continue from your last chapter.</p>
                    </div>
                </div>
                <Link
                    to={`${MANGA_HUB_PATH}/library`}
                    className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 self-start rounded-xl bg-amber-600 px-4 py-2.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-amber-700 sm:min-h-0 sm:shrink-0 sm:px-3 sm:py-2 ${hubRailFocusRing}`}
                >
                    Library
                    <span className="opacity-80" aria-hidden>
                        →
                    </span>
                </Link>
            </div>

            <div className="relative mt-5 flex min-w-0 w-full gap-3.5 overflow-x-auto overflow-y-hidden scroll-pl-1 scroll-pr-4 pb-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] snap-x snap-mandatory sm:gap-4 sm:scroll-pr-2 [&::-webkit-scrollbar]:hidden">
                {loading && entries.length === 0 ? (
                    <LifesyncHubMangaRailSkeleton count={5} />
                ) : (
                    entries.slice(0, 12).map((entry) => {
                        const { to, state } = hubMangaResumeTarget(entry)
                        return (
                            <Link
                                key={`${entry.source}-${entry.mangaId}-${entry.lastChapterId || 'unknown'}`}
                                to={to}
                                state={state ?? undefined}
                                className={`group w-[112px] shrink-0 snap-start sm:w-[118px] ${hubRailFocusRing} rounded-2xl outline-none`}
                            >
                                <div className="overflow-hidden rounded-2xl bg-amber-50/80 shadow-sm ring-1 ring-amber-200/70 transition duration-300 group-active:scale-[0.98] group-hover:shadow-md group-hover:ring-amber-300">
                                    <div className="relative aspect-[2/3] bg-amber-100/80">
                                        {entry.coverUrl ? (
                                            <LifesyncEpisodeThumbnail
                                                src={entry.coverUrl}
                                                className="absolute inset-0 h-full w-full"
                                                imgClassName="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                                                imgProps={mangadexImageProps(entry.coverUrl)}
                                            />
                                        ) : null}
                                        <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-white/75 via-transparent to-transparent pb-3 opacity-100 transition duration-200 sm:opacity-0 sm:group-hover:opacity-100">
                                            <span className="rounded-full bg-[#C6FF00] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-slate-900">
                                                Resume
                                            </span>
                                        </div>
                                        {entry.hasNewChapter ? (
                                            <span
                                                className="absolute left-2 top-2 z-1 rounded-md bg-[#C6FF00] px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide text-slate-900 shadow-sm ring-1 ring-white/90"
                                                title="New chapter"
                                            >
                                                New
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="border-t border-amber-200/90 bg-white px-2 py-2">
                                        <p className="line-clamp-2 text-[10px] font-semibold leading-snug text-slate-900">{entry.title}</p>
                                    </div>
                                </div>
                            </Link>
                        )
                    })
                )}
            </div>
        </div>
    )
}
