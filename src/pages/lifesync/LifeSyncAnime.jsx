import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import useControllerSupportEnabled from "../../hooks/useControllerSupportEnabled";
import useLifeSyncGamepadInput from "../../hooks/useLifeSyncGamepadInput";
import { XBOX_GAMEPAD_BUTTONS } from "../../lib/lifeSyncControllerInput";
import { ControllerHintBar } from "../../components/lifesync/ControllerHintOverlay";
import { useFocusedCardScroll } from "../../hooks/useFocusedCardScroll";
import { useHideCursorOnDpad } from "../../hooks/useHideCursorOnDpad";
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
  MediaPageHeader,
  MediaSectionTitle,
  MediaArrowButton,
  MediaPager,
  MediaEmptyState,
  MediaConnectPrompt,
  mediaChipClass,
  mediaChipNeutralClass,
  mediaSearchInputClass,
  mediaPrimaryButtonClass,
  mediaPosterFrameClass,
} from "../../components/lifesync/MediaPageChrome";
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
  lifeSyncCardGridContainer,
  lifeSyncCardEnterVariants,
  lifeSyncRailContainer,
  lifeSyncRailItemVariants,
  lifeSyncStatBlockContainer,
  lifeSyncStatBlockItem,
  lifeSyncSpringPageVariants,
  lifeSyncSpringPageTransition,
  MotionDiv,
  MotionSpan,
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
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

const BROWSE_TYPE_OPTIONS = [
  { id: "", label: "All" },
  { id: "1", label: "TV" },
  { id: "2", label: "Movie" },
  { id: "3", label: "OVA" },
  { id: "4", label: "ONA" },
  { id: "5", label: "Special" },
  { id: "6", label: "Music" },
];
const BROWSE_STATUS_OPTIONS = [
  { id: "", label: "Any" },
  { id: "Ongoing", label: "Ongoing" },
  { id: "Completed", label: "Completed" },
  { id: "info", label: "Upcoming" },
];
const BROWSE_LANGUAGE_OPTIONS = [
  { id: "", label: "All" },
  { id: "sub", label: "Sub" },
  { id: "dub", label: "Dub" },
];
const BROWSE_SORT_OPTIONS = [
  { id: "", label: "Latest" },
  { id: "recently_added", label: "Newly Added" },
  { id: "release_date", label: "Release Date" },
  { id: "title_az", label: "A–Z" },
];
const BROWSE_GENRE_OPTIONS = [
  "action",
  "adventure",
  "comedy",
  "drama",
  "ecchi",
  "fantasy",
  "horror",
  "isekai",
  "magic",
  "mecha",
  "military",
  "mystery",
  "psychological",
  "romance",
  "sci-fi",
  "slice-of-life",
  "sports",
  "supernatural",
  "thriller",
];

// ── Icons ──────────────────────────────────────────────────────────────────────
const IconGrid = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth="2"
  >
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);
const IconList = () => (
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
      d="M9 5h12M9 12h12M9 19h12M4 5h.01M4 12h.01M4 19h.01"
    />
  </svg>
);
const IconPlay = () => (
  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);
const IconSearch = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth="2"
  >
    <circle cx="11" cy="11" r="7" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
  </svg>
);
const IconChevronLeft = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth="2.5"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);
const IconChevronRight = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth="2.5"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

