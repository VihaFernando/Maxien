import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import useControllerSupportEnabled from "../../hooks/useControllerSupportEnabled";
import useLifeSyncGamepadInput from "../../hooks/useLifeSyncGamepadInput";
import { XBOX_GAMEPAD_BUTTONS } from "../../lib/lifeSyncControllerInput";
import { ControllerHintBar } from "../../components/lifesync/ControllerHintOverlay";
import {
  DetailWatchGridSkeleton,
  LifesyncTextLinesSkeleton,
} from "../../components/lifesync/EpisodeLoadingSkeletons";
import { LifeSyncSectionNav } from "../../components/lifesync/LifeSyncSectionNav";
import { useLifeSync } from "../../context/LifeSyncContext";
import {
  getAnimeStreamAudio,
  getAnimeLibraryLayout,
  getLifesyncApiBase,
  lifesyncFetch,
  lifesyncPatchPreferences,
} from "../../lib/lifesyncApi";
import {
  fetchStreamInfoBySlugWithCache,
  writeLifesyncStreamCatalogBySlug,
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

function animeDetailPreviewFromNode(node) {
  if (!node || !node.slug) return null;
  return {
    id: String(node.slug),
    title: node.title,
    poster: node.poster || node.image,
    num_episodes: node.num_episodes ?? node.numEpisodes,
    type: node.type || node.media_type,
  };
}

function clampPage(n) {
  const v = Number.parseInt(String(n || "1"), 10);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

function isIOSDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

const BROWSE_TYPE_OPTIONS = [
  { id: "", label: "All" }, { id: "1", label: "TV" }, { id: "2", label: "Movie" },
  { id: "3", label: "OVA" }, { id: "4", label: "ONA" }, { id: "5", label: "Special" }, { id: "6", label: "Music" },
];
const BROWSE_STATUS_OPTIONS = [
  { id: "", label: "Any" }, { id: "Ongoing", label: "Ongoing" },
  { id: "Completed", label: "Completed" }, { id: "info", label: "Upcoming" },
];
const BROWSE_LANGUAGE_OPTIONS = [
  { id: "", label: "All" }, { id: "sub", label: "Sub" }, { id: "dub", label: "Dub" },
];
const BROWSE_SORT_OPTIONS = [
  { id: "", label: "Latest" }, { id: "recently_added", label: "Newly Added" },
  { id: "release_date", label: "Release Date" }, { id: "title_az", label: "A–Z" },
];
const BROWSE_GENRE_OPTIONS = [
  "action", "adventure", "comedy", "drama", "ecchi", "fantasy", "horror",
  "isekai", "magic", "mecha", "military", "mystery", "psychological",
  "romance", "sci-fi", "slice-of-life", "sports", "supernatural", "thriller",
];

// ── Icons ──────────────────────────────────────────────────────────────────────
const IconGrid = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);
const IconList = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5h12M9 12h12M9 19h12M4 5h.01M4 12h.01M4 19h.01" />
  </svg>
);
const IconPlay = () => (
  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);
const IconSearch = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <circle cx="11" cy="11" r="7" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
  </svg>
);
const IconChevronLeft = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);
const IconChevronRight = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

