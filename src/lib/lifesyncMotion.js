/**
 * Shared Framer Motion presets for LifeSync hub routes (pages + shell).
 * Matches legacy CSS `lifesync-ep-enter` (opacity + slight Y) and modal `slideUp`.
 */
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'

export { AnimatePresence, LayoutGroup }

/** Primitives (named exports satisfy ESLint `no-unused-vars` vs `motion.div` JSX). */
export const MotionDiv = motion.div
export const MotionSpan = motion.span
/** Sliding tab underline (`layoutId` must be unique per nav instance on screen). */
export const MotionUnderline = motion.span

/** @type {[number, number, number, number]} */
export const lifeSyncEaseOut = [0.16, 1, 0.3, 1]

export const lifeSyncPageTransition = {
    type: 'tween',
    duration: 0.38,
    ease: lifeSyncEaseOut,
}

export const lifeSyncPageVariants = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
}

/** Dolly-in on hub media pages: scale up + settle (camera-forward feel). */
export const lifeSyncDollyPageTransition = {
    type: 'tween',
    duration: 0.5,
    ease: lifeSyncEaseOut,
}

/** Hub page enter: fade + slide only (no scale  avoids large-layer compositing on big trees). */
export const lifeSyncDollyPageVariants = {
    initial: {
        opacity: 0,
        y: 18,
    },
    animate: {
        opacity: 1,
        y: 0,
    },
}

export const lifeSyncStaggerContainer = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.04,
            delayChildren: 0.03,
        },
    },
}

export const lifeSyncStaggerItem = {
    hidden: { opacity: 0, y: 6 },
    show: {
        opacity: 1,
        y: 0,
        transition: lifeSyncPageTransition,
    },
}

/** Dense manga-style grids: opacity stagger only (cheaper than per-card Y). */
export const lifeSyncStaggerItemFade = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: lifeSyncPageTransition,
    },
}

/** Dense grids (manga / large lists) */
export const lifeSyncStaggerContainerDense = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.022,
            delayChildren: 0.02,
        },
    },
}

/** Anime detail episode grid: short stagger + light motion (large lists stay snappy). */
export const lifeSyncStaggerEpisodeGrid = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.018,
            delayChildren: 0.015,
        },
    },
}

const lifeSyncSnappyTween = {
    type: 'tween',
    duration: 0.22,
    ease: lifeSyncEaseOut,
}

export const lifeSyncStaggerEpisodeGridItem = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: lifeSyncSnappyTween,
    },
}

export const lifeSyncModalSlideProps = {
    initial: { opacity: 0, y: 32 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
}

/** `layoutId` shared transitions: tween avoids per-frame spring solves on big hubs. */
export const lifeSyncSharedLayoutTransition = {
    type: 'tween',
    duration: 0.34,
    ease: lifeSyncEaseOut,
}

/**
 * Stable `transition` prop for poster `layoutId` nodes. Inlining `{ layout: … }` in JSX creates a
 * new object every render and makes Framer Motion re-reconcile layout transitions across large grids.
 */
export const lifeSyncSharedLayoutTransitionProps = {
    layout: lifeSyncSharedLayoutTransition,
}

const lifeSyncDetailSheetExitTween = {
    duration: 0.48,
    ease: lifeSyncEaseOut,
}

/** Detail modal inner sheet `exit` variant (anime / hentai / manga popups). */
export const lifeSyncDetailSheetExitVariant = {
    opacity: 0,
    y: 28,
    transition: lifeSyncDetailSheetExitTween,
}

const lifeSyncDetailSheetOpacityTween = {
    duration: 0.26,
    ease: lifeSyncEaseOut,
    delay: 0.04,
}

const lifeSyncDetailSheetEnterYTween = {
    duration: 0.38,
    ease: lifeSyncEaseOut,
    delay: 0.02,
}

export const lifeSyncDetailOverlayFadeTransition = {
    duration: 0.36,
    ease: lifeSyncEaseOut,
}

export const lifeSyncDetailBackdropFadeTransition = {
    duration: 0.4,
    ease: lifeSyncEaseOut,
}

/** Detail modal body block (e.g. hentai series body fade-in). */
export const lifeSyncDetailBodyRevealTransition = {
    duration: 0.36,
    ease: lifeSyncEaseOut,
    delay: 0.06,
}

/** Anime detail panel: scrollable content after hero. */
export const lifeSyncDetailAnimeContentRevealTransition = {
    duration: 0.28,
    ease: lifeSyncEaseOut,
    delay: 0.05,
}

/**
 * Above this many watch episodes, skip per-cell `MotionDiv` + stagger (large Framer subtree + many
 * stagger timers). One container fade keeps the grid cheap.
 */
export const lifeSyncEpisodeGridStaggerMaxItems = 24

/** Manga browse grid: above this, one container fade instead of per-card MotionDiv + stagger. */
export const lifeSyncBrowseGridStaggerMaxItems = 24

/** Tab / section panel cross-fade (use with `AnimatePresence mode="wait"`). */
export const lifeSyncSectionPresenceVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
}

export const lifeSyncSectionPresenceTransition = {
  duration: 0.22,
  ease: lifeSyncEaseOut,
}

/** Detail modal / sheet: smooth height when synopsis, list status, or episodes mount. */
export const lifeSyncDetailShellLayoutTransition = {
    type: 'tween',
    duration: 0.34,
    ease: lifeSyncEaseOut,
}

