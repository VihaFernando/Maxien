import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  DetailWatchGridSkeleton,
  LifesyncTextLinesSkeleton,
} from "../../components/lifesync/EpisodeLoadingSkeletons";
import { LifeSyncSectionNav } from "../../components/lifesync/LifeSyncSectionNav";
import { useLifeSync } from "../../context/LifeSyncContext";
import {
  getAnimeStreamAudio,
  getLifesyncApiBase,
  lifesyncFetch,
  lifesyncOAuthStartUrl,
} from "../../lib/lifesyncApi";
import {
  fetchStreamInfoByMalWithCache,
  writeLifesyncStreamCatalogByMal,
} from "../../lib/lifesyncStreamCatalogCache";
import { animePosterLayoutId } from "../../lib/lifesyncAnimeSharedLayout";
import { stashAnimeWatchHandoff } from "../../lib/lifesyncWatchHandoff";
import {
  AnimatePresence,
  lifeSyncDetailAnimeContentRevealTransition,
  lifeSyncDetailBackdropFadeTransition,
  lifeSyncDetailOverlayFadeTransition,
  lifeSyncDetailSheetEnterAnimate,
  lifeSyncDetailSheetEnterInitial,
  lifeSyncDetailSheetExitVariant,
  lifeSyncDetailSheetMainTransition,
  lifeSyncDollyPageTransition,
  lifeSyncDollyPageVariants,
  lifeSyncEpisodeBlockPresenceTransition,
  lifeSyncEpisodeGridStaggerMaxItems,
  lifeSyncPageTransition,
  lifeSyncSectionPresenceTransition,
  lifeSyncSectionPresenceVariants,
  lifeSyncSharedLayoutTransitionProps,
  lifeSyncStaggerContainer,
  lifeSyncStaggerItem,
  lifeSyncStaggerEpisodeGrid,
  lifeSyncStaggerEpisodeGridItem,
  MotionDiv,
} from "../../lib/lifesyncMotion";

/** Minimal MAL node fields for instant detail hero (navigate `state`, no extra fetch). */
function animeDetailPreviewFromNode(node) {
  if (!node || node.id == null) return null;
  return {
    id: String(node.id),
    title: node.title,
    main_picture: node.main_picture,
    mean: node.mean,
    num_episodes: node.num_episodes,
    media_type: node.media_type,
  };
}

function clampPage(n) {
  const v = Number.parseInt(String(n || "1"), 10);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

/** MAL API v2 GET /anime/ranking — `ranking_type` values. */
/** MAL API seasonal calendar (month 0–11 → season). */
function currentMalSeason(d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth();
  if (m <= 2) return { year: y, season: "winter" };
  if (m <= 5) return { year: y, season: "spring" };
  if (m <= 8) return { year: y, season: "summer" };
  return { year: y, season: "fall" };
}

const MAL_SEASON_OPTIONS = [
  { id: "winter", label: "Winter" },
  { id: "spring", label: "Spring" },
  { id: "summer", label: "Summer" },
  { id: "fall", label: "Fall" },
];

const MAL_RANKING_OPTIONS = [
  { id: "all", label: "Top series" },
  { id: "airing", label: "Airing" },
  { id: "upcoming", label: "Upcoming" },
  { id: "tv", label: "TV" },
  { id: "movie", label: "Movies" },
  { id: "ova", label: "OVA" },
  { id: "special", label: "Specials" },
  { id: "bypopularity", label: "Popular" },
  { id: "favorite", label: "Favorited" },
];

function isIOSDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOS =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOS || iPadOS;
}

