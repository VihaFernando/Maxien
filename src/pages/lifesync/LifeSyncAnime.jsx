import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import AdvancedVideoPlayer from "../../components/lifesync/AdvancedVideoPlayer";
import { useLifeSync } from "../../context/LifeSyncContext";
import {
  ANIPUB_API_REFERENCE_URL,
  getAnimeStreamAudio,
  getLifesyncApiBase,
  lifesyncFetch,
  lifesyncOAuthStartUrl,
} from "../../lib/lifesyncApi";

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

function AnimeCard({ node, ranking, onSelect }) {
  const anime = node || {};
  const pic = anime.main_picture?.large || anime.main_picture?.medium;
  return (
    <button
      type="button"
      onClick={() => anime.id != null && onSelect?.(anime.id)}
      className="group w-full text-left"
    >
      <div className="bg-white rounded-[18px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden hover:shadow-md transition-all">
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#f5f5f7]">
          {pic ? (
            <img
              src={pic}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#86868b]">
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
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          {ranking != null && (
            <span className="absolute left-2 top-2 bg-[#C6FF00] text-[#1d1d1f] text-[10px] font-bold px-2 py-0.5 rounded-lg">
              #{ranking}
            </span>
          )}
          {anime.mean != null && (
            <span className="absolute right-2 top-2 bg-white/90 text-[#1d1d1f] text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-0.5">
              <svg
                className="w-3 h-3 text-amber-500 fill-amber-500"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {anime.mean}
            </span>
          )}
          <div className="absolute bottom-0 inset-x-0 p-3">
            <p className="text-[13px] font-semibold text-white line-clamp-2 drop-shadow">
              {anime.title}
            </p>
            <div className="flex gap-1 mt-1">
              {anime.media_type && (
                <span className="bg-white/20 text-white text-[10px] font-medium px-1.5 py-0.5 rounded uppercase backdrop-blur-sm">
                  {anime.media_type}
                </span>
              )}
              {anime.num_episodes != null && (
                <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                  {anime.num_episodes} ep
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

function MyListCard({ node, listStatus, onSelect }) {
  const anime = node || {};
  const pic = anime.main_picture?.large || anime.main_picture?.medium;
  const st = listStatus || {};
  const statusColors = {
    watching: "bg-emerald-50 text-emerald-700 border-emerald-100",
    completed: "bg-blue-50 text-blue-700 border-blue-100",
    on_hold: "bg-amber-50 text-amber-700 border-amber-100",
    dropped: "bg-red-50 text-red-700 border-red-100",
    plan_to_watch: "bg-[#f5f5f7] text-[#86868b] border-[#e5e5ea]",
  };
  const badge =
    statusColors[st.status] || "bg-[#f5f5f7] text-[#86868b] border-[#e5e5ea]";

  return (
    <button
      type="button"
      onClick={() => anime.id != null && onSelect?.(anime.id)}
      className="group w-full text-left"
    >
      <div className="bg-white rounded-[16px] border border-[#d2d2d7]/50 shadow-sm p-3 flex gap-3 hover:shadow-md transition-all">
        <div className="w-16 h-24 shrink-0 rounded-xl overflow-hidden bg-[#f5f5f7]">
          {pic ? (
            <img
              src={pic}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[#1d1d1f] line-clamp-2">
            {anime.title}
          </p>
          <span
            className={`inline-flex mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${badge}`}
          >
            {(st.status || "").replace(/_/g, " ")}
          </span>
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[#86868b]">
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
}

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

function formatMalStatusLabel(status) {
  if (!status) return "—";
  return String(status).replace(/_/g, " ");
}

function episodeNumberForMalProgress(ep, episodeIndex) {
  if (ep?.number != null && Number.isFinite(Number(ep.number))) {
    return Math.max(1, Math.floor(Number(ep.number)));
  }
  return Math.max(1, episodeIndex + 1);
}

async function putAnimeWatchProgress(malId, lastEpisodeNumber) {
  if (!malId || !lastEpisodeNumber) return;
  try {
    await lifesyncFetch(
      `/api/anime/watch-progress/${encodeURIComponent(malId)}`,
      {
        method: "PUT",
        json: { lastEpisodeNumber },
      },
    );
  } catch {
    /* ignore */
  }
}

function MalScoreStars({
  malId,
  malLinked,
  malDetail,
  onUpdated,
  className = "",
}) {
  const ls = malDetail?.my_list_status || {};
  const [score, setScore] = useState(() =>
    ls.score != null ? Number(ls.score) : 0,
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const s = malDetail?.my_list_status || {};
    setScore(s.score != null ? Number(s.score) : 0);
  }, [malDetail]);

  const saveScore = async (nextScore) => {
    if (!malLinked || !malId) {
      setMsg("Link MyAnimeList to rate.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const body = { score: nextScore > 0 ? nextScore : 0 };
      const data = await lifesyncFetch(
        `/api/anime/mylist/${encodeURIComponent(malId)}`,
        {
          method: "PATCH",
          json: body,
        },
      );
      onUpdated?.(data);
      setMsg("Saved.");
      setTimeout(() => setMsg(""), 2500);
    } catch (err) {
      setMsg(err.message || "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const Star = ({ filled }) => (
    <svg
      className={`h-6 w-6 ${filled ? "text-amber-400 fill-amber-400" : "text-white/20 fill-white/10"}`}
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );

  return (
    <div className={className}>
      <div
        className={`flex items-center justify-between gap-3 ${!malLinked || busy ? "opacity-60" : ""}`}
      >
        <div className="flex items-center gap-1">
          {Array.from({ length: 10 }).map((_, i) => {
            const v = i + 1;
            const filled = score >= v;
            const label =
              v === score
                ? `Score ${v} out of 10 (selected)`
                : `Set score to ${v} out of 10`;
            return (
              <button
                key={v}
                type="button"
                disabled={!malLinked || busy}
                onClick={() => {
                  setScore(v);
                  void saveScore(v);
                }}
                className="rounded focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                aria-label={label}
              >
                <Star filled={filled} />
              </button>
            );
          })}
        </div>
        <div className="shrink-0 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-semibold text-white/80 tabular-nums">
          {score > 0 ? `${score}/10` : "—"}
        </div>
      </div>
      {msg ? (
        <p className="mt-1.5 text-[11px] text-cyan-200/90">{msg}</p>
      ) : null}
    </div>
  );
}

function pickMalAltTitle(mal) {
  if (!mal || typeof mal !== "object") return "";
  const title = mal.title || "";
  const syn = Array.isArray(mal.alternative_titles?.synonyms)
    ? mal.alternative_titles.synonyms.filter(Boolean)
    : [];
  const ja = mal.alternative_titles?.ja;
  const en = mal.alternative_titles?.en;
  if (ja && String(ja).trim() && ja !== title) return String(ja).trim();
  if (syn.length) return syn.join(" · ");
  if (en && String(en).trim() && en !== title) return String(en).trim();
  return "";
}

function StreamMetaStatCard({ label, value }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-lg border border-white/[0.06] bg-[#0a0f16] py-2.5 pl-3 pr-2 sm:py-3">
      <span className="border-l-2 border-cyan-400 pl-2.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/45">
        {label}
      </span>
      <p className="mt-1.5 pl-2.5 text-[13px] font-semibold capitalize text-white sm:text-[14px]">
        {value}
      </p>
    </div>
  );
}

/** Hero row below the stream player (poster + MAL-style metadata). */
function AnimeStreamDetailBelowVideo({
  series,
  malLinked,
  onScrollToPlayer,
  onMalUpdated,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
}) {
  const mal = series?.malDetail;
  const malId =
    series?.malId ??
    (typeof series?.seriesKey === "string" &&
    series.seriesKey.startsWith("mal:")
      ? series.seriesKey.slice(4)
      : null);
  const poster =
    series?.poster || mal?.main_picture?.large || mal?.main_picture?.medium;
  const displayTitle = mal?.title || series?.title || "Anime";
  const altTitle = pickMalAltTitle(mal);
  const epCount =
    mal?.num_episodes != null
      ? mal.num_episodes
      : (series?.episodes?.length ?? "—");
  const votes = mal?.num_list_users ?? mal?.statistics?.num_list_users;
  const rank = mal?.rank;
  const mean = mal?.mean;
  const genres = Array.isArray(mal?.genres) ? mal.genres : [];

  return (
    <div className="overflow-hidden rounded-2xl border border-cyan-500/15 bg-[#0d1219] shadow-[0_0_40px_-8px_rgba(168,85,247,0.25)]">
      <div className="flex flex-col gap-5 p-4 sm:flex-row sm:items-stretch sm:gap-6 sm:p-5">
        <div className="mx-auto w-[8.5rem] shrink-0 sm:mx-0 sm:w-[min(11rem,28vw)]">
          <div className="aspect-[2/3] overflow-hidden rounded-xl shadow-[0_12px_40px_-4px_rgba(168,85,247,0.35)] ring-1 ring-fuchsia-500/20">
            {poster ? (
              <img
                src={poster}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-white/5 text-white/25">
                <svg
                  className="h-12 w-12"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h2 className="font-serif text-[1.35rem] font-bold leading-tight tracking-tight text-white sm:text-[1.65rem]">
              {displayTitle}
            </h2>
            {altTitle ? (
              <p className="mt-1.5 text-[12px] italic text-white/50 sm:text-[13px]">
                Also known as: {altTitle}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
            <StreamMetaStatCard
              label="Status:"
              value={formatMalStatusLabel(mal?.status)}
            />
            <StreamMetaStatCard
              label="Type:"
              value={
                mal?.media_type ? String(mal.media_type).toUpperCase() : "—"
              }
            />
            <StreamMetaStatCard
              label="Episodes:"
              value={epCount === "—" ? "—" : String(epCount)}
            />
            <StreamMetaStatCard
              label="Rating:"
              value={mean != null ? `${mean} / 10` : "? / 10"}
            />
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="rounded-xl border border-fuchsia-500/25 bg-[#0a0f16] px-4 py-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/45">
                MyAnimeList votes
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-cyan-400 sm:text-[1.75rem]">
                {votes != null ? Number(votes).toLocaleString() : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-fuchsia-500/25 bg-[#0a0f16] px-4 py-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/45">
                MyAnimeList rank
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-cyan-400 sm:text-[1.75rem]">
                {rank != null ? `#${rank}` : "—"}
              </p>
            </div>
          </div>

          {genres.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {genres.slice(0, 8).map((g) => (
                <span
                  key={g.id || g.name}
                  className="rounded-full border border-cyan-400/50 bg-transparent px-3 py-1 text-[11px] font-medium text-white"
                >
                  {g.name}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex-1 sm:flex-initial sm:min-w-[22rem]">
              {malId ? (
                <div className="rounded-xl border border-white/10 bg-[#0a0f16] px-4 py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/45">
                    Your score
                  </p>
                  <MalScoreStars
                    malId={malId}
                    malLinked={malLinked}
                    malDetail={mal}
                    onUpdated={onMalUpdated}
                    className="mt-2"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onScrollToPlayer}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 text-[12px] font-bold uppercase tracking-wide text-[#0a1628] shadow-[0_0_24px_-4px_rgba(34,211,238,0.45)] transition hover:bg-cyan-300"
                >
                  <svg
                    className="h-4 w-4 shrink-0"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Watch now
                </button>
              )}
            </div>
            <div className="flex gap-2 sm:ml-auto">
              <button
                type="button"
                disabled={prevDisabled}
                onClick={onPrev}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3 text-[11px] font-semibold text-white/85 hover:bg-white/10 disabled:opacity-30 sm:flex-initial sm:min-w-[6.5rem]"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={nextDisabled}
                onClick={onNext}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-400/15 px-3 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-400/25 disabled:opacity-30 sm:flex-initial sm:min-w-[6.5rem]"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Fullscreen watch UI — same flow as LifeSyncHentai (player + episode queue). */
function AnimeStreamPlayerPopup({
  playerState,
  onClose,
  onChangeEpisode,
  malLinked,
  streamAudioType,
  onAudioModeChange,
  onMirrorChange,
  onMalListPatchResult,
}) {
  const { stream, series, episodeIndex } = playerState;
  const episodes = useMemo(() => series?.episodes || [], [series]);
  const prevEp = episodeIndex > 0 ? episodes[episodeIndex - 1] : null;
  const nextEp =
    episodeIndex >= 0 && episodeIndex < episodes.length - 1
      ? episodes[episodeIndex + 1]
      : null;
  const playingRef = useRef(null);
  const playerAnchorRef = useRef(null);
  const malSyncTimerRef = useRef(null);
  const [audioBusy, setAudioBusy] = useState(false);
  const [episodesOpen, setEpisodesOpen] = useState(false);

  const malId = series?.malId;
  const displayTitle = series?.malDetail?.title || series?.title || "Anime";
  const nowPlayingLabel = stream?.title ? String(stream.title) : "";

  const queueMalSync = useCallback(
    (mid, epNum, totalEpisodes) => {
      if (!malLinked || !mid || !epNum) return;
      if (malSyncTimerRef.current) clearTimeout(malSyncTimerRef.current);
      malSyncTimerRef.current = setTimeout(async () => {
        try {
          const body = { num_watched_episodes: epNum };
          const total = totalEpisodes != null ? Number(totalEpisodes) : NaN;
          if (Number.isFinite(total) && total > 0 && epNum >= total) {
            body.status = "completed";
          }
          await lifesyncFetch(`/api/anime/mylist/${encodeURIComponent(mid)}`, {
            method: "PATCH",
            json: body,
          });
        } catch {
          /* not on list or offline */
        }
      }, 700);
    },
    [malLinked],
  );

  useEffect(() => {
    return () => {
      if (malSyncTimerRef.current) clearTimeout(malSyncTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!malId || !episodes.length) return;
    const ep = episodes[episodeIndex];
    if (!ep) return;
    const n = episodeNumberForMalProgress(ep, episodeIndex);
    void putAnimeWatchProgress(malId, n);
    queueMalSync(malId, n, series?.malDetail?.num_episodes);
  }, [
    episodeIndex,
    episodes,
    malId,
    malLinked,
    queueMalSync,
    series?.malDetail?.num_episodes,
  ]);

  const scrollToPlayer = useCallback(() => {
    playerAnchorRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  useEffect(() => {
    const el = playingRef.current;
    if (!el) return;
    el.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [episodeIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const hideScroll = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
  const progressLabel =
    episodes.length > 0
      ? `${Math.min(episodes.length, episodeIndex + 1)} / ${episodes.length}`
      : null;

  const handleEnded = useCallback(() => {
    if (!malId || !episodes[episodeIndex]) return;
    const n = episodeNumberForMalProgress(episodes[episodeIndex], episodeIndex);
    void putAnimeWatchProgress(malId, n);
    queueMalSync(malId, n, series?.malDetail?.num_episodes);
    if (nextEp) onChangeEpisode(episodeIndex + 1);
  }, [
    episodeIndex,
    episodes,
    malId,
    nextEp,
    onChangeEpisode,
    queueMalSync,
    series?.malDetail?.num_episodes,
  ]);

  const switchAudio = async (mode) => {
    if (audioBusy || mode === streamAudioType) return;
    setAudioBusy(true);
    try {
      await onAudioModeChange?.(mode);
    } finally {
      setAudioBusy(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex h-dvh max-h-dvh w-full max-w-[100vw] flex-col overflow-x-hidden overflow-y-hidden bg-[#020202] text-white"
      style={{
        paddingLeft: "max(0px, env(safe-area-inset-left))",
        paddingRight: "max(0px, env(safe-area-inset-right))",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#C6FF00]/12 blur-[120px]" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-[#37c9ff]/8 blur-[135px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08)_0%,rgba(2,2,2,0)_48%)]" />
      </div>

      <header className="relative shrink-0 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="flex min-w-0 items-center justify-between gap-2 py-2.5 pl-3 pr-3 pt-[max(0.625rem,env(safe-area-inset-top))] sm:gap-3 sm:px-4 sm:py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-w-0 shrink items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white/85 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
            >
              <svg
                className="h-4 w-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <span className="truncate">Back</span>
            </button>
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold text-white/90 sm:text-[13px]">
                {displayTitle}
              </p>
              {nowPlayingLabel ? (
                <p className="truncate text-[10px] font-medium text-white/45">
                  {nowPlayingLabel}
                </p>
              ) : (
                <p className="text-[10px] font-medium text-white/35">Ready</p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Mobile: Episodes drawer */}
            {episodes.length > 0 && (
              <button
                type="button"
                onClick={() => setEpisodesOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/85 hover:bg-white/10 sm:hidden"
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
                    d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
                  />
                </svg>
                Episodes
              </button>
            )}

            {/* Close (explicit X) */}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
              aria-label="Close player"
              title="Close"
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
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-3 py-2 sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-full border border-white/15 bg-black/30 p-0.5">
              <button
                type="button"
                disabled={audioBusy}
                onClick={() => void switchAudio("sub")}
                className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide transition ${
                  streamAudioType !== "dub"
                    ? "bg-cyan-400 text-[#0a1628]"
                    : "text-white/55 hover:text-white"
                }`}
              >
                Sub
              </button>
              <button
                type="button"
                disabled={audioBusy}
                onClick={() => void switchAudio("dub")}
                className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide transition ${
                  streamAudioType === "dub"
                    ? "bg-cyan-400 text-[#0a1628]"
                    : "text-white/55 hover:text-white"
                }`}
              >
                Dub
              </button>
            </div>
            {Array.isArray(stream?.mirrors) &&
              stream.mirrors.length > 1 &&
              String(stream?.provider || "").toLowerCase() !== "anitaku" && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                    Mirror
                  </span>
                  <select
                    value={stream.selectedMirrorId ?? "0"}
                    onChange={(e) => {
                      const val = e.target.value;
                      onMirrorChange?.(val);
                    }}
                    className="h-7 rounded-md border border-white/15 bg-black/40 px-2 text-[11px] font-semibold text-white/80 outline-none hover:border-white/25 focus:border-cyan-400/60"
                  >
                    {stream.mirrors.map((m, i) => (
                      <option
                        key={m.id ?? String(i)}
                        value={m.id ?? String(i)}
                        className="bg-[#111]"
                      >
                        {m.label || `Mirror ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
          </div>
          <div className="flex items-center gap-2">
            {progressLabel ? (
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold tabular-nums text-white/75">
                {progressLabel}
              </span>
            ) : null}
            <div className="hidden sm:flex items-center gap-2">
              <button
                type="button"
                disabled={!prevEp}
                onClick={() => prevEp && onChangeEpisode(episodeIndex - 1)}
                className="inline-flex h-8 items-center justify-center rounded-full border border-white/15 bg-white/5 px-3 text-[11px] font-semibold text-white/80 hover:bg-white/10 disabled:opacity-30"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={!nextEp}
                onClick={() => nextEp && onChangeEpisode(episodeIndex + 1)}
                className="inline-flex h-8 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-400/15 px-3 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-400/25 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </header>

      <div
        className={`relative min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden pb-[env(safe-area-inset-bottom,0px)] ${hideScroll}`}
      >
        <div className="mx-auto grid w-full min-w-0 max-w-[1200px] gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.4fr)] lg:gap-5 lg:px-6">
          <section className="min-w-0 space-y-4">
            <div
              ref={playerAnchorRef}
              id="lifesync-anime-player-anchor"
              className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-white/15 bg-black shadow-[0_28px_80px_rgba(0,0,0,0.5)]"
            >
              <div className="relative aspect-video w-full">
                <div className="absolute inset-0">
                  {stream.resolving ? (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-[#111]">
                      <div className="flex gap-1.5">
                        {[0, 150, 300].map((d) => (
                          <span
                            key={d}
                            className="h-2.5 w-2.5 rounded-full bg-[#C6FF00] animate-bounce"
                            style={{ animationDelay: `${d}ms` }}
                          />
                        ))}
                      </div>
                      <p className="mt-3 text-[13px] text-white/45">
                        Resolving stream…
                      </p>
                    </div>
                  ) : stream.iframeUrl ? (
                    <iframe
                      key={stream.iframeUrl}
                      title={stream.title || "Episode"}
                      src={stream.iframeUrl}
                      className="h-full w-full border-0 bg-black"
                      allow="fullscreen; encrypted-media; autoplay; picture-in-picture"
                      sandbox={
                        ["streamhg", "earnvid"].includes(
                          String(stream?.selectedMirrorLabel || "")
                            .trim()
                            .toLowerCase(),
                        )
                          ? undefined
                          : "allow-same-origin allow-scripts allow-presentation allow-popups allow-popups-to-escape-sandbox allow-forms"
                      }
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  ) : stream.videoUrl ? (
                    <AdvancedVideoPlayer
                      key={stream.videoUrl}
                      src={stream.videoUrl}
                      textTracks={stream.textTracks || []}
                      onEnded={handleEnded}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#111] px-4 text-center">
                      <p className="text-[14px] text-white/35">
                        No stream available for this episode.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <AnimeStreamDetailBelowVideo
              series={series}
              malLinked={malLinked}
              onScrollToPlayer={scrollToPlayer}
              onMalUpdated={(data) => onMalListPatchResult?.(data)}
              onPrev={() => prevEp && onChangeEpisode(episodeIndex - 1)}
              onNext={() => nextEp && onChangeEpisode(episodeIndex + 1)}
              prevDisabled={!prevEp}
              nextDisabled={!nextEp}
            />

            {stream.title &&
            stream.title !== (series?.malDetail?.title || series?.title) ? (
              <p className="text-center text-[11px] text-white/40 sm:text-left">
                Now playing:{" "}
                <span className="font-medium text-white/70">
                  {stream.title}
                </span>
              </p>
            ) : null}
          </section>

          {episodes.length > 0 && (
            <aside className="min-w-0 lg:max-h-[calc(100dvh-7.25rem)] lg:overflow-hidden hidden lg:block">
              <div
                className={`rounded-2xl border border-white/10 bg-white/[0.04] p-3 sm:p-4 lg:flex lg:h-full lg:max-h-full lg:flex-col`}
              >
                <div className="mb-3 flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">
                      Episodes
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-snug text-white/90">
                      {displayTitle}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md border border-white/10 bg-white/[0.06] px-2 py-1 text-[10px] font-medium tabular-nums text-white/55">
                    {episodes.length}
                  </span>
                </div>
                <div
                  className={`max-h-[42dvh] overflow-y-auto pr-1 lg:min-h-0 lg:max-h-none lg:flex-1 ${hideScroll}`}
                >
                  <ul className="space-y-1.5">
                    {episodes.map((ep, i) => {
                      const isCurrent = i === episodeIndex;
                      const epLabel =
                        ep.number != null ? `Ep ${ep.number}` : `Part ${i + 1}`;
                      return (
                        <li key={ep.episodeId || i}>
                          <button
                            ref={isCurrent ? playingRef : undefined}
                            type="button"
                            onClick={() => onChangeEpisode(i)}
                            className={`group flex w-full min-w-0 items-center gap-2.5 rounded-xl border px-2 py-2 text-left transition-all ${
                              isCurrent
                                ? "border-[#C6FF00]/50 bg-[#C6FF00]/14"
                                : "border-white/10 bg-black/30 hover:border-white/20 hover:bg-white/[0.06]"
                            }`}
                          >
                            <div className="relative h-12 w-[4.4rem] shrink-0 overflow-hidden rounded-lg bg-black/45">
                              {ep.thumbnailUrl || series?.poster ? (
                                <img
                                  src={ep.thumbnailUrl || series.poster}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-white/20">
                                  <svg
                                    className="h-5 w-5"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path d="M8 5v14l11-7z" />
                                  </svg>
                                </div>
                              )}
                              {isCurrent && (
                                <span className="absolute left-1 top-1 rounded bg-[#C6FF00]/90 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-black">
                                  Live
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className={`line-clamp-2 text-[11px] font-semibold leading-snug ${isCurrent ? "text-[#C6FF00]" : "text-white/88"}`}
                              >
                                {ep.title}
                              </p>
                              <p className="mt-1 text-[9px] text-white/42">
                                {epLabel}
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Mobile episodes drawer */}
      {episodes.length > 0 && episodesOpen && (
        <div
          className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setEpisodesOpen(false)}
        >
          <div
            className="absolute inset-x-0 bottom-0 max-h-[78dvh] rounded-t-3xl border-t border-white/10 bg-[#070a10] shadow-[0_-24px_60px_rgba(0,0,0,0.6)]"
            style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Episodes
                </p>
                <p className="truncate text-[13px] font-semibold text-white/90">
                  {displayTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEpisodesOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                aria-label="Close episodes"
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
            </div>
            <div
              className={`px-3 py-3 overflow-y-auto ${hideScroll}`}
              style={{ maxHeight: "calc(78dvh - 3.25rem)" }}
            >
              <ul className="space-y-2">
                {episodes.map((ep, i) => {
                  const isCurrent = i === episodeIndex;
                  const epLabel =
                    ep.number != null ? `Ep ${ep.number}` : `Part ${i + 1}`;
                  return (
                    <li key={ep.episodeId || i}>
                      <button
                        type="button"
                        onClick={() => {
                          onChangeEpisode(i);
                          setEpisodesOpen(false);
                        }}
                        className={`group flex w-full min-w-0 items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all ${
                          isCurrent
                            ? "border-[#C6FF00]/55 bg-[#C6FF00]/12"
                            : "border-white/10 bg-black/30 hover:border-white/20 hover:bg-white/[0.06]"
                        }`}
                      >
                        <div className="relative h-14 w-[5.4rem] shrink-0 overflow-hidden rounded-xl bg-black/45">
                          {ep.thumbnailUrl || series?.poster ? (
                            <img
                              src={ep.thumbnailUrl || series.poster}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-white/20">
                              <svg
                                className="h-5 w-5"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          )}
                          {isCurrent && (
                            <span className="absolute left-1.5 top-1.5 rounded bg-[#C6FF00]/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-black">
                              Live
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`line-clamp-2 text-[12px] font-semibold leading-snug ${isCurrent ? "text-[#C6FF00]" : "text-white/90"}`}
                          >
                            {ep.title}
                          </p>
                          <p className="mt-1 text-[10px] text-white/45">
                            {epLabel}
                          </p>
                        </div>
                        <svg
                          className={`h-4 w-4 shrink-0 ${isCurrent ? "text-[#C6FF00]" : "text-white/25 group-hover:text-white/45"}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

/** `key={animeId}` on parent resets loading state when the selected title changes (no sync setState in effects). */
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
    let cancelled = false;
    lifesyncFetch(
      `/api/anime/stream/info/by-mal/${encodeURIComponent(animeId)}`,
    )
      .then((res) => {
        if (!cancelled) setStreamData(res?.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setStreamData(null);
      })
      .finally(() => {
        if (!cancelled) setStreamBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [animeId]);

  useEffect(() => {
    let cancelled = false;
    const audio = animeStreamAudio === "dub" ? "dub" : "sub";
    lifesyncFetch(
      `/api/anime/mal-episode-thumbnails/${encodeURIComponent(animeId)}?audio=${audio}`,
    )
      .then((res) => {
        if (
          !cancelled &&
          res?.thumbnails &&
          typeof res.thumbnails === "object"
        ) {
          setThumbMap(res.thumbnails);
        }
      })
      .catch(() => {
        if (!cancelled) setThumbMap({});
      });
    return () => {
      cancelled = true;
    };
  }, [animeId, animeStreamAudio]);

  useEffect(() => {
    let cancelled = false;
    lifesyncFetch(`/api/anime/watch-progress/${encodeURIComponent(animeId)}`)
      .then((p) => {
        if (cancelled) return;
        setResumeLastEp(
          p?.lastEpisodeNumber != null ? p.lastEpisodeNumber : null,
        );
      })
      .catch(() => {
        if (!cancelled) setResumeLastEp(null);
      });
    return () => {
      cancelled = true;
    };
  }, [animeId]);

  const streamEps = useMemo(
    () => normalizeStreamEpisodesForPlayer(streamData?.episodes, thumbMap),
    [streamData, thumbMap],
  );

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

  return (
    <div className="border-t border-[#e5e5ea] pt-4 space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#86868b]">
        Watch
      </p>
      {!streamBusy &&
        streamData?.matchedStreamTitle &&
        streamData.matchedStreamTitle !== malTitle && (
          <p className="text-[11px] text-[#86868b]">
            Mirror match:{" "}
            <span className="font-medium text-[#1d1d1f]">
              {streamData.matchedStreamTitle}
            </span>
          </p>
        )}
      {streamBusy && (
        <div className="flex gap-1.5 items-center text-[12px] text-[#86868b]">
          {[0, 120, 240].map((d) => (
            <span
              key={d}
              className="w-1.5 h-1.5 rounded-full bg-[#d2d2d7] animate-bounce"
              style={{ animationDelay: `${d}ms` }}
            />
          ))}
          <span>Loading episodes…</span>
        </div>
      )}
      {!streamBusy &&
        streamEps.length > 0 &&
        resumeIndex >= 0 &&
        streamEps[resumeIndex] && (
          <button
            type="button"
            onClick={() => openSeries(streamEps[resumeIndex], resumeIndex)}
            className="w-full rounded-[14px] border border-[#2E51A2]/30 bg-[#2E51A2]/8 px-4 py-3 text-left shadow-sm transition hover:border-[#2E51A2]/50 hover:bg-[#2E51A2]/12"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#2E51A2]">
              Continue
            </p>
            <p className="mt-1 text-[13px] font-semibold text-[#1d1d1f]">
              Resume episode {resumeLastEp}
              {streamEps[resumeIndex]?.title
                ? ` · ${streamEps[resumeIndex].title}`
                : ""}
            </p>
          </button>
        )}
      {!streamBusy && streamEps.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {streamEps.map((ep, i) => (
            <button
              key={ep.episodeId}
              type="button"
              onClick={() => openSeries(ep, i)}
              className="group text-left overflow-hidden rounded-[14px] border border-[#d2d2d7]/50 bg-[#fafafa] shadow-sm hover:shadow-md hover:border-[#C6FF00]/40 transition-all"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-[#f5f5f7]">
                {ep.thumbnailUrl || pic ? (
                  <img
                    src={ep.thumbnailUrl || pic}
                    alt=""
                    className="h-full w-full object-cover opacity-90 transition-transform duration-300 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[#86868b]">
                    <svg
                      className="w-8 h-8"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                )}
                {ep.number != null && (
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-[#1d1d1f]/85 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-white">
                    E{ep.number}
                  </span>
                )}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 bg-black/25">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#C6FF00] shadow-lg">
                    <svg
                      className="ml-0.5 h-4 w-4 text-[#1d1d1f]"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                </div>
              </div>
              <div className="px-2 py-2">
                <p className="text-[10px] font-semibold text-[#1d1d1f] line-clamp-2 leading-snug">
                  {ep.title}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
      {!streamBusy && streamData && streamEps.length === 0 && (
        <p className="text-[12px] text-[#86868b]">
          No playable episodes were returned for this mirror.
        </p>
      )}
      {!streamBusy && streamData === null && (
        <p className="text-[12px] text-[#86868b]">
          No streaming catalog matched this title on the mirror search.
        </p>
      )}
    </div>
  );
}

function DetailPanel({ animeId, animeStreamAudio, onClose, onPlayStream }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [descExpanded, setDescExpanded] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    lifesyncFetch(`/api/anime/details/${animeId}`, { signal: ac.signal })
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [animeId]);

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

  if (busy) {
    return (
      <div className="fixed inset-0 z-[9998] flex items-center justify-center">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md" />
        <div className="relative flex gap-1.5">
          {[0, 150, 300].map((d) => (
            <span
              key={d}
              className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#C6FF00]"
              style={{ animationDelay: `${d}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }
  if (!data) return null;

  const pic = data.main_picture?.large || data.main_picture?.medium;
  const description = data.synopsis ? String(data.synopsis).trim() : "";
  const genres = Array.isArray(data.genres) ? data.genres : [];

  return (
    <div
      className="fixed inset-0 z-[9998] flex h-dvh max-h-dvh w-full max-w-[100vw] min-w-0 items-end justify-center overflow-hidden p-0 sm:items-center sm:p-4"
      onClick={onClose}
      style={{
        paddingLeft: "max(0px, env(safe-area-inset-left))",
        paddingRight: "max(0px, env(safe-area-inset-right))",
        paddingBottom: "max(0px, env(safe-area-inset-bottom))",
      }}
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md" />

      <div
        className="relative flex h-dvh max-h-dvh w-full min-w-0 flex-col overflow-hidden bg-white shadow-2xl animate-[slideUp_0.3s_ease-out] sm:h-auto sm:max-h-[min(88vh,calc(100dvh-2rem))] sm:max-w-4xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero */}
        <div className="relative shrink-0">
          {pic ? (
            <>
              <div className="absolute inset-0 overflow-hidden">
                <img src={pic} alt="" className="h-full w-full object-cover opacity-65" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-white" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-[#1d1d1f] to-white" />
          )}

          <button
            type="button"
            onClick={onClose}
            className="absolute z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur-sm transition-all hover:bg-black/60 hover:text-white"
            style={{
              top: "max(0.75rem, env(safe-area-inset-top))",
              right: "max(0.75rem, env(safe-area-inset-right))",
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

          <div className="relative flex flex-col items-center gap-4 px-4 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] text-center sm:flex-row sm:items-end sm:gap-5 sm:px-6 sm:pt-5 sm:text-left">
            <div className="w-24 shrink-0 sm:w-36">
              {pic ? (
                <img
                  src={pic}
                  alt=""
                  className="aspect-[2/3] w-full rounded-xl object-cover shadow-lg ring-1 ring-black/10"
                />
              ) : (
                <div className="flex aspect-[2/3] w-full items-center justify-center rounded-xl bg-[#f5f5f7]">
                  <svg
                    className="h-10 w-10 text-[#86868b]"
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
            </div>

            <div className="flex w-full min-w-0 flex-1 flex-col justify-end pb-1">
              <h2 className="wrap-anywhere line-clamp-4 text-[17px] font-bold leading-tight text-[#1d1d1f] sm:line-clamp-3 sm:text-[22px]">
                {data.title}
              </h2>

              <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {data.mean != null && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#C6FF00]/20 px-2 py-0.5 text-[10px] font-semibold text-[#1d1d1f]">
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
                  <span className="rounded-full bg-[#f5f5f7] px-2 py-0.5 text-[10px] font-medium capitalize text-[#86868b]">
                    {String(data.status).replace(/_/g, " ")}
                  </span>
                )}
                {data.num_episodes != null && (
                  <span className="rounded-full bg-[#f5f5f7] px-2 py-0.5 text-[10px] font-medium text-[#86868b]">
                    {data.num_episodes} ep
                  </span>
                )}
                {data.media_type && (
                  <span className="rounded-full bg-[#f5f5f7] px-2 py-0.5 text-[10px] font-medium uppercase text-[#86868b]">
                    {data.media_type}
                  </span>
                )}
              </div>

              {genres.length > 0 && (
                <div className="mt-2.5 flex flex-wrap justify-center gap-1 sm:justify-start">
                  {genres.map((g) => (
                    <span
                      key={g.id || g.name}
                      className="rounded-full bg-[#C6FF00]/10 px-2 py-0.5 text-[10px] font-medium text-[#1d1d1f]"
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom,0px)]">
          {(description || data.my_list_status) && (
            <div className="border-b border-[#f0f0f0] px-5 py-3 sm:px-6">
              {description && (
                <>
                  <p
                    className={`text-[12px] leading-relaxed text-[#424245] ${descExpanded ? "" : "line-clamp-3"}`}
                  >
                    {description}
                  </p>
                  {description.length > 200 && (
                    <button
                      type="button"
                      onClick={() => setDescExpanded((v) => !v)}
                      className="mt-1 text-[11px] font-semibold text-[#1d1d1f] hover:underline"
                    >
                      {descExpanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </>
              )}

              {data.my_list_status && (
                <div className={`${description ? "mt-3" : ""} rounded-2xl bg-[#f5f5f7] p-4`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#86868b]">
                    Your List Status
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full border border-[#e5e5ea] bg-white px-2.5 py-0.5 font-semibold capitalize text-[#1d1d1f]">
                      {(data.my_list_status.status || "").replace(/_/g, " ")}
                    </span>
                    {data.my_list_status.score > 0 && (
                      <span className="rounded-full border border-[#e5e5ea] bg-white px-2.5 py-0.5 font-semibold text-[#1d1d1f]">
                        Score: {data.my_list_status.score}/10
                      </span>
                    )}
                    {data.my_list_status.num_episodes_watched != null && (
                      <span className="rounded-full border border-[#e5e5ea] bg-white px-2.5 py-0.5 font-medium text-[#86868b]">
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
              key={animeId}
              animeId={animeId}
              malTitle={data.title}
              pic={pic}
              malDetail={data}
              animeStreamAudio={animeStreamAudio}
              onPlayStream={onPlayStream}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LifeSyncAnime() {
  const {
    isLifeSyncConnected,
    lifeSyncUser,
    refreshLifeSyncMe,
    lifeSyncUpdatePreferences,
  } = useLifeSync();
  /** Server applies MAL `nsfw` from this preference; listed in deps so lists refetch after toggling in Settings. */
  const nsfwContentEnabled = Boolean(
    lifeSyncUser?.preferences?.nsfwContentEnabled,
  );
  const [tab, setTab] = useState("seasonal");
  const [seasonalYear, setSeasonalYear] = useState(
    () => currentMalSeason().year,
  );
  const [seasonalSeason, setSeasonalSeason] = useState(
    () => currentMalSeason().season,
  );
  const [seasonal, setSeasonal] = useState([]);
  const [rankingType, setRankingType] = useState("all");
  const [ranking, setRanking] = useState([]);
  const [myList, setMyList] = useState([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [oauthMsg, setOauthMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [playerState, setPlayerState] = useState(null);
  const [anipubStreamStatus, setAnipubStreamStatus] = useState(null);

  const streamAudioType = getAnimeStreamAudio(lifeSyncUser?.preferences);
  const malLinked = Boolean(
    lifeSyncUser?.integrations?.mal || lifeSyncUser?.integrations?.malUsername,
  );

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
          `/api/anime/stream/watch/${encodeURIComponent(episodeId)}?type=${type}${malQ}${mirrorQ}`,
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

  const mergePlayerMalList = useCallback((data) => {
    if (!data || typeof data !== "object") return;
    setPlayerState((prev) => {
      if (!prev?.series?.malDetail) return prev;
      const cur = prev.series.malDetail;
      return {
        ...prev,
        series: {
          ...prev.series,
          malDetail: {
            ...cur,
            my_list_status: { ...(cur.my_list_status || {}), ...data },
          },
        },
      };
    });
  }, []);

  const handleAudioModeChange = useCallback(
    async (mode) => {
      const m = mode === "dub" ? "dub" : "sub";
      await lifeSyncUpdatePreferences({ animeStreamAudio: m });
      await refreshLifeSyncMe();
      setPlayerState((prev) => {
        if (!prev?.series?.episodes?.[prev.episodeIndex]) return prev;
        const ep = prev.series.episodes[prev.episodeIndex];
        const idx = prev.episodeIndex;
        (async () => {
          const resolved = await resolveAnimeStream(
            ep,
            m,
            prev?.series?.malId,
            prev?.stream?.selectedMirrorId,
          );
          setPlayerState((p) =>
            p && p.episodeIndex === idx
              ? { ...p, stream: { ...resolved, resolving: false } }
              : p,
          );
        })();
        return { ...prev, stream: { ...prev.stream, resolving: true } };
      });
    },
    [lifeSyncUpdatePreferences, refreshLifeSyncMe, resolveAnimeStream],
  );

  const handleMirrorChange = useCallback(
    async (mirrorId) => {
      let ep = null;
      let idx = -1;
      let malId = null;
      setPlayerState((prev) => {
        if (!prev?.series?.episodes?.[prev.episodeIndex]) return prev;
        ep = prev.series.episodes[prev.episodeIndex];
        idx = prev.episodeIndex;
        malId = prev.series.malId;
        return {
          ...prev,
          stream: {
            ...prev.stream,
            resolving: true,
            selectedMirrorId: mirrorId,
          },
        };
      });
      if (!ep || idx < 0) return;
      const resolved = await resolveAnimeStream(ep, undefined, malId, mirrorId);
      setPlayerState((prev) =>
        prev && prev.episodeIndex === idx
          ? { ...prev, stream: { ...resolved, resolving: false } }
          : prev,
      );
    },
    [resolveAnimeStream],
  );

  const playEpisode = useCallback(
    async (series, ep, epIndex) => {
      setDetailId(null);
      const stream = {
        title: ep.title,
        embedUrl: "",
        watchUrl: "",
        videoUrl: null,
        iframeUrl: null,
        textTracks: [],
        resolving: true,
      };
      setPlayerState({ stream, series, episodeIndex: epIndex });
      const resolved = await resolveAnimeStream(
        ep,
        undefined,
        series.malId,
        null,
      );
      setPlayerState((prev) =>
        prev ? { ...prev, stream: { ...resolved, resolving: false } } : null,
      );
    },
    [resolveAnimeStream],
  );

  const changePlayerEpisode = useCallback(
    async (newIndex) => {
      let ep = null;
      let capturedIndex = newIndex;
      let seriesMalId = null;
      setPlayerState((prev) => {
        if (!prev?.series?.episodes?.[newIndex]) return prev;
        ep = prev.series.episodes[newIndex];
        capturedIndex = newIndex;
        seriesMalId = prev.series.malId;
        return {
          ...prev,
          episodeIndex: newIndex,
          stream: {
            title: ep.title,
            embedUrl: "",
            watchUrl: "",
            videoUrl: null,
            iframeUrl: null,
            textTracks: [],
            resolving: true,
          },
        };
      });
      if (!ep) return;
      const resolved = await resolveAnimeStream(
        ep,
        undefined,
        seriesMalId,
        null,
      );
      setPlayerState((prev) => {
        if (!prev || prev.episodeIndex !== capturedIndex) return prev;
        return { ...prev, stream: { ...resolved, resolving: false } };
      });
    },
    [resolveAnimeStream],
  );

  const seasonalYearOptions = useMemo(() => {
    const end = new Date().getFullYear() + 1;
    const out = [];
    for (let y = end; y >= 1995; y -= 1) out.push(y);
    return out;
  }, []);

  const loadSeasonal = useCallback(async () => {
    try {
      const data = await lifesyncFetch(
        `/api/anime/seasonal?year=${seasonalYear}&season=${encodeURIComponent(seasonalSeason)}&limit=24&fields=mean,media_type,num_episodes`,
      );
      setSeasonal(data?.data || []);
    } catch {
      /* ignore */
    }
  }, [seasonalYear, seasonalSeason, nsfwContentEnabled]);

  const loadRanking = useCallback(async () => {
    try {
      const data = await lifesyncFetch(
        `/api/anime/ranking?ranking_type=${encodeURIComponent(rankingType)}&limit=24`,
      );
      setRanking(data?.data || []);
    } catch {
      /* ignore */
    }
  }, [rankingType, nsfwContentEnabled]);

  const loadMyList = useCallback(async () => {
    try {
      const data = await lifesyncFetch("/api/anime/mylist?limit=50");
      setMyList(data?.data || []);
    } catch {
      /* ignore */
    }
  }, [nsfwContentEnabled]);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      await Promise.all([
        loadSeasonal(),
        loadRanking(),
        malLinked ? loadMyList() : Promise.resolve(),
      ]);
    } catch (e) {
      setError(e.message || "Failed to load anime data");
    } finally {
      setBusy(false);
    }
  }, [loadSeasonal, loadRanking, loadMyList, malLinked]);

  useEffect(() => {
    if (isLifeSyncConnected) load();
  }, [isLifeSyncConnected, load]);

  useEffect(() => {
    if (!isLifeSyncConnected) {
      setAnipubStreamStatus(null);
      return;
    }
    let cancelled = false;
    lifesyncFetch("/api/anime/stream/status")
      .then((body) => {
        if (!cancelled) setAnipubStreamStatus(body);
      })
      .catch(() => {
        if (!cancelled) setAnipubStreamStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isLifeSyncConnected]);

  useEffect(() => {
    if (!isLifeSyncConnected || tab !== "ranking") return;
    void loadRanking();
  }, [isLifeSyncConnected, tab, loadRanking]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("maxien_lifesync_oauth");
      if (raw) {
        sessionStorage.removeItem("maxien_lifesync_oauth");
        const { type, text, provider } = JSON.parse(raw);
        if (provider?.startsWith("mal")) {
          setOauthMsg(text);
          if (type === "error") setError(text);
          refreshLifeSyncMe()
            .then(() => load())
            .catch(() => {});
          setTimeout(() => setOauthMsg(""), 8000);
        }
      }
    } catch {
      /* ignore */
    }
  }, [refreshLifeSyncMe, load]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && isLifeSyncConnected) {
        refreshLifeSyncMe()
          .then(() => load())
          .catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isLifeSyncConnected, refreshLifeSyncMe, load]);

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQ.trim()) return;
    setSearching(true);
    try {
      const data = await lifesyncFetch(
        `/api/anime/search?q=${encodeURIComponent(searchQ.trim())}&limit=24`,
      );
      setSearchResults(data?.data || []);
      setTab("search");
    } catch (e) {
      setError(e.message || "Search failed");
    } finally {
      setSearching(false);
    }
  }

  if (!isLifeSyncConnected) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight mb-2">
          Anime
        </h1>
        <div className="bg-white rounded-[20px] border border-[#d2d2d7]/50 shadow-sm px-8 py-16 text-center">
          <p className="text-[15px] font-bold text-[#1d1d1f] mb-2">
            LifeSync Not Connected
          </p>
          <p className="text-[13px] text-[#86868b] mb-4">
            Connect LifeSync in your profile to access anime tracking.
          </p>
          <Link
            to="/dashboard/profile?tab=integrations"
            className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-black transition-colors"
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {playerState && (
        <AnimeStreamPlayerPopup
          malLinked={malLinked}
          playerState={playerState}
          streamAudioType={streamAudioType}
          onAudioModeChange={handleAudioModeChange}
          onMirrorChange={(mid) => void handleMirrorChange(mid)}
          onMalListPatchResult={mergePlayerMalList}
          onClose={() => setPlayerState(null)}
          onChangeEpisode={(idx) => void changePlayerEpisode(idx)}
        />
      )}
      {detailId && (
        <DetailPanel
          key={detailId}
          animeId={detailId}
          animeStreamAudio={streamAudioType}
          onClose={() => setDetailId(null)}
          onPlayStream={playEpisode}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">
            LifeSync / Anime
          </p>
          <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight">
            Anime
          </h1>
          <p className="mt-1.5 max-w-xl text-[11px] leading-relaxed text-[#86868b]">
            Browse and lists use{" "}
            <a
              href="https://myanimelist.net/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#2E51A2] hover:underline"
            >
              MyAnimeList
            </a>
            . Episode links and metadata use the{" "}
            <a
              href={anipubStreamStatus?.docsUrl || ANIPUB_API_REFERENCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#1d1d1f] hover:underline"
            >
              AniPub API
            </a>
            {anipubStreamStatus?.jsonBaseUrl ? (
              <>
                {" "}
                <span className="text-[#b0b0b5]">
                  (JSON from {anipubStreamStatus.jsonBaseUrl})
                </span>
              </>
            ) : null}
            .
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={busy}
            className="text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-2 rounded-xl border border-[#e5e5ea] transition-colors disabled:opacity-50"
          >
            {busy ? "Loading..." : "Refresh"}
          </button>
          {!malLinked && lifesyncOAuthStartUrl("mal") && (
            <a
              href={lifesyncOAuthStartUrl("mal")}
              className="text-[12px] font-semibold bg-[#2E51A2] text-white px-4 py-2 rounded-xl hover:bg-[#24408a] transition-colors"
            >
              Link MAL
            </a>
          )}
          {malLinked && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await lifesyncFetch("/api/anime/link", { method: "DELETE" });
                  await refreshLifeSyncMe();
                  setOauthMsg("MyAnimeList disconnected.");
                  setTimeout(() => setOauthMsg(""), 5000);
                } catch (e) {
                  setError(e.message || "Failed to disconnect MAL");
                }
              }}
              className="text-[11px] font-semibold text-[#86868b] hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 border border-[#e5e5ea] hover:border-red-100 transition-colors"
            >
              Disconnect MAL
            </button>
          )}
        </div>
      </div>

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

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="search"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search anime..."
          className="flex-1 px-4 py-2.5 bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#C6FF00]/60 focus:bg-white rounded-xl text-[13px] text-[#1d1d1f] focus:outline-none transition-all"
        />
        <button
          type="submit"
          disabled={searching}
          className="bg-[#1d1d1f] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-black transition-colors disabled:opacity-50"
        >
          {searching ? "Searching..." : "Search"}
        </button>
      </form>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all ${tab === t.id ? "bg-[#C6FF00] text-[#1d1d1f] shadow-sm" : "bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "seasonal" && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap -mt-2">
          <div className="flex items-center gap-2">
            <label
              htmlFor="seasonal-year"
              className="text-[11px] font-semibold text-[#86868b] whitespace-nowrap"
            >
              Year
            </label>
            <select
              id="seasonal-year"
              value={seasonalYear}
              onChange={(e) => setSeasonalYear(Number(e.target.value))}
              className="text-[12px] font-semibold text-[#1d1d1f] bg-white border border-[#e5e5ea] rounded-lg px-2.5 py-1.5 min-w-[5.5rem] focus:outline-none focus:border-[#C6FF00]/60"
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
              className="text-[11px] font-semibold text-[#2E51A2] hover:underline px-1"
            >
              This season
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {MAL_SEASON_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSeasonalSeason(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all border ${
                  seasonalSeason === opt.id
                    ? "bg-[#1d1d1f] text-white border-[#1d1d1f]"
                    : "bg-white text-[#86868b] border-[#e5e5ea] hover:text-[#1d1d1f] hover:border-[#d2d2d7]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "ranking" && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mt-2">
          {MAL_RANKING_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setRankingType(opt.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all border ${
                rankingType === opt.id
                  ? "bg-[#1d1d1f] text-white border-[#1d1d1f]"
                  : "bg-white text-[#86868b] border-[#e5e5ea] hover:text-[#1d1d1f] hover:border-[#d2d2d7]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {tab === "mylist" && currentItems.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {currentItems.map((item) => (
            <MyListCard
              key={item.node?.id}
              node={item.node}
              listStatus={item.list_status}
              onSelect={setDetailId}
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
              onSelect={setDetailId}
            />
          ))}
        </div>
      ) : (
        !busy && (
          <div className="bg-white rounded-[18px] border border-[#d2d2d7]/50 shadow-sm px-6 py-10 text-center">
            <p className="text-[13px] text-[#86868b]">
              {tab === "mylist"
                ? "Your anime list is empty. Link MAL to sync your list."
                : "No anime to display."}
            </p>
          </div>
        )
      )}
    </div>
  );
}