/** Detail modal white sheet: `layout` + enter opacity/y (stable reference; no scale). */
export const lifeSyncDetailSheetMainTransition = {
    layout: lifeSyncDetailShellLayoutTransition,
    opacity: lifeSyncDetailSheetOpacityTween,
    y: lifeSyncDetailSheetEnterYTween,
}

/** Shared enter targets for detail sheets (keep in sync with transition timings above). */
export const lifeSyncDetailSheetEnterInitial = { opacity: 0, y: 18 }
export const lifeSyncDetailSheetEnterAnimate = { opacity: 1, y: 0 }

/** Episode skeleton ↔ grid crossfade in detail watch section. */
export const lifeSyncEpisodeBlockPresenceTransition = {
    type: 'tween',
    duration: 0.2,
    ease: lifeSyncEaseOut,
}

/** Card scale-in for grid items  subtle pop with spring feel. */
export const lifeSyncCardEnterVariants = {
    hidden: { opacity: 0, scale: 0.92, y: 8 },
    show: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: { type: 'spring', stiffness: 300, damping: 28 },
    },
}

/** Stagger container tuned for card grids (slightly longer stagger than items). */
export const lifeSyncCardGridContainer = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.045,
            delayChildren: 0.04,
        },
    },
}

/** Slide-up + fade from below  used for hero text, drawer panels, stat blocks. */
export const lifeSyncSlideUpVariants = {
    hidden: { opacity: 0, y: 22 },
    show: {
        opacity: 1,
        y: 0,
        transition: { type: 'spring', stiffness: 280, damping: 26 },
    },
}

/** Hero image crossfade  slower, cinematic feel. */
export const lifeSyncHeroCrossfadeTransition = {
    duration: 0.72,
    ease: [0.22, 1, 0.36, 1],
}

/** Page-level spring enter  used when switching top-level routes. */
export const lifeSyncSpringPageTransition = {
    type: 'spring',
    stiffness: 240,
    damping: 28,
}

export const lifeSyncSpringPageVariants = {
    initial: { opacity: 0, y: 14, scale: 0.995 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -8, scale: 0.998 },
}

/** Stat counter block  used in history/library stats row. */
export const lifeSyncStatBlockContainer = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.09, delayChildren: 0.05 },
    },
}

export const lifeSyncStatBlockItem = {
    hidden: { opacity: 0, y: 16, scale: 0.9 },
    show: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { type: 'spring', stiffness: 320, damping: 24 },
    },
}

/** Enhanced page transition with scale effect  premium feel. */
export const lifeSyncPremiumPageTransition = {
    type: 'spring',
    stiffness: 260,
    damping: 32,
}

export const lifeSyncPremiumPageVariants = {
    initial: { opacity: 0, y: 12, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -12, scale: 0.98 },
}

/** Enhanced card hover with more pronounced effect. */
export const lifeSyncEnhancedCardHover = {
    y: -8,
    scale: 1.03,
    transition: { type: 'spring', stiffness: 450, damping: 24 },
}

/** Smooth fade-in for images with slight scale. */
export const lifeSyncImageFadeInVariants = {
    hidden: { opacity: 0, scale: 1.05 },
    show: {
        opacity: 1,
        scale: 1,
        transition: { duration: 0.5, ease: lifeSyncEaseOut },
    },
}

/** Stagger for manga/hentai thumbnails  faster for denser grids. */
export const lifeSyncImageGridContainer = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.028,
            delayChildren: 0.02,
        },
    },
}

export const lifeSyncImageGridItem = {
    hidden: { opacity: 0, scale: 0.95 },
    show: {
        opacity: 1,
        scale: 1,
        transition: { duration: 0.32, ease: lifeSyncEaseOut },
    },
}

/** Calendar cell stagger  very fast (0.005s) since 42 cells render at once. */
export const lifeSyncCalendarGridContainer = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.005, delayChildren: 0.01 },
    },
}

export const lifeSyncCalendarCellItem = {
    hidden: { opacity: 0, scale: 0.94 },
    show: {
        opacity: 1,
        scale: 1,
        transition: { type: 'spring', stiffness: 380, damping: 30 },
    },
}

/** Schedule day tab transition  pill slides with spring. */
export const lifeSyncTabPillSpring = {
    type: 'spring',
    stiffness: 420,
    damping: 36,
}

/** Drawer / bottom sheet spring enter. */
export const lifeSyncDrawerSpring = {
    type: 'spring',
    stiffness: 340,
    damping: 32,
}

/** Shimmer keyframe helper  returns inline style for a shimmer animation. */
export const lifeSyncShimmerStyle = {
    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
    backgroundSize: '200% 100%',
    animation: 'lifesync-shimmer 1.6s infinite',
}

/** Fade + scale down exit (used for removing list/grid items). */
export const lifeSyncItemExitVariants = {
    exit: {
        opacity: 0,
        scale: 0.94,
        x: -12,
        transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
    },
}

/** Horizontal rail item enter (slight scale + fade). */
export const lifeSyncRailItemVariants = {
    hidden: { opacity: 0, scale: 0.88, x: 8 },
    show: {
        opacity: 1,
        scale: 1,
        x: 0,
        transition: { type: 'spring', stiffness: 260, damping: 24 },
    },
}

export const lifeSyncRailContainer = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.04, delayChildren: 0.02 },
    },
}