const AnimeCard = memo(function AnimeCard({ node, ranking, onSelect }) {
  const anime = node || {};
  const pic = anime.main_picture?.large || anime.main_picture?.medium;
  return (
    <button
      type="button"
      onClick={() => anime.id != null && onSelect?.(anime)}
      className="group w-full text-left"
    >
      <div className="bg-[var(--color-surface)] rounded-[18px] border border-[var(--mx-color-d2d2d7)]/50 shadow-sm overflow-hidden hover:shadow-md transition-all">
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-[var(--mx-color-f5f5f7)]">
          {anime.id != null ? (
            <MotionDiv
              layoutId={animePosterLayoutId(anime.id)}
              transition={lifeSyncSharedLayoutTransitionProps}
              className="absolute inset-0 bg-[var(--mx-color-f5f5f7)]"
            >
              {pic ? (
                <img
                  src={pic}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[var(--mx-color-86868b)]">
                  <svg
                    className="w-10 h-10"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-12.75A1.125 1.125 0 014.5 4.5h15a1.125 1.125 0 011.125 1.125v12.75M3.375 19.5h17.25m0 0a1.125 1.125 0 001.125-1.125m0 0V5.625"
                    />
                  </svg>
                </div>
              )}
            </MotionDiv>
          ) : pic ? (
            <img
              src={pic}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[var(--mx-color-86868b)]">
              <svg
                className="w-10 h-10"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-12.75A1.125 1.125 0 014.5 4.5h15a1.125 1.125 0 011.125 1.125v12.75M3.375 19.5h17.25m0 0a1.125 1.125 0 001.125-1.125m0 0V5.625"
                />
              </svg>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          {ranking != null && (
            <span className="absolute left-2 top-2 bg-[var(--mx-color-c6ff00)] text-[var(--mx-color-1d1d1f)] text-[10px] font-bold px-2 py-0.5 rounded-lg">
              #{ranking}
            </span>
          )}
          {anime.mean != null && (
            <span className="absolute right-2 top-2 bg-[var(--color-surface)]/90 text-[var(--mx-color-1d1d1f)] text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-0.5">
              <svg
                className="w-3 h-3 text-amber-500 fill-amber-500"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {anime.mean}
            </span>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] p-3">
            <p className="text-[13px] font-semibold text-white line-clamp-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
              {anime.title}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {anime.media_type && (
                <span className="rounded bg-[var(--color-surface)]/20 px-1.5 py-0.5 text-[10px] font-medium uppercase text-white backdrop-blur-sm">
                  {anime.media_type}
                </span>
              )}
              {anime.num_episodes != null && (
                <span className="rounded bg-[var(--color-surface)]/20 px-1.5 py-0.5 text-[10px] text-white backdrop-blur-sm">
                  {anime.num_episodes} ep
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-1.5 border-t border-[var(--mx-color-f0f0f0)] bg-[var(--mx-color-fafafa)] py-2.5 text-[11px] font-semibold text-[var(--mx-color-1d1d1f)]">
          <svg
            className="h-3.5 w-3.5 text-[var(--mx-color-86868b)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z"
            />
          </svg>
          View details
        </div>
      </div>
    </button>
  );
});

const MyListCard = memo(function MyListCard({ node, listStatus, onSelect }) {
  const anime = node || {};
  const pic = anime.main_picture?.large || anime.main_picture?.medium;
  const st = listStatus || {};
  const statusColors = {
    watching: "bg-emerald-50 text-emerald-700 border-emerald-100",
    completed: "bg-blue-50 text-blue-700 border-blue-100",
    on_hold: "bg-amber-50 text-amber-700 border-amber-100",
    dropped: "bg-red-50 text-red-700 border-red-100",
    plan_to_watch: "bg-[var(--mx-color-f5f5f7)] text-[var(--mx-color-86868b)] border-[var(--mx-color-e5e5ea)]",
  };
  const badge =
    statusColors[st.status] || "bg-[var(--mx-color-f5f5f7)] text-[var(--mx-color-86868b)] border-[var(--mx-color-e5e5ea)]";

  return (
    <button
      type="button"
      onClick={() => anime.id != null && onSelect?.(anime)}
      className="group w-full text-left"
    >
      <div className="bg-[var(--color-surface)] rounded-[16px] border border-[var(--mx-color-d2d2d7)]/50 shadow-sm p-3 flex gap-3 hover:shadow-md transition-all">
        <div className="h-24 w-16 shrink-0 overflow-hidden rounded-xl bg-[var(--mx-color-f5f5f7)]">
          {anime.id != null ? (
            <MotionDiv
              layoutId={animePosterLayoutId(anime.id)}
              transition={lifeSyncSharedLayoutTransitionProps}
              className="h-full w-full"
            >
              {pic ? (
                <img
                  src={pic}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : null}
            </MotionDiv>
          ) : pic ? (
            <img
              src={pic}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[var(--mx-color-1d1d1f)] line-clamp-2">
            {anime.title}
          </p>
          <span
            className={`inline-flex mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${badge}`}
          >
            {(st.status || "").replace(/_/g, " ")}
          </span>
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[var(--mx-color-86868b)]">
            {st.score > 0 && (
              <span className="flex items-center gap-0.5">
                <svg
                  className="w-3 h-3 text-amber-500 fill-amber-500"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {st.score}/10
              </span>
            )}
            {st.num_episodes_watched != null && (
              <span>{st.num_episodes_watched} ep watched</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
});

function normalizeStreamEpisodesForPlayer(list, episodeThumbnails = {}) {
  const thumbs =
    episodeThumbnails && typeof episodeThumbnails === "object"
      ? episodeThumbnails
      : {};
  return (list || [])
    .map((ep, i) => {
      const episodeId = ep.episodeId || ep.id;
      if (!episodeId) return null;
      const num = ep.number ?? ep.episode;
      const tn = num != null ? thumbs[String(num)] : null;
      const thumbUrl =
        (typeof ep.thumbnailUrl === "string" && ep.thumbnailUrl.trim()) ||
        (typeof tn === "string" && tn.trim()) ||
        undefined;
      return {
        episodeId: String(episodeId),
        title:
          ep.title || (num != null ? `Episode ${num}` : `Episode ${i + 1}`),
        number: num,
        hasDub: ep.hasDub,
        hasSub: ep.hasSub,
        thumbnailUrl: thumbUrl,
      };
    })
    .filter(Boolean);
}

/** Parent key includes `animeStreamAudio` so sub/dub changes remount this block (no sync reset setState in the effect). */
function DetailWatchSection({
  animeId,
  malTitle,
  pic,
  malDetail,
  animeStreamAudio,
  onPlayStream,
}) {
  const [streamData, setStreamData] = useState(null);
  const [streamBusy, setStreamBusy] = useState(true);
  const [thumbMap, setThumbMap] = useState({});
  const [resumeLastEp, setResumeLastEp] = useState(null);

  useEffect(() => {
    const ac = new AbortController();
    const { signal } = ac;
    let cancelled = false;
    const isAbort = (err) => err?.name === "AbortError";

    const audio = animeStreamAudio === "dub" ? "dub" : "sub";

    lifesyncFetch(
      `/api/v1/anime/stream/info/by-mal/${encodeURIComponent(animeId)}?view=full${malTitle ? `&title=${encodeURIComponent(String(malTitle))}` : ''}`,
      { signal },
    )
      .then((res) => {
        if (!cancelled) setStreamData(res?.data ?? null);
      })
      .catch((err) => {
        if (isAbort(err) || cancelled) return;
        setStreamData(null);
      })
      .finally(() => {
        if (!cancelled) setStreamBusy(false);
      });

    lifesyncFetch(
      `/api/v1/anime/mal-episode-thumbnails/${encodeURIComponent(animeId)}?audio=${audio}&view=compact`,
      { signal },
    )
      .then((res) => {
        if (
          cancelled ||
          !res?.thumbnails ||
          typeof res.thumbnails !== "object"
        )
          return;
        setThumbMap(res.thumbnails);
      })
      .catch((err) => {
        if (isAbort(err) || cancelled) return;
        setThumbMap({});
      });

    lifesyncFetch(`/api/v1/anime/watch-progress/${encodeURIComponent(animeId)}`, {
      signal,
    })
      .then((p) => {
        if (cancelled) return;
        setResumeLastEp(
          p?.lastEpisodeNumber != null ? p.lastEpisodeNumber : null,
        );
      })
      .catch((err) => {
        if (isAbort(err) || cancelled) return;
        setResumeLastEp(null);
      });

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [animeId, animeStreamAudio, malTitle]);

  const catalogWarmTimerRef = useRef(null);
  const warmStreamCatalog = useCallback(() => {
    if (!animeId) return;
    if (catalogWarmTimerRef.current != null) return;
    catalogWarmTimerRef.current = window.setTimeout(() => {
      catalogWarmTimerRef.current = null;
      void fetchStreamInfoByMalWithCache(animeId, lifesyncFetch)
        .then((body) => {
          if (body?.data != null) writeLifesyncStreamCatalogByMal(animeId, body);
        })
        .catch(() => {});
    }, 200);
  }, [animeId]);

  useEffect(
    () => () => {
      if (catalogWarmTimerRef.current != null) {
        window.clearTimeout(catalogWarmTimerRef.current);
        catalogWarmTimerRef.current = null;
      }
    },
    [],
  );

  const streamEps = useMemo(
    () => normalizeStreamEpisodesForPlayer(streamData?.episodes, thumbMap),
    [streamData, thumbMap],
  );

  const dubAvailabilityLabel = useMemo(() => {
    if (!streamEps.length) return "Dub: —";
    let hasSignal = false;
    let anyDub = false;
    for (const ep of streamEps) {
      if (typeof ep?.hasDub !== "boolean") continue;
      hasSignal = true;
      if (ep.hasDub) anyDub = true;
    }
    if (!hasSignal) return "Dub: Unknown";
    return anyDub ? "Dub: Available" : "Dub: Not available";
  }, [streamEps]);

  const resumeIndex =
    resumeLastEp != null
      ? streamEps.findIndex((e) => e.number === resumeLastEp)
      : -1;

  const openSeries = useCallback(
    (ep, i) => {
      onPlayStream?.(
        {
          seriesKey: `mal:${animeId}`,
          malId: animeId,
          title: malTitle,
          poster: pic || "",
          episodes: streamEps,
          malDetail: malDetail || null,
        },
        ep,
        i,
      );
    },
    [animeId, malDetail, malTitle, onPlayStream, pic, streamEps],
  );

  const useStaggeredEpisodeCells =
    streamEps.length > 0 &&
    streamEps.length <= lifeSyncEpisodeGridStaggerMaxItems;

  const episodeGridClass =
    "grid grid-cols-2 gap-2 sm:grid-cols-3";
  const isDarkTheme =
    typeof document !== "undefined" &&
    document.documentElement?.dataset?.maxienTheme === "dark";

  return (
    <div className=" pt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--mx-color-86868b)]">
          Watch
        </p>
        <span className="inline-flex items-center rounded-full border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--mx-color-5b5670)]">
          {dubAvailabilityLabel}
        </span>
      </div>
      <AnimatePresence mode="sync" initial={false}>
        {streamBusy ? (
          <MotionDiv
            key="watch-ep-skeleton"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={lifeSyncEpisodeBlockPresenceTransition}
          >
            <DetailWatchGridSkeleton count={6} dark={isDarkTheme} />
          </MotionDiv>
        ) : (
          <MotionDiv
            key={`watch-ep-loaded-${animeId}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={lifeSyncEpisodeBlockPresenceTransition}
            className="space-y-3"
          >
            {streamData?.matchedStreamTitle &&
              streamData.matchedStreamTitle !== malTitle && (
                <p className="text-[11px] text-[var(--mx-color-86868b)]">
                  Mirror match:{" "}
                  <span className="font-medium text-[var(--mx-color-1d1d1f)]">
                    {streamData.matchedStreamTitle}
                  </span>
                </p>
              )}
            {streamEps.length > 0 &&
              resumeIndex >= 0 &&
              streamEps[resumeIndex] && (
                <MotionDiv
                  variants={lifeSyncStaggerEpisodeGridItem}
                  initial="hidden"
                  animate="show"
                >
                  <button
                    type="button"
                    onMouseEnter={warmStreamCatalog}
                    onFocus={warmStreamCatalog}
                    onClick={() =>
                      openSeries(streamEps[resumeIndex], resumeIndex)
                    }
                    className="w-full rounded-[14px] border border-[var(--mx-color-c6ff00)]/30 bg-[var(--mx-color-c6ff00)]/10 px-4 py-3 text-left shadow-sm transition hover:border-[var(--mx-color-c6ff00)]/50 hover:bg-[var(--mx-color-c6ff00)]/14"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--mx-color-c6ff00)]">
                      Continue
                    </p>
                    <p className="mt-1 text-[13px] font-semibold text-[var(--mx-color-1d1d1f)]">
                      Resume episode {resumeLastEp}
                      {streamEps[resumeIndex]?.title
                        ? ` · ${streamEps[resumeIndex].title}`
                        : ""}
                    </p>
                  </button>
                </MotionDiv>
              )}
            {streamEps.length > 0 ? (
              useStaggeredEpisodeCells ? (
                <MotionDiv
                  variants={lifeSyncStaggerEpisodeGrid}
                  initial="hidden"
                  animate="show"
                  className={episodeGridClass}
                >
                  {streamEps.map((ep, i) => (
                    <MotionDiv
                      key={ep.episodeId}
                      variants={lifeSyncStaggerEpisodeGridItem}
                    >
                      <button
                        type="button"
                        onMouseEnter={warmStreamCatalog}
                        onFocus={warmStreamCatalog}
                        onClick={() => openSeries(ep, i)}
                        className="group h-full w-full overflow-hidden rounded-[14px] border border-[var(--mx-color-d2d2d7)]/50 bg-[var(--mx-color-fafafa)] text-left shadow-sm transition-all hover:border-[var(--mx-color-c6ff00)]/40 hover:shadow-md"
                      >
                        <div className="relative aspect-video w-full overflow-hidden bg-[var(--mx-color-f5f5f7)]">
                          {ep.thumbnailUrl || pic ? (
                            <img
                              src={ep.thumbnailUrl || pic}
                              alt=""
                              className="h-full w-full object-cover opacity-90 transition-transform duration-300 group-hover:scale-[1.03]"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[var(--mx-color-86868b)]">
                              <svg
                                className="h-8 w-8"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          )}
                          {ep.number != null && (
                            <span className="absolute left-1.5 top-1.5 rounded-md bg-[var(--mx-color-1d1d1f)]/85 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-white">
                              E{ep.number}
                            </span>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--mx-color-c6ff00)] shadow-lg">
                              <svg
                                className="ml-0.5 h-4 w-4 text-[var(--mx-color-1d1d1f)]"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </span>
                          </div>
                        </div>
                        <div className="px-2 py-2">
                          <p className="line-clamp-2 text-[10px] font-semibold leading-snug text-[var(--mx-color-1d1d1f)]">
                            {ep.title}
                          </p>
                        </div>
                      </button>
                    </MotionDiv>
                  ))}
                </MotionDiv>
              ) : (
                <MotionDiv
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={lifeSyncPageTransition}
                  className={episodeGridClass}
                >
                  {streamEps.map((ep, i) => (
                    <div key={ep.episodeId}>
                      <button
                        type="button"
                        onMouseEnter={warmStreamCatalog}
                        onFocus={warmStreamCatalog}
                        onClick={() => openSeries(ep, i)}
                        className="group h-full w-full overflow-hidden rounded-[14px] border border-[var(--mx-color-d2d2d7)]/50 bg-[var(--mx-color-fafafa)] text-left shadow-sm transition-all hover:border-[var(--mx-color-c6ff00)]/40 hover:shadow-md"
                      >
                        <div className="relative aspect-video w-full overflow-hidden bg-[var(--mx-color-f5f5f7)]">
                          {ep.thumbnailUrl || pic ? (
                            <img
                              src={ep.thumbnailUrl || pic}
                              alt=""
                              className="h-full w-full object-cover opacity-90 transition-transform duration-300 group-hover:scale-[1.03]"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[var(--mx-color-86868b)]">
                              <svg
                                className="h-8 w-8"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          )}
                          {ep.number != null && (
                            <span className="absolute left-1.5 top-1.5 rounded-md bg-[var(--mx-color-1d1d1f)]/85 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-white">
                              E{ep.number}
                            </span>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--mx-color-c6ff00)] shadow-lg">
                              <svg
                                className="ml-0.5 h-4 w-4 text-[var(--mx-color-1d1d1f)]"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </span>
                          </div>
                        </div>
                        <div className="px-2 py-2">
                          <p className="line-clamp-2 text-[10px] font-semibold leading-snug text-[var(--mx-color-1d1d1f)]">
                            {ep.title}
                          </p>
                        </div>
                      </button>
                    </div>
                  ))}
                </MotionDiv>
              )
            ) : null}
            {streamData && streamEps.length === 0 ? (
              <p className="text-[12px] text-[var(--mx-color-86868b)]">
                No playable episodes were found for this mirror.
              </p>
            ) : null}
            {streamData === null ? (
              <p className="text-[12px] text-[var(--mx-color-86868b)]">
                We couldn’t find this title on the selected mirror. Try a different mirror.
              </p>
            ) : null}
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Parent uses `key={detailId}` so each open starts with `busy === true` and `data === null` without effect setState. */
function DetailPanel({ animeId, animeStreamAudio, onClose, onPlayStream, preview }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [detailError, setDetailError] = useState("");
  const [descExpanded, setDescExpanded] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    lifesyncFetch(`/api/v1/anime/details/${animeId}?view=full`, { signal: ac.signal })
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        if (!cancelled) setData(null);
        if (!cancelled) {
          setDetailError(
            err?.message ||
              "We couldn’t load this title right now. Check your connection and try again.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [animeId, reloadTick]);

  const triggerReload = useCallback(() => {
    // Avoid synchronous setState inside the effect body (React can warn about cascading renders).
    // This runs on user action, and `key={detailId}` remount already resets initial state on open.
    setBusy(true);
    setDetailError("");
    setData(null);
    setReloadTick((n) => n + 1);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const pic = data?.main_picture?.large || data?.main_picture?.medium;
  const previewPic =
    preview?.main_picture?.large || preview?.main_picture?.medium;
  const heroPic = pic || previewPic;
  const description = data?.synopsis ? String(data.synopsis).trim() : "";
  const genres = Array.isArray(data?.genres) ? data.genres : [];
  const showPreviewMeta = busy && preview && !data;
  const malUrl = animeId ? `https://myanimelist.net/anime/${encodeURIComponent(String(animeId))}` : null;
  const isDarkTheme =
    typeof document !== "undefined" &&
    document.documentElement?.dataset?.maxienTheme === "dark";

  const node = (
    <MotionDiv
      className="fixed inset-0 z-[9998] flex h-dvh max-h-dvh w-full max-w-[100vw] min-w-0 items-end justify-center overflow-hidden p-0 sm:items-center sm:p-4"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={lifeSyncDetailOverlayFadeTransition}
    >
      <MotionDiv
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={lifeSyncDetailBackdropFadeTransition}
      />

      <MotionDiv
        layout="size"
        layoutRoot
        className="lifesync-anime-detail-sheet relative flex h-dvh max-h-dvh w-full min-w-0 flex-col overflow-hidden bg-[var(--color-surface)] shadow-2xl sm:h-auto sm:max-h-[min(88vh,calc(100dvh-2rem))] sm:max-w-4xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        initial={lifeSyncDetailSheetEnterInitial}
        animate={lifeSyncDetailSheetEnterAnimate}
        exit={lifeSyncDetailSheetExitVariant}
        transition={lifeSyncDetailSheetMainTransition}
      >
        {/* Hero */}
        <div className="relative shrink-0">
          {heroPic ? (
            <>
              <div className="absolute inset-0 overflow-hidden">
                <img
                  src={heroPic}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="absolute inset-0 lifesync-detail-hero-fade" />
            </>
          ) : (
            <div className="absolute inset-0 lifesync-detail-hero-fallback" />
          )}

          <button
            type="button"
            onClick={onClose}
            className="absolute z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur-sm transition-all hover:bg-black/60 hover:text-white"
            style={{
              top: "0.75rem",
              right: "0.75rem",
            }}
            aria-label="Close"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          <div className="relative flex flex-col items-center gap-4 px-4 pb-4 pt-5 text-center sm:flex-row sm:items-end sm:gap-5 sm:px-6 sm:pt-5 sm:text-left">
            <MotionDiv
              layoutId={animePosterLayoutId(animeId)}
              transition={lifeSyncSharedLayoutTransitionProps}
              className="w-24 shrink-0 overflow-hidden rounded-xl bg-[var(--mx-color-f5f5f7)] shadow-lg ring-1 ring-black/10 sm:w-36"
              style={{ aspectRatio: "2/3" }}
            >
              {heroPic ? (
                <img
                  src={heroPic}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : busy ? (
                <div className="flex h-full min-h-[6.5rem] w-full items-center justify-center gap-1.5">
                  <span
                    className="lifesync-dot-bounce h-2 w-2 rounded-full bg-[var(--mx-color-c6ff00)]"
                    aria-hidden
                  />
                  <span
                    className="lifesync-dot-bounce lifesync-dot-bounce-delay-1 h-2 w-2 rounded-full bg-[var(--mx-color-c6ff00)]"
                    aria-hidden
                  />
                  <span
                    className="lifesync-dot-bounce lifesync-dot-bounce-delay-2 h-2 w-2 rounded-full bg-[var(--mx-color-c6ff00)]"
                    aria-hidden
                  />
                </div>
              ) : (
                <div className="flex h-full min-h-[6.5rem] w-full items-center justify-center">
                  <svg
                    className="h-10 w-10 text-[var(--mx-color-86868b)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-12.75"
                    />
                  </svg>
                </div>
              )}
            </MotionDiv>

            <div className="flex w-full min-w-0 flex-1 flex-col justify-end pb-1">
              <h2 className="wrap-anywhere line-clamp-4 text-[17px] font-bold leading-tight text-[var(--mx-color-1d1d1f)] sm:line-clamp-3 sm:text-[22px]">
                {busy && !preview?.title ? (
                  <span className="inline-block h-6 w-[min(100%,12rem)] animate-pulse rounded-lg bg-[var(--mx-color-ebebed)]" />
                ) : data?.title ? (
                  data.title
                ) : preview?.title ? (
                  preview.title
                ) : !busy ? (
                "Couldn\u2019t load details"
                ) : (
                  <span className="inline-block h-6 w-[min(100%,12rem)] animate-pulse rounded-lg bg-[var(--mx-color-ebebed)]" />
                )}
              </h2>

              {showPreviewMeta ? (
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  {preview.mean != null && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--mx-color-c6ff00)]/20 px-2 py-0.5 text-[10px] font-semibold text-[var(--mx-color-1d1d1f)]">
                      <svg
                        className="h-3 w-3 text-amber-500 fill-amber-500"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      {preview.mean}
                    </span>
                  )}
                  {preview.num_episodes != null && (
                    <span className="rounded-full bg-[var(--mx-color-f5f5f7)] px-2 py-0.5 text-[10px] font-medium text-[var(--mx-color-86868b)]">
                      {preview.num_episodes} ep
                    </span>
                  )}
                  {preview.media_type && (
                    <span className="rounded-full bg-[var(--mx-color-f5f5f7)] px-2 py-0.5 text-[10px] font-medium uppercase text-[var(--mx-color-86868b)]">
                      {preview.media_type}
                    </span>
                  )}
                </div>
              ) : null}

              {!busy && data ? (
                <>
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    {data.mean != null && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--mx-color-c6ff00)]/20 px-2 py-0.5 text-[10px] font-semibold text-[var(--mx-color-1d1d1f)]">
                        <svg
                          className="h-3 w-3 text-amber-500 fill-amber-500"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        {data.mean}
                      </span>
                    )}
                    {data.status && (
                      <span className="rounded-full bg-[var(--mx-color-f5f5f7)] px-2 py-0.5 text-[10px] font-medium capitalize text-[var(--mx-color-86868b)]">
                        {String(data.status).replace(/_/g, " ")}
                      </span>
                    )}
                    {data.num_episodes != null && (
                      <span className="rounded-full bg-[var(--mx-color-f5f5f7)] px-2 py-0.5 text-[10px] font-medium text-[var(--mx-color-86868b)]">
                        {data.num_episodes} ep
                      </span>
                    )}
                    {data.media_type && (
                      <span className="rounded-full bg-[var(--mx-color-f5f5f7)] px-2 py-0.5 text-[10px] font-medium uppercase text-[var(--mx-color-86868b)]">
                        {data.media_type}
                      </span>
                    )}
                  </div>

                  {genres.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap justify-center gap-1 sm:justify-start">
                      {genres.map((g) => (
                        <span
                          key={g.id || g.name}
                          className="rounded-full bg-[var(--mx-color-c6ff00)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--mx-color-1d1d1f)]"
                        >
                          {g.name}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {data && !busy ? (
            <MotionDiv
              key={String(animeId)}
              className="min-h-0"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={lifeSyncDetailAnimeContentRevealTransition}
            >
              {(description || data.my_list_status) && (
                <div className="border-b border-[var(--mx-color-f0f0f0)] px-5 py-3 sm:px-6">
                  {description && (
                    <>
                      <p
                        className={`text-[12px] leading-relaxed text-[var(--mx-color-424245)] ${descExpanded ? "" : "line-clamp-3"}`}
                      >
                        {description}
                      </p>
                      {description.length > 200 && (
                        <button
                          type="button"
                          onClick={() => setDescExpanded((v) => !v)}
                          className="mt-1 text-[11px] font-semibold text-[var(--mx-color-1d1d1f)] hover:underline"
                        >
                          {descExpanded ? "Show less" : "Show more"}
                        </button>
                      )}
                    </>
                  )}

                  {data.my_list_status && (
                    <div className={`${description ? "mt-3" : ""} rounded-2xl bg-[var(--mx-color-f5f5f7)] p-4`}>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--mx-color-86868b)]">
                        Your List Status
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                        <span className="rounded-full border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] px-2.5 py-0.5 font-semibold capitalize text-[var(--mx-color-1d1d1f)]">
                          {(data.my_list_status.status || "").replace(/_/g, " ")}
                        </span>
                        {data.my_list_status.score > 0 && (
                          <span className="rounded-full border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] px-2.5 py-0.5 font-semibold text-[var(--mx-color-1d1d1f)]">
                            Score: {data.my_list_status.score}/10
                          </span>
                        )}
                        {data.my_list_status.num_episodes_watched != null && (
                          <span className="rounded-full border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] px-2.5 py-0.5 font-medium text-[var(--mx-color-86868b)]">
                            {data.my_list_status.num_episodes_watched} ep watched
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="px-5 py-4 sm:px-6">
                <DetailWatchSection
                  key={`${animeId}-${animeStreamAudio}`}
                  animeId={animeId}
                  malTitle={data.title}
                  pic={pic}
                  malDetail={data}
                  animeStreamAudio={animeStreamAudio}
                  onPlayStream={onPlayStream}
                />
              </div>
            </MotionDiv>
          ) : !busy && !data ? (
            <div className="px-5 py-8 sm:px-6">
              <div className="lifesync-detail-status-card rounded-2xl  bg-[var(--mx-color-fafafa)] px-4 py-5 text-center">
                <p className="text-[13px] font-semibold text-[var(--mx-color-1d1d1f)]">
                  Couldn’t load this title
                </p>
                <p className="mt-1 text-[12px] text-[var(--mx-color-86868b)]">
                  {detailError || "Try again in a moment, or open it on MyAnimeList."}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={triggerReload}
                    className="min-h-[40px] rounded-xl bg-[var(--mx-color-c6ff00)] px-4 text-[12px] font-bold text-[var(--mx-color-1a1628)] shadow-sm"
                  >
                    Try again
                  </button>
                  {malUrl ? (
                    <a
                      href={malUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[40px] rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] px-4 text-[12px] font-semibold text-[var(--mx-color-1d1d1f)] transition hover:bg-[var(--mx-color-fafafa)]"
                    >
                      Open on MAL
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          ) : busy ? (
            <div className="px-5 py-6 sm:px-6">
              <div className="lifesync-detail-status-card rounded-2xl bg-[var(--color-surface)] px-4 py-5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--mx-color-86868b)]">
                  Loading details
                </p>
                <div className="mt-3">
                  <LifesyncTextLinesSkeleton lines={3} dark={isDarkTheme} />
                </div>
                <div className="mt-4">
                  <DetailWatchGridSkeleton count={6} dark={isDarkTheme} />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </MotionDiv>
    </MotionDiv>
  );

  return createPortal(node, document.body);
}

export default function LifeSyncAnime() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLifeSyncConnected, lifeSyncUser, refreshLifeSyncMe } = useLifeSync();
  /** Server applies MAL `nsfw` from this preference; listed in deps so lists refetch after toggling in Settings. */
  const nsfwContentEnabled = Boolean(
    lifeSyncUser?.preferences?.nsfwContentEnabled,
  );

  const basePath = "/dashboard/lifesync/anime/anime";
  const route = useMemo(() => {
    const rel = location.pathname.startsWith(basePath)
      ? location.pathname.slice(basePath.length)
      : "";
    const parts = rel.split("/").filter(Boolean);

    const tabId = parts[0] || "seasonal";
    const allowedTabs = new Set(["seasonal", "ranking", "mylist", "search"]);
    const tab = allowedTabs.has(tabId) ? tabId : "seasonal";

    let page = 1;
    const pageIdx = parts.indexOf("page");
    if (pageIdx >= 0 && parts[pageIdx + 1]) page = clampPage(parts[pageIdx + 1]);

    const detailIdx = parts.indexOf("detail");
    const detailAnimeId = detailIdx >= 0 ? parts[detailIdx + 1] || null : null;

    const watchIdx = parts.indexOf("watch");
    const watchAnimeId = watchIdx >= 0 ? parts[watchIdx + 1] || null : null;
    const watchEpisodeIndexRaw =
      watchIdx >= 0 ? parts[watchIdx + 2] || null : null;
    const watchEpisodeIndex =
      watchEpisodeIndexRaw != null ? clampPage(watchEpisodeIndexRaw) - 1 : null;

    return {
      tab,
      page,
      detailAnimeId,
      watchAnimeId,
      watchEpisodeIndex,
      parts,
    };
  }, [location.pathname]);
  const [tab, setTab] = useState("seasonal");
  const [seasonalYear, setSeasonalYear] = useState(
    () => currentMalSeason().year,
  );
  const [seasonalSeason, setSeasonalSeason] = useState(
    () => currentMalSeason().season,
  );
  const [seasonal, setSeasonal] = useState([]);
  const [seasonalPage, setSeasonalPage] = useState(1);
  const [seasonalHasNext, setSeasonalHasNext] = useState(false);
  const [rankingType, setRankingType] = useState("all");
  const [ranking, setRanking] = useState([]);
  const [rankingPage, setRankingPage] = useState(1);
  const [rankingHasNext, setRankingHasNext] = useState(false);
  const [myList, setMyList] = useState([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchCommittedQ, setSearchCommittedQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchPage, setSearchPage] = useState(1);
  const [searchHasNext, setSearchHasNext] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [oauthMsg, setOauthMsg] = useState("");
  const oauthMsgTimerRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const streamAudioType = getAnimeStreamAudio(lifeSyncUser?.preferences);
  const malLinked = Boolean(
    lifeSyncUser?.integrations?.mal || lifeSyncUser?.integrations?.malUsername,
  );

  const scheduleClearOauthMsg = useCallback((ms) => {
    if (oauthMsgTimerRef.current != null) {
      window.clearTimeout(oauthMsgTimerRef.current);
      oauthMsgTimerRef.current = null;
    }
    oauthMsgTimerRef.current = window.setTimeout(() => {
      oauthMsgTimerRef.current = null;
      setOauthMsg("");
    }, ms);
  }, []);

  useEffect(
    () => () => {
      if (oauthMsgTimerRef.current != null) {
        window.clearTimeout(oauthMsgTimerRef.current);
        oauthMsgTimerRef.current = null;
      }
    },
    [],
  );

  const listFetchMountedRef = useRef(true);
  useEffect(() => {
    listFetchMountedRef.current = true;
    return () => {
      listFetchMountedRef.current = false;
    };
  }, []);

  const listPath = useMemo(() => {
    const t = route.tab === "mylist" && !malLinked ? "seasonal" : route.tab;
    const p = route.page;
    return `${basePath}/${t}/page/${p}${location.search || ""}`;
  }, [basePath, location.search, malLinked, route.page, route.tab]);

  const goToList = useCallback(
    (opts = {}) => {
      navigate(listPath, {
        replace: Boolean(opts.replace),
        state: null,
      });
    },
    [navigate, listPath],
  );

  const goToTab = useCallback(
    (t) => {
      const nextTab = t === "mylist" && !malLinked ? "seasonal" : t;
      navigate(`${basePath}/${nextTab}/page/1${location.search || ""}`);
    },
    [basePath, location.search, malLinked, navigate],
  );

  const goToPage = useCallback(
    (p) => {
      navigate(
        `${basePath}/${route.tab}/page/${clampPage(p)}${location.search || ""}`,
      );
    },
    [basePath, location.search, navigate, route.tab],
  );

  const goToDetail = useCallback(
    (animeOrId) => {
      const id =
        animeOrId && typeof animeOrId === "object"
          ? animeOrId.id
          : animeOrId;
      if (id == null) return;
      const preview = animeDetailPreviewFromNode(
        animeOrId && typeof animeOrId === "object" ? animeOrId : null,
      );
      navigate(
        `${listPath.replace(location.search || "", "")}/detail/${encodeURIComponent(String(id))}${location.search || ""}`,
        preview ? { state: { animeDetailPreview: preview } } : {},
      );
    },
    [navigate, listPath, location.search],
  );

  useEffect(() => {
    const desiredTab = route.tab === "mylist" && !malLinked ? "seasonal" : route.tab;
    if (tab !== desiredTab) setTab(desiredTab);
    // Keep per-tab pagination aligned with URL.
    if (desiredTab === "seasonal" && seasonalPage !== route.page) setSeasonalPage(route.page);
    if (desiredTab === "ranking" && rankingPage !== route.page) setRankingPage(route.page);
    if (desiredTab === "search" && searchPage !== route.page) setSearchPage(route.page);
    // mylist has no pagination currently.
  }, [
    malLinked,
    rankingPage,
    route.page,
    route.tab,
    searchPage,
    seasonalPage,
    tab,
  ]);

  useEffect(() => {
    // Canonicalize base route to include tab + page.
    if (location.pathname === basePath || location.pathname === `${basePath}/`) {
      navigate(`${basePath}/seasonal/page/1${location.search || ""}`, {
        replace: true,
      });
    }
  }, [basePath, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (route.tab !== "search") return;
    const q = new URLSearchParams(location.search || "").get("q") || "";
    const next = q.trim();
    if (next && next !== searchCommittedQ) {
      setSearchCommittedQ(next);
      setSearchQ(next);
    }
  }, [location.search, route.tab, searchCommittedQ]);

  useEffect(() => {
    // Route-controlled detail overlay.
    if (route.detailAnimeId) {
      if (detailId !== route.detailAnimeId) setDetailId(route.detailAnimeId);
    } else if (detailId) {
      setDetailId(null);
    }
  }, [detailId, route.detailAnimeId]);

  const detailPreview = useMemo(() => {
    const raw = location.state?.animeDetailPreview;
    if (!raw || route.detailAnimeId == null) return null;
    if (String(raw.id) !== String(route.detailAnimeId)) return null;
    return raw;
  }, [location.state?.animeDetailPreview, route.detailAnimeId]);

  const resolveAnimeStream = useCallback(
    async (ep, audioOverride, seriesMalId, mirrorId) => {
      const episodeId = ep?.episodeId;
      const base = {
        title: ep?.title || "Episode",
        embedUrl: "",
        watchUrl: "",
        videoUrl: null,
        iframeUrl: null,
        textTracks: [],
        mirrors: [],
        selectedMirrorId: null,
        selectedMirrorLabel: null,
        resolving: false,
      };
      if (!episodeId) return base;
      try {
        const audio =
          audioOverride === "dub" || audioOverride === "sub"
            ? audioOverride
            : streamAudioType === "dub"
              ? "dub"
              : "sub";
        const type = audio === "dub" ? "dub" : "sub";
        const malQ =
          seriesMalId != null &&
          String(seriesMalId).trim() !== "" &&
          /^\d+$/.test(String(seriesMalId).trim())
            ? `&malId=${encodeURIComponent(String(seriesMalId).trim())}`
            : "";
        const mirrorQ =
          mirrorId != null && String(mirrorId).trim() !== ""
            ? `&server=${encodeURIComponent(String(mirrorId).trim())}`
            : "";
        const pack = await lifesyncFetch(
          `/api/v1/anime/stream/watch/${encodeURIComponent(episodeId)}?type=${type}${malQ}${mirrorQ}&view=full`,
        );
        const apiBase = getLifesyncApiBase();
        const iframeFromPack =
          typeof pack.iframeUrl === "string" &&
          /^https?:\/\//i.test(pack.iframeUrl)
            ? pack.iframeUrl
            : null;
        if (iframeFromPack) {
          return {
            ...base,
            title: ep.title || base.title,
            iframeUrl: iframeFromPack,
            textTracks: [],
            mirrors: pack?.streamMeta?.mirrors || [],
            selectedMirrorId: pack?.streamMeta?.selectedMirrorId ?? null,
            selectedMirrorLabel: pack?.streamMeta?.selectedMirrorLabel ?? null,
            provider: pack?.streamMeta?.provider ?? null,
          };
        }
        const sources = Array.isArray(pack.sources) ? pack.sources : [];
        const preferIframe = isIOSDevice();
        const iframeSrc = sources.find(
          (s) =>
            s &&
            String(s.kind || "").toLowerCase() === "iframe" &&
            s.url,
        );
        if (iframeSrc?.url) {
          const u = String(iframeSrc.url).startsWith("http")
            ? iframeSrc.url
            : `${apiBase}${iframeSrc.url}`;
          return {
            ...base,
            title: ep.title || base.title,
            iframeUrl: u,
            textTracks: [],
            mirrors: pack?.streamMeta?.mirrors || [],
            selectedMirrorId: pack?.streamMeta?.selectedMirrorId ?? null,
            selectedMirrorLabel: pack?.streamMeta?.selectedMirrorLabel ?? null,
            provider: pack?.streamMeta?.provider ?? null,
          };
        }
        const first = preferIframe
          ? sources.find((s) => s.kind === "iframe") ||
            sources.find((s) => s.kind === "hls") ||
            sources.find((s) => s.kind === "mp4") ||
            sources[0]
          : sources.find((s) => s.kind === "hls") ||
            sources.find((s) => s.kind === "mp4") ||
            sources[0];
        if (!first?.url) return base;
        const url = String(first.url).startsWith("http")
          ? first.url
          : `${apiBase}${first.url}`;
        const rawSubs = Array.isArray(pack.subtitles) ? pack.subtitles : [];
        const textTracks = rawSubs.map((s, i) => ({
          src: String(s.url || "").startsWith("http")
            ? s.url
            : `${apiBase}${s.url}`,
          label: s.label || `Subtitles ${i + 1}`,
          srclang: s.lang || "und",
          default: i === 0,
        }));
        return {
          ...base,
          title: ep.title || base.title,
          videoUrl: url,
          textTracks,
          mirrors: pack?.streamMeta?.mirrors || [],
          selectedMirrorId: pack?.streamMeta?.selectedMirrorId ?? null,
          selectedMirrorLabel: pack?.streamMeta?.selectedMirrorLabel ?? null,
          provider: pack?.streamMeta?.provider ?? null,
        };
      } catch {
        return { ...base, title: ep.title || base.title };
      }
    },
    [streamAudioType],
  );

  const playEpisode = useCallback(
    async (series, ep, epIndex) => {
      if (!series?.malId || !ep?.episodeId) return;
      const resolved = await resolveAnimeStream(
        ep,
        undefined,
        series.malId,
        null,
      );
      if (!listFetchMountedRef.current) return;
      const handoffId = stashAnimeWatchHandoff({
        malId: String(series.malId),
        episodeIndex: epIndex,
        anime: series.malDetail || null,
        episodes: Array.isArray(series.episodes) ? series.episodes : [],
        stream: { ...resolved, resolving: false },
      });
      void fetchStreamInfoByMalWithCache(String(series.malId), lifesyncFetch, undefined, {
        title: String(series?.title || ''),
      })
        .then((body) => {
          if (body?.data != null)
            writeLifesyncStreamCatalogByMal(series.malId, body);
        })
        .catch(() => {});
      const ep1 = clampPage(epIndex + 1);
      const fromPath = `${listPath.replace(location.search || "", "")}${location.search || ""}`;
      const target = `/dashboard/lifesync/anime/anime/watch/${encodeURIComponent(String(series.malId))}/${ep1}`;
      const nextState = { from: fromPath, handoffId, title: String(series?.title || '') };
      const go = () => navigate(target, { state: nextState });
      if (typeof document !== "undefined" && document.startViewTransition) {
        document.startViewTransition(() => {
          go();
        });
      } else {
        go();
      }
    },
    [listPath, location.search, navigate, resolveAnimeStream],
  );

  /** Legacy list URLs `…/seasonal/page/1/watch/:malId/:ep` → dedicated watch route. */
  useEffect(() => {
    const malId = route.watchAnimeId;
    if (!malId) return;
    const rel = location.pathname.startsWith(basePath)
      ? location.pathname.slice(basePath.length)
      : "";
    const parts = rel.split("/").filter(Boolean);
    const watchIdx = parts.indexOf("watch");
    if (watchIdx < 0) return;
    const withoutWatch = parts.slice(0, watchIdx);
    const fromPath = `${basePath}/${withoutWatch.join("/")}${location.search || ""}`;
    const ep1 =
      route.watchEpisodeIndex != null && route.watchEpisodeIndex >= 0
        ? clampPage(route.watchEpisodeIndex + 1)
        : 1;
    navigate(
      `/dashboard/lifesync/anime/anime/watch/${encodeURIComponent(malId)}/${ep1}`,
      { replace: true, state: { from: fromPath } },
    );
  }, [
    basePath,
    location.pathname,
    location.search,
    navigate,
    route.watchAnimeId,
    route.watchEpisodeIndex,
  ]);

  const seasonalYearOptions = useMemo(() => {
    const end = new Date().getFullYear() + 1;
    const out = [];
    for (let y = end; y >= 1995; y -= 1) out.push(y);
    return out;
  }, []);

  const PAGE_SIZE = 24;

  const loadSeasonal = useCallback(async () => {
    try {
      const offset = (Math.max(1, seasonalPage) - 1) * PAGE_SIZE;
      const data = await lifesyncFetch(
        `/api/v1/anime/seasonal?year=${seasonalYear}&season=${encodeURIComponent(seasonalSeason)}&limit=${PAGE_SIZE}&offset=${offset}&fields=mean,media_type,num_episodes&view=compact`,
      );
      if (!listFetchMountedRef.current) return;
      setSeasonal(data?.data || []);
      setSeasonalHasNext(Boolean(data?.paging?.next));
    } catch {
      /* ignore */
    }
  }, [seasonalYear, seasonalSeason, seasonalPage, nsfwContentEnabled]);

  const loadRanking = useCallback(async () => {
    try {
      const offset = (Math.max(1, rankingPage) - 1) * PAGE_SIZE;
      const data = await lifesyncFetch(
        `/api/v1/anime/ranking?ranking_type=${encodeURIComponent(rankingType)}&limit=${PAGE_SIZE}&offset=${offset}&view=compact`,
      );
      if (!listFetchMountedRef.current) return;
      setRanking(data?.data || []);
      setRankingHasNext(Boolean(data?.paging?.next));
    } catch {
      /* ignore */
    }
  }, [rankingType, rankingPage, nsfwContentEnabled]);

  const loadMyList = useCallback(async () => {
    try {
      const data = await lifesyncFetch("/api/v1/anime/mylist?limit=50&view=standard");
      if (!listFetchMountedRef.current) return;
      setMyList(data?.data || []);
    } catch {
      /* ignore */
    }
  }, [nsfwContentEnabled]);

  const load = useCallback(async () => {
    if (listFetchMountedRef.current) {
      setBusy(true);
      setError("");
    }
    try {
      await Promise.all([
        loadSeasonal(),
        loadRanking(),
        malLinked ? loadMyList() : Promise.resolve(),
      ]);
    } catch (e) {
      if (listFetchMountedRef.current) {
        setError(e.message || "Failed to load anime data");
      }
    } finally {
      if (listFetchMountedRef.current) {
        setBusy(false);
      }
    }
  }, [loadSeasonal, loadRanking, loadMyList, malLinked]);

  useEffect(() => {
    if (isLifeSyncConnected) load();
  }, [isLifeSyncConnected, load]);

  useEffect(() => {
    if (!isLifeSyncConnected || tab !== "ranking") return;
    void loadRanking();
  }, [isLifeSyncConnected, tab, loadRanking]);

  useEffect(() => {
    if (!isLifeSyncConnected || tab !== "seasonal") return;
    void loadSeasonal();
  }, [isLifeSyncConnected, tab, loadSeasonal]);

  useEffect(() => {
    setSeasonalPage(1);
  }, [seasonalYear, seasonalSeason]);

  useEffect(() => {
    setRankingPage(1);
  }, [rankingType]);

  useEffect(() => {
    let cancelled = false;
    try {
      const raw = sessionStorage.getItem("maxien_lifesync_oauth");
      if (raw) {
        sessionStorage.removeItem("maxien_lifesync_oauth");
        const { type, text, provider } = JSON.parse(raw);
        if (provider?.startsWith("mal")) {
          setOauthMsg(text);
          if (type === "error") setError(text);
          refreshLifeSyncMe()
            .then(() => {
              if (!cancelled) void load();
            })
            .catch(() => {});
          scheduleClearOauthMsg(8000);
        }
      }
    } catch {
      /* ignore */
    }
    return () => {
      cancelled = true;
    };
  }, [refreshLifeSyncMe, load, scheduleClearOauthMsg]);

  useEffect(() => {
    let cancelled = false;
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !isLifeSyncConnected) return;
      refreshLifeSyncMe()
        .then(() => {
          if (!cancelled) void load();
        })
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isLifeSyncConnected, refreshLifeSyncMe, load]);

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQ.trim()) return;
    setSearching(true);
    try {
      const q = searchQ.trim();
      setSearchCommittedQ(q);
      setSearchPage(1);
      const qs = new URLSearchParams(location.search || "");
      qs.set("q", q);
      navigate(`${basePath}/search/page/1?${qs.toString()}`);
    } catch (e) {
      setError(e.message || "Search failed");
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    if (!isLifeSyncConnected || tab !== "search" || !searchCommittedQ.trim()) return;
    const offset = (Math.max(1, searchPage) - 1) * PAGE_SIZE;
    let cancelled = false;
    setSearching(true);
    lifesyncFetch(
      `/api/v1/anime/search?q=${encodeURIComponent(searchCommittedQ.trim())}&limit=${PAGE_SIZE}&offset=${offset}&view=compact`,
    )
      .then((data) => {
        if (cancelled) return;
        setSearchResults(data?.data || []);
        setSearchHasNext(Boolean(data?.paging?.next));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLifeSyncConnected, tab, searchCommittedQ, searchPage]);

  if (!isLifeSyncConnected) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-1 text-[28px] font-bold tracking-tight text-[var(--mx-color-1a1628)]">
          Anime
        </h1>
        <p className="mb-4 max-w-xl text-[13px] leading-relaxed text-[var(--mx-color-5b5670)]">
          Track what you watch, browse seasonal charts, and open episodes—connect LifeSync to get started.
        </p>
        <div className="rounded-[22px] border border-[var(--color-border-strong)]/90 bg-[var(--color-surface)]/90 px-8 py-16 text-center shadow-sm ring-1 ring-[var(--mx-color-e8e4ef)]/70">
          <p className="mb-2 text-[15px] font-bold text-[var(--mx-color-1a1628)]">
            LifeSync Not Connected
          </p>
          <p className="mb-4 text-[13px] text-[var(--mx-color-5b5670)]">
            Connect LifeSync in your profile to access anime tracking.
          </p>
          <Link
            to="/dashboard/profile?tab=integrations"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--mx-color-c6ff00)] px-5 py-2.5 text-[13px] font-semibold text-[var(--mx-color-1a1628)] shadow-sm ring-1 ring-[var(--mx-color-1a1628)]/10 transition-all hover:brightness-95"
          >
            Go to Integrations
          </Link>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "seasonal", label: "Seasonal" },
    { id: "ranking", label: "Top Ranked" },
    ...(malLinked ? [{ id: "mylist", label: "My List" }] : []),
    ...(searchResults.length > 0
      ? [{ id: "search", label: "Search Results" }]
      : []),
  ];

  const currentItems =
    tab === "seasonal"
      ? seasonal
      : tab === "ranking"
        ? ranking
        : tab === "mylist"
          ? myList
          : searchResults;

  const pager = (() => {
    if (tab === "seasonal") {
      return {
        page: seasonalPage,
        onPage: setSeasonalPage,
        canPrev: seasonalPage > 1,
        canNext: seasonalHasNext,
      };
    }
    if (tab === "ranking") {
      return {
        page: rankingPage,
        onPage: setRankingPage,
        canPrev: rankingPage > 1,
        canNext: rankingHasNext,
      };
    }
    if (tab === "search") {
      return {
        page: searchPage,
        onPage: setSearchPage,
        canPrev: searchPage > 1,
        canNext: searchHasNext,
      };
    }
    return null;
  })();

  return (
    <MotionDiv
      className="space-y-6 sm:space-y-8"
      style={{ transformOrigin: "50% 0%" }}
      initial="initial"
      animate="animate"
      variants={lifeSyncDollyPageVariants}
      transition={lifeSyncDollyPageTransition}
    >
      <AnimatePresence mode="sync">
        {detailId ? (
          <DetailPanel
            key={detailId}
            animeId={detailId}
            preview={detailPreview}
            animeStreamAudio={streamAudioType}
            onClose={() => goToList({ replace: true })}
            onPlayStream={playEpisode}
          />
        ) : null}
      </AnimatePresence>

      <MotionDiv
        className="flex flex-col gap-5 sm:gap-6"
        style={{ pointerEvents: detailId ? "none" : undefined }}
        variants={lifeSyncStaggerContainer}
        initial="hidden"
        animate="show"
      >
      <MotionDiv className="flex items-start justify-between gap-3 sm:gap-4" variants={lifeSyncStaggerItem}>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-[var(--mx-color-86868b)] uppercase tracking-widest">
            LifeSync / Anime
          </p>
          <h1 className="text-[24px] sm:text-[28px] font-bold text-[var(--mx-color-1a1628)] tracking-tight">
            Anime
          </h1>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[var(--mx-color-5b5670)]">
            Track seasonal lineups and rankings, open any title for details, and continue watching on the dedicated watch page.
          </p>
        </div>
        <div className="flex shrink-0 flex-col sm:flex-row sm:items-center gap-2 sm:pt-0.5">
          {!malLinked && lifesyncOAuthStartUrl("mal") && (
            <a
              href={lifesyncOAuthStartUrl("mal")}
              className="whitespace-nowrap text-center text-[12px] font-semibold bg-[var(--mx-color-2e51a2)] text-white px-4 py-2 rounded-xl hover:bg-[var(--mx-color-24408a)] transition-colors"
            >
              Link MAL
            </a>
          )}
          {malLinked && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await lifesyncFetch("/api/v1/anime/link", { method: "DELETE" });
                  await refreshLifeSyncMe();
                  setOauthMsg("MyAnimeList disconnected.");
                  scheduleClearOauthMsg(5000);
                } catch (e) {
                  setError(e.message || "Failed to disconnect MAL");
                }
              }}
              className="whitespace-nowrap text-[11px] font-semibold text-[var(--mx-color-86868b)] hover:text-red-500 px-3 py-2 sm:py-1.5 rounded-lg hover:bg-red-50 border border-[var(--mx-color-e5e5ea)] hover:border-red-100 transition-colors"
            >
              Disconnect MAL
            </button>
          )}
        </div>
      </MotionDiv>

      {oauthMsg && !error && (
        <div className="bg-green-50 text-green-700 text-[12px] font-medium px-4 py-3 rounded-xl border border-green-100">
          {oauthMsg}
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 text-[12px] font-medium px-4 py-3 rounded-xl border border-red-100">
          {error}
        </div>
      )}

      <MotionDiv
        variants={lifeSyncStaggerItem}
      >
      <form
        onSubmit={handleSearch}
        className="flex flex-col gap-2 items-stretch sm:flex-row sm:flex-wrap"
      >
        <input
          type="search"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search anime..."
          className="min-w-[min(100%,12rem)] flex-1 rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-f5f5f7)] px-4 py-2.5 text-[13px] text-[var(--mx-color-1d1d1f)] transition-all focus:border-[var(--mx-color-c6ff00)]/60 focus:bg-[var(--color-surface)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={searching}
          className="w-full shrink-0 rounded-xl bg-[var(--mx-color-c6ff00)] px-4 py-2.5 text-[13px] font-semibold text-[var(--mx-color-1a1628)] shadow-sm ring-1 ring-[var(--mx-color-1a1628)]/10 transition-all hover:brightness-95 disabled:opacity-50 sm:w-auto"
        >
          {searching ? "Searching..." : "Search"}
        </button>
      </form>
      </MotionDiv>

      <MotionDiv variants={lifeSyncStaggerItem}>
      <LifeSyncSectionNav
        ariaLabel="Anime lists"
        layoutId="lifesync-anime-main-tab"
        items={tabs.map((t) => ({ id: t.id, label: t.label }))}
        activeId={tab}
        onSelect={(id) => goToTab(id)}
      />
      </MotionDiv>

      {tab === "seasonal" && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap -mt-2">
          <div className="flex items-center gap-2">
            <label
              htmlFor="seasonal-year"
              className="text-[11px] font-semibold text-[var(--mx-color-86868b)] whitespace-nowrap"
            >
              Year
            </label>
            <select
              id="seasonal-year"
              value={seasonalYear}
              onChange={(e) => setSeasonalYear(Number(e.target.value))}
              className="text-[12px] font-semibold text-[var(--mx-color-1d1d1f)] bg-[var(--color-surface)] border border-[var(--mx-color-e5e5ea)] rounded-lg px-2.5 py-1.5 min-w-[5.5rem] focus:outline-none focus:border-[var(--mx-color-c6ff00)]/60"
            >
              {seasonalYearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const cur = currentMalSeason();
                setSeasonalYear(cur.year);
                setSeasonalSeason(cur.season);
              }}
              className="text-[11px] font-semibold text-[var(--mx-color-2e51a2)] hover:underline px-1"
            >
              This season
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 hide-scrollbar overscroll-x-contain">
            {MAL_SEASON_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSeasonalSeason(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                  seasonalSeason === opt.id
                    ? "bg-[var(--mx-color-1d1d1f)] text-white border-[var(--mx-color-1d1d1f)]"
                    : "bg-[var(--color-surface)] text-[var(--mx-color-86868b)] border-[var(--mx-color-e5e5ea)] hover:text-[var(--mx-color-1d1d1f)] hover:border-[var(--mx-color-d2d2d7)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "ranking" && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mt-2 hide-scrollbar overscroll-x-contain">
          {MAL_RANKING_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setRankingType(opt.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all border ${
                rankingType === opt.id
                  ? "bg-[var(--mx-color-1d1d1f)] text-white border-[var(--mx-color-1d1d1f)]"
                  : "bg-[var(--color-surface)] text-[var(--mx-color-86868b)] border-[var(--mx-color-e5e5ea)] hover:text-[var(--mx-color-1d1d1f)] hover:border-[var(--mx-color-d2d2d7)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* List + pager only — tab filters above stay put */}
      <MotionDiv variants={lifeSyncStaggerItem}>
        <AnimatePresence mode="wait">
          <MotionDiv
            key={tab}
            className="space-y-4"
            initial="initial"
            animate="animate"
            exit="exit"
            variants={lifeSyncSectionPresenceVariants}
            transition={lifeSyncSectionPresenceTransition}
          >
      {tab === "mylist" && currentItems.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {currentItems.map((item) => (
            <MyListCard
              key={item.node?.id}
              node={item.node}
              listStatus={item.list_status}
              onSelect={goToDetail}
            />
          ))}
        </div>
      ) : currentItems.length > 0 ? (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {currentItems.map((item, i) => (
            <AnimeCard
              key={item.node?.id || i}
              node={item.node}
              ranking={tab === "ranking" ? item.ranking?.rank : undefined}
              onSelect={goToDetail}
            />
          ))}
        </div>
      ) : (
        !busy && (
          <div className="bg-[var(--color-surface)] rounded-[18px] border border-[var(--mx-color-d2d2d7)]/50 shadow-sm px-6 py-10 text-center">
            <p className="text-[13px] text-[var(--mx-color-86868b)]">
              {tab === "mylist"
                ? "Your anime list is empty. Link MAL to sync your list."
                : "No anime to display."}
            </p>
          </div>
        )
      )}

      {pager && currentItems.length > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-[var(--mx-color-86868b)]">Page {pager.page}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={!pager.canPrev}
              onClick={() => goToPage(pager.page - 1)}
              className="text-[11px] font-semibold text-[var(--mx-color-1d1d1f)] bg-[var(--mx-color-f5f5f7)] hover:bg-[var(--mx-color-ebebed)] px-3 py-1.5 rounded-lg border border-[var(--mx-color-e5e5ea)] disabled:opacity-40"
            >
              Previous
            </button>
            <div className="flex items-center gap-1.5">
              {(() => {
                const cur = pager.page;
                const pages = [];
                const start = Math.max(1, cur - 2);
                const end = cur + 2;
                if (start > 1) pages.push(1, "…");
                for (let p = start; p <= end; p += 1) pages.push(p);
                if (pager.canNext) pages.push("…");
                return pages.map((p, idx) =>
                  typeof p === "number" ? (
                    <button
                      key={p}
                      type="button"
                      onClick={() => goToPage(p)}
                      className={`min-w-8 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                        p === cur
                          ? "bg-[var(--mx-color-1d1d1f)] text-white border-[var(--mx-color-1d1d1f)]"
                          : "bg-[var(--color-surface)] text-[var(--mx-color-1d1d1f)] border-[var(--mx-color-e5e5ea)] hover:bg-[var(--mx-color-fafafa)]"
                      }`}
                      aria-current={p === cur ? "page" : undefined}
                    >
                      {p}
                    </button>
                  ) : (
                    <span key={`dots-${idx}`} className="px-1 text-[11px] text-[var(--mx-color-86868b)]">
                      …
                    </span>
                  ),
                );
              })()}
            </div>
            <button
              type="button"
              disabled={!pager.canNext}
              onClick={() => goToPage(pager.page + 1)}
              className="text-[11px] font-semibold text-[var(--mx-color-1d1d1f)] bg-[var(--mx-color-f5f5f7)] hover:bg-[var(--mx-color-ebebed)] px-3 py-1.5 rounded-lg border border-[var(--mx-color-e5e5ea)] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
          </MotionDiv>
        </AnimatePresence>
      </MotionDiv>

      </MotionDiv>
    </MotionDiv>
  );
}
