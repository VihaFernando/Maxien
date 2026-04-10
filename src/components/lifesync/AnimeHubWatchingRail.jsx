import { Link } from 'react-router-dom'
import { LifesyncEpisodeThumbnail, LifesyncHubMangaRailSkeleton } from './EpisodeLoadingSkeletons'

const ANIME_HUB_PATH = '/dashboard/lifesync/anime/anime'

const focusRing =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white'

/** Same shape as in-app `goToWatch` — must hit `LifeSyncAnime` (`anime/*`), not `anime/watch/*` (LifeSyncAnimeWatch). */
function watchPath(malId, episode) {
    const ep = Math.max(1, Math.floor(Number(episode) || 1))
    return `${ANIME_HUB_PATH}/seasonal/page/1/watch/${encodeURIComponent(String(malId))}/${ep}`
}

/** Hub rail — anime watch resume strip. */
export function LifeSyncHubAnimeWatching({ entries, loading, className = '' }) {
    if (!loading && entries.length === 0) return null

    return (
        <div className={`relative border-l-4 border-l-[#C6FF00] pl-4 sm:pl-5 ${className}`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#C6FF00]/25 text-slate-900 shadow-sm ring-1 ring-[#C6FF00]/40">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path d="M8 5v14l11-7L8 5z" />
                        </svg>
                    </span>
                    <div className="min-w-0 pt-0.5">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Watching</p>
                        <h3 className="text-[16px] font-black leading-tight tracking-tight text-slate-900 sm:text-[17px]">Anime queue</h3>
                        <p className="mt-1 text-[12px] leading-snug text-slate-600">Last episode saved per title.</p>
                    </div>
                </div>
                <Link
                    to={ANIME_HUB_PATH}
                    className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 self-start rounded-xl bg-white px-4 py-2.5 text-[12px] font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-slate-50 sm:min-h-0 sm:shrink-0 sm:px-3 sm:py-2 ${focusRing}`}
                >
                    Browse
                    <span className="opacity-70" aria-hidden>
                        →
                    </span>
                </Link>
            </div>

            <div className="relative mt-5 flex min-w-0 w-full gap-3.5 overflow-x-auto overflow-y-hidden scroll-pl-1 scroll-pr-4 pb-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] snap-x snap-mandatory sm:gap-4 sm:scroll-pr-2 [&::-webkit-scrollbar]:hidden">
                {loading && entries.length === 0 ? (
                    <LifesyncHubMangaRailSkeleton count={5} />
                ) : (
                    entries.slice(0, 12).map((entry) => (
                        <Link
                            key={entry.malId}
                            to={watchPath(entry.malId, entry.lastEpisodeNumber)}
                            className={`group w-[112px] shrink-0 snap-start sm:w-[118px] ${focusRing} rounded-2xl outline-none`}
                        >
                            <div className="overflow-hidden rounded-2xl bg-slate-100 shadow-sm ring-1 ring-slate-200/80 transition duration-300 group-active:scale-[0.98] group-hover:shadow-md group-hover:ring-slate-300">
                                <div className="relative aspect-[2/3] bg-slate-200/80">
                                    {entry.imageUrl ? (
                                        <LifesyncEpisodeThumbnail
                                            src={entry.imageUrl}
                                            className="absolute inset-0 h-full w-full"
                                            imgClassName="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                                            imgProps={{ referrerPolicy: 'no-referrer' }}
                                        />
                                    ) : null}
                                    <span className="absolute left-2 top-2 z-1 max-w-[calc(100%-1rem)] truncate rounded-md bg-white/90 px-1.5 py-0.5 font-mono text-[8px] font-bold tabular-nums uppercase tracking-wide text-slate-900 ring-1 ring-slate-200/80">
                                        EP {entry.lastEpisodeNumber}
                                    </span>
                                    <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-white/80 via-transparent to-transparent pb-3 opacity-100 transition duration-200 sm:opacity-0 sm:group-hover:opacity-100">
                                        <span className="rounded-full bg-[#C6FF00] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-slate-900">
                                            Resume
                                        </span>
                                    </div>
                                </div>
                                <div className="border-t border-slate-200/90 bg-white px-2 py-2">
                                    <p className="line-clamp-2 text-[10px] font-semibold leading-snug text-slate-800">{entry.title}</p>
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    )
}
