# LifeSyncManga Mobile Glassmorphism View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `LifeSyncManga.jsx` a genuinely separate mobile view — stacked single-column layout, bottom-sheet filters, swipeable source tabs, glassmorphic surfaces — rendered from the same file and sharing all existing state/handlers, switched by a new `useIsMobile()` hook.

**Architecture:** The existing component keeps every `useState`/`useEffect`/callback unchanged. Its single `return (...)` (currently ~line 2826) becomes `return isMobile ? <MobileTree/> : <DesktopTree/>`, where both trees are defined in the same file so the mobile tree closes over the same locals (`source`, `selectedManga`, `goToList`, `goToMangaDetail`, `handleStartRead`, `route`, filter state, etc.) without a prop-drilling interface. A new shared `useIsMobile()` hook and a new `BottomSheet` component (modeled 1:1 on the existing `FilterDrawer`'s prop shape, so source-specific filter bodies drop in unchanged) are the two reusable pieces this and future pages depend on.

**Tech Stack:** React 18, react-router-dom, framer-motion (`motion` re-exported as `MotionDiv`/`AnimatePresence` from `src/lib/lifesyncMotion.js`), Tailwind v4 (CSS custom-property tokens, no `tailwind.config.js`).

## Global Constraints

- No new dependencies — framer-motion (`^12.42.2`, already installed) covers drag-to-dismiss via `drag="y"` + `dragConstraints` + `onDragEnd`; no gesture library needed.
- Reuse existing `--color-*` tokens and `bg-primary` (`#c6ff00`). No new CSS variables, no new palette. (Spec: `docs/superpowers/specs/2026-07-08-lifesync-mobile-glassmorphism-design.md`.)
- Solid `bg-primary` elements stay opaque with dark ink text (`text-(--color-ink-strong)` or `text-black`) — never apply glass/translucency or light text to them (project memory: `feedback-primary-button-contrast`).
- Touch targets ≥44×44px, ≥8px spacing between adjacent tappable elements.
- Reuse existing motion transitions from `src/lib/lifesyncMotion.js` (e.g. `lifeSyncDetailOverlayFadeTransition`) — do not invent new duration/easing constants for the sheet.
- `useIsMobile()` must be SSR-safe: default to desktop (`false`) before mount, update via `matchMedia` on mount, breakpoint `(max-width: 767px)`.
- Games pages, desktop layout changes beyond adding the conditional branch, and TV mode are out of scope — do not touch them.
- Tailwind v4 canonical classes only (e.g. `h-11` not `h-[44px]`) per project style rules.
- **No test framework exists in this project** (`package.json` has no `test` script, no Vitest/Jest, no `@testing-library/react`). Do not add one for this plan — verify behavior manually via the dev server instead of writing `.test.js` files. This overrides any "write the failing test" step below that assumes a test runner.

---

## File Structure

- Create: `src/hooks/useIsMobile.js` — shared hook, used by this page and every later page in the queue.
- Modify: `src/pages/lifesync/LifeSyncManga.jsx` — add `BottomSheet` component (near existing `FilterDrawer`, ~line 92), add mobile JSX tree, branch the final `return`.

No other files change. `MediaPageChrome.jsx`, `MangaCard`, `MangaDetail`, `MangaPagerFooter` are reused as-is in the mobile tree.

---

### Task 1: `useIsMobile` shared hook

**Files:**
- Create: `src/hooks/useIsMobile.js`

**Interfaces:**
- Produces: `useIsMobile(): boolean` — default export named `useIsMobile`, no arguments, returns `true` when viewport matches `(max-width: 767px)`, else `false`. Every later page task imports this exact name/signature from `src/hooks/useIsMobile.js`.

- [ ] **Step 1: Write the implementation**

This project has no test framework installed (no Vitest/Jest, no `@testing-library/react`, no `test` script in `package.json`) — do not add one. Write the hook directly:

```javascript
import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 767px)";

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
```

- [ ] **Step 2: Verify manually via a temporary render**

Since there's no test runner, confirm the hook works by temporarily importing and logging it from any already-mounted component (e.g. add `console.log(useIsMobile())` inside `LifeSyncManga`'s body right after its other hook calls — do not commit this line, it's throwaway verification), running `npm run dev`, opening the LifeSyncManga page, and resizing the browser across 767px while watching the console log flip between `true`/`false`. Remove the temporary log line before committing.
Expected: log value is `false` above 767px width, `true` at or below it, and updates live on resize without a page reload.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useIsMobile.js
git commit -m "feat: add useIsMobile hook for mobile-specific LifeSync views"
```

---

### Task 2: `BottomSheet` component

**Files:**
- Modify: `src/pages/lifesync/LifeSyncManga.jsx` (add new component after the existing `FilterDrawer`, currently ending at line 181)

**Interfaces:**
- Consumes: `MotionDiv`, `AnimatePresence`, `lifeSyncDetailOverlayFadeTransition`, `createPortal` (all already imported in this file).
- Produces: `BottomSheet({ open, onClose, title, count, onReset, children })` — same prop names/shapes as the existing `FilterDrawer`, so any `<FilterDrawer ...>` call in the mobile tree can become `<BottomSheet ...>` with identical props. Rendered via `createPortal` to `document.body`.

- [ ] **Step 1: Add the `BottomSheet` component**

Insert directly after the `FilterDrawer` function (after line 181, before the `MangaPagerFooter` comment at line 183) in `src/pages/lifesync/LifeSyncManga.jsx`:

```javascript
/**
 * Mobile filter sheet — slides up from the bottom, drag-to-dismiss.
 * Same prop shape as `FilterDrawer` so source-specific filter bodies
 * (Roliascan/MangaDistrict/MangaDNA panels) pass through unchanged.
 */
function BottomSheet({ open, onClose, title, count, onReset, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <MotionDiv
          className="fixed inset-0 z-9997 flex items-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={lifeSyncDetailOverlayFadeTransition}
        >
          <MotionDiv
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <MotionDiv
            className="relative flex max-h-[85dvh] w-full flex-col rounded-t-3xl bg-(--color-surface)/70 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose?.();
            }}
          >
            <div className="mx-auto mt-2.5 h-1.25 w-10 shrink-0 rounded-full bg-(--color-border-strong)" />
            <div className="flex shrink-0 items-center justify-between gap-3 px-5 py-4">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="truncate text-[15px] font-black text-(--color-text-primary)">
                  {title}
                </h2>
                {count > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-black tabular-nums text-(--color-ink-strong)">
                    {count}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {count > 0 && onReset && (
                  <button
                    type="button"
                    onClick={onReset}
                    className="min-h-11 rounded-lg border border-(--color-border-soft) px-2.5 text-[11px] font-semibold text-(--color-text-secondary) transition hover:bg-(--color-surface-muted) hover:text-(--color-text-primary)"
                  >
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close filters"
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-(--color-text-secondary) transition hover:bg-(--color-surface-muted) hover:text-(--color-text-primary)"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="2.5"
                    aria-hidden
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
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
              {children}
            </div>
          </MotionDiv>
        </MotionDiv>
      )}
    </AnimatePresence>,
    document.body,
  );
}
```

- [ ] **Step 2: Verify the file still builds**

Run: `npm run build` (or `npm run dev` and check the browser console for compile errors)
Expected: no new errors introduced (pre-existing lint warnings noted in project memory are fine; zero new errors/warnings from this change)

- [ ] **Step 3: Commit**

```bash
git add src/pages/lifesync/LifeSyncManga.jsx
git commit -m "feat: add BottomSheet component for mobile filter UI"
```

---

### Task 3: Mobile JSX tree — header, source switcher, search/filter bar

**Files:**
- Modify: `src/pages/lifesync/LifeSyncManga.jsx`

**Interfaces:**
- Consumes: locals already in scope in the component body — `source`, `fromHome`, `navigate`, `hManhwaEnabled`, `error`, `roliascanSearchQ`, `setRoliascanSearchQ`, `roliascanFiltersOpen`, `setRoliascanFiltersOpen`, `roliascanFilterBarCount`, `resetRoliascanFilters`, `handleRoliascanSearch`, `searchInputRef`, `mdFilter`/`dnaFilter` and their setters/search handlers (same names used in the desktop tree — reuse verbatim, do not rename).
- Produces: the opening JSX fragment for the mobile tree (header through search/filter bar), continued in Task 4.

This task builds the top portion of the mobile tree: stacked column, sticky glass header, single "Filters" trigger that opens a `BottomSheet` instead of the side `FilterDrawer`.

- [ ] **Step 1: Locate the exact insertion point**

```bash
grep -n "^  return (" src/pages/lifesync/LifeSyncManga.jsx
```

Confirm the line number of the main `return (` (originally 2826; re-check after Task 2's edit, since adding `BottomSheet` shifts line numbers down). This is the line to replace.

- [ ] **Step 2: Replace the `return (` line with a branch, and start the mobile tree**

Replace:

```javascript
  return (
    <LayoutGroup id="lifesync-manga">
```

With:

```javascript
  if (isMobile) {
    return (
      <div className="min-w-0 w-full max-w-full space-y-4 pb-24">
        <AnimatePresence mode="sync">
          {selectedManga ? (
            <MangaDetail
              key={`${selectedManga.source || source}-${selectedManga.id}`}
              manga={selectedManga}
              source={source}
              isLifeSyncConnected={isLifeSyncConnected}
              onClose={() => goToList({ replace: true })}
              onStartRead={handleStartRead}
              roliascanConnected={false}
              browseTranslatedLang={
                mangaEnglishReleasesOnly ? "en" : dexTranslatedLang
              }
            />
          ) : null}
        </AnimatePresence>

        <div
          className="sticky top-0 z-30 -mx-4 space-y-3 border-b border-(--color-border-soft)/60 bg-(--color-surface)/70 px-4 pb-3 pt-3 backdrop-blur-xl"
          style={{ pointerEvents: selectedManga ? "none" : undefined }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-bold text-(--color-text-secondary)">
                LifeSync · Reading
              </p>
              <h1 className="truncate text-[19px] font-black text-(--color-text-primary)">
                {source === "mangadistrict" || source === "mangadna"
                  ? "H Manhwa"
                  : "Manga"}
              </h1>
            </div>
            {fromHome && (
              <button
                type="button"
                onClick={() => navigate(fromHome)}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-(--color-surface)/80 px-3.5 text-[12px] font-bold text-(--color-text-primary) ring-1 ring-(--color-border-soft) backdrop-blur-sm"
              >
                <FaArrowLeft className="h-3 w-3" /> Home
              </button>
            )}
          </div>

          <div className="scrollbar-none -mx-1 flex snap-x snap-mandatory gap-1.5 overflow-x-auto px-1">
            {[
              { id: "roliascan", label: "Roliascan" },
              ...(hManhwaEnabled
                ? [
                    { id: "mangadna", label: "MangaDNA" },
                    { id: "mangadistrict", label: "H Manhwa" },
                  ]
                : []),
            ].map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() =>
                  navigate(
                    `${basePath}/${id}/${defaultTabForSource(id)}/page/1${location.search || ""}`,
                  )
                }
                aria-pressed={source === id}
                className={`min-h-11 shrink-0 snap-start rounded-xl px-4 text-[13px] font-bold transition-all ${
                  source === id
                    ? "bg-primary text-black shadow-sm"
                    : "bg-(--color-surface-muted)/70 text-(--color-text-secondary) ring-1 ring-(--color-border-soft) backdrop-blur-sm"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200/60 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-600 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}

          {source === "roliascan" && (
            <form
              onSubmit={handleRoliascanSearch}
              className="flex items-stretch gap-2"
            >
              <input
                ref={searchInputRef}
                type="search"
                value={roliascanSearchQ}
                onChange={(e) => setRoliascanSearchQ(e.target.value)}
                placeholder="Search Roliascan…"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-(--color-border-soft) bg-(--color-surface-muted)/70 px-4 text-[13px] text-(--color-text-primary) backdrop-blur-sm focus:border-primary/60 focus:bg-(--color-surface) focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setRoliascanFiltersOpen(true)}
                aria-expanded={roliascanFiltersOpen}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-(--color-border-soft) bg-(--color-surface-muted)/70 px-3.5 text-[13px] font-semibold text-(--color-text-primary) backdrop-blur-sm"
              >
                Filters
                {roliascanFilterBarCount > 0 && (
                  <span className="rounded-full bg-primary/35 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                    {roliascanFilterBarCount}
                  </span>
                )}
              </button>
            </form>
          )}
        </div>
```

Note: `mdFilter`/`dnaFilter` search rows for the other two sources follow the same pattern shown above for Roliascan — mirror them as sibling `{source === "mangadistrict" && (...)}` / `{source === "mangadna" && (...)}` blocks, reusing whatever input/filter-open state names the desktop tree already uses for those sources (check exact names via `grep -n "FiltersOpen" src/pages/lifesync/LifeSyncManga.jsx`). Do not introduce new state.

- [ ] **Step 3: Run the dev server and visually confirm the header/switcher/search bar render on a mobile viewport**

Run: `npm run dev`, open the page at `/dashboard/lifesync/anime/manga/roliascan/manga/page/1`, resize browser or use device toolbar to <768px width.
Expected: sticky glass header with title, horizontally scrollable source tabs, search bar with Filters button — no console errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/lifesync/LifeSyncManga.jsx
git commit -m "feat: add mobile header, source switcher, and search bar to LifeSyncManga"
```

---

### Task 4: Mobile JSX tree — bottom sheet filters, pager, grid, close branch

**Files:**
- Modify: `src/pages/lifesync/LifeSyncManga.jsx`

**Interfaces:**
- Consumes: the same locals as the desktop tree's filter panel bodies (all `roliascan*`/`md*`/`dna*` filter state — reuse the exact JSX bodies from inside the desktop `FilterDrawer` calls, unchanged, just re-parented under `BottomSheet`), `MangaPagerFooter`, `mangaGridLoading`, `currentItems`, `LifesyncMangaBrowseGridSkeleton`, `MediaEmptyState`, `MangaCard`, `openMangaFromCard`.
- Produces: closes the `if (isMobile) { return (...) }` branch opened in Task 3, followed immediately by the unchanged desktop `return (` continuing as before.

- [ ] **Step 1: Add `isMobile` to the component's local declarations and import the hook**

Near the top of the component body (alongside `const searchInputRef = useRef(null);`), add:

```javascript
  const isMobile = useIsMobile();
```

Add the import at the top of the file, alongside the other hook imports (e.g. near `import useControllerSupportEnabled from "../../hooks/useControllerSupportEnabled";`):

```javascript
import useIsMobile from "../../hooks/useIsMobile";
```

- [ ] **Step 2: Add the `BottomSheet` filter body, reusing the desktop filter panel content**

Immediately after the sticky header's closing `</div>` from Task 3, add:

```javascript
        <BottomSheet
          open={roliascanFiltersOpen}
          onClose={() => setRoliascanFiltersOpen(false)}
          title="Roliascan filters"
          count={roliascanFilterBarCount}
          onReset={resetRoliascanFilters}
        >
          {/* Copy the exact JSX children currently passed to the desktop
              <FilterDrawer> call for Roliascan (Sorting / Authors & Artists /
              Genres blocks) here, unchanged. */}
        </BottomSheet>
```

Find the exact content to copy:

```bash
grep -n "<FilterDrawer" src/pages/lifesync/LifeSyncManga.jsx
```

Copy each `<FilterDrawer>` call's children into a matching `<BottomSheet>` with the same `open`/`onClose`/`title`/`count`/`onReset` props, one per source that has a `FilterDrawer` in the desktop tree.

- [ ] **Step 3: Add pager + grid, then close the mobile branch**

```javascript
        <div className="px-4">
          {source === "mangadistrict" && !mdFilter.trim() && mdLatest && (
            <MangaPagerFooter
              page={mdCurPage}
              lastPage={mdLastPage}
              busy={busy}
              onPrev={() => goToPage(mdCurPage - 1)}
              onNext={() => goToPage(mdCurPage + 1)}
            />
          )}
          {source === "mangadna" && !dnaFilter.trim() && dnaLatest && (
            <MangaPagerFooter
              page={dnaCurPage}
              lastPage={dnaLastPage}
              busy={busy}
              onPrev={() => goToPage(dnaCurPage - 1)}
              onNext={() => goToPage(dnaCurPage + 1)}
            />
          )}
          {source === "roliascan" && (
            <MangaPagerFooter
              page={roliascanPage}
              lastPage={roliascanLastPage}
              total={roliascanTotal}
              busy={roliascanLoading}
              onPrev={() => goToPage(roliascanPage - 1)}
              onNext={() => goToPage(roliascanPage + 1)}
            />
          )}

          <AnimatePresence mode="wait">
            <MotionDiv
              key={source}
              className="min-w-0 max-w-full space-y-4"
              initial="initial"
              animate="animate"
              exit="exit"
              variants={lifeSyncSectionPresenceVariants}
              transition={lifeSyncSectionPresenceTransition}
            >
              {mangaGridLoading ? (
                <LifesyncMangaBrowseGridSkeleton />
              ) : currentItems.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 items-stretch">
                  {currentItems.map((manga, i) => (
                    <div key={`${manga.source || source}-${manga.id || i}`}>
                      <MangaCard
                        manga={{ ...manga, source: manga.source || source }}
                        onClick={openMangaFromCard}
                      />
                    </div>
                  ))}
                </div>
              ) : !busy ? (
                <MediaEmptyState
                  accent={source === "mangadistrict" ? "hmanhwa" : "manga"}
                  title="Nothing to show"
                  message="No manga to display."
                />
              ) : null}
            </MotionDiv>
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <LayoutGroup id="lifesync-manga">
```

The final `return (\n    <LayoutGroup id="lifesync-manga">` line is the original desktop tree already in the file — leave it in place immediately after the mobile branch's closing `}`, do not duplicate it.

Note: the mobile empty-state `message` is a single string rather than the desktop tree's per-source ternary chain — acceptable for mobile's progressive-disclosure goal (spec: "show less per screen"). Not a regression; if per-source messages are wanted later, extract the desktop ternary into a shared local computed once above the branch — not needed for this task.

- [ ] **Step 4: Run the dev server and manually verify both branches**

Run: `npm run dev`
- At ≥768px width: confirm the page renders exactly as before (desktop tree unchanged) — search, filters, grid, pager all still work.
- At <768px width: confirm sticky header, source tabs, search bar, tapping "Filters" opens the bottom sheet (slides up, backdrop blur; drag-down, Escape, or × closes it), pager and 2-column grid render, tapping a card opens `MangaDetail`.
Expected: no console errors in either mode; resizing the browser without reloading switches trees live (confirms the hook's `matchMedia` listener fires).

- [ ] **Step 5: Run the build and lint to confirm no regressions**

This project has no test suite (see Global Constraints) — use the build and lint as the regression check instead.

Run: `npm run build && npm run lint`
Expected: build succeeds; lint shows no NEW errors/warnings beyond the pre-existing ones already known in this file (see project memory `project-lifesync-ui-rework-2026` for the pre-existing baseline count) — this change only adds a conditional branch above the existing desktop `return`; the desktop tree's code is untouched.

- [ ] **Step 6: Commit**

```bash
git add src/pages/lifesync/LifeSyncManga.jsx
git commit -m "feat: add mobile filter sheet, pager, and grid to LifeSyncManga; branch render on useIsMobile"
```

---

## Self-Review Notes

- **Spec coverage:** container/view split via same-file branching ✓ (Task 3/4); `useIsMobile` hook ✓ (Task 1); glassmorphism frosted surfaces on existing tokens ✓ (Task 2/3, `bg-(--color-surface)/70 backdrop-blur-xl`); bottom sheet replacing side drawer ✓ (Task 2); stacked single-column layout ✓ (Task 3/4, 2-col grid vs desktop's 2–6 col); swipeable/scrollable source tabs ✓ (Task 3, `overflow-x-auto snap-x`); safe-area-aware sticky bar ✓ (Task 2, `env(safe-area-inset-bottom)`); ≥44px touch targets ✓ (all buttons `min-h-11`/`h-11`/`w-11`); solid primary button stays opaque dark-on-lime ✓ (active tab: `bg-primary text-black`, unchanged from desktop).
- **Deferred, per spec's non-goals:** desktop tree left identical except being moved under the `else` branch; no TV mode changes; no game page changes; no new color tokens.
- **Next page after this ships and is reviewed:** LifeSyncHentai (per `project-lifesync-mobile-glassmorphism` memory) — reuse `useIsMobile`; promote `BottomSheet` to a shared file (e.g. `src/components/lifesync/BottomSheet.jsx`) only if Hentai's structure needs it verbatim — decide at that page's planning time, not now (YAGNI).