// ── Poster card (grid) ─────────────────────────────────────────────────────────
const AnimeCard = memo(function AnimeCard({ node, ranking, onSelect }) {
  const anime = node || {};
  const slug = anime.slug || anime.id;
  const pic =
    anime.poster ||
    anime.image ||
    anime.main_picture?.large ||
    anime.main_picture?.medium;
  return (
    <MotionDiv
      variants={lifeSyncCardEnterVariants}
      whileHover={{
        y: -4,
        transition: { type: "spring", stiffness: 400, damping: 28 },
      }}
      className="w-full"
    >
      <button
        type="button"
        onClick={() => slug && onSelect?.(anime)}
        className="group w-full text-left"
      >
        <div className={mediaPosterFrameClass}>
          <div className="relative aspect-2/3 w-full overflow-hidden">
            {slug ? (
              <MotionDiv
                layoutId={animePosterLayoutId(slug)}
                transition={lifeSyncSharedLayoutTransitionProps}
                className="absolute inset-0 overflow-hidden bg-(--color-surface-muted)"
              >
                {pic ? (
                  <img
                    src={pic}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-(--color-text-secondary)">
                    <svg
                      className="w-8 h-8"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-12.75A1.125 1.125 0 014.5 4.5h15a1.125 1.125 0 011.125 1.125v12.75"
                      />
                    </svg>
                  </div>
                )}
              </MotionDiv>
            ) : pic ? (
              <img
                src={pic}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-(--color-text-secondary)">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-12.75A1.125 1.125 0 014.5 4.5h15a1.125 1.125 0 011.125 1.125v12.75"
                  />
                </svg>
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 via-black/15 to-transparent" />
            {ranking != null && (
              <MotionSpan
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 380,
                  damping: 22,
                  delay: 0.05,
                }}
                className="absolute left-2 top-2 rounded-lg bg-primary px-2 py-0.5 text-[10px] font-black tabular-nums text-(--color-ink-strong) shadow-[0_4px_12px_-4px_rgba(198,255,0,0.7)]"
              >
                #{ranking}
              </MotionSpan>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-2 p-2.5">
              <p className="text-[12px] font-bold leading-snug text-white line-clamp-2 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                {anime.title}
              </p>
              {(anime.type || anime.media_type) && (
                <span className="mt-1 inline-block rounded-full bg-white/12 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/90 ring-1 ring-white/20 backdrop-blur-sm">
                  {anime.type || anime.media_type}
                </span>
              )}
            </div>
            {/* Hover play affordance */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-250 group-hover:opacity-100">
              <div className="flex h-11 w-11 scale-75 items-center justify-center rounded-full bg-primary text-black shadow-[0_12px_30px_-8px_rgba(198,255,0,0.9)] transition-transform duration-250 group-hover:scale-100">
                <IconPlay />
              </div>
            </div>
            {/* Shimmer sweep on hover */}
            <div
              className="pointer-events-none absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/8 to-transparent opacity-0 transition-none group-hover:animate-[lifesync-shimmer_0.6s_ease-out_forwards] group-hover:opacity-100"
              aria-hidden
            />
            {/* Accent edge */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-linear-to-r from-transparent via-primary to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              aria-hidden
            />
          </div>
        </div>
      </button>
    </MotionDiv>
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
        <span className="w-5 shrink-0 text-center text-[11px] font-black tabular-nums text-primary">
          {ranking}
        </span>
      )}
      <div className="relative h-[54px] w-[38px] shrink-0 overflow-hidden rounded-lg bg-(--color-surface-muted)">
        {pic ? (
          <img
            src={pic}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-(--color-text-secondary)">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125V5.625"
              />
            </svg>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-[13px] font-semibold text-(--color-text-primary)">
          {anime.title}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5">
          {(anime.type || anime.media_type) && (
            <span className="rounded bg-(--color-surface-muted) px-1.5 py-0.5 text-[9px] font-semibold uppercase text-(--color-text-secondary)">
              {anime.type || anime.media_type}
            </span>
          )}
          {anime.status && (
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${anime.status === "Ongoing" ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-(--color-surface-muted) text-(--color-text-secondary)"}`}
            >
              {anime.status}
            </span>
          )}
        </div>
      </div>
      <svg
        className="h-3.5 w-3.5 shrink-0 text-(--color-text-secondary) opacity-0 transition-opacity group-hover:opacity-100"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
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
    timerRef.current = setInterval(
      () => setIdx((i) => (i + 1) % Math.max(1, items.length)),
      7000,
    );
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

  const heroBadges = (node) => {
    const chips = [];
    const t = node?.type || node?.media_type;
    if (t) chips.push(t);
    if (node?.status) chips.push(node.status);
    if (node?.release) chips.push(node.release);
    if (node?.hasSub) chips.push("SUB");
    if (node?.hasDub) chips.push("DUB");
    return chips;
  };

  return (
    <div
      className="relative overflow-hidden rounded-[28px] bg-(--color-surface-muted) ring-1 ring-black/25 shadow-[0_28px_60px_-24px_rgba(0,0,0,0.55)]"
      style={{ minHeight: 320, aspectRatio: "21/9" }}
    >
      {/* Background images with zoom-in on enter */}
      <AnimatePresence mode="sync" initial={false}>
        <MotionDiv
          key={idx}
          className="absolute inset-0 overflow-hidden"
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        >
          {pic && (
            <img
              src={pic}
              alt=""
              className="h-full w-full object-cover object-top"
            />
          )}
          {/* Multi-layer cinematic grade */}
          <div className="absolute inset-0 bg-linear-to-r from-black/90 via-black/50 to-black/10" />
          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(198,255,0,0.08),transparent_55%)]" />
        </MotionDiv>
      </AnimatePresence>

      {/* Accent top hairline */}
      <div
        className="pointer-events-none absolute inset-x-10 top-0 z-1 h-px bg-linear-to-r from-transparent via-primary/70 to-transparent"
        aria-hidden
      />
      {/* Bottom vignette lift */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/60 to-transparent z-1"
        aria-hidden
      />

      {/* Content */}
      <div className="relative z-2 flex h-full flex-col justify-end p-5 sm:p-8 sm:pb-10">
        <AnimatePresence mode="wait" initial={false}>
          <MotionDiv
            key={`hero-text-${idx}`}
            initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, filter: "blur(2px)" }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-xl"
          >
            {/* Featured badge with live dot */}
            <MotionDiv
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.06, duration: 0.32 }}
            >
              <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/55 bg-black/50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-primary backdrop-blur-sm">
                <span
                  className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary"
                  aria-hidden
                />
                Featured
              </span>
            </MotionDiv>

            {/* Title */}
            <h2 className="line-clamp-2 text-[22px] font-black leading-tight text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.7)] sm:text-[32px]">
              {active?.title}
            </h2>

            {/* Tag chips */}
            {heroBadges(active).length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {heroBadges(active).map((label, i) => (
                  <MotionDiv
                    key={label}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      delay: 0.08 + i * 0.04,
                      type: "spring",
                      stiffness: 300,
                      damping: 24,
                    }}
                  >
                    <span className="rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white ring-1 ring-white/20 backdrop-blur-sm">
                      {label}
                    </span>
                  </MotionDiv>
                ))}
              </div>
            )}

            {/* Synopsis */}
            {active?.synopsis && (
              <p className="mt-2.5 line-clamp-2 text-[12px] leading-relaxed text-white/72 sm:line-clamp-3">
                {active.synopsis}
              </p>
            )}

            {/* Meta row */}
            <div className="mt-2 space-y-0.5">
              {active?.genres?.length > 0 && (
                <p className="text-[11px] text-white/65">
                  <span className="font-semibold text-primary">Genres:</span>{" "}
                  {active.genres.slice(0, 5).join(", ")}
                </p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                {active?.studio && (
                  <p className="text-[11px] text-white/65">
                    <span className="font-semibold text-primary">Studio:</span>{" "}
                    {active.studio}
                  </p>
                )}
                {(active?.episodeCount || active?.num_episodes) && (
                  <p className="text-[11px] text-white/65">
                    <span className="font-semibold text-primary">Eps:</span>{" "}
                    {active.episodeCount || active.num_episodes}
                  </p>
                )}
                {active?.quality && (
                  <p className="text-[11px] text-white/65">
                    <span className="font-semibold text-primary">Quality:</span>{" "}
                    {active.quality}
                  </p>
                )}
              </div>
            </div>

            {/* CTA buttons */}
            <div className="mt-4 flex flex-wrap gap-2.5">
              <MotionDiv
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 24 }}
              >
                <button
                  type="button"
                  onClick={() => onSelect?.(active)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-2.5 text-[13px] font-black text-black shadow-[0_16px_36px_-10px_rgba(198,255,0,0.8)] transition-[brightness] hover:brightness-105"
                >
                  <IconPlay />
                  Watch Now
                </button>
              </MotionDiv>
              <MotionDiv
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 24 }}
              >
                <button
                  type="button"
                  onClick={() => onSelect?.(active)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-6 py-2.5 text-[13px] font-bold text-white backdrop-blur-md transition-colors hover:bg-white/18"
                >
                  View Details
                </button>
              </MotionDiv>
            </div>
          </MotionDiv>
        </AnimatePresence>

        {/* Slide indicators */}
        <div className="absolute bottom-5 right-6 flex items-center gap-2">
          <span className="mr-1 text-[10px] font-black tabular-nums text-white/45">
            {idx + 1} / {items.length}
          </span>
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show slide ${i + 1}`}
              onClick={() => {
                setIdx(i);
                startTimer();
              }}
              className={`h-1 rounded-full transition-all duration-400 ${i === idx ? "w-8 bg-primary shadow-[0_0_14px_rgba(198,255,0,0.8)]" : "w-3 bg-white/22 hover:bg-white/45"}`}
            />
          ))}
        </div>

        {/* Left/right nav arrows (sm+) */}
        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous"
              className="absolute left-3 top-1/2 hidden -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60 sm:flex"
            >
              <IconChevronLeft />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next"
              className="absolute right-3 top-1/2 hidden -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60 sm:flex"
            >
              <IconChevronRight />
            </button>
          </>
        )}
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
      <MediaSectionTitle
        accent="anime"
        title={title}
        action={
          <div className="flex items-center gap-1.5">
            <MediaArrowButton
              size="sm"
              direction="left"
              onClick={() => scroll(-1)}
              label={`Scroll ${title} left`}
            />
            <MediaArrowButton
              size="sm"
              direction="right"
              onClick={() => scroll(1)}
              label={`Scroll ${title} right`}
            />
            {onSeeAll && (
              <button
                type="button"
                onClick={onSeeAll}
                className="ml-1 rounded-full border border-(--color-border-soft) bg-(--color-surface) px-3 py-1 text-[11px] font-bold text-(--color-text-secondary) transition-all hover:-translate-y-px hover:border-primary/50 hover:text-(--color-text-primary)"
              >
                See all
              </button>
            )}
          </div>
        }
      />
      <MotionDiv
        ref={ref}
        variants={lifeSyncRailContainer}
        initial="hidden"
        animate="show"
        className="flex gap-3.5 overflow-x-auto pb-3 pt-1 hide-scrollbar overscroll-x-contain snap-x snap-mandatory"
      >
        {items.map((node, i) => (
          <MotionDiv
            key={node.slug || node.id || i}
            variants={lifeSyncRailItemVariants}
            className="w-32.5 shrink-0 snap-start sm:w-37.5"
          >
            <AnimeCard node={node} onSelect={onSelect} />
          </MotionDiv>
        ))}
      </MotionDiv>
    </div>
  );
}

// ── Trending strip (ranked horizontal) ────────────────────────────────────────
function TrendingStrip({ items, onSelect }) {
  if (!items?.length) return null;
  return (
    <div>
      <MediaSectionTitle
        accent="anime"
        title="Trending"
        hint="Top 10 right now"
      />
      <MotionDiv
        variants={lifeSyncRailContainer}
        initial="hidden"
        animate="show"
        className="flex gap-6 overflow-x-auto pb-3 pl-7 pt-1 hide-scrollbar overscroll-x-contain snap-x snap-mandatory sm:gap-8 sm:pl-9"
      >
        {items.slice(0, 10).map((node, i) => {
          const pic = node?.poster || node?.image;
          return (
            <MotionDiv
              key={node.slug || i}
              variants={lifeSyncRailItemVariants}
              whileHover={{
                y: -5,
                transition: { type: "spring", stiffness: 380, damping: 26 },
              }}
              className="group relative shrink-0 snap-start"
              style={{ width: 108 }}
            >
              <button
                type="button"
                onClick={() => onSelect?.(node)}
                className="w-full text-left"
              >
                {/* Oversized rank numeral */}
                <MotionDiv
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 0.55, x: 0 }}
                  transition={{ delay: 0.06 + i * 0.03, duration: 0.3 }}
                  className="pointer-events-none absolute -left-7 bottom-0 z-0 select-none text-[84px] font-black leading-[0.8] tabular-nums tracking-tighter text-transparent sm:-left-9 sm:text-[104px]"
                  style={{
                    WebkitTextStroke: "2px var(--mx-color-c6ff00, #c6ff00)",
                  }}
                  aria-hidden
                >
                  {i + 1}
                </MotionDiv>
                <div
                  className="relative z-1 overflow-hidden rounded-[16px] ring-1 ring-(--color-border-soft) shadow-sm transition-shadow duration-300 group-hover:shadow-[0_20px_44px_-14px_rgba(0,0,0,0.55)] group-hover:ring-primary/70"
                  style={{ aspectRatio: "2/3" }}
                >
                  {pic && (
                    <img
                      src={pic}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                      loading="lazy"
                    />
                  )}
                  <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-2">
                    <p className="line-clamp-2 text-[10px] font-bold leading-tight text-white drop-shadow">
                      {node.title}
                    </p>
                  </div>
                </div>
              </button>
            </MotionDiv>
          );
        })}
      </MotionDiv>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function SkeletonHero() {
  return (
    <div
      className="w-full animate-pulse rounded-3xl bg-(--color-surface-muted)"
      style={{ aspectRatio: "21/9" }}
    />
  );
}
function SkeletonRail({ count = 6 }) {
  return (
    <div className="flex gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="w-[130px] shrink-0 animate-pulse overflow-hidden rounded-2xl bg-(--color-surface-muted) aspect-2/3"
        />
      ))}
    </div>
  );
}
function SkeletonGrid({ count = 12 }) {
  return (
    <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse overflow-hidden rounded-2xl bg-(--color-surface-muted) aspect-2/3"
        />
      ))}
    </div>
  );
}
function SkeletonList({ count = 8 }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-(--color-border-soft) bg-(--color-surface)">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 px-4 py-3 animate-pulse ${i < count - 1 ? "border-b border-(--color-border-soft)" : ""}`}
        >
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
      const thumbUrl =
        typeof ep.thumbnailUrl === "string" && ep.thumbnailUrl.trim()
          ? ep.thumbnailUrl
          : undefined;
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

function DetailWatchSection({
  animeId,
  animeTitle,
  pic,
  animeStreamAudio,
  onPlayStream,
}) {
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
      `/api/v1/anime/watch-progress/${encodeURIComponent(animeId)}`,
      { signal },
    )
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
  }, [animeId, animeTitle]);

  const catalogWarmTimerRef = useRef(null);
  const warmStreamCatalog = useCallback(() => {
    if (!animeId || catalogWarmTimerRef.current != null) return;
    catalogWarmTimerRef.current = window.setTimeout(() => {
      catalogWarmTimerRef.current = null;
      void fetchStreamInfoBySlugWithCache(animeId, lifesyncFetch).catch(
        () => {},
      );
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
    () => normalizeStreamEpisodesForPlayer(streamData?.episodes),
    [streamData],
  );

  const dubAvailabilityLabel = useMemo(() => {
    if (!streamEps.length) return "Dub: ";
    let hasSignal = false,
      anyDub = false;
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
          seriesKey: `anineko:${animeId}`,
          animeId,
          title: animeTitle,
          poster: pic || "",
          episodes: streamEps,
        },
        ep,
        i,
      );
    },
    [animeId, animeTitle, onPlayStream, pic, streamEps],
  );

  const [focusedEpIndex, setFocusedEpIndex] = useState(-1);
  const detailControllerEnabled = useControllerSupportEnabled();

  const detailEpHandlers = useMemo(
    () => ({
      [XBOX_GAMEPAD_BUTTONS.DPAD_UP]: () =>
        setFocusedEpIndex((prev) =>
          Math.max(0, prev <= 0 ? streamEps.length - 1 : prev - 1),
        ),
      [XBOX_GAMEPAD_BUTTONS.DPAD_DOWN]: () =>
        setFocusedEpIndex((prev) => (prev + 1) % Math.max(1, streamEps.length)),
      [XBOX_GAMEPAD_BUTTONS.A]: () => {
        if (focusedEpIndex >= 0 && streamEps[focusedEpIndex])
          openSeries(streamEps[focusedEpIndex], focusedEpIndex);
      },
    }),
    [focusedEpIndex, openSeries, streamEps],
  );

  useLifeSyncGamepadInput({
    enabled: detailControllerEnabled && streamEps.length > 0,
    handlers: detailEpHandlers,
    repeatableButtons: [
      XBOX_GAMEPAD_BUTTONS.DPAD_UP,
      XBOX_GAMEPAD_BUTTONS.DPAD_DOWN,
    ],
  });

  useEffect(() => {
    if (focusedEpIndex < 0) return;
    document
      .querySelector('[data-focused-ep="true"]')
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusedEpIndex]);

  const isDarkTheme =
    typeof document !== "undefined" &&
    document.documentElement?.dataset?.maxienTheme === "dark";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-(--color-text-secondary)">
          Episodes
        </p>
        <span className="inline-flex items-center rounded-full border border-sky-400/25 bg-sky-500/8 px-2 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-300">
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
            className="space-y-2"
          >
            {streamData?.matchedStreamTitle &&
              streamData.matchedStreamTitle !== animeTitle && (
                <p className="text-[11px] text-(--color-text-secondary)">
                  Matched:{" "}
                  <span className="font-medium text-(--color-text-primary)">
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
                    className="w-full rounded-2xl border border-primary/35 bg-primary/10 px-4 py-3.5 text-left transition hover:border-primary/50 hover:bg-primary/15 shadow-[0_4px_16px_-6px_rgba(198,255,0,0.3)]"
                  >
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                      <svg
                        className="h-3 w-3"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      Continue
                    </p>
                    <p className="mt-1 text-[13px] font-semibold text-(--color-text-primary)">
                      Resume Ep {resumeLastEp}
                      {streamEps[resumeIndex]?.title
                        ? ` · ${streamEps[resumeIndex].title}`
                        : ""}
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
                      data-focused-ep={
                        focusedEpIndex === i ? "true" : undefined
                      }
                      onMouseEnter={warmStreamCatalog}
                      onFocus={warmStreamCatalog}
                      onClick={() => openSeries(ep, i)}
                      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                        focusedEpIndex === i
                          ? "bg-primary/10 border border-primary/50 ring-1 ring-primary/40"
                          : isResume
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
                          {ep.hasSub && (
                            <span className="rounded bg-(--color-surface-muted) px-1 py-0.5 text-[9px] font-bold text-(--color-text-secondary)">
                              SUB
                            </span>
                          )}
                          {ep.hasDub && (
                            <span className="rounded bg-(--color-surface-muted) px-1 py-0.5 text-[9px] font-bold text-(--color-text-secondary)">
                              DUB
                            </span>
                          )}
                        </span>
                      )}
                      <svg
                        className="h-3.5 w-3.5 shrink-0 text-(--color-text-secondary) opacity-0 group-hover:opacity-100 transition-opacity"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                  );
                })}
              </div>
            )}
            {streamData && streamEps.length === 0 && (
              <p className="text-[12px] text-(--color-text-secondary)">
                No playable episodes found for this title.
              </p>
            )}
            {streamData === null && (
              <p className="text-[12px] text-(--color-text-secondary)">
                Couldn't find this title on the streaming provider.
              </p>
            )}
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Detail panel ───────────────────────────────────────────────────────────────
function DetailPanel({
  animeId,
  animeStreamAudio,
  onClose,
  onPlayStream,
  preview,
}) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [detailError, setDetailError] = useState("");
  const [descExpanded, setDescExpanded] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    lifesyncFetch(
      `/api/v1/anime/stream/info/by-slug/${encodeURIComponent(animeId)}?view=full`,
      { signal: ac.signal },
    )
      .then((res) => {
        if (!cancelled) setData(res?.data ?? res ?? null);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        if (!cancelled) {
          setData(null);
          setDetailError(
            err?.message || "We couldn't load this title right now.",
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

  const pic =
    data?.poster ||
    data?.image ||
    data?.main_picture?.large ||
    data?.main_picture?.medium;
  const previewPic = preview?.poster || preview?.main_picture?.large;
  const heroPic = pic || previewPic;
  const description = data?.synopsis ? String(data.synopsis).trim() : "";
  const genres = Array.isArray(data?.genres) ? data.genres : [];
  const related = Array.isArray(data?.related) ? data.related : [];
  const isDarkTheme =
    typeof document !== "undefined" &&
    document.documentElement?.dataset?.maxienTheme === "dark";

  const node = (
    <MotionDiv
      className="fixed inset-0 z-9998 flex h-dvh max-h-dvh w-full max-w-screen min-w-0 items-end justify-center overflow-hidden p-0 sm:items-center sm:p-4"
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
        className="lifesync-anime-detail-sheet relative flex h-dvh max-h-dvh w-full min-w-0 flex-col overflow-hidden bg-(--color-surface) shadow-2xl sm:h-auto sm:max-h-[min(88vh,calc(100dvh-2rem))] sm:max-w-5xl sm:rounded-2xl"
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
                <img
                  src={heroPic}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-700 scale-[1.04]"
                />
              </div>
              <div className="absolute inset-0 lifesync-detail-hero-fade" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.18),transparent_60%)]" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-sky-400/60 to-transparent" />
            </>
          )}
          {!heroPic && (
            <div className="absolute inset-0 lifesync-detail-hero-fallback" />
          )}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur-sm transition-all hover:bg-black/60"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <div className="relative flex flex-row items-end gap-4 px-5 pb-5 pt-5 sm:gap-5 sm:px-6">
            <MotionDiv
              layoutId={animePosterLayoutId(animeId)}
              transition={lifeSyncSharedLayoutTransitionProps}
              className="w-24 shrink-0 overflow-hidden rounded-xl bg-(--color-surface-muted) shadow-xl ring-1 ring-black/15 sm:w-32"
              style={{ aspectRatio: "2/3" }}
            >
              {heroPic ? (
                <img
                  src={heroPic}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : busy ? (
                <div className="flex h-full min-h-28 w-full items-center justify-center gap-1">
                  <span className="lifesync-dot-bounce h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="lifesync-dot-bounce lifesync-dot-bounce-delay-1 h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="lifesync-dot-bounce lifesync-dot-bounce-delay-2 h-1.5 w-1.5 rounded-full bg-primary" />
                </div>
              ) : (
                <div className="flex h-full min-h-28 w-full items-center justify-center text-(--color-text-secondary)">
                  <svg
                    className="h-8 w-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.375 19.5h17.25M3.375 19.5a1.125 1.125 0 01-1.125-1.125V5.625"
                    />
                  </svg>
                </div>
              )}
            </MotionDiv>
            <div className="min-w-0 flex-1 pb-1">
              <h2 className="wrap-anywhere line-clamp-3 text-[19px] font-bold leading-tight text-white drop-shadow sm:text-[22px]">
                {data?.title ||
                  preview?.title ||
                  (busy ? "" : "Couldn't load details")}
                {busy && !preview?.title && (
                  <span className="inline-block h-5 w-48 animate-pulse rounded-md bg-white/20" />
                )}
              </h2>
              {data?.altTitle && data.altTitle !== data.title && (
                <p className="mt-0.5 line-clamp-1 text-[11px] text-white/65">
                  {data.altTitle}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(data?.type || preview?.type) && (
                  <span className="rounded-md bg-sky-400/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-300 backdrop-blur-sm">
                    {data?.type || preview?.type}
                  </span>
                )}
                {data?.status && (
                  <span className="rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm">
                    {data.status}
                  </span>
                )}
                {data?.release && (
                  <span className="rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm">
                    {data.release}
                  </span>
                )}
                {data?.quality && (
                  <span className="rounded-md bg-primary/80 px-2 py-0.5 text-[10px] font-bold text-(--color-ink-strong) backdrop-blur-sm">
                    {data.quality}
                  </span>
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
              <div className="mt-5">
                <DetailWatchGridSkeleton count={6} dark={isDarkTheme} />
              </div>
            </div>
          ) : !busy && !data ? (
            <div className="px-5 py-8 sm:px-6">
              <div className="rounded-2xl bg-(--color-surface-muted) px-4 py-5 text-center">
                <p className="text-[13px] font-semibold text-(--color-text-primary)">
                  Couldn't load this title
                </p>
                <p className="mt-1 text-[12px] text-(--color-text-secondary)">
                  {detailError || "Try again in a moment."}
                </p>
                <button
                  type="button"
                  onClick={triggerReload}
                  className="mt-4 rounded-xl bg-primary px-4 py-2 text-[12px] font-bold text-(--color-ink-strong)"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : data ? (
            <MotionDiv
              key={String(animeId)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={lifeSyncDetailAnimeContentRevealTransition}
            >
              {description && (
                <div className="border-b border-(--color-border-soft) px-5 py-4 sm:px-6">
                  <p
                    className={`text-[12.5px] leading-relaxed text-(--color-text-secondary) ${descExpanded ? "" : "line-clamp-3"}`}
                  >
                    {description}
                  </p>
                  {description.length > 200 && (
                    <button
                      type="button"
                      onClick={() => setDescExpanded((v) => !v)}
                      className="mt-1.5 text-[11px] font-semibold text-(--color-text-secondary) hover:text-(--color-text-primary)"
                    >
                      {descExpanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>
              )}
              <div className="border-b border-(--color-border-soft) px-5 py-4 sm:px-6">
                <p className="mb-3 text-[9.5px] font-bold uppercase tracking-widest text-(--color-text-secondary)">
                  Anime Info
                </p>
                {(data.score || data.rating) && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {data.score && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                        ★ {data.score}
                      </span>
                    )}
                    {data.rating && (
                      <span className="inline-flex items-center rounded-full bg-(--color-surface-muted) px-3 py-1 text-[11px] font-semibold text-(--color-text-secondary)">
                        {data.rating}
                      </span>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                  {data.japanese && (
                    <div className="flex gap-3">
                      <span className="w-24 shrink-0 text-[11px] text-(--color-text-secondary)">
                        Japanese
                      </span>
                      <span className="text-[11px] font-semibold text-(--color-text-primary) min-w-0 break-words">
                        {data.japanese}
                      </span>
                    </div>
                  )}
                  {Array.isArray(data.synonyms) && data.synonyms.length > 0 && (
                    <div className="flex gap-3">
                      <span className="w-24 shrink-0 text-[11px] text-(--color-text-secondary)">
                        Synonyms
                      </span>
                      <span className="text-[11px] font-semibold text-(--color-text-primary) min-w-0 break-words">
                        {data.synonyms.join(", ")}
                      </span>
                    </div>
                  )}
                  {data.type && (
                    <div className="flex gap-3">
                      <span className="w-24 shrink-0 text-[11px] text-(--color-text-secondary)">
                        Type
                      </span>
                      <span className="text-[11px] font-semibold text-(--color-text-primary) min-w-0 break-words">
                        {data.type}
                      </span>
                    </div>
                  )}
                  {data.status && (
                    <div className="flex gap-3">
                      <span className="w-24 shrink-0 text-[11px] text-(--color-text-secondary)">
                        Status
                      </span>
                      <span className="text-[11px] font-semibold text-(--color-text-primary) min-w-0 break-words">
                        {data.status}
                      </span>
                    </div>
                  )}
                  {data.release && (
                    <div className="flex gap-3">
                      <span className="w-24 shrink-0 text-[11px] text-(--color-text-secondary)">
                        Release
                      </span>
                      <span className="text-[11px] font-semibold text-(--color-text-primary) min-w-0 break-words">
                        {data.release}
                      </span>
                    </div>
                  )}
                  {data.duration && (
                    <div className="flex gap-3">
                      <span className="w-24 shrink-0 text-[11px] text-(--color-text-secondary)">
                        Duration
                      </span>
                      <span className="text-[11px] font-semibold text-(--color-text-primary) min-w-0 break-words">
                        {data.duration}
                      </span>
                    </div>
                  )}
                  {data.quality && (
                    <div className="flex gap-3">
                      <span className="w-24 shrink-0 text-[11px] text-(--color-text-secondary)">
                        Quality
                      </span>
                      <span className="text-[11px] font-semibold text-(--color-text-primary) min-w-0 break-words">
                        {data.quality}
                      </span>
                    </div>
                  )}
                  {(data.subCount != null || data.dubCount != null) && (
                    <div className="flex gap-3">
                      <span className="w-24 shrink-0 text-[11px] text-(--color-text-secondary)">
                        Episodes
                      </span>
                      <span className="text-[11px] font-semibold text-(--color-text-primary) min-w-0 break-words">
                        {[
                          data.subCount != null && `SUB ${data.subCount}`,
                          data.dubCount != null && `DUB ${data.dubCount}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                  )}
                  {data.studios && data.studios !== "?" && (
                    <div className="flex gap-3">
                      <span className="w-24 shrink-0 text-[11px] text-(--color-text-secondary)">
                        Studios
                      </span>
                      <span className="text-[11px] font-semibold text-(--color-text-primary) min-w-0 break-words">
                        {data.studios}
                      </span>
                    </div>
                  )}
                </div>
                {genres.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {genres.map((g, i) => (
                      <span
                        key={g?.name || g || i}
                        className="rounded-full border border-sky-400/25 bg-sky-500/8 px-3 py-1 text-[10px] font-semibold text-sky-600 dark:text-sky-300 transition hover:border-sky-400/50"
                      >
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
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-(--color-text-secondary)">
                    Related
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {related.slice(0, 8).map((r, i) => (
                      <div
                        key={r.slug || r.title || i}
                        className="flex items-center gap-3 rounded-2xl border border-(--color-border-soft) bg-(--color-surface-muted) px-3 py-2.5 transition hover:border-sky-400/30 hover:bg-(--color-surface)"
                      >
                        {r.poster && (
                          <img
                            src={r.poster}
                            alt=""
                            className="h-10 w-7 shrink-0 rounded-md object-cover"
                            loading="lazy"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-[12px] font-semibold text-(--color-text-primary)">
                            {r.title}
                          </p>
                          {r.relation && (
                            <p className="text-[10px] capitalize text-(--color-text-secondary)">
                              {r.relation}
                            </p>
                          )}
                        </div>
                        {r.slug && (
                          <button
                            type="button"
                            onClick={() =>
                              onPlayStream?.(
                                {
                                  animeId: r.slug,
                                  title: r.title,
                                  episodes: [],
                                },
                                { episodeId: null },
                                0,
                              )
                            }
                            className="shrink-0 rounded-xl bg-sky-500/10 border border-sky-400/25 px-3 py-1.5 text-[10px] font-bold text-sky-600 dark:text-sky-300 transition hover:bg-sky-500/20"
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
  const { isLifeSyncConnected, lifeSyncUser, refreshLifeSyncMe } =
    useLifeSync();
  const nsfwContentEnabled = Boolean(
    lifeSyncUser?.preferences?.nsfwContentEnabled,
  );

  const basePath = "/dashboard/lifesync/anime/anime";
  const route = useMemo(() => {
    const rel = location.pathname.startsWith(basePath)
      ? location.pathname.slice(basePath.length)
      : "";
    const parts = rel.split("/").filter(Boolean);
    const tabId = parts[0] || "home";
    const allowedTabs = new Set([
      "home",
      "ongoing",
      "latest",
      "browse",
      "search",
    ]);
    const tab = allowedTabs.has(tabId) ? tabId : "home";
    let page = 1;
    const pageIdx = parts.indexOf("page");
    if (pageIdx >= 0 && parts[pageIdx + 1])
      page = clampPage(parts[pageIdx + 1]);
    const detailIdx = parts.indexOf("detail");
    const detailAnimeId = detailIdx >= 0 ? parts[detailIdx + 1] || null : null;
    const watchIdx = parts.indexOf("watch");
    const watchAnimeId = watchIdx >= 0 ? parts[watchIdx + 1] || null : null;
    const watchEpisodeIndexRaw =
      watchIdx >= 0 ? parts[watchIdx + 2] || null : null;
    const watchEpisodeIndex =
      watchEpisodeIndexRaw != null ? clampPage(watchEpisodeIndexRaw) - 1 : null;
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
  useFocusedCardScroll(focusedCardIndex);
  useHideCursorOnDpad();
  useEffect(() => {
    const onMove = () => setFocusedCardIndex(-1);
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);
  const searchInputRef = useRef(null);
  const controllerSupportEnabled = useControllerSupportEnabled();

  // Layout  seeded from server pref, persisted on toggle
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

  useEffect(
    () => () => {
      if (layoutSaveTimer.current) clearTimeout(layoutSaveTimer.current);
    },
    [],
  );

  const streamAudioType = getAnimeStreamAudio(lifeSyncUser?.preferences);
  const listFetchMountedRef = useRef(true);
  useEffect(() => {
    listFetchMountedRef.current = true;
    return () => {
      listFetchMountedRef.current = false;
    };
  }, []);

  const listPath = useMemo(
    () => `${basePath}/${route.tab}/page/${route.page}${location.search || ""}`,
    [basePath, location.search, route.page, route.tab],
  );

  const goToList = useCallback(
    (opts = {}) =>
      navigate(listPath, { replace: Boolean(opts.replace), state: null }),
    [navigate, listPath],
  );
  const goToTab = useCallback(
    (t) => navigate(`${basePath}/${t}/page/1${location.search || ""}`),
    [basePath, location.search, navigate],
  );
  const goToPage = useCallback(
    (p) =>
      navigate(
        `${basePath}/${route.tab}/page/${clampPage(p)}${location.search || ""}`,
      ),
    [basePath, location.search, navigate, route.tab],
  );

  const goToDetail = useCallback(
    (animeOrId) => {
      const id =
        animeOrId && typeof animeOrId === "object"
          ? animeOrId.slug || animeOrId.id
          : animeOrId;
      if (!id) return;
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
    if (tab !== route.tab) setTab(route.tab);
    if (route.tab === "ongoing" && ongoingPage !== route.page)
      setOngoingPage(route.page);
    if (route.tab === "latest" && latestPage !== route.page)
      setLatestPage(route.page);
    if (route.tab === "browse" && browsePage !== route.page)
      setBrowsePage(route.page);
    if (route.tab === "search" && searchPage !== route.page)
      setSearchPage(route.page);
  }, [
    route.page,
    route.tab,
    ongoingPage,
    latestPage,
    browsePage,
    searchPage,
    tab,
  ]);

  useEffect(() => {
    if (
      location.pathname === basePath ||
      location.pathname === `${basePath}/`
    ) {
      navigate(`${basePath}/home/page/1${location.search || ""}`, {
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
    if (route.detailAnimeId) {
      if (detailId !== route.detailAnimeId) setDetailId(route.detailAnimeId);
    } else if (detailId) setDetailId(null);
  }, [detailId, route.detailAnimeId]);

  const detailPreview = useMemo(() => {
    const raw = location.state?.animeDetailPreview;
    if (!raw || route.detailAnimeId == null) return null;
    if (String(raw.id) !== String(route.detailAnimeId)) return null;
    return raw;
  }, [location.state?.animeDetailPreview, route.detailAnimeId]);

  const resolveAnimeStream = useCallback(
    async (ep, audioOverride, animeId, mirrorId) => {
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
        const mirrorQ =
          mirrorId != null && String(mirrorId).trim()
            ? `&server=${encodeURIComponent(String(mirrorId).trim())}`
            : "";
        const pack = await lifesyncFetch(
          `/api/v1/anime/stream/watch/${encodeURIComponent(episodeId)}?type=${type}${mirrorQ}&view=full`,
        );
        const apiBase = getLifesyncApiBase();
        const iframeFromPack =
          typeof pack.iframeUrl === "string" &&
          /^https?:\/\//i.test(pack.iframeUrl)
            ? pack.iframeUrl
            : null;
        if (iframeFromPack)
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
        const sources = Array.isArray(pack.sources) ? pack.sources : [];
        const preferIframe = isIOSDevice();
        const iframeSrc = sources.find(
          (s) => s && String(s.kind || "").toLowerCase() === "iframe" && s.url,
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
      if (!series?.animeId || !ep?.episodeId) return;
      const resolved = await resolveAnimeStream(
        ep,
        undefined,
        series.animeId,
        null,
      );
      if (!listFetchMountedRef.current) return;
      const handoffId = stashAnimeWatchHandoff({
        animeId: String(series.animeId),
        episodeIndex: epIndex,
        anime: series.animeDetail || null,
        episodes: Array.isArray(series.episodes) ? series.episodes : [],
        stream: { ...resolved, resolving: false },
      });
      void fetchStreamInfoBySlugWithCache(
        String(series.animeId),
        lifesyncFetch,
        undefined,
        { title: String(series?.title || "") },
      )
        .then((body) => {
          if (body?.data != null)
            writeLifesyncStreamCatalogBySlug(series.animeId, body);
        })
        .catch(() => {});
      const ep1 = clampPage(epIndex + 1);
      const fromPath = `${listPath.replace(location.search || "", "")}${location.search || ""}`;
      const target = `/dashboard/lifesync/anime/anime/watch/${encodeURIComponent(String(series.animeId))}/${ep1}`;
      const nextState = {
        from: fromPath,
        handoffId,
        title: String(series?.title || ""),
      };
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

  useEffect(() => {
    const animeId = route.watchAnimeId;
    if (!animeId) return;
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
      `/dashboard/lifesync/anime/anime/watch/${encodeURIComponent(animeId)}/${ep1}`,
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

  const PAGE_SIZE = 24;

  const loadHome = useCallback(async () => {
    if (!listFetchMountedRef.current) return;
    setHomeBusy(true);
    try {
      const data = await lifesyncFetch("/api/v1/anime/home");
      if (!listFetchMountedRef.current) return;
      setHomeData(data || null);
    } catch {
      if (listFetchMountedRef.current) setHomeData(null);
    } finally {
      if (listFetchMountedRef.current) setHomeBusy(false);
    }
  }, []);

  const loadOngoing = useCallback(async () => {
    try {
      const data = await lifesyncFetch(
        `/api/v1/anime/ongoing?limit=${PAGE_SIZE}&page=${Math.max(1, ongoingPage)}`,
      );
      if (!listFetchMountedRef.current) return;
      setOngoingItems(data?.data || []);
      setOngoingHasNext(Boolean(data?.paging?.next));
    } catch {
      /* ignore */
    }
  }, [ongoingPage, nsfwContentEnabled]);

  const loadLatest = useCallback(async () => {
    try {
      const data = await lifesyncFetch(
        `/api/v1/anime/latest?limit=${PAGE_SIZE}&page=${Math.max(1, latestPage)}`,
      );
      if (!listFetchMountedRef.current) return;
      setLatestItems(data?.data || []);
      setLatestHasNext(Boolean(data?.paging?.next));
    } catch {
      /* ignore */
    }
  }, [latestPage, nsfwContentEnabled]);

  const loadBrowse = useCallback(async () => {
    try {
      const qs = new URLSearchParams({
        limit: String(PAGE_SIZE),
        page: String(Math.max(1, browsePage)),
      });
      if (browseType) qs.set("type", browseType);
      if (browseStatus) qs.set("status", browseStatus);
      if (browseLanguage) qs.set("language", browseLanguage);
      if (browseSort) qs.set("sort", browseSort);
      if (browseGenres.length > 0) qs.set("genre", browseGenres.join(","));
      const data = await lifesyncFetch(`/api/v1/anime/browse?${qs}`);
      if (!listFetchMountedRef.current) return;
      setBrowseItems(data?.data || []);
      setBrowseHasNext(Boolean(data?.paging?.next));
    } catch {
      /* ignore */
    }
  }, [
    browsePage,
    browseType,
    browseStatus,
    browseLanguage,
    browseSort,
    browseGenres,
    nsfwContentEnabled,
  ]);

  const load = useCallback(async () => {
    if (listFetchMountedRef.current) {
      setBusy(true);
      setError("");
    }
    try {
      await Promise.all([loadHome(), loadOngoing(), loadLatest()]);
    } catch (e) {
      if (listFetchMountedRef.current)
        setError(e.message || "Failed to load anime data");
    } finally {
      if (listFetchMountedRef.current) setBusy(false);
    }
  }, [loadHome, loadOngoing, loadLatest]);

  useEffect(() => {
    if (isLifeSyncConnected) load();
  }, [isLifeSyncConnected, load]);
  useEffect(() => {
    if (!isLifeSyncConnected || tab !== "ongoing") return;
    void loadOngoing();
  }, [isLifeSyncConnected, tab, loadOngoing]);
  useEffect(() => {
    if (!isLifeSyncConnected || tab !== "latest") return;
    void loadLatest();
  }, [isLifeSyncConnected, tab, loadLatest]);
  useEffect(() => {
    if (!isLifeSyncConnected || tab !== "browse") return;
    void loadBrowse();
  }, [isLifeSyncConnected, tab, loadBrowse]);
  useEffect(() => {
    setOngoingPage(1);
  }, []);
  useEffect(() => {
    setLatestPage(1);
  }, []);
  useEffect(() => {
    setBrowsePage(1);
  }, [browseType, browseStatus, browseLanguage, browseSort, browseGenres]);
  useEffect(() => {
    let cancelled = false;
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !isLifeSyncConnected)
        return;
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
    if (!isLifeSyncConnected || tab !== "search" || !searchCommittedQ.trim())
      return;
    const offset = (Math.max(1, searchPage) - 1) * PAGE_SIZE;
    let cancelled = false;
    setSearching(true);
    lifesyncFetch(
      `/api/v1/anime/search?q=${encodeURIComponent(searchCommittedQ.trim())}&limit=${PAGE_SIZE}&offset=${offset}`,
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

  const tabs = [
    { id: "home", label: "Home" },
    { id: "ongoing", label: "Ongoing" },
    { id: "latest", label: "Latest" },
    { id: "browse", label: "Browse" },
    ...(searchResults.length > 0
      ? [{ id: "search", label: "Search Results" }]
      : []),
  ];

  const paginatedItems =
    tab === "ongoing"
      ? ongoingItems
      : tab === "latest"
        ? latestItems
        : tab === "browse"
          ? browseItems
          : tab === "search"
            ? searchResults
            : [];

  const pager = (() => {
    if (tab === "ongoing")
      return {
        page: ongoingPage,
        onPage: setOngoingPage,
        canPrev: ongoingPage > 1,
        canNext: ongoingHasNext,
      };
    if (tab === "latest")
      return {
        page: latestPage,
        onPage: setLatestPage,
        canPrev: latestPage > 1,
        canNext: latestHasNext,
      };
    if (tab === "browse")
      return {
        page: browsePage,
        onPage: setBrowsePage,
        canPrev: browsePage > 1,
        canNext: browseHasNext,
      };
    if (tab === "search")
      return {
        page: searchPage,
        onPage: setSearchPage,
        canPrev: searchPage > 1,
        canNext: searchHasNext,
      };
    return null;
  })();

  const animeGamepadHandlers = useMemo(
    () => ({
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
        setFocusedCardIndex((prev) =>
          Math.max(0, prev <= 0 ? paginatedItems.length - 1 : prev - 1),
        );
      },
      [XBOX_GAMEPAD_BUTTONS.DPAD_RIGHT]: () => {
        setFocusedCardIndex(
          (prev) => (prev + 1) % Math.max(1, paginatedItems.length),
        );
      },
      [XBOX_GAMEPAD_BUTTONS.DPAD_UP]: () => {
        setFocusedCardIndex((prev) => Math.max(0, prev - 6));
      },
      [XBOX_GAMEPAD_BUTTONS.DPAD_DOWN]: () => {
        setFocusedCardIndex((prev) =>
          Math.min(paginatedItems.length - 1, prev + 6),
        );
      },
      [XBOX_GAMEPAD_BUTTONS.A]: () => {
        const item = paginatedItems[focusedCardIndex];
        if (item?.node) goToDetail(item.node);
      },
      [XBOX_GAMEPAD_BUTTONS.B]: () => {
        if (focusedCardIndex >= 0) {
          setFocusedCardIndex(-1);
        } else if (detailId) {
          goToList({ replace: true });
        } else {
          navigate(-1);
        }
      },
    }),
    [
      detailId,
      focusedCardIndex,
      goToDetail,
      goToList,
      goToPage,
      goToTab,
      layout,
      navigate,
      pager,
      paginatedItems,
      setLayout,
      tab,
    ],
  );

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
      <MediaConnectPrompt
        accent="anime"
        title="Anime hub locked"
        body="Browse featured anime, ongoing series, and latest updates  connect LifeSync in your profile to get started."
      />
    );
  }

  return (
    <MotionDiv
      className="space-y-5 sm:space-y-7"
      style={{ transformOrigin: "50% 0%" }}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={lifeSyncSpringPageVariants}
      transition={lifeSyncSpringPageTransition}
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
        initial="hidden"
        animate="show"
      >
        {/* Header */}
        <MotionDiv variants={lifeSyncStaggerItem}>
          <MediaPageHeader
            accent="anime"
            kicker="LifeSync · Streaming"
            title="Anime"
            subtitle="Featured picks, ongoing series, and the latest episode drops."
            icon={
              <svg
                className="h-5.5 w-5.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
                aria-hidden
              >
                <rect x="2" y="5" width="20" height="14" rx="3" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 9.5l4.5 2.5L10 14.5v-5z"
                />
              </svg>
            }
            actions={
              <>
                {tab !== "home" && (
                  <div className="flex items-center rounded-full border border-(--color-border-soft) bg-(--color-surface) p-1 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setLayout("grid")}
                      title="Grid view"
                      className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${layout === "grid" ? "bg-primary text-black shadow-[0_4px_12px_-4px_rgba(198,255,0,0.6)]" : "text-(--color-text-secondary) hover:text-(--color-text-primary)"}`}
                    >
                      <IconGrid />
                    </button>
                    <button
                      type="button"
                      onClick={() => setLayout("list")}
                      title="List view"
                      className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${layout === "list" ? "bg-primary text-black shadow-[0_4px_12px_-4px_rgba(198,255,0,0.6)]" : "text-(--color-text-secondary) hover:text-(--color-text-primary)"}`}
                    >
                      <IconList />
                    </button>
                  </div>
                )}
                <ControllerHintBar
                  cols={2}
                  hints={
                    tab === "home"
                      ? [{ btns: ["X"], label: "Go to search" }]
                      : [
                          { btns: ["LB"], label: "Prev page" },
                          { btns: ["RB"], label: "Next page" },
                          { btns: ["X"], label: "Search" },
                          { btns: ["Y"], label: "Grid / List" },
                          { btns: ["←→"], label: "Navigate cards" },
                          { btns: ["A"], label: "Open" },
                        ]
                  }
                />
              </>
            }
          />
        </MotionDiv>

        {error && (
          <div className="rounded-2xl border border-red-200/60 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-600 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Search */}
        <MotionDiv variants={lifeSyncStaggerItem}>
          <form
            onSubmit={handleSearch}
            className="flex flex-col gap-2 items-stretch sm:flex-row sm:flex-wrap"
          >
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-(--color-text-secondary)">
                <IconSearch />
              </span>
              <input
                ref={searchInputRef}
                type="search"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search anime…"
                className={mediaSearchInputClass}
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className={`w-full sm:w-auto ${mediaPrimaryButtonClass}`}
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
        <AnimatePresence initial={false}>
          {tab === "browse" && (
            <MotionDiv
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-2.5 -mt-2 overflow-hidden rounded-2xl border border-(--color-border-soft) bg-(--color-surface) p-3.5 shadow-sm"
            >
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 hide-scrollbar overscroll-x-contain">
                {BROWSE_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setBrowseType(opt.id)}
                    className={mediaChipNeutralClass(browseType === opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 hide-scrollbar overscroll-x-contain">
                  {BROWSE_STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setBrowseStatus(opt.id)}
                      className={mediaChipClass(browseStatus === opt.id)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 hide-scrollbar overscroll-x-contain">
                  {BROWSE_LANGUAGE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setBrowseLanguage(opt.id)}
                      className={mediaChipNeutralClass(
                        browseLanguage === opt.id,
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 hide-scrollbar overscroll-x-contain">
                  {BROWSE_SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setBrowseSort(opt.id)}
                      className={mediaChipNeutralClass(browseSort === opt.id)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 hide-scrollbar overscroll-x-contain">
                {BROWSE_GENRE_OPTIONS.map((g) => {
                  const active = browseGenres.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() =>
                        setBrowseGenres((prev) =>
                          active ? prev.filter((x) => x !== g) : [...prev, g],
                        )
                      }
                      className={`capitalize ${mediaChipClass(active)}`}
                    >
                      {g.replace(/-/g, " ")}
                    </button>
                  );
                })}
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>

        {/* Tab content */}
        <MotionDiv variants={lifeSyncStaggerItem}>
          <AnimatePresence mode="wait">
            <MotionDiv
              key={tab}
              className="space-y-6"
              initial="initial"
              animate="animate"
              exit="exit"
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
                      {/* Hero  first 5 featured items */}
                      {homeData?.featured?.length > 0 && (
                        <HeroBanner
                          items={homeData.featured.slice(0, 5)}
                          onSelect={goToDetail}
                        />
                      )}

                      {/* Trending strip */}
                      {homeData?.trending?.length > 0 && (
                        <TrendingStrip
                          items={homeData.trending}
                          onSelect={goToDetail}
                        />
                      )}

                      {/* Schedule promo banner */}
                      <Link
                        to="/dashboard/lifesync/anime/anime/schedule"
                        className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-[20px] border border-(--color-border-soft) bg-(--color-surface) px-5 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                      >
                        <div
                          className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-linear-to-r from-transparent via-primary/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                          aria-hidden
                        />
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-(--color-text-primary) ring-1 ring-primary/30 transition-all duration-300 group-hover:bg-primary group-hover:text-(--color-ink-strong) group-hover:shadow-[0_8px_20px_-8px_rgba(198,255,0,0.7)]">
                            <svg
                              className="h-5 w-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              strokeWidth="2"
                            >
                              <rect x="3" y="4" width="18" height="18" rx="2" />
                              <line x1="16" y1="2" x2="16" y2="6" />
                              <line x1="8" y1="2" x2="8" y2="6" />
                              <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-[13px] font-black tracking-tight text-(--color-text-primary)">
                              Weekly Schedule
                            </p>
                            <p className="text-[11px] text-(--color-text-secondary)">
                              See what's airing each day this week
                            </p>
                          </div>
                        </div>
                        <svg
                          className="h-4 w-4 shrink-0 text-(--color-text-secondary) transition-transform duration-300 group-hover:translate-x-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth="2.5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </Link>

                      {/* Featured rail (remaining) */}
                      {homeData?.featured?.length > 5 && (
                        <HorizRail
                          title="Featured"
                          items={homeData.featured.slice(5)}
                          onSelect={goToDetail}
                        />
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
                        <MediaEmptyState
                          accent="anime"
                          title="Couldn't load the home page"
                          message="Check your connection and try again in a moment."
                        />
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── PAGINATED TABS ──────────────────────────────────── */}
              {tab !== "home" && (
                <>
                  {busy && paginatedItems.length === 0 ? (
                    layout === "grid" ? (
                      <SkeletonGrid count={12} />
                    ) : (
                      <SkeletonList count={8} />
                    )
                  ) : paginatedItems.length > 0 ? (
                    <AnimatePresence mode="wait" initial={false}>
                      {layout === "grid" ? (
                        <MotionDiv
                          key="grid"
                          variants={lifeSyncCardGridContainer}
                          initial="hidden"
                          animate="show"
                          exit={{ opacity: 0, transition: { duration: 0.15 } }}
                          className="grid gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                        >
                          {paginatedItems.map((item, i) => (
                            <div
                              key={item.node?.slug || item.node?.id || i}
                              data-focused-card={
                                focusedCardIndex === i ? "true" : undefined
                              }
                              className={
                                focusedCardIndex === i
                                  ? "rounded-2xl ring-2 ring-primary ring-offset-2"
                                  : ""
                              }
                            >
                              <AnimeCard
                                node={item.node}
                                ranking={
                                  tab === "browse"
                                    ? item.ranking?.rank
                                    : undefined
                                }
                                onSelect={goToDetail}
                              />
                            </div>
                          ))}
                        </MotionDiv>
                      ) : (
                        <MotionDiv
                          key="list"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{
                            duration: 0.22,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          className="overflow-hidden rounded-2xl border border-(--color-border-soft) bg-(--color-surface) shadow-sm"
                        >
                          {paginatedItems.map((item, i) => (
                            <div
                              key={item.node?.slug || item.node?.id || i}
                              data-focused-card={
                                focusedCardIndex === i ? "true" : undefined
                              }
                              className={
                                focusedCardIndex === i
                                  ? "ring-2 ring-primary ring-inset"
                                  : ""
                              }
                            >
                              <AnimeRow
                                node={item.node}
                                ranking={
                                  tab === "browse"
                                    ? item.ranking?.rank
                                    : undefined
                                }
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
                      <MediaEmptyState
                        accent="anime"
                        title="No anime to display"
                        message="Try a different tab, filter, or search query."
                      />
                    )
                  )}

                  {/* Pagination */}
                  {pager && paginatedItems.length > 0 && (
                    <MediaPager
                      page={pager.page}
                      canPrev={pager.canPrev}
                      canNext={pager.canNext}
                      onPage={goToPage}
                    />
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
