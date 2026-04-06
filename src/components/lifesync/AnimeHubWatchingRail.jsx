import { Link } from 'react-router-dom'
import { LifesyncEpisodeThumbnail, LifesyncHubMangaRailSkeleton } from './EpisodeLoadingSkeletons'

const ANIME_HUB_PATH = '/dashboard/lifesync/anime/anime'

/** Same shape as in-app `goToWatch` — must hit `LifeSyncAnime` (`anime/*`), not `anime/watch/*` (LifeSyncAnimeWatch). */
function watchPath(malId, episode) {
    const ep = Math.max(1, Math.floor(Number(episode) || 1))
    return `${ANIME_HUB_PATH}/seasonal/page/1/watch/${encodeURIComponent(String(malId))}/${ep}`
}

/** Compact rail on Anime & Manga hub — resumes last streamed episode per title. */
export function LifeSyncHubAnimeWatching({ entries, loading, className = 'mb-6' }) {
    if (!loading && entries.length === 0) return null

    return (
        <div
            className={`${className} relative overflow-hidden rounded-[22px] border border-[#e8e4ef]/70 bg-gradient-to-br from-white/75 via-[#faf8ff]/85 to-[#ede9ff]/80 shadow-[0_12px_40px_-12px_rgba(100,90,140,0.1)] ring-1 ring-[#e8e4ef]/60 backdrop-blur-sm sm:rounded-[26px]`}
        >
            <div
                className="pointer-events-none absolute -right-8 -top-12 h-32 w-32 rounded-full bg-[#a78bfa]/18 blur-2xl"
                aria-hidden
            />
            <div className="relative flex items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-5 sm:pb-3.5 sm:pt-5">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e0f2fe] to-[#fef9c3] text-[#1a1628] shadow-sm ring-2 ring-white">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden>
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                            />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </span>
                    <div className="min-w-0">
                        <p className="font-['Georgia',serif] text-[13px] font-semibold italic tracking-tight text-[#1a1628] sm:text-[14px]">
                            On the air
                        </p>
                        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#7c7794]">Continue watching</p>
                    </div>
                </div>
                <Link
                    to={ANIME_HUB_PATH}
                    className="shrink-0 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-[#4338ca] shadow-sm ring-1 ring-[#e0e7ff] transition hover:bg-[#eef2ff] hover:ring-[#c7d2fe]"
                >
                    Browse all →
                </Link>
            </div>
            <div className="relative flex max-w-full min-w-0 gap-3.5 overflow-x-auto overflow-y-hidden px-4 pb-5 pt-1 sm:gap-4 sm:px-5 sm:pb-6 snap-x snap-mandatory hide-scrollbar overscroll-x-contain scroll-pl-4 scroll-pr-4 sm:scroll-pl-5 sm:scroll-pr-5">
                {loading && entries.length === 0 ? (
                    <LifesyncHubMangaRailSkeleton count={5} />
                ) : (
                    entries.slice(0, 12).map((entry) => (
                        <Link
                            key={entry.malId}
                            to={watchPath(entry.malId, entry.lastEpisodeNumber)}
                            className="group relative w-[88px] shrink-0 snap-start sm:w-[96px]"
                        >
                            <div className="overflow-hidden rounded-[14px] border-2 border-white bg-white shadow-[4px_6px_0_0_rgba(167,139,250,0.35)] ring-1 ring-[#e8e4ef] transition-all group-hover:-translate-y-0.5 group-hover:shadow-[6px_8px_0_0_rgba(198,255,0,0.45)] sm:rounded-2xl">
                                <div className="relative aspect-[2/3] bg-gradient-to-br from-[#f0f4ff] to-[#fdf4ff]">
                                    {entry.imageUrl ? (
                                        <LifesyncEpisodeThumbnail
                                            src={entry.imageUrl}
                                            className="absolute inset-0 h-full w-full"
                                            imgClassName="h-full w-full object-cover"
                                            imgProps={{ referrerPolicy: 'no-referrer' }}
                                        />
                                    ) : null}
                                    <span className="absolute left-2 top-2 z-10 max-w-[calc(100%-0.75rem)] truncate rounded-md bg-black/70 px-1.5 py-0.5 text-[8px] font-bold tabular-nums text-white shadow-sm ring-1 ring-white/25">
                                        Ep. {entry.lastEpisodeNumber}
                                    </span>
                                    <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/55 via-black/10 to-transparent pb-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                                        <span className="rounded-full bg-[#C6FF00] px-2.5 py-1 text-[8px] font-bold uppercase tracking-wide text-[#1a1628] shadow-md ring-1 ring-black/10">
                                            Resume
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <p className="mt-2 line-clamp-2 text-[9px] font-semibold leading-tight text-[#1a1628]">{entry.title}</p>
                        </Link>
                    ))
                )}
            </div>
        </div>
    )
}
