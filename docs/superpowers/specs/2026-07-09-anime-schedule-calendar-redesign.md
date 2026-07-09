# Anime Schedule & Calendar redesign

Date: 2026-07-09
Status: Approved, ready for implementation

## Context

Two LifeSync anime pages get a visual/UX redesign:

- `src/pages/lifesync/LifeSyncAnimeSchedule.jsx` — weekly day-by-day episode schedule
- `src/pages/lifesync/LifeSyncAnimeCalendar.jsx` — month calendar with a day-detail overlay

Both currently render a flat grid-of-posters-by-day (Schedule) or a dense 3-column modal (Calendar day overlay). Approved mockups:

- Schedule timeline + episode popup: https://claude.ai/code/artifact/34c9620a-177a-4d45-9e57-b598fc99e334
- Calendar month grid + day sheet: https://claude.ai/code/artifact/bc2982e8-b0d0-49dc-a49e-bf4786653b1f

**Scope boundary:** visual/UX redesign only. `LifeSyncAnimeCalendar.jsx` has ~40+ hardcoded light-only hex colors (a slate/blue palette, not even the app's `mx-color` system) that render incorrectly in dark mode — fixing that is explicitly OUT of scope for this pass (user decision). Keep using the existing raw hex values already in that file rather than introducing new ones, to avoid quietly expanding scope; do not migrate them to `--color-*` tokens as part of this work.

This is separate from the ongoing `project-lifesync-mobile-glassmorphism` series — that series does targeted mobile-only glass treatments page by page; this is a full visual rework of these two specific pages (both mobile and desktop layout), not a glass pass.

## Design

### 1. Schedule page — timeline redesign

Replace the "2-col poster grid per day" body with a chronological timeline:

- Keep the existing day-pill selector row and page header as-is (already works well).
- Within the selected day, group entries into time-of-day bands: **Morning** (06:00–11:59), **Afternoon** (12:00–17:59), **Evening** (18:00–22:59), **Night** (23:00–05:59). Entries with no parseable air time go in an unlabeled trailing group (no band header), sorted last.
- A vertical rail (2px line) connects band dots down the left side of the timeline.
- Each band header: small dot on the rail + uppercase label + time range, sticky within the scroll container.
- Each entry is a horizontal row: air time (right-aligned, with timezone label under it) — poster thumbnail (40×56, episode-number badge) — title + status/track chips — trailing countdown (if upcoming) or a play-hint circle (if airing/aired).
- If the selected day is today, insert a **"Now" marker** — a lime dot + horizontal line + "Now · HH:MM" label — positioned between the bands that bracket the current time. Uses the existing `useCountdown`-style ticking logic already in the file (reuse, don't duplicate).
- Keep the "This Week" overview strip below the timeline (unchanged) and the empty/loading states (unchanged, restyle only if they visually clash).
- Tapping/clicking an entry opens the redesigned popup (see #2) instead of navigating directly.

Data mapping: band grouping and the "Now" marker both key off `entry.fullAirDateTime` (fallback to `airTime` string parsing) — same fields the page already reads, no new API calls.

### 2. Schedule page — episode detail popup

Replace `DetailDrawer` content (structure/mount/unmount logic stays — bottom sheet on mobile, centered modal on desktop, Escape-to-close, body-scroll-lock — all already correct) with a richer layout, using only fields already flowing through this page today (no synopsis/score/genre — not confirmed present on schedule entries):

- Larger poster (92×130) with episode-number badge, drop shadow, in a hero row beside the title.
- Title + status chip + sub/dub chip row. Close (✕) button top-right.
- Air-time card: date/time on the left ("Airs" label), prominent countdown on the right, subtle primary-tinted gradient background. Reuses `formatAirDateTime` / `CountdownDisplay` already defined in the file.
- 3-up meta stat row: Episode number / Release status / Sub-or-dub, each as its own small card.
- Actions: **Watch Now** (primary, full-width-ish) + **Close** (secondary), same handlers as today (`onWatch`, `onClose`).

### 3. Calendar page — month grid

Replace the current "up to 2 truncated text rows / dots" cell content with mini poster thumbnails:

- Each in-month day cell shows up to 3 small poster crops side by side (equal-width flex row) for that day's entries; a "+N" badge in the corner if more than 3.
- Pinned-day indicator becomes a small star badge top-left of the cell (only shown when the day has ≥1 pinned entry), replacing the current pinned-count pill.
- Today gets a lime ring + filled lime circle around the date number (already similar today — keep this treatment, adjust to match the new token/shape language).
- Out-of-month cells stay dimmed (opacity), same as today.
- Weekday header row, month nav (prev/next/Today/Refresh), and page header stay structurally the same — just visually tightened to match the new type/spacing scale.

### 4. Calendar page — day detail sheet

Replace the 3-column `DayOverlay` (controls sidebar / episode list / details panel) with a single-column bottom sheet:

- Sheet header: weekday+date eyebrow, "Today's schedule" (or date-relative) title, stat chips (episode count, pinned count).
- One scrollable list of that day's episodes: poster (42×58) — title — episode/time chips — a tap-to-pin star button on the right (pinned state = filled star + lime tint on the row).
- Dropped from this pass: the separate Filter & sort panel, the Priority Queue preview list, and the separate Details panel — pin/unpin is now inline per-row (tap the star), and tapping a row's title/poster area navigates straight to the anime detail page (same `openAnimeDetails` logic already in the file).
- Keep: Prev/Next day navigation (move into the sheet header as small arrow buttons), pin/unpin API calls (`pinOrUpdatePriority`/`unpin`, unchanged), search-driven navigation fallback (unchanged).
- Priority number picker (1–10 dropdown) is dropped from the inline row — pin defaults to priority 3 (existing default) on tap-to-pin; if a user wants to set a specific priority later, that's out of scope for this pass (simple star toggle only, matching the mockup).

## Non-goals

- No changes to API calls, data fetching, or the shapes of `days`/`pins`/`schedule` state.
- No dark-mode token migration on the Calendar page (tracked separately, not this pass).
- No changes to the mobile-glassmorphism page queue/series — these two pages are being reworked here instead, and should be considered done for that series' purposes once this ships (update `project-lifesync-mobile-glassmorphism` memory afterward).
- No new dependencies.
