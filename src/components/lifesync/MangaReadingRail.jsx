import { Link } from 'react-router-dom'

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
    onRefresh,
    onSync,
    onContinue,
    onRemove,
    continueDisabled,
}) {
    const hasItems = entries.length > 0

    return (
        <section className="overflow-hidden rounded-[22px] border border-[#d2d2d7]/50 bg-white shadow-sm">
            <div className="px-4 py-4 sm:px-6 sm:py-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#C6FF00]/25 text-[#1d1d1f]">
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.75" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                            </svg>
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-[15px] font-bold tracking-tight text-[#1d1d1f] sm:text-[17px]">Continue reading</h2>
                            <p className="text-[11px] text-[#86868b]">
                                {hasItems
                                    ? `${entries.length} title${entries.length === 1 ? '' : 's'} on your shelf`
                                    : loading
                                      ? 'Loading your shelf…'
                                      : 'Pick a manga below — progress saves automatically'}
                            </p>
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
                    </div>
                </div>

                {nsfwHiddenCount > 0 && (
                    <p className="mb-3 text-[10px] text-[#86868b]">
                        NSFW off in preferences — {nsfwHiddenCount} saved title{nsfwHiddenCount === 1 ? '' : 's'} not shown.
                    </p>
                )}

                {loading && !hasItems ? (
                    <div className="flex gap-4 overflow-hidden pb-1">
                        {[1, 2, 3, 4].map(i => (
                            <div
                                key={i}
                                className="h-[200px] w-[132px] shrink-0 animate-pulse rounded-[18px] bg-[#f5f5f7] sm:h-[220px] sm:w-[148px]"
                            />
                        ))}
                    </div>
                ) : !hasItems ? (
                    <div className="rounded-[18px] border border-dashed border-[#e5e5ea] bg-[#fafafa] px-5 py-8 text-center">
                        <p className="text-[13px] font-medium text-[#1d1d1f]">Nothing on your shelf yet</p>
                        <p className="mt-1 text-[12px] text-[#86868b]">Browse Popular or Recent and open a chapter — we’ll remember your place.</p>
                    </div>
                ) : (
                    <div className="-mx-1 flex gap-4 overflow-x-auto pb-2 pt-1 px-1 snap-x snap-mandatory">
                        {entries.map(entry => (
                            <article
                                key={`${entry.source}-${entry.mangaId}`}
                                className="group relative w-[148px] shrink-0 snap-start sm:w-[164px]"
                            >
                                <div className="overflow-hidden rounded-[18px] border border-[#d2d2d7]/50 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md">
                                    <div className="relative aspect-[2/3] w-full bg-[#f5f5f7]">
                                        {entry.coverUrl ? (
                                            <img
                                                src={entry.coverUrl}
                                                alt=""
                                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                                                loading="lazy"
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
                                            className="mt-2 w-full rounded-xl bg-[#1d1d1f] py-2 text-[11px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-50"
                                        >
                                            Resume
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </section>
    )
}

const MANGA_HUB_PATH = '/dashboard/lifesync/anime/manga'

/** Compact rail on Anime & Manga hub — links into Manga with resume state. */
export function LifeSyncHubMangaReading({ entries, loading }) {
    if (!loading && entries.length === 0) return null

    return (
        <div className="mb-6 overflow-hidden rounded-[22px] border border-[#d2d2d7]/60 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-[#f0f0f0] px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#C6FF00]/25 text-[#1d1d1f]">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75v14.25A8.987 8.987 0 0112 18c2.305 0 4.408.867 6 2.292V7.758a8.982 8.982 0 00-6-1.508z" />
                        </svg>
                    </span>
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold text-[#1d1d1f]">Pick up where you left off</p>
                        <p className="text-[10px] text-[#86868b]">Manga reading progress</p>
                    </div>
                </div>
                <Link
                    to={MANGA_HUB_PATH}
                    className="shrink-0 text-[11px] font-semibold text-[#1d1d1f] underline decoration-[#C6FF00] decoration-2 underline-offset-2 hover:text-black"
                >
                    Open manga
                </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto px-4 py-4 sm:px-5 snap-x snap-mandatory">
                {loading && entries.length === 0
                    ? [1, 2, 3].map(i => (
                          <div key={i} className="h-[120px] w-[80px] shrink-0 animate-pulse rounded-xl bg-[#f5f5f7] snap-start" />
                      ))
                    : entries.slice(0, 12).map(entry => (
                          <Link
                              key={`${entry.source}-${entry.mangaId}`}
                              to={MANGA_HUB_PATH}
                              state={{ resumeEntry: entry }}
                              className="group relative w-[88px] shrink-0 snap-start sm:w-[96px]"
                          >
                              <div className="overflow-hidden rounded-xl border border-[#d2d2d7]/50 bg-white shadow-sm ring-2 ring-transparent transition-all group-hover:ring-[#C6FF00]/60 group-hover:shadow-md">
                                  <div className="relative aspect-[2/3] bg-[#f5f5f7]">
                                      {entry.coverUrl ? (
                                          <img src={entry.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                                      ) : null}
                                      <div className="absolute inset-0 flex items-end justify-center bg-[#f5f5f7]/0 pb-2 opacity-0 transition-all group-hover:bg-[#f5f5f7]/85 group-hover:opacity-100">
                                          <span className="rounded-lg bg-[#1d1d1f] px-2 py-1 text-[8px] font-semibold text-white">
                                              Resume
                                          </span>
                                      </div>
                                      {entry.hasNewChapter && (
                                          <span className="absolute left-1 top-1 h-2 w-2 rounded-full bg-[#C6FF00] ring-2 ring-white" title="New chapter" />
                                      )}
                                  </div>
                              </div>
                              <p className="mt-1.5 line-clamp-2 text-[9px] font-medium leading-tight text-[#1d1d1f]">{entry.title}</p>
                          </Link>
                      ))}
            </div>
        </div>
    )
}