// ── Poster card (grid) ─────────────────────────────────────────────────────────
const AnimeCard = memo(function AnimeCard({ node, ranking, onSelect }) {
  const anime = node || {};
  const slug = anime.slug || anime.id;
  const pic = anime.poster || anime.image || anime.main_picture?.large || anime.main_picture?.medium;
  return (
    <button type="button" onClick={() => slug && onSelect?.(anime)} className="group w-full text-left">
      <div className="relative overflow-hidden rounded-2xl border border-(--color-border-soft) bg-(--color-surface) shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5">
        <div className="relative aspect-2/3 w-full overflow-hidden bg-(--color-surface-muted)">
          {slug ? (
            <MotionDiv
              layoutId={animePosterLayoutId(slug)}
              transition={lifeSyncSharedLayoutTransitionProps}
              className="absolute inset-0 overflow-hidden bg-(--color-surface-muted)"
            >
              {pic ? (
                <img src={pic} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" loading="lazy" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-(--color-text-secondary)">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-12.75A1.125 1.125 0 014.5 4.5h15a1.125 1.125 0 011.125 1.125v12.75" />
                  </svg>
                </div>
              )}
            </MotionDiv>
          ) : pic ? (
            <img src={pic} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-(--color-text-secondary)">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-12.75A1.125 1.125 0 014.5 4.5h15a1.125 1.125 0 011.125 1.125v12.75" />
              </svg>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent" />
          {ranking != null && (
            <span className="absolute left-2 top-2 bg-primary text-(--color-ink-strong) text-[10px] font-black px-1.5 py-0.5 rounded-md tabular-nums">
              #{ranking}
            </span>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] p-2.5">
            <p className="text-[12px] font-bold text-white line-clamp-2 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
              {anime.title}
            </p>
            {(anime.type || anime.media_type) && (
              <span className="mt-1 inline-block rounded bg-white/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white/90 backdrop-blur-sm">
                {anime.type || anime.media_type}
              </span>
            )}
          </div>
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/90 text-(--color-ink-strong) shadow-lg backdrop-blur-sm">
              <IconPlay />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
});

// ── Row card (list view) ───────────────────────────────────────────────────────
const AnimeRow = memo(function AnimeRow({ node, ranking, onSelect, isLast }) {
  const anime = node || {};
  const slug = anime.slug || anime.id;
  const pic = anime.poster || anime.image || anime.main_picture?.large;
  return (
    <button
      type="button"
      onClick={() => slug && onSelect?.(anime)}
      className={`group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-(--color-surface-muted) ${!isLast ? "border-b border-(--color-border-soft)" : ""}`}
    >
      {ranking != null && (
        <span className="w-5 shrink-0 text-center text-[11px] font-black tabular-nums text-primary">{ranking}</span>
      )}
      <div className="relative h-[54px] w-[38px] shrink-0 overflow-hidden rounded-lg bg-(--color-surface-muted)">
        {pic ? (
          <img src={pic} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-(--color-text-secondary)">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125V5.625" />
            </svg>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-[13px] font-semibold text-(--color-text-primary)">{anime.title}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          {(anime.type || anime.media_type) && (
            <span className="rounded bg-(--color-surface-muted) px-1.5 py-0.5 text-[9px] font-semibold uppercase text-(--color-text-secondary)">{anime.type || anime.media_type}</span>
          )}
          {anime.status && (
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${anime.status === "Ongoing" ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-(--color-surface-muted) text-(--color-text-secondary)"}`}>{anime.status}</span>
          )}
        </div>
      </div>
      <svg className="h-3.5 w-3.5 shrink-0 text-(--color-text-secondary) opacity-0 transition-opacity group-hover:opacity-100" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z" />
      </svg>
    </button>
  );
});

// ── Hero banner (home featured) ────────────────────────────────────────────────
function HeroBanner({ items, onSelect }) {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef(null);
  const active = items?.[idx] || items?.[0];
  const pic = active?.poster || active?.image || active?.main_picture?.large;

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setIdx((i) => (i + 1) % Math.max(1, items.length)), 6000);
  }, [items?.length]);

  useEffect(() => {
    if (!items?.length) return;
    startTimer();
    return () => clearInterval(timerRef.current);
  }, [startTimer, items?.length]);

  const go = (n) => {
    setIdx((i) => (i + n + items.length) % items.length);
    startTimer();
  };

  if (!items?.length) return null;

  // Build tag chips from metadata
  const heroBadges = (node) => {
    const chips = [];
    const t = node?.type || node?.media_type;
    if (t) chips.push({ label: t, cls: "bg-white/15 text-white" });
    if (node?.status) chips.push({ label: node.status, cls: "bg-white/15 text-white" });
    if (node?.release) chips.push({ label: node.release, cls: "bg-white/15 text-white" });
    if (node?.hasSub) chips.push({ label: "SUB", cls: "bg-white/15 text-white" });
    if (node?.hasDub) chips.push({ label: "DUB", cls: "bg-white/15 text-white" });
    return chips;
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-(--color-surface-muted)" style={{ minHeight: 320, aspectRatio: "21/9" }}>
      {/* Background images */}
      <AnimatePresence mode="sync" initial={false}>
        <MotionDiv
          key={idx}
          className="absolute inset-0 overflow-hidden"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {pic && <img src={pic} alt="" className="h-full w-full object-cover object-top" />}
          <div className="absolute inset-0 bg-linear-to-r from-black/80 via-black/40 to-black/10" />
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent" />
        </MotionDiv>
      </AnimatePresence>

      {/* Content overlay */}
      <div className="relative flex h-full flex-col justify-end p-5 sm:p-8 sm:pb-10">
        <AnimatePresence mode="wait" initial={false}>
          <MotionDiv
            key={`hero-text-${idx}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.38 }}
            className="max-w-lg"
          >
            {/* Featured badge */}
            <span className="mb-2 inline-block rounded-full border border-primary/60 bg-primary/20 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-primary backdrop-blur-sm">
              Featured
            </span>

            {/* Title */}
            <h2 className="line-clamp-2 text-[22px] font-black leading-tight text-white drop-shadow sm:text-[30px]">
              {active?.title}
            </h2>

            {/* Tag chips */}
            {heroBadges(active).length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {heroBadges(active).map((chip, i) => (
                  <span key={i} className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm ${chip.cls}`}>
                    {chip.label}
                  </span>
                ))}
              </div>
            )}

            {/* Synopsis */}
            {active?.synopsis && (
              <p className="mt-2.5 line-clamp-2 text-[12px] leading-relaxed text-white/75 sm:line-clamp-3">
                {active.synopsis}
              </p>
            )}

            {/* Meta row: genres, studio, episodes, quality */}
            <div className="mt-2.5 space-y-1">
              {active?.genres?.length > 0 && (
                <p className="text-[11px] text-white/70">
                  <span className="font-semibold text-primary">Genres:</span>{" "}
                  {active.genres.slice(0, 5).join(", ")}
                </p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                {active?.studio && (
                  <p className="text-[11px] text-white/70">
                    <span className="font-semibold text-primary">Studio:</span> {active.studio}
                  </p>
                )}
                {(active?.episodeCount || active?.num_episodes) && (
                  <p className="text-[11px] text-white/70">
                    <span className="font-semibold text-primary">Episodes:</span>{" "}
                    {active.episodeCount || active.num_episodes}
                  </p>
                )}
                {active?.quality && (
                  <p className="text-[11px] text-white/70">
                    <span className="font-semibold text-primary">Quality:</span> {active.quality}
                  </p>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => onSelect?.(active)}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-[13px] font-bold text-(--color-ink-strong) shadow-lg transition-all hover:brightness-105 active:scale-[0.97]"
              >
                <IconPlay />
                Watch Now
              </button>
              <button
                type="button"
                onClick={() => onSelect?.(active)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-2.5 text-[13px] font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20 active:scale-[0.97]"
              >
                View Details
              </button>
            </div>
          </MotionDiv>
        </AnimatePresence>

        {/* Slide dots */}
        <div className="absolute bottom-4 right-5 flex gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { setIdx(i); startTimer(); }}
              className={`h-2 rounded-full transition-all ${i === idx ? "w-6 bg-primary" : "w-2 bg-white/30 hover:bg-white/50"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Horizontal scroll rail ─────────────────────────────────────────────────────
function HorizRail({ title, items, onSelect, onSeeAll }) {
  const ref = useRef(null);
  const scroll = (dir) => {
    if (!ref.current) return;
    ref.current.scrollBy({ left: dir * 220, behavior: "smooth" });
  };
  if (!items?.length) return null;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-black uppercase tracking-widest text-(--color-text-secondary)">{title}</p>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => scroll(-1)} className="flex h-6 w-6 items-center justify-center rounded-full border border-(--color-border-soft) bg-(--color-surface) text-(--color-text-secondary) transition hover:bg-(--color-surface-muted)">
            <IconChevronLeft />
          </button>
          <button type="button" onClick={() => scroll(1)} className="flex h-6 w-6 items-center justify-center rounded-full border border-(--color-border-soft) bg-(--color-surface) text-(--color-text-secondary) transition hover:bg-(--color-surface-muted)">
            <IconChevronRight />
          </button>
          {onSeeAll && (
            <button type="button" onClick={onSeeAll} className="ml-1 text-[11px] font-semibold text-primary hover:underline">
              See all
            </button>
          )}
        </div>
      </div>
      <div
        ref={ref}
        className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar overscroll-x-contain snap-x snap-mandatory"
      >
        {items.map((node, i) => (
          <div key={node.slug || node.id || i} className="w-[130px] shrink-0 snap-start sm:w-[150px]">
            <AnimeCard node={node} onSelect={onSelect} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Trending strip (ranked horizontal) ────────────────────────────────────────
function TrendingStrip({ items, onSelect }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-(--color-text-secondary)">Trending</p>
      <div className="flex gap-2.5 overflow-x-auto pb-2 hide-scrollbar overscroll-x-contain snap-x snap-mandatory">
        {items.slice(0, 10).map((node, i) => {
          const pic = node?.poster || node?.image;
          return (
            <button
              key={node.slug || i}
              type="button"
              onClick={() => onSelect?.(node)}
              className="group relative shrink-0 snap-start overflow-hidden rounded-2xl bg-(--color-surface-muted) transition-all hover:scale-[1.02] hover:shadow-lg"
              style={{ width: 100, aspectRatio: "2/3" }}
            >
              {pic && <img src={pic} alt="" className="h-full w-full object-cover" loading="lazy" />}
              <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/10 to-transparent" />
              <span className="absolute left-2 top-2 text-[22px] font-black leading-none text-white/20 tabular-nums select-none">{i + 1}</span>
              <div className="absolute inset-x-0 bottom-0 p-2">
                <p className="line-clamp-2 text-[10px] font-bold leading-tight text-white drop-shadow">{node.title}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function SkeletonHero() {
  return <div className="w-full animate-pulse rounded-3xl bg-(--color-surface-muted)" style={{ aspectRatio: "21/9" }} />;
}
function SkeletonRail({ count = 6 }) {
  return (
    <div className="flex gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-[130px] shrink-0 animate-pulse overflow-hidden rounded-2xl bg-(--color-surface-muted) aspect-2/3" />
      ))}
    </div>
  );
}
function SkeletonGrid({ count = 12 }) {
  return (
    <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-2xl bg-(--color-surface-muted) aspect-2/3" />
      ))}
    </div>
  );
}
function SkeletonList({ count = 8 }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-(--color-border-soft) bg-(--color-surface)">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`flex items-center gap-3 px-4 py-3 animate-pulse ${i < count - 1 ? "border-b border-(--color-border-soft)" : ""}`}>
          <div className="h-[54px] w-[38px] shrink-0 rounded-lg bg-(--color-surface-muted)" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 rounded bg-(--color-surface-muted)" />
            <div className="h-2 w-1/3 rounded bg-(--color-surface-muted)" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Episode stream section (inside detail panel) ───────────────────────────────
function normalizeStreamEpisodesForPlayer(list) {
  return (list || [])
    .map((ep, i) => {
      const episodeId = ep.episodeId || ep.id;
      if (!episodeId) return null;
      const num = ep.number ?? ep.episode;
      const thumbUrl = typeof ep.thumbnailUrl === "string" && ep.thumbnailUrl.trim() ? ep.thumbnailUrl : undefined;
      return {
        episodeId: String(episodeId),
        title: ep.title || (num != null ? `Episode ${num}` : `Episode ${i + 1}`),
        number: num,
        hasDub: ep.hasDub,
        hasSub: ep.hasSub,
        thumbnailUrl: thumbUrl,
      };
    })
    .filter(Boolean);
}

function DetailWatchSection({ animeId, animeTitle, pic, animeStreamAudio, onPlayStream }) {
  const [streamData, setStreamData] = useState(null);
  const [streamBusy, setStreamBusy] = useState(true);
  const [resumeLastEp, setResumeLastEp] = useState(null);

  useEffect(() => {
    const ac = new AbortController();
    const { signal } = ac;
    let cancelled = false;
    const isAbort = (err) => err?.name === "AbortError";

    lifesyncFetch(
      `/api/v1/anime/stream/info/by-slug/${encodeURIComponent(animeId)}?view=full${animeTitle ? `&title=${encodeURIComponent(String(animeTitle))}` : ""}`,
      { signal },
    )
      .then((res) => { if (!cancelled) setStreamData(res?.data ?? null); })
      .catch((err) => { if (isAbort(err) || cancelled) return; setStreamData(null); })
      .finally(() => { if (!cancelled) setStreamBusy(false); });

    lifesyncFetch(`/api/v1/anime/watch-progress/${encodeURIComponent(animeId)}`, { signal })
      .then((p) => { if (cancelled) return; setResumeLastEp(p?.lastEpisodeNumber != null ? p.lastEpisodeNumber : null); })
      .catch((err) => { if (isAbort(err) || cancelled) return; setResumeLastEp(null); });

    return () => { cancelled = true; ac.abort(); };
  }, [animeId, animeTitle]);

  const catalogWarmTimerRef = useRef(null);
  const warmStreamCatalog = useCallback(() => {
    if (!animeId || catalogWarmTimerRef.current != null) return;
    catalogWarmTimerRef.current = window.setTimeout(() => {
      catalogWarmTimerRef.current = null;
      void fetchStreamInfoBySlugWithCache(animeId, lifesyncFetch).catch(() => {});
    }, 200);
  }, [animeId]);

  useEffect(() => () => {
    if (catalogWarmTimerRef.current != null) {
      window.clearTimeout(catalogWarmTimerRef.current);
      catalogWarmTimerRef.current = null;
    }
  }, []);

  const streamEps = useMemo(() => normalizeStreamEpisodesForPlayer(streamData?.episodes), [streamData]);

  const dubAvailabilityLabel = useMemo(() => {
    if (!streamEps.length) return "Dub: —";
    let hasSignal = false, anyDub = false;
    for (const ep of streamEps) {
      if (typeof ep?.hasDub !== "boolean") continue;
      hasSignal = true;
      if (ep.hasDub) anyDub = true;
    }
    if (!hasSignal) return "Dub: Unknown";
    return anyDub ? "Dub: Available" : "Dub: Not available";
  }, [streamEps]);

  const resumeIndex = resumeLastEp != null ? streamEps.findIndex((e) => e.number === resumeLastEp) : -1;

  const openSeries = useCallback((ep, i) => {
    onPlayStream?.({ seriesKey: `anineko:${animeId}`, animeId, title: animeTitle, poster: pic || "", episodes: streamEps }, ep, i);
  }, [animeId, animeTitle, onPlayStream, pic, streamEps]);

  const isDarkTheme = typeof document !== "undefined" && document.documentElement?.dataset?.maxienTheme === "dark";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-(--color-text-secondary)">Episodes</p>
        <span className="inline-flex items-center rounded-full border border-(--color-border-soft) bg-(--color-surface) px-2 py-0.5 text-[10px] font-semibold text-(--color-text-secondary)">
          {dubAvailabilityLabel}
        </span>
      </div>
      <AnimatePresence mode="sync" initial={false}>
        {streamBusy ? (
          <MotionDiv key="watch-ep-skeleton" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={lifeSyncEpisodeBlockPresenceTransition}>
            <DetailWatchGridSkeleton count={6} dark={isDarkTheme} />
          </MotionDiv>
        ) : (
          <MotionDiv key={`watch-ep-loaded-${animeId}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={lifeSyncEpisodeBlockPresenceTransition} className="space-y-2">
            {streamData?.matchedStreamTitle && streamData.matchedStreamTitle !== animeTitle && (
              <p className="text-[11px] text-(--color-text-secondary)">
                Matched: <span className="font-medium text-(--color-text-primary)">{streamData.matchedStreamTitle}</span>
              </p>
            )}
            {streamEps.length > 0 && resumeIndex >= 0 && streamEps[resumeIndex] && (
              <MotionDiv variants={lifeSyncStaggerEpisodeGridItem} initial="hidden" animate="show">
                <button
                  type="button"
                  onMouseEnter={warmStreamCatalog}
                  onFocus={warmStreamCatalog}
                  onClick={() => openSeries(streamEps[resumeIndex], resumeIndex)}
                  className="w-full rounded-[14px] border border-primary/30 bg-primary/10 px-4 py-3 text-left shadow-sm transition hover:border-primary/50 hover:bg-primary/15"
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Continue</p>
                  <p className="mt-1 text-[13px] font-semibold text-(--color-text-primary)">
                    Resume Ep {resumeLastEp}{streamEps[resumeIndex]?.title ? ` · ${streamEps[resumeIndex].title}` : ""}
                  </p>
                </button>
              </MotionDiv>
            )}
            {streamEps.length > 0 && (
              <div className="flex flex-col gap-1">
                {streamEps.map((ep, i) => {
                  const isResume = i === resumeIndex && resumeIndex >= 0;
                  return (
                    <button
                      key={ep.episodeId}
                      type="button"
                      onMouseEnter={warmStreamCatalog}
                      onFocus={warmStreamCatalog}
                      onClick={() => openSeries(ep, i)}
                      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                        isResume
                          ? "bg-primary/8 border border-primary/25 hover:bg-primary/12"
                          : "border border-transparent hover:bg-(--color-surface-muted) hover:border-(--color-border-soft)"
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--color-surface-muted) text-[11px] font-bold tabular-nums text-(--color-text-secondary) group-hover:bg-primary group-hover:text-(--color-ink-strong) transition-colors">
                        {ep.number}
                      </span>
                      <span className="min-w-0 flex-1 text-[12.5px] font-medium text-(--color-text-primary) line-clamp-1">
                        {ep.title || `Episode ${ep.number}`}
                      </span>
                      {(ep.hasSub || ep.hasDub) && (
                        <span className="flex shrink-0 gap-1">
                          {ep.hasSub && <span className="rounded bg-(--color-surface-muted) px-1 py-0.5 text-[9px] font-bold text-(--color-text-secondary)">SUB</span>}
                          {ep.hasDub && <span className="rounded bg-(--color-surface-muted) px-1 py-0.5 text-[9px] font-bold text-(--color-text-secondary)">DUB</span>}
                        </span>
                      )}
                      <svg className="h-3.5 w-3.5 shrink-0 text-(--color-text-secondary) opacity-0 group-hover:opacity-100 transition-opacity" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                  );
                })}
              </div>
            )}
            {streamData && streamEps.length === 0 && <p className="text-[12px] text-(--color-text-secondary)">No playable episodes found for this title.</p>}
            {streamData === null && <p className="text-[12px] text-(--color-text-secondary)">Couldn't find this title on the streaming provider.</p>}
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Detail panel ───────────────────────────────────────────────────────────────
function DetailPanel({ animeId, animeStreamAudio, onClose, onPlayStream, preview }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [detailError, setDetailError] = useState("");
  const [descExpanded, setDescExpanded] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    lifesyncFetch(`/api/v1/anime/stream/info/by-slug/${encodeURIComponent(animeId)}?view=full`, { signal: ac.signal })
      .then((res) => { if (!cancelled) setData(res?.data ?? res ?? null); })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        if (!cancelled) { setData(null); setDetailError(err?.message || "We couldn't load this title right now."); }
      })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; ac.abort(); };
  }, [animeId, reloadTick]);

  const triggerReload = useCallback(() => {
    setBusy(true); setDetailError(""); setData(null); setReloadTick((n) => n + 1);
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const pic = data?.poster || data?.image || data?.main_picture?.large || data?.main_picture?.medium;
  const previewPic = preview?.poster || preview?.main_picture?.large;
  const heroPic = pic || previewPic;
  const description = data?.synopsis ? String(data.synopsis).trim() : "";
  const genres = Array.isArray(data?.genres) ? data.genres : [];
  const related = Array.isArray(data?.related) ? data.related : [];
  const isDarkTheme = typeof document !== "undefined" && document.documentElement?.dataset?.maxienTheme === "dark";

  const node = (
    <MotionDiv
      className="fixed inset-0 z-9998 flex h-dvh max-h-dvh w-full max-w-screen min-w-0 items-end justify-center overflow-hidden p-0 sm:items-center sm:p-4"
      onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={lifeSyncDetailOverlayFadeTransition}
    >
      <MotionDiv
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={lifeSyncDetailBackdropFadeTransition}
      />
      <MotionDiv
        layout="size" layoutRoot
        className="lifesync-anime-detail-sheet relative flex h-dvh max-h-dvh w-full min-w-0 flex-col overflow-hidden bg-(--color-surface) shadow-2xl sm:h-auto sm:max-h-[min(88vh,calc(100dvh-2rem))] sm:max-w-4xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        initial={lifeSyncDetailSheetEnterInitial}
        animate={lifeSyncDetailSheetEnterAnimate}
        exit={lifeSyncDetailSheetExitVariant}
        transition={lifeSyncDetailSheetMainTransition}
      >
        {/* Hero */}
        <div className="relative shrink-0">
          {heroPic && (
            <>
              <div className="absolute inset-0 overflow-hidden">
                <img src={heroPic} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="absolute inset-0 lifesync-detail-hero-fade" />
            </>
          )}
          {!heroPic && <div className="absolute inset-0 lifesync-detail-hero-fallback" />}
          <button
            type="button" onClick={onClose}
            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur-sm transition-all hover:bg-black/60"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="relative flex flex-row items-end gap-4 px-5 pb-5 pt-5 sm:gap-5 sm:px-6">
            <MotionDiv
              layoutId={animePosterLayoutId(animeId)}
              transition={lifeSyncSharedLayoutTransitionProps}
              className="w-[88px] shrink-0 overflow-hidden rounded-xl bg-(--color-surface-muted) shadow-xl ring-1 ring-black/15 sm:w-[120px]"
              style={{ aspectRatio: "2/3" }}
            >
              {heroPic ? (
                <img src={heroPic} alt="" className="h-full w-full object-cover" />
              ) : busy ? (
                <div className="flex h-full min-h-28 w-full items-center justify-center gap-1">
                  <span className="lifesync-dot-bounce h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="lifesync-dot-bounce lifesync-dot-bounce-delay-1 h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="lifesync-dot-bounce lifesync-dot-bounce-delay-2 h-1.5 w-1.5 rounded-full bg-primary" />
                </div>
              ) : (
                <div className="flex h-full min-h-28 w-full items-center justify-center text-(--color-text-secondary)">
                  <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25M3.375 19.5a1.125 1.125 0 01-1.125-1.125V5.625" />
                  </svg>
                </div>
              )}
            </MotionDiv>
            <div className="min-w-0 flex-1 pb-1">
              <h2 className="wrap-anywhere line-clamp-3 text-[17px] font-bold leading-tight text-white drop-shadow sm:text-[20px]">
                {data?.title || preview?.title || (busy ? "" : "Couldn't load details")}
                {busy && !preview?.title && <span className="inline-block h-5 w-48 animate-pulse rounded-md bg-white/20" />}
              </h2>
              {data?.altTitle && data.altTitle !== data.title && (
                <p className="mt-0.5 line-clamp-1 text-[11px] text-white/65">{data.altTitle}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(data?.type || preview?.type) && (
                  <span className="rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-white/90 backdrop-blur-sm">{data?.type || preview?.type}</span>
                )}
                {data?.status && (
                  <span className="rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm">{data.status}</span>
                )}
                {data?.release && (
                  <span className="rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm">{data.release}</span>
                )}
                {data?.quality && (
                  <span className="rounded-md bg-primary/80 px-2 py-0.5 text-[10px] font-bold text-(--color-ink-strong) backdrop-blur-sm">{data.quality}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {busy && !data ? (
            <div className="px-5 py-5 sm:px-6">
              <LifesyncTextLinesSkeleton lines={3} dark={isDarkTheme} />
              <div className="mt-5"><DetailWatchGridSkeleton count={6} dark={isDarkTheme} /></div>
            </div>
          ) : !busy && !data ? (
            <div className="px-5 py-8 sm:px-6">
              <div className="rounded-2xl bg-(--color-surface-muted) px-4 py-5 text-center">
                <p className="text-[13px] font-semibold text-(--color-text-primary)">Couldn't load this title</p>
                <p className="mt-1 text-[12px] text-(--color-text-secondary)">{detailError || "Try again in a moment."}</p>
                <button type="button" onClick={triggerReload} className="mt-4 rounded-xl bg-primary px-4 py-2 text-[12px] font-bold text-(--color-ink-strong)">
                  Try again
                </button>
              </div>
            </div>
          ) : data ? (
            <MotionDiv key={String(animeId)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={lifeSyncDetailAnimeContentRevealTransition}>
              {description && (
                <div className="border-b border-(--color-border-soft) px-5 py-4 sm:px-6">
                  <p className={`text-[12.5px] leading-relaxed text-(--color-text-secondary) ${descExpanded ? "" : "line-clamp-3"}`}>{description}</p>
                  {description.length > 200 && (
                    <button type="button" onClick={() => setDescExpanded((v) => !v)} className="mt-1.5 text-[11px] font-semibold text-(--color-text-secondary) hover:text-(--color-text-primary)">
                      {descExpanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>
              )}
              <div className="border-b border-(--color-border-soft) px-5 py-4 sm:px-6">
                <p className="mb-3 text-[9.5px] font-bold uppercase tracking-widest text-(--color-text-secondary)">Anime Info</p>
                <div className="flex flex-col gap-2">
                  {data.japanese && (
                    <div className="flex gap-3">
                      <span className="w-20 shrink-0 text-[11px] text-(--color-text-secondary)">Japanese</span>
                      <span className="text-[11px] font-medium text-(--color-text-primary) wrap-break-word min-w-0">{data.japanese}</span>
                    </div>
                  )}
                  {Array.isArray(data.synonyms) && data.synonyms.length > 0 && (
                    <div className="flex gap-3">
                      <span className="w-20 shrink-0 text-[11px] text-(--color-text-secondary)">Synonyms</span>
                      <span className="text-[11px] text-(--color-text-secondary) wrap-break-word min-w-0">{data.synonyms.join(", ")}</span>
                    </div>
                  )}
                  {data.type && (
                    <div className="flex gap-3">
                      <span className="w-20 shrink-0 text-[11px] text-(--color-text-secondary)">Type</span>
                      <span className="text-[11px] font-semibold text-(--color-text-primary)">{data.type}</span>
                    </div>
                  )}
                  {data.status && (
                    <div className="flex gap-3">
                      <span className="w-20 shrink-0 text-[11px] text-(--color-text-secondary)">Status</span>
                      <span className="text-[11px] font-semibold text-(--color-text-primary)">{data.status}</span>
                    </div>
                  )}
                  {data.release && (
                    <div className="flex gap-3">
                      <span className="w-20 shrink-0 text-[11px] text-(--color-text-secondary)">Release</span>
                      <span className="text-[11px] font-medium text-(--color-text-primary)">{data.release}</span>
                    </div>
                  )}
                  {data.duration && (
                    <div className="flex gap-3">
                      <span className="w-20 shrink-0 text-[11px] text-(--color-text-secondary)">Duration</span>
                      <span className="text-[11px] font-medium text-(--color-text-primary)">{data.duration}</span>
                    </div>
                  )}
                  {data.quality && (
                    <div className="flex gap-3">
                      <span className="w-20 shrink-0 text-[11px] text-(--color-text-secondary)">Quality</span>
                      <span className="text-[11px] font-semibold text-(--color-text-primary)">{data.quality}</span>
                    </div>
                  )}
                  {(data.subCount != null || data.dubCount != null) && (
                    <div className="flex gap-3">
                      <span className="w-20 shrink-0 text-[11px] text-(--color-text-secondary)">Episodes</span>
                      <span className="text-[11px] font-semibold text-(--color-text-primary)">
                        {[data.subCount != null && `SUB ${data.subCount}`, data.dubCount != null && `DUB ${data.dubCount}`].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  )}
                  {data.studios && data.studios !== "?" && (
                    <div className="flex gap-3">
                      <span className="w-20 shrink-0 text-[11px] text-(--color-text-secondary)">Studios</span>
                      <span className="text-[11px] font-medium text-(--color-text-primary)">{data.studios}</span>
                    </div>
                  )}
                </div>
                {genres.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {genres.map((g, i) => (
                      <span key={g?.name || g || i} className="rounded-full border border-(--color-border-soft) bg-(--color-surface-muted) px-2.5 py-0.5 text-[10.5px] font-medium text-(--color-text-secondary)">
                        {g?.name || g}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-5 py-4 sm:px-6">
                <DetailWatchSection
                  key={`${animeId}-${animeStreamAudio}`}
                  animeId={animeId}
                  animeTitle={data.title || data.name || ""}
                  pic={pic}
                  animeStreamAudio={animeStreamAudio}
                  onPlayStream={onPlayStream}
                />
              </div>
              {related.length > 0 && (
                <div className="border-t border-(--color-border-soft) px-5 pb-6 pt-4 sm:px-6">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-(--color-text-secondary)">Related</p>
                  <div className="flex flex-col gap-1.5">
                    {related.slice(0, 8).map((r, i) => (
                      <div key={r.slug || r.title || i} className="flex items-center gap-3 rounded-xl bg-(--color-surface-muted) border border-(--color-border-soft) px-3 py-2.5">
                        {r.poster && <img src={r.poster} alt="" className="h-10 w-7 shrink-0 rounded-md object-cover" loading="lazy" />}
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-[12px] font-semibold text-(--color-text-primary)">{r.title}</p>
                          {r.relation && <p className="text-[10px] capitalize text-(--color-text-secondary)">{r.relation}</p>}
                        </div>
                        {r.slug && (
                          <button
                            type="button"
                            onClick={() => onPlayStream?.({ animeId: r.slug, title: r.title, episodes: [] }, { episodeId: null }, 0)}
                            className="shrink-0 rounded-lg bg-(--color-surface-muted) px-2.5 py-1.5 text-[10px] font-semibold text-(--color-text-primary) transition hover:bg-(--color-border-soft)"
                          >
                            View
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </MotionDiv>
          ) : null}
        </div>
      </MotionDiv>
    </MotionDiv>
  );

  return createPortal(node, document.body);
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function LifeSyncAnime() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLifeSyncConnected, lifeSyncUser, refreshLifeSyncMe } = useLifeSync();
  const nsfwContentEnabled = Boolean(lifeSyncUser?.preferences?.nsfwContentEnabled);

  const basePath = "/dashboard/lifesync/anime/anime";
  const route = useMemo(() => {
    const rel = location.pathname.startsWith(basePath) ? location.pathname.slice(basePath.length) : "";
    const parts = rel.split("/").filter(Boolean);
    const tabId = parts[0] || "home";
    const allowedTabs = new Set(["home", "ongoing", "latest", "browse", "search"]);
    const tab = allowedTabs.has(tabId) ? tabId : "home";
    let page = 1;
    const pageIdx = parts.indexOf("page");
    if (pageIdx >= 0 && parts[pageIdx + 1]) page = clampPage(parts[pageIdx + 1]);
    const detailIdx = parts.indexOf("detail");
    const detailAnimeId = detailIdx >= 0 ? parts[detailIdx + 1] || null : null;
    const watchIdx = parts.indexOf("watch");
    const watchAnimeId = watchIdx >= 0 ? parts[watchIdx + 1] || null : null;
    const watchEpisodeIndexRaw = watchIdx >= 0 ? parts[watchIdx + 2] || null : null;
    const watchEpisodeIndex = watchEpisodeIndexRaw != null ? clampPage(watchEpisodeIndexRaw) - 1 : null;
    return { tab, page, detailAnimeId, watchAnimeId, watchEpisodeIndex, parts };
  }, [location.pathname]);

  const [tab, setTab] = useState("home");
  const [homeData, setHomeData] = useState(null);
  const [homeBusy, setHomeBusy] = useState(false);
  const [ongoingItems, setOngoingItems] = useState([]);
  const [ongoingPage, setOngoingPage] = useState(1);
  const [ongoingHasNext, setOngoingHasNext] = useState(false);
  const [latestItems, setLatestItems] = useState([]);
  const [latestPage, setLatestPage] = useState(1);
  const [latestHasNext, setLatestHasNext] = useState(false);
  const [browseItems, setBrowseItems] = useState([]);
  const [browsePage, setBrowsePage] = useState(1);
  const [browseHasNext, setBrowseHasNext] = useState(false);
  const [browseType, setBrowseType] = useState("");
  const [browseStatus, setBrowseStatus] = useState("");
  const [browseLanguage, setBrowseLanguage] = useState("");
  const [browseSort, setBrowseSort] = useState("");
  const [browseGenres, setBrowseGenres] = useState([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchCommittedQ, setSearchCommittedQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchPage, setSearchPage] = useState(1);
  const [searchHasNext, setSearchHasNext] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [focusedCardIndex, setFocusedCardIndex] = useState(-1);
  const searchInputRef = useRef(null);
  const controllerSupportEnabled = useControllerSupportEnabled();

  // Layout — seeded from server pref, persisted on toggle
  const [layout, setLayoutState] = useState(() => getAnimeLibraryLayout(null));
  const layoutSaveTimer = useRef(null);

  useEffect(() => {
    setLayoutState(getAnimeLibraryLayout(lifeSyncUser?.preferences));
  }, [lifeSyncUser?.preferences?.animeLibraryLayout]);

  const setLayout = useCallback((next) => {
    setLayoutState(next);
    if (layoutSaveTimer.current) clearTimeout(layoutSaveTimer.current);
    layoutSaveTimer.current = setTimeout(() => {
      lifesyncPatchPreferences({ animeLibraryLayout: next }).catch(() => {});
    }, 600);
  }, []);

  useEffect(() => () => { if (layoutSaveTimer.current) clearTimeout(layoutSaveTimer.current); }, []);

  const streamAudioType = getAnimeStreamAudio(lifeSyncUser?.preferences);
  const listFetchMountedRef = useRef(true);
  useEffect(() => {
    listFetchMountedRef.current = true;
    return () => { listFetchMountedRef.current = false; };
  }, []);

  const listPath = useMemo(
    () => `${basePath}/${route.tab}/page/${route.page}${location.search || ""}`,
    [basePath, location.search, route.page, route.tab],
  );

  const goToList = useCallback((opts = {}) => navigate(listPath, { replace: Boolean(opts.replace), state: null }), [navigate, listPath]);
  const goToTab = useCallback((t) => navigate(`${basePath}/${t}/page/1${location.search || ""}`), [basePath, location.search, navigate]);
  const goToPage = useCallback((p) => navigate(`${basePath}/${route.tab}/page/${clampPage(p)}${location.search || ""}`), [basePath, location.search, navigate, route.tab]);

  const goToDetail = useCallback((animeOrId) => {
    const id = animeOrId && typeof animeOrId === "object" ? (animeOrId.slug || animeOrId.id) : animeOrId;
    if (!id) return;
    const preview = animeDetailPreviewFromNode(animeOrId && typeof animeOrId === "object" ? animeOrId : null);
    navigate(
      `${listPath.replace(location.search || "", "")}/detail/${encodeURIComponent(String(id))}${location.search || ""}`,
      preview ? { state: { animeDetailPreview: preview } } : {},
    );
  }, [navigate, listPath, location.search]);

  useEffect(() => {
    if (tab !== route.tab) setTab(route.tab);
    if (route.tab === "ongoing" && ongoingPage !== route.page) setOngoingPage(route.page);
    if (route.tab === "latest" && latestPage !== route.page) setLatestPage(route.page);
    if (route.tab === "browse" && browsePage !== route.page) setBrowsePage(route.page);
    if (route.tab === "search" && searchPage !== route.page) setSearchPage(route.page);
  }, [route.page, route.tab, ongoingPage, latestPage, browsePage, searchPage, tab]);

  useEffect(() => {
    if (location.pathname === basePath || location.pathname === `${basePath}/`) {
      navigate(`${basePath}/home/page/1${location.search || ""}`, { replace: true });
    }
  }, [basePath, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (route.tab !== "search") return;
    const q = new URLSearchParams(location.search || "").get("q") || "";
    const next = q.trim();
    if (next && next !== searchCommittedQ) { setSearchCommittedQ(next); setSearchQ(next); }
  }, [location.search, route.tab, searchCommittedQ]);

  useEffect(() => {
    if (route.detailAnimeId) { if (detailId !== route.detailAnimeId) setDetailId(route.detailAnimeId); }
    else if (detailId) setDetailId(null);
  }, [detailId, route.detailAnimeId]);

  const detailPreview = useMemo(() => {
    const raw = location.state?.animeDetailPreview;
    if (!raw || route.detailAnimeId == null) return null;
    if (String(raw.id) !== String(route.detailAnimeId)) return null;
    return raw;
  }, [location.state?.animeDetailPreview, route.detailAnimeId]);

  const resolveAnimeStream = useCallback(async (ep, audioOverride, animeId, mirrorId) => {
    const episodeId = ep?.episodeId;
    const base = { title: ep?.title || "Episode", embedUrl: "", watchUrl: "", videoUrl: null, iframeUrl: null, textTracks: [], mirrors: [], selectedMirrorId: null, selectedMirrorLabel: null, resolving: false };
    if (!episodeId) return base;
    try {
      const audio = audioOverride === "dub" || audioOverride === "sub" ? audioOverride : streamAudioType === "dub" ? "dub" : "sub";
      const type = audio === "dub" ? "dub" : "sub";
      const mirrorQ = mirrorId != null && String(mirrorId).trim() ? `&server=${encodeURIComponent(String(mirrorId).trim())}` : "";
      const pack = await lifesyncFetch(`/api/v1/anime/stream/watch/${encodeURIComponent(episodeId)}?type=${type}${mirrorQ}&view=full`);
      const apiBase = getLifesyncApiBase();
      const iframeFromPack = typeof pack.iframeUrl === "string" && /^https?:\/\//i.test(pack.iframeUrl) ? pack.iframeUrl : null;
      if (iframeFromPack) return { ...base, title: ep.title || base.title, iframeUrl: iframeFromPack, textTracks: [], mirrors: pack?.streamMeta?.mirrors || [], selectedMirrorId: pack?.streamMeta?.selectedMirrorId ?? null, selectedMirrorLabel: pack?.streamMeta?.selectedMirrorLabel ?? null, provider: pack?.streamMeta?.provider ?? null };
      const sources = Array.isArray(pack.sources) ? pack.sources : [];
      const preferIframe = isIOSDevice();
      const iframeSrc = sources.find((s) => s && String(s.kind || "").toLowerCase() === "iframe" && s.url);
      if (iframeSrc?.url) {
        const u = String(iframeSrc.url).startsWith("http") ? iframeSrc.url : `${apiBase}${iframeSrc.url}`;
        return { ...base, title: ep.title || base.title, iframeUrl: u, textTracks: [], mirrors: pack?.streamMeta?.mirrors || [], selectedMirrorId: pack?.streamMeta?.selectedMirrorId ?? null, selectedMirrorLabel: pack?.streamMeta?.selectedMirrorLabel ?? null, provider: pack?.streamMeta?.provider ?? null };
      }
      const first = preferIframe
        ? sources.find((s) => s.kind === "iframe") || sources.find((s) => s.kind === "hls") || sources.find((s) => s.kind === "mp4") || sources[0]
        : sources.find((s) => s.kind === "hls") || sources.find((s) => s.kind === "mp4") || sources[0];
      if (!first?.url) return base;
      const url = String(first.url).startsWith("http") ? first.url : `${apiBase}${first.url}`;
      const rawSubs = Array.isArray(pack.subtitles) ? pack.subtitles : [];
      const textTracks = rawSubs.map((s, i) => ({ src: String(s.url || "").startsWith("http") ? s.url : `${apiBase}${s.url}`, label: s.label || `Subtitles ${i + 1}`, srclang: s.lang || "und", default: i === 0 }));
      return { ...base, title: ep.title || base.title, videoUrl: url, textTracks, mirrors: pack?.streamMeta?.mirrors || [], selectedMirrorId: pack?.streamMeta?.selectedMirrorId ?? null, selectedMirrorLabel: pack?.streamMeta?.selectedMirrorLabel ?? null, provider: pack?.streamMeta?.provider ?? null };
    } catch { return { ...base, title: ep.title || base.title }; }
  }, [streamAudioType]);

  const playEpisode = useCallback(async (series, ep, epIndex) => {
    if (!series?.animeId || !ep?.episodeId) return;
    const resolved = await resolveAnimeStream(ep, undefined, series.animeId, null);
    if (!listFetchMountedRef.current) return;
    const handoffId = stashAnimeWatchHandoff({ animeId: String(series.animeId), episodeIndex: epIndex, anime: series.animeDetail || null, episodes: Array.isArray(series.episodes) ? series.episodes : [], stream: { ...resolved, resolving: false } });
    void fetchStreamInfoBySlugWithCache(String(series.animeId), lifesyncFetch, undefined, { title: String(series?.title || "") })
      .then((body) => { if (body?.data != null) writeLifesyncStreamCatalogBySlug(series.animeId, body); })
      .catch(() => {});
    const ep1 = clampPage(epIndex + 1);
    const fromPath = `${listPath.replace(location.search || "", "")}${location.search || ""}`;
    const target = `/dashboard/lifesync/anime/anime/watch/${encodeURIComponent(String(series.animeId))}/${ep1}`;
    const nextState = { from: fromPath, handoffId, title: String(series?.title || "") };
    const go = () => navigate(target, { state: nextState });
    if (typeof document !== "undefined" && document.startViewTransition) {
      document.startViewTransition(() => { go(); });
    } else { go(); }
  }, [listPath, location.search, navigate, resolveAnimeStream]);

  useEffect(() => {
    const animeId = route.watchAnimeId;
    if (!animeId) return;
    const rel = location.pathname.startsWith(basePath) ? location.pathname.slice(basePath.length) : "";
    const parts = rel.split("/").filter(Boolean);
    const watchIdx = parts.indexOf("watch");
    if (watchIdx < 0) return;
    const withoutWatch = parts.slice(0, watchIdx);
    const fromPath = `${basePath}/${withoutWatch.join("/")}${location.search || ""}`;
    const ep1 = route.watchEpisodeIndex != null && route.watchEpisodeIndex >= 0 ? clampPage(route.watchEpisodeIndex + 1) : 1;
    navigate(`/dashboard/lifesync/anime/anime/watch/${encodeURIComponent(animeId)}/${ep1}`, { replace: true, state: { from: fromPath } });
  }, [basePath, location.pathname, location.search, navigate, route.watchAnimeId, route.watchEpisodeIndex]);

  const PAGE_SIZE = 24;

  const loadHome = useCallback(async () => {
    if (!listFetchMountedRef.current) return;
    setHomeBusy(true);
    try {
      const data = await lifesyncFetch("/api/v1/anime/home");
      if (!listFetchMountedRef.current) return;
      setHomeData(data || null);
    } catch { if (listFetchMountedRef.current) setHomeData(null); }
    finally { if (listFetchMountedRef.current) setHomeBusy(false); }
  }, []);

  const loadOngoing = useCallback(async () => {
    try {
      const data = await lifesyncFetch(`/api/v1/anime/ongoing?limit=${PAGE_SIZE}&page=${Math.max(1, ongoingPage)}`);
      if (!listFetchMountedRef.current) return;
      setOngoingItems(data?.data || []); setOngoingHasNext(Boolean(data?.paging?.next));
    } catch { /* ignore */ }
  }, [ongoingPage, nsfwContentEnabled]);

  const loadLatest = useCallback(async () => {
    try {
      const data = await lifesyncFetch(`/api/v1/anime/latest?limit=${PAGE_SIZE}&page=${Math.max(1, latestPage)}`);
      if (!listFetchMountedRef.current) return;
      setLatestItems(data?.data || []); setLatestHasNext(Boolean(data?.paging?.next));
    } catch { /* ignore */ }
  }, [latestPage, nsfwContentEnabled]);

  const loadBrowse = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(Math.max(1, browsePage)) });
      if (browseType) qs.set("type", browseType);
      if (browseStatus) qs.set("status", browseStatus);
      if (browseLanguage) qs.set("language", browseLanguage);
      if (browseSort) qs.set("sort", browseSort);
      if (browseGenres.length > 0) qs.set("genre", browseGenres.join(","));
      const data = await lifesyncFetch(`/api/v1/anime/browse?${qs}`);
      if (!listFetchMountedRef.current) return;
      setBrowseItems(data?.data || []); setBrowseHasNext(Boolean(data?.paging?.next));
    } catch { /* ignore */ }
  }, [browsePage, browseType, browseStatus, browseLanguage, browseSort, browseGenres, nsfwContentEnabled]);

  const load = useCallback(async () => {
    if (listFetchMountedRef.current) { setBusy(true); setError(""); }
    try { await Promise.all([loadHome(), loadOngoing(), loadLatest()]); }
    catch (e) { if (listFetchMountedRef.current) setError(e.message || "Failed to load anime data"); }
    finally { if (listFetchMountedRef.current) setBusy(false); }
  }, [loadHome, loadOngoing, loadLatest]);

  useEffect(() => { if (isLifeSyncConnected) load(); }, [isLifeSyncConnected, load]);
  useEffect(() => { if (!isLifeSyncConnected || tab !== "ongoing") return; void loadOngoing(); }, [isLifeSyncConnected, tab, loadOngoing]);
  useEffect(() => { if (!isLifeSyncConnected || tab !== "latest") return; void loadLatest(); }, [isLifeSyncConnected, tab, loadLatest]);
  useEffect(() => { if (!isLifeSyncConnected || tab !== "browse") return; void loadBrowse(); }, [isLifeSyncConnected, tab, loadBrowse]);
  useEffect(() => { setOngoingPage(1); }, []);
  useEffect(() => { setLatestPage(1); }, []);
  useEffect(() => { setBrowsePage(1); }, [browseType, browseStatus, browseLanguage, browseSort, browseGenres]);
  useEffect(() => {
    let cancelled = false;
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !isLifeSyncConnected) return;
      refreshLifeSyncMe().then(() => { if (!cancelled) void load(); }).catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVisible); };
  }, [isLifeSyncConnected, refreshLifeSyncMe, load]);

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQ.trim()) return;
    setSearching(true);
    try {
      const q = searchQ.trim();
      setSearchCommittedQ(q); setSearchPage(1);
      const qs = new URLSearchParams(location.search || "");
      qs.set("q", q);
      navigate(`${basePath}/search/page/1?${qs.toString()}`);
    } catch (e) { setError(e.message || "Search failed"); }
    finally { setSearching(false); }
  }

  useEffect(() => {
    if (!isLifeSyncConnected || tab !== "search" || !searchCommittedQ.trim()) return;
    const offset = (Math.max(1, searchPage) - 1) * PAGE_SIZE;
    let cancelled = false;
    setSearching(true);
    lifesyncFetch(`/api/v1/anime/search?q=${encodeURIComponent(searchCommittedQ.trim())}&limit=${PAGE_SIZE}&offset=${offset}`)
      .then((data) => { if (cancelled) return; setSearchResults(data?.data || []); setSearchHasNext(Boolean(data?.paging?.next)); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; };
  }, [isLifeSyncConnected, tab, searchCommittedQ, searchPage]);

  const tabs = [
    { id: "home", label: "Home" },
    { id: "ongoing", label: "Ongoing" },
    { id: "latest", label: "Latest" },
    { id: "browse", label: "Browse" },
    ...(searchResults.length > 0 ? [{ id: "search", label: "Search Results" }] : []),
  ];

  const paginatedItems =
    tab === "ongoing" ? ongoingItems
    : tab === "latest" ? latestItems
    : tab === "browse" ? browseItems
    : tab === "search" ? searchResults
    : [];

  const pager = (() => {
    if (tab === "ongoing") return { page: ongoingPage, onPage: setOngoingPage, canPrev: ongoingPage > 1, canNext: ongoingHasNext };
    if (tab === "latest") return { page: latestPage, onPage: setLatestPage, canPrev: latestPage > 1, canNext: latestHasNext };
    if (tab === "browse") return { page: browsePage, onPage: setBrowsePage, canPrev: browsePage > 1, canNext: browseHasNext };
    if (tab === "search") return { page: searchPage, onPage: setSearchPage, canPrev: searchPage > 1, canNext: searchHasNext };
    return null;
  })();

  const animeGamepadHandlers = useMemo(() => ({
    [XBOX_GAMEPAD_BUTTONS.LB]: () => {
      if (pager?.canPrev) goToPage(pager.page - 1);
      setFocusedCardIndex(0);
    },
    [XBOX_GAMEPAD_BUTTONS.RB]: () => {
      if (pager?.canNext) goToPage(pager.page + 1);
      setFocusedCardIndex(0);
    },
    [XBOX_GAMEPAD_BUTTONS.X]: () => {
      if (tab === "search" || tab === "browse") {
        if (searchInputRef.current) searchInputRef.current.focus();
      } else {
        goToTab("search");
        setTimeout(() => searchInputRef.current?.focus(), 120);
      }
    },
    [XBOX_GAMEPAD_BUTTONS.Y]: () => {
      setLayout(layout === "grid" ? "list" : "grid");
    },
    [XBOX_GAMEPAD_BUTTONS.DPAD_LEFT]: () => {
      setFocusedCardIndex(prev => Math.max(0, prev <= 0 ? paginatedItems.length - 1 : prev - 1));
    },
    [XBOX_GAMEPAD_BUTTONS.DPAD_RIGHT]: () => {
      setFocusedCardIndex(prev => (prev + 1) % Math.max(1, paginatedItems.length));
    },
    [XBOX_GAMEPAD_BUTTONS.DPAD_UP]: () => {
      setFocusedCardIndex(prev => Math.max(0, prev - 6));
    },
    [XBOX_GAMEPAD_BUTTONS.DPAD_DOWN]: () => {
      setFocusedCardIndex(prev => Math.min(paginatedItems.length - 1, prev + 6));
    },
    [XBOX_GAMEPAD_BUTTONS.A]: () => {
      const item = paginatedItems[focusedCardIndex];
      if (item?.node) goToDetail(item.node);
    },
  }), [focusedCardIndex, goToDetail, goToPage, goToTab, layout, pager, paginatedItems, setLayout, tab]);

  useLifeSyncGamepadInput({
    enabled: controllerSupportEnabled && !detailId && tab !== "home",
    handlers: animeGamepadHandlers,
    repeatableButtons: [
      XBOX_GAMEPAD_BUTTONS.DPAD_LEFT,
      XBOX_GAMEPAD_BUTTONS.DPAD_RIGHT,
      XBOX_GAMEPAD_BUTTONS.DPAD_UP,
      XBOX_GAMEPAD_BUTTONS.DPAD_DOWN,
    ],
  });

  if (!isLifeSyncConnected) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-1 text-[28px] font-bold tracking-tight text-(--color-text-primary)">Anime</h1>
        <p className="mb-4 max-w-xl text-[13px] leading-relaxed text-(--color-text-secondary)">Browse featured anime, ongoing series, and latest updates—connect LifeSync to get started.</p>
        <div className="rounded-[22px] border border-(--color-border-strong) bg-(--color-surface) px-8 py-16 text-center shadow-sm">
          <p className="mb-2 text-[15px] font-bold text-(--color-text-primary)">LifeSync Not Connected</p>
          <p className="mb-4 text-[13px] text-(--color-text-secondary)">Connect LifeSync in your profile to access anime tracking.</p>
          <Link to="/dashboard/profile?tab=integrations" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-(--color-ink-strong) shadow-sm transition-all hover:brightness-95">
            Go to Integrations
          </Link>
        </div>
      </div>
    );
  }

  return (
    <MotionDiv
      className="space-y-5 sm:space-y-7"
      style={{ transformOrigin: "50% 0%" }}
      initial="initial" animate="animate"
      variants={lifeSyncDollyPageVariants}
      transition={lifeSyncDollyPageTransition}
    >
      <AnimatePresence mode="sync">
        {detailId && (
          <DetailPanel
            key={detailId}
            animeId={detailId}
            preview={detailPreview}
            animeStreamAudio={streamAudioType}
            onClose={() => goToList({ replace: true })}
            onPlayStream={playEpisode}
          />
        )}
      </AnimatePresence>

      <MotionDiv
        className="flex flex-col gap-5 sm:gap-6"
        style={{ pointerEvents: detailId ? "none" : undefined }}
        variants={lifeSyncStaggerContainer}
        initial="hidden" animate="show"
      >
        {/* Header */}
        <MotionDiv variants={lifeSyncStaggerItem} className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold text-(--color-text-secondary) uppercase tracking-widest">LifeSync / Anime</p>
            <h1 className="text-[24px] sm:text-[28px] font-black text-(--color-text-primary) tracking-tight leading-none mt-0.5">Anime</h1>
          </div>
          {/* Layout toggle — only shown outside home tab */}
          <div className="flex items-center gap-2">
            {tab !== "home" && (
              <div className="flex items-center rounded-xl border border-(--color-border-soft) bg-(--color-surface) p-0.5">
                <button
                  type="button"
                  onClick={() => setLayout("grid")}
                  title="Grid view"
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${layout === "grid" ? "bg-primary text-(--color-ink-strong) shadow-sm" : "text-(--color-text-secondary) hover:text-(--color-text-primary)"}`}
                >
                  <IconGrid />
                </button>
                <button
                  type="button"
                  onClick={() => setLayout("list")}
                  title="List view"
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${layout === "list" ? "bg-primary text-(--color-ink-strong) shadow-sm" : "text-(--color-text-secondary) hover:text-(--color-text-primary)"}`}
                >
                  <IconList />
                </button>
              </div>
            )}
            <ControllerHintBar
              cols={2}
              hints={tab === "home" ? [
                { btns: ['X'], label: 'Go to search' },
              ] : [
                { btns: ['LB'], label: 'Prev page' },
                { btns: ['RB'], label: 'Next page' },
                { btns: ['X'], label: 'Search' },
                { btns: ['Y'], label: 'Grid / List' },
                { btns: ['←→'], label: 'Navigate cards' },
                { btns: ['A'], label: 'Open' },
              ]}
            />
          </div>
        </MotionDiv>

        {error && (
          <div className="bg-red-50 text-red-600 text-[12px] font-medium px-4 py-3 rounded-xl border border-red-100">{error}</div>
        )}

        {/* Search */}
        <MotionDiv variants={lifeSyncStaggerItem}>
          <form onSubmit={handleSearch} className="flex flex-col gap-2 items-stretch sm:flex-row sm:flex-wrap">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-secondary)">
                <IconSearch />
              </span>
              <input
                ref={searchInputRef}
                type="search"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search anime…"
                className="w-full rounded-xl border border-(--color-border-soft) bg-(--color-surface-muted) pl-9 pr-4 py-2.5 text-[13px] text-(--color-text-primary) transition-all focus:border-primary/60 focus:bg-(--color-surface) focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="w-full shrink-0 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-bold text-(--color-ink-strong) shadow-sm transition-all hover:brightness-105 disabled:opacity-50 sm:w-auto"
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </form>
        </MotionDiv>

        {/* Tabs */}
        <MotionDiv variants={lifeSyncStaggerItem}>
          <LifeSyncSectionNav
            ariaLabel="Anime lists"
            layoutId="lifesync-anime-main-tab"
            items={tabs.map((t) => ({ id: t.id, label: t.label }))}
            activeId={tab}
            onSelect={(id) => goToTab(id)}
          />
        </MotionDiv>

        {/* Browse filters */}
        {tab === "browse" && (
          <div className="flex flex-col gap-2.5 -mt-2">
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 hide-scrollbar overscroll-x-contain">
              {BROWSE_TYPE_OPTIONS.map((opt) => (
                <button key={opt.id} type="button" onClick={() => setBrowseType(opt.id)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all border ${browseType === opt.id ? "bg-(--color-text-primary) text-(--color-surface) border-(--color-text-primary)" : "bg-(--color-surface) text-(--color-text-secondary) border-(--color-border-soft) hover:text-(--color-text-primary) hover:border-(--color-border-strong)"}`}>
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 hide-scrollbar overscroll-x-contain">
                {BROWSE_STATUS_OPTIONS.map((opt) => (
                  <button key={opt.id} type="button" onClick={() => setBrowseStatus(opt.id)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all border ${browseStatus === opt.id ? "bg-primary text-(--color-ink-strong) border-primary" : "bg-(--color-surface) text-(--color-text-secondary) border-(--color-border-soft) hover:text-(--color-text-primary)"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 hide-scrollbar overscroll-x-contain">
                {BROWSE_LANGUAGE_OPTIONS.map((opt) => (
                  <button key={opt.id} type="button" onClick={() => setBrowseLanguage(opt.id)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all border ${browseLanguage === opt.id ? "bg-(--color-text-primary) text-(--color-surface) border-(--color-text-primary)" : "bg-(--color-surface) text-(--color-text-secondary) border-(--color-border-soft) hover:text-(--color-text-primary)"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 hide-scrollbar overscroll-x-contain">
                {BROWSE_SORT_OPTIONS.map((opt) => (
                  <button key={opt.id} type="button" onClick={() => setBrowseSort(opt.id)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all border ${browseSort === opt.id ? "bg-(--color-text-secondary) text-(--color-surface) border-(--color-text-secondary)" : "bg-(--color-surface) text-(--color-text-secondary) border-(--color-border-soft) hover:text-(--color-text-primary)"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 hide-scrollbar overscroll-x-contain">
              {BROWSE_GENRE_OPTIONS.map((g) => {
                const active = browseGenres.includes(g);
                return (
                  <button key={g} type="button" onClick={() => setBrowseGenres((prev) => active ? prev.filter((x) => x !== g) : [...prev, g])}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap capitalize transition-all border ${active ? "bg-primary text-(--color-ink-strong) border-primary" : "bg-(--color-surface) text-(--color-text-secondary) border-(--color-border-soft) hover:text-(--color-text-primary)"}`}>
                    {g.replace(/-/g, " ")}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab content */}
        <MotionDiv variants={lifeSyncStaggerItem}>
          <AnimatePresence mode="wait">
            <MotionDiv
              key={tab}
              className="space-y-6"
              initial="initial" animate="animate" exit="exit"
              variants={lifeSyncSectionPresenceVariants}
              transition={lifeSyncSectionPresenceTransition}
            >
              {/* ── HOME TAB ────────────────────────────────────────── */}
              {tab === "home" && (
                <div className="space-y-8">
                  {homeBusy && !homeData ? (
                    <div className="space-y-8">
                      <SkeletonHero />
                      <SkeletonRail count={6} />
                      <SkeletonRail count={6} />
                    </div>
                  ) : (
                    <>
                      {/* Hero — first 5 featured items */}
                      {homeData?.featured?.length > 0 && (
                        <HeroBanner items={homeData.featured.slice(0, 5)} onSelect={goToDetail} />
                      )}

                      {/* Trending strip */}
                      {homeData?.trending?.length > 0 && (
                        <TrendingStrip items={homeData.trending} onSelect={goToDetail} />
                      )}

                      {/* Schedule promo banner */}
                      <Link
                        to="/dashboard/lifesync/anime/anime/schedule"
                        className="group flex items-center justify-between gap-4 overflow-hidden rounded-2xl border border-(--color-border-soft) bg-(--color-surface) px-5 py-4 transition-all hover:border-primary/40 hover:bg-primary/5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-[13px] font-bold text-(--color-text-primary)">Weekly Schedule</p>
                            <p className="text-[11px] text-(--color-text-secondary)">See what's airing each day this week</p>
                          </div>
                        </div>
                        <svg className="h-4 w-4 shrink-0 text-(--color-text-secondary) transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>

                      {/* Featured rail (remaining) */}
                      {homeData?.featured?.length > 5 && (
                        <HorizRail title="Featured" items={homeData.featured.slice(5)} onSelect={goToDetail} />
                      )}

                      {/* Latest updates rail */}
                      {homeData?.latestUpdates?.length > 0 && (
                        <HorizRail
                          title="Latest Updates"
                          items={homeData.latestUpdates.slice(0, 12)}
                          onSelect={goToDetail}
                          onSeeAll={() => goToTab("latest")}
                        />
                      )}

                      {/* Ongoing rail */}
                      {homeData?.ongoing?.length > 0 && (
                        <HorizRail
                          title="Ongoing"
                          items={homeData.ongoing.slice(0, 12)}
                          onSelect={goToDetail}
                          onSeeAll={() => goToTab("ongoing")}
                        />
                      )}

                      {!homeBusy && !homeData && (
                        <div className="rounded-2xl border border-(--color-border-soft) bg-(--color-surface) px-6 py-10 text-center">
                          <p className="text-[13px] text-(--color-text-secondary)">Couldn't load home page data.</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── PAGINATED TABS ──────────────────────────────────── */}
              {tab !== "home" && (
                <>
                  {busy && paginatedItems.length === 0 ? (
                    layout === "grid" ? <SkeletonGrid count={12} /> : <SkeletonList count={8} />
                  ) : paginatedItems.length > 0 ? (
                    <AnimatePresence mode="wait" initial={false}>
                      {layout === "grid" ? (
                        <MotionDiv
                          key="grid"
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="grid gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                        >
                          {paginatedItems.map((item, i) => (
                            <div key={item.node?.slug || item.node?.id || i} className={focusedCardIndex === i ? "rounded-2xl ring-2 ring-primary ring-offset-2" : ""}>
                              <AnimeCard
                                node={item.node}
                                ranking={tab === "browse" ? item.ranking?.rank : undefined}
                                onSelect={goToDetail}
                              />
                            </div>
                          ))}
                        </MotionDiv>
                      ) : (
                        <MotionDiv
                          key="list"
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden rounded-2xl border border-(--color-border-soft) bg-(--color-surface)"
                        >
                          {paginatedItems.map((item, i) => (
                            <div key={item.node?.slug || item.node?.id || i} className={focusedCardIndex === i ? "ring-2 ring-primary ring-inset" : ""}>
                              <AnimeRow
                                node={item.node}
                                ranking={tab === "browse" ? item.ranking?.rank : undefined}
                                onSelect={goToDetail}
                                isLast={i === paginatedItems.length - 1}
                              />
                            </div>
                          ))}
                        </MotionDiv>
                      )}
                    </AnimatePresence>
                  ) : (
                    !busy && (
                      <div className="rounded-2xl border border-(--color-border-soft) bg-(--color-surface) px-6 py-10 text-center">
                        <p className="text-[13px] text-(--color-text-secondary)">No anime to display.</p>
                      </div>
                    )
                  )}

                  {/* Pagination */}
                  {pager && paginatedItems.length > 0 && (
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-[11px] text-(--color-text-secondary)">Page {pager.page}</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!pager.canPrev}
                          onClick={() => goToPage(pager.page - 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-(--color-border-soft) bg-(--color-surface) text-(--color-text-secondary) transition hover:bg-(--color-surface-muted) disabled:opacity-40"
                        >
                          <IconChevronLeft />
                        </button>
                        <div className="flex items-center gap-1">
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
                                  key={p} type="button" onClick={() => goToPage(p)}
                                  className={`min-w-8 px-2 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${p === cur ? "bg-primary text-(--color-ink-strong) border-primary" : "bg-(--color-surface) text-(--color-text-primary) border-(--color-border-soft) hover:bg-(--color-surface-muted)"}`}
                                  aria-current={p === cur ? "page" : undefined}
                                >
                                  {p}
                                </button>
                              ) : (
                                <span key={`dots-${idx}`} className="px-1 text-[11px] text-(--color-text-secondary)">…</span>
                              ),
                            );
                          })()}
                        </div>
                        <button
                          type="button"
                          disabled={!pager.canNext}
                          onClick={() => goToPage(pager.page + 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-(--color-border-soft) bg-(--color-surface) text-(--color-text-secondary) transition hover:bg-(--color-surface-muted) disabled:opacity-40"
                        >
                          <IconChevronRight />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </MotionDiv>
          </AnimatePresence>
        </MotionDiv>
      </MotionDiv>
    </MotionDiv>
  );
}
