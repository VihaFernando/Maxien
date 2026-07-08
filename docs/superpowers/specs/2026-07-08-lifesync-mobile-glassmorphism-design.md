# LifeSync Mobile Glassmorphism Design

**Date:** 2026-07-08
**Status:** Approved

## Context

LifeSync pages (manga/hentai/anime media browsing) currently have one responsive JSX tree per page, using scattered `sm:hidden`/`lg:hidden` utility toggles for mobile. A prior project ([[project-lifesync-ui-rework-2026]]) reworked several pages desktop-first into a flat cinematic-dark system (neon-lime `bg-primary`, `--color-*` tokens, no glassmorphism, no `dark:` variants).

This project adds a genuinely separate mobile-specific layout per page, styled in glassmorphism — a deliberate, scoped exception to the existing "glassmorphism as default: banned" rule. Desktop and TV mode are explicitly **out of scope** here; a full-system glassmorphism conversion for desktop/TV is a separate follow-up project to be sequenced later.

## Goals

- Each LifeSync media page gets a distinct mobile view: different layout structure, navigation idioms, and density — not just responsive CSS tweaks on the same tree.
- Mobile views use glassmorphism (frosted/translucent surfaces, blur, layered depth) while keeping the existing color tokens and neon-lime brand accent.
- No duplication of data-fetching/business logic between desktop and mobile — only the presentational tree differs.

## Non-goals

- Desktop layout changes (beyond extracting existing JSX into a sibling component).
- TV mode (`LifeSyncTVMode.jsx`) changes.
- Game pages (`LifeSyncGame*`, `LifeSyncGamesHub`) — explicitly out of scope per existing lock.
- New color palette — reuses existing `--color-*` tokens and `bg-primary`.
- A global bottom tab bar / shared app shell — no such shell exists today; introducing one is a separate cross-cutting decision if desired later.

## Architecture

For each page in scope:

1. The existing page component (e.g. `LifeSyncManga.jsx`) keeps all its `useState`/`useEffect`/data-fetching/handlers unchanged, in the same file.
2. The final `return (...)` branches on a new shared hook — `src/hooks/useIsMobile.js` (`matchMedia('(max-width: 767px)')`-based, SSR-safe: defaults to desktop on first render, updates on mount) — into two JSX trees: the existing desktop tree, and a new mobile tree.
3. Both trees live in the **same file**, as sibling render functions/components defined alongside the main component (not separate sibling files). This lets the mobile tree close over the same local variables/handlers naturally instead of requiring a large, error-prone explicit prop interface — these pages have 50+ interdependent locals (route state, selection state, navigation callbacks, controller/gamepad hooks), and hand-listing them all as named props across a file boundary is a correctness risk, not a simplification.
4. No logic duplication, no separate route, no separate data fetching, regardless of file layout.

**Why same-file over separate-file:** confirmed during planning by reading `LifeSyncManga.jsx` — its JSX return (~974 lines) depends on 50+ locals defined in the ~1,300-line component body above it (e.g. `source`, `selectedManga`, `goToList`, `goToMangaDetail`, `handleStartRead`, `route`, gamepad/controller hooks). Splitting the mobile tree into a separate file would require passing all of these as explicit props, which is exactly the kind of large, brittle interface writing-plans and ponytail both flag as a smell. Colocating avoids it entirely.

## Page order

Same queue as the desktop rework, one page at a time, each reviewed before advancing:

1. LifeSyncManga
2. LifeSyncHentai
3. LifeSyncCategoryHub
4. LifeSyncAnimeHistory
5. LifeSyncMangaLibrary
6. LifeSyncMangaRead
7. LifeSyncAnimeWatch
8. LifeSyncAnimeSchedule
9. LifeSyncAnimeMediaLayout
10. LifeSyncAnimeCalendar

## Visual system (mobile only)

**Tokens:** unchanged. Same `--color-surface`, `--color-surface-muted`, `--color-text-primary/secondary`, `--color-border-soft/strong`, `--color-ink-strong`, `bg-primary` (`#c6ff00`). No new CSS variables, no new palette.

**Glassmorphism treatment:**
- Frosted panels: `bg-(--color-surface)/60 backdrop-blur-xl ring-1 ring-white/10` for cards, sheets, bars.
- Layered depth via subtle shadow + blur stacking, not flat opaque fills.
- Primary buttons keep dark-on-lime contrast per [[feedback-primary-button-contrast]] — glassmorphism does not apply to solid `bg-primary` elements (they stay solid/opaque for contrast and legibility).

**Layout structure:**
- Stacked single-column sections (not desktop's multi-column grid).
- Bottom sheets (slide up from bottom, drag-to-dismiss, frosted) replace the side `FilterDrawer` portal pattern used on desktop.
- Sticky frosted bottom action bar for primary actions (search/filter/sync), replacing desktop's top command bar.

**Navigation pattern:**
- Swipeable horizontal tabs for source/category switching where applicable.
- Thumb-reachable primary CTAs (bottom third of screen).
- Safe-area-aware fixed elements: `env(safe-area-inset-bottom)` padding on sticky bars.
- Predictable back behavior; no gesture conflicts with system back-swipe.

**Density & touch:**
- Touch targets ≥44×44px everywhere.
- ≥8px spacing between adjacent tappable elements.
- Larger heading scale than desktop's denser type.
- Progressive disclosure: show less per screen, expand on demand, instead of desktop's simultaneous density.

## Follow-up (separate project, not this scope)

- Convert desktop layouts to glassmorphism (reusing current structure, restyled).
- Convert TV mode (`LifeSyncTVMode.jsx`) to glassmorphism.
- Once both ship, update [[feedback-code-style]] to drop "glassmorphism as default: banned" or scope it down to whatever remains flat.

## Open questions resolved during brainstorming

- Mobile-detection mechanism: new shared hook, not per-page duplication.
- File split trigger: `LifeSyncManga.jsx` is already 3,800 lines; extraction into `XDesktopView`/`XMobileView` siblings applies to every page in scope, not just the large ones.
- Palette: multiple rounds of discussion landed on "keep existing tokens" — do not introduce the ui-ux-pro-max-suggested indigo/violet "Cinema Mobile" color scheme.
