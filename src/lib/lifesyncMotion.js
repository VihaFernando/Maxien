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

/** Hub page enter: fade + slide only (no scale — avoids large-layer compositing on big trees). */
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
