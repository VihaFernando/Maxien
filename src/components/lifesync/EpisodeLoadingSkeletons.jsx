import { useCallback, useState } from 'react'

/** Theme-aware grid matching `DetailWatchSection` episode cards. */
export function DetailWatchGridSkeleton({ count = 6, dark = false }) {
  const shimmer = dark ? 'lifesync-skeleton-shimmer-dark lifesync-shimmer-gloss-dark' : 'lifesync-skeleton-shimmer-light lifesync-shimmer-gloss-light'
  const cardClass = dark
    ? 'overflow-hidden rounded-[14px] border border-[var(--color-border-strong)]/12 bg-[var(--color-surface)]/[0.04] shadow-[0_12px_36px_rgba(0,0,0,0.35)]'
    : 'overflow-hidden rounded-[14px] border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafa)] shadow-sm'

  return (
    <div
      className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      aria-busy="true"
      aria-label="Loading episodes"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="lifesync-ep-grid-enter opacity-0"
          style={{ animationDelay: `${Math.min(i, 12) * 42}ms` }}
        >
          <div className={cardClass}>
            <div className="relative aspect-video w-full overflow-hidden">
              <div className={`${shimmer} absolute inset-0`} />
            </div>
            <div className="space-y-2 px-2 py-2.5">
              <div className={`h-2.5 w-[82%] rounded-md ${shimmer}`} />
              <div className={`h-2.5 w-[48%] rounded-md ${shimmer} opacity-85`} />
              <div className={`h-2 w-[34%] rounded-md ${shimmer} opacity-65`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Manga detail modal — chapter list rows (matches `MangaDetail` list layout). */
export function LifesyncMangaChapterListSkeleton({ rows = 8, dark = false }) {
  const shimmer = dark ? 'lifesync-skeleton-shimmer-dark lifesync-shimmer-gloss-dark' : 'lifesync-skeleton-shimmer-light lifesync-shimmer-gloss-light'
  const shellClass = dark
    ? 'overflow-hidden rounded-xl border border-[var(--color-border-strong)]/12 bg-[var(--color-surface)]/[0.03]'
    : 'overflow-hidden rounded-xl border border-[var(--mx-color-e5e5ea)]'
  const listClass = dark
    ? 'max-h-80 divide-y divide-white/10 overflow-hidden'
    : 'max-h-80 divide-y divide-[var(--mx-color-f0f0f0)] overflow-hidden'

  return (
    <div
      className={shellClass}
      aria-busy="true"
      aria-label="Loading chapters"
    >
      <ul className={listClass}>
        {Array.from({ length: rows }).map((_, i) => (
          <li
            key={i}
            className="flex items-center gap-3 px-3.5 py-2.5 lifesync-ep-grid-enter opacity-0"
            style={{ animationDelay: `${i * 38}ms` }}
          >
            <div className={`h-7 w-7 shrink-0 rounded-lg ${shimmer}`} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className={`h-3 w-[min(220px,72%)] rounded-md ${shimmer}`} />
              <div className={`h-2.5 w-[min(160px,48%)] rounded-md ${shimmer} opacity-80`} />
            </div>
            <div className={`h-3.5 w-3.5 shrink-0 rounded-sm ${shimmer} opacity-50`} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Hentai Ocean detail — episode picker grid (16:9 cards). */
export function LifesyncHentaiEpisodeGridSkeleton({ count = 6, dark = false }) {
  const n = Math.min(12, Math.max(1, count))
  const shimmer = dark ? 'lifesync-skeleton-shimmer-dark lifesync-shimmer-gloss-dark' : 'lifesync-skeleton-shimmer-light lifesync-shimmer-gloss-light'
  const cardClass = dark
    ? 'overflow-hidden rounded-[14px] border border-[var(--color-border-strong)]/12 bg-[var(--color-surface)]/[0.05] shadow-[0_12px_34px_rgba(0,0,0,0.34)]'
    : 'overflow-hidden rounded-[14px] border border-[var(--mx-color-d2d2d7)]/50 bg-[var(--color-surface)] shadow-sm'
  const mediaClass = dark
    ? 'relative aspect-video w-full overflow-hidden bg-black/35'
    : 'relative aspect-video w-full overflow-hidden bg-[var(--mx-color-fafafa)]'

  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-label="Loading episodes"
    >
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          className={`${cardClass} lifesync-ep-grid-enter opacity-0`}
          style={{ animationDelay: `${i * 44}ms` }}
        >
          <div className={mediaClass}>
            <div className={`${shimmer} absolute inset-0`} />
          </div>
          <div className="space-y-2 px-2 py-2.5">
            <div className={`h-2.5 w-[78%] rounded-md ${shimmer}`} />
            <div className={`h-2.5 w-[42%] rounded-md ${shimmer} opacity-80`} />
            <div className={`h-2 w-[28%] rounded-md ${shimmer} opacity-65`} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Dark fullscreen player area while stream URL resolves (Hentai Ocean, etc.). */
export function LifesyncStreamPlayerResolvingSkeleton() {
  return (
    <div
      className="relative flex h-full w-full min-h-[160px] flex-col items-center justify-center overflow-hidden bg-[var(--mx-color-111)]"
      aria-busy="true"
      aria-label="Resolving stream"
    >
      <div className="absolute inset-0">
        <div className="lifesync-skeleton-shimmer-dark lifesync-shimmer-gloss-dark absolute inset-0" />
      </div>
      <p className="relative z-10 text-[13px] text-white/50">Resolving stream…</p>
    </div>
  )
}

/** Full watch-page loading state (dark): player + episode rail + sidebar. */
export function WatchPageLoadSkeleton() {
  return (
    <div
      className="rounded-3xl border border-[var(--color-border-strong)]/10 bg-[var(--color-surface)]/6 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.55)] sm:p-6"
      aria-busy="true"
      aria-label="Loading watch session"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-[var(--color-border-strong)]/10 sm:h-12 sm:w-12">
          <div className="lifesync-skeleton-shimmer-dark lifesync-shimmer-gloss-dark absolute inset-0" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3.5 w-[min(220px,55%)] rounded-md lifesync-skeleton-shimmer-dark" />
          <div className="h-3 w-[min(280px,75%)] rounded-md lifesync-skeleton-shimmer-dark opacity-80" />
        </div>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-6">
        <div className="space-y-4">
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-[var(--color-border-strong)]/10 sm:rounded-3xl">
            <div className="lifesync-skeleton-shimmer-dark lifesync-shimmer-gloss-dark absolute inset-0" />
          </div>
          <div className="flex gap-1.5 overflow-hidden pb-1 lg:hidden">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-11 min-w-11 shrink-0 rounded-2xl border border-[var(--color-border-strong)]/10 lifesync-skeleton-shimmer-dark"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        </div>
        <div className="hidden min-h-[200px] overflow-hidden rounded-2xl border border-[var(--color-border-strong)]/10 lg:block">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border-strong)]/10 px-3 py-2.5">
            <div className="h-3 w-20 rounded-md lifesync-skeleton-shimmer-dark" />
            <div className="h-6 w-9 rounded-full border border-[var(--color-border-strong)]/10 lifesync-skeleton-shimmer-dark" />
          </div>
          <div className="space-y-2 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-2xl border border-[var(--color-border-strong)]/10 bg-black/20 px-2 py-2"
              >
                <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded-xl">
                  <div className="lifesync-skeleton-shimmer-dark lifesync-shimmer-gloss-dark absolute inset-0" />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="h-2.5 w-[70%] rounded-md lifesync-skeleton-shimmer-dark" />
                  <div className="h-2 w-[40%] rounded-md lifesync-skeleton-shimmer-dark opacity-80" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Portrait catalog card (manga / hentai series). */
export function LifesyncPortraitCardSkeleton({ className = '' }) {
  return (
    <div className={`overflow-hidden rounded-[18px] border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] shadow-sm ${className}`}>
      <div className="relative aspect-[2/3] w-full overflow-hidden">
        <div className="lifesync-skeleton-shimmer-light lifesync-shimmer-gloss-light absolute inset-0" />
      </div>
      <div className="space-y-2 p-3">
        <div className="h-3 w-[88%] rounded-md lifesync-skeleton-shimmer-light" />
        <div className="h-2.5 w-[55%] rounded-md lifesync-skeleton-shimmer-light opacity-80" />
      </div>
    </div>
  )
}

/** Manga browse grid — matches `LifeSyncManga` main grid. */
export function LifesyncMangaBrowseGridSkeleton({ count = 12 }) {
  return (
    <div
      className="grid grid-cols-2 gap-4 items-stretch sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
      aria-busy="true"
      aria-label="Loading manga"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="min-h-0 lifesync-ep-grid-enter opacity-0"
          style={{ animationDelay: `${Math.min(i, 18) * 32}ms` }}
        >
          <LifesyncPortraitCardSkeleton className="h-full" />
        </div>
      ))}
    </div>
  )
}

/** Hentai Ocean catalog grid. */
export function LifesyncHentaiCatalogGridSkeleton({ count = 12 }) {
  return (
    <div
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
      aria-busy="true"
      aria-label="Loading catalog"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="min-h-0 lifesync-ep-grid-enter opacity-0"
          style={{ animationDelay: `${Math.min(i, 18) * 28}ms` }}
        >
          <LifesyncPortraitCardSkeleton />
        </div>
      ))}
    </div>
  )
}

/** Steam library / store card shape. */
export function LifesyncSteamMediaCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[18px] border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] shadow-sm">
      <div className="relative aspect-video w-full overflow-hidden">
        <div className="lifesync-skeleton-shimmer-light lifesync-shimmer-gloss-light absolute inset-0" />
      </div>
      <div className="space-y-2 p-3">
        <div className="h-3 w-[78%] rounded-md lifesync-skeleton-shimmer-light" />
        <div className="h-2.5 w-[40%] rounded-md lifesync-skeleton-shimmer-light opacity-80" />
      </div>
    </div>
  )
}

export function LifesyncSteamLibraryGridSkeleton({ count = 6 }) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-label="Loading library"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="lifesync-ep-grid-enter opacity-0"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <LifesyncSteamMediaCardSkeleton />
        </div>
      ))}
    </div>
  )
}

/** Wishlist row (image + body). */
export function LifesyncWishlistRowSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-[18px] border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] shadow-sm sm:flex-row">
      <div className="relative aspect-video w-full shrink-0 overflow-hidden sm:aspect-auto sm:min-h-[120px] sm:w-[200px]">
        <div className="lifesync-skeleton-shimmer-light lifesync-shimmer-gloss-light absolute inset-0" />
      </div>
      <div className="flex flex-1 flex-col justify-center gap-2 p-4">
        <div className="h-3.5 w-[min(220px,70%)] rounded-md lifesync-skeleton-shimmer-light" />
        <div className="h-2.5 w-[min(160px,45%)] rounded-md lifesync-skeleton-shimmer-light opacity-80" />
        <div className="h-2.5 w-24 rounded-md lifesync-skeleton-shimmer-light opacity-70" />
      </div>
    </div>
  )
}

export function LifesyncWishlistListSkeleton({ count = 4 }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading wishlist">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="lifesync-ep-grid-enter opacity-0" style={{ animationDelay: `${i * 50}ms` }}>
          <LifesyncWishlistRowSkeleton />
        </div>
      ))}
    </div>
  )
}

/** Xbox Game Pass / deals tile (portrait poster). */
export function LifesyncXboxCatalogGridSkeleton({ gridClass, count = 12 }) {
  const cls = gridClass || 'grid gap-2.5 sm:gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
  return (
    <div className={cls} aria-busy="true" aria-label="Loading catalog">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative aspect-[2/3] w-full overflow-hidden rounded-[12px] border border-[var(--mx-color-e5e5ea)] sm:rounded-[14px] lifesync-ep-grid-enter opacity-0"
          style={{ animationDelay: `${Math.min(i, 20) * 25}ms` }}
        >
          <div className="lifesync-skeleton-shimmer-light lifesync-shimmer-gloss-light absolute inset-0" />
          <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-2.5 pt-10">
            <div className="h-2.5 w-[85%] rounded-md bg-black/25" />
            <div className="h-2 w-[50%] rounded-md bg-black/15" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function LifesyncXboxLibraryGridSkeleton({ count = 6 }) {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      aria-busy="true"
      aria-label="Loading games"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative aspect-[2/3] w-full overflow-hidden rounded-[14px] border border-[var(--mx-color-e5e5ea)] lifesync-ep-grid-enter opacity-0"
          style={{ animationDelay: `${i * 35}ms` }}
        >
          <div className="lifesync-skeleton-shimmer-light lifesync-shimmer-gloss-light absolute inset-0" />
          <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-2.5 pt-12">
            <div className="h-2.5 w-[80%] rounded-md bg-black/20" />
            <div className="h-2 w-[55%] rounded-md bg-black/12" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function LifesyncXboxProfileSkeleton() {
  return (
    <div
      className="flex flex-col items-center gap-4 rounded-[20px] border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafa)] p-5 sm:flex-row sm:items-center"
      aria-busy="true"
      aria-label="Loading profile"
    >
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-[var(--mx-color-e5e5ea)]">
        <div className="lifesync-skeleton-shimmer-light lifesync-shimmer-gloss-light absolute inset-0" />
      </div>
      <div className="w-full min-w-0 flex-1 space-y-2 text-center sm:text-left">
        <div className="mx-auto h-4 w-[min(200px,60%)] rounded-md lifesync-skeleton-shimmer-light sm:mx-0" />
        <div className="mx-auto h-2.5 w-[min(140px,40%)] rounded-md lifesync-skeleton-shimmer-light opacity-80 sm:mx-0" />
        <div className="flex justify-center gap-2 pt-1 sm:justify-start">
          <div className="h-6 w-20 rounded-full lifesync-skeleton-shimmer-light" />
          <div className="h-6 w-16 rounded-full lifesync-skeleton-shimmer-light opacity-80" />
        </div>
      </div>
    </div>
  )
}

export function LifesyncAchievementRowsSkeleton({ rows = 5 }) {
  return (
    <ul className="divide-y divide-[var(--mx-color-e5e5ea)]">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex gap-3 px-3 py-2.5">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-[var(--mx-color-e5e5ea)]">
            <div className="lifesync-skeleton-shimmer-light absolute inset-0" />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5 py-0.5">
            <div className="h-3 w-[72%] rounded-md lifesync-skeleton-shimmer-light" />
            <div className="h-2.5 w-full max-w-[200px] rounded-md lifesync-skeleton-shimmer-light opacity-75" />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function LifesyncAchievementPanelSkeleton() {
  return (
    <div className="overflow-hidden rounded-[18px] border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] shadow-sm" aria-busy="true" aria-label="Loading achievements">
      <div className="border-b border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafa)] px-4 py-3">
        <div className="h-2 w-24 rounded-md lifesync-skeleton-shimmer-light opacity-70" />
        <div className="mt-2 h-4 w-[min(220px,70%)] rounded-md lifesync-skeleton-shimmer-light" />
        <div className="mt-3 h-2 w-full max-w-xs rounded-full bg-[var(--mx-color-e5e5ea)]">
          <div className="h-full w-[33%] rounded-full lifesync-skeleton-shimmer-light" />
        </div>
      </div>
      <LifesyncAchievementRowsSkeleton />
    </div>
  )
}

/** Manga chapter reader (dark) while pages fetch. */
export function LifesyncChapterPagesSkeleton({ bars = 4 }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 px-3 py-6" aria-busy="true" aria-label="Loading pages">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="relative w-full overflow-hidden rounded-lg border border-[var(--color-border-strong)]/10 lifesync-ep-grid-enter opacity-0"
          style={{
            animationDelay: `${i * 72}ms`,
            aspectRatio: '3 / 4',
            maxHeight: i === 0 ? '70vh' : '62vh',
          }}
        >
          <div className="lifesync-skeleton-shimmer-dark lifesync-shimmer-gloss-dark absolute inset-0" />
        </div>
      ))}
    </div>
  )
}

/** Horizontal manga rail placeholders (hub + shelf). */
export function LifesyncMangaRailSkeleton({ count = 5, compact = false }) {
  const w = compact ? 'w-[92px]' : 'w-[148px] sm:w-[164px]'
  const h = compact ? 'h-[138px]' : 'h-[200px] sm:h-[220px]'
  return (
    <div className="flex gap-3 overflow-hidden pb-1" aria-busy="true" aria-label="Loading titles">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`shrink-0 ${w} ${h} overflow-hidden rounded-[18px] border border-[var(--mx-color-e5e5ea)] lifesync-ep-grid-enter opacity-0`}
          style={{ animationDelay: `${i * 45}ms` }}
        >
          <div className="lifesync-skeleton-shimmer-light lifesync-shimmer-gloss-light h-full w-full" />
        </div>
      ))}
    </div>
  )
}

/** Hub rail: small covers + title lines (matches `AnimeHubWatchingRail` / hub manga link widths). */
export function LifesyncHubMangaRailSkeleton({ count = 4 }) {
  return (
    <div className="flex max-w-full min-w-0 gap-3 overflow-hidden px-4 py-4 sm:px-5" aria-busy="true" aria-label="Loading reading list">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-[112px] shrink-0 sm:w-[118px] lifesync-ep-grid-enter opacity-0" style={{ animationDelay: `${i * 50}ms` }}>
          <div className="overflow-hidden rounded-2xl border border-[var(--mx-color-e5e5ea)] shadow-sm ring-1 ring-slate-200/80">
            <div className="relative aspect-[2/3] w-full">
              <div className="lifesync-skeleton-shimmer-light lifesync-shimmer-gloss-light absolute inset-0" />
            </div>
          </div>
          <div className="mt-1.5 space-y-1 px-0.5">
            <div className="h-2 w-full rounded-md lifesync-skeleton-shimmer-light" />
            <div className="h-2 w-[80%] rounded-md lifesync-skeleton-shimmer-light opacity-80" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** One library shelf card: portrait + reading status + chapter info + actions (manga library cards). */
function LifesyncLibraryShelfCardSkeleton() {
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[var(--color-surface)] shadow-sm">
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-slate-100">
        <div className="lifesync-skeleton-shimmer-light lifesync-shimmer-gloss-light absolute inset-0" />
      </div>
      <div className="flex flex-1 flex-col gap-2 border-t border-slate-100 px-3 pb-2 pt-3">
        {/* Reading Status & Progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-[10px]">
            <div className="h-2 w-16 rounded-md lifesync-skeleton-shimmer-light opacity-70" />
            <div className="h-2 w-8 rounded-md lifesync-skeleton-shimmer-light opacity-70" />
          </div>
          <div className="h-1.5 w-full rounded-full lifesync-skeleton-shimmer-light opacity-70" />
          <div className="h-2 w-24 rounded-md lifesync-skeleton-shimmer-light opacity-50" />
        </div>

        {/* Chapter Info Compact */}
        <div className="flex gap-2 text-[9px]">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="h-2 w-12 rounded-md lifesync-skeleton-shimmer-light opacity-60" />
            <div className="h-2 w-full rounded-md lifesync-skeleton-shimmer-light opacity-70" />
            <div className="h-1.5 w-16 rounded-md lifesync-skeleton-shimmer-light opacity-50" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="h-2 w-10 rounded-md lifesync-skeleton-shimmer-light opacity-60" />
            <div className="h-2 w-full rounded-md lifesync-skeleton-shimmer-light opacity-70" />
            <div className="h-1.5 w-14 rounded-md lifesync-skeleton-shimmer-light opacity-50" />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <div className="h-8 rounded-lg lifesync-skeleton-shimmer-light opacity-75" />
          <div className="h-8 rounded-lg lifesync-skeleton-shimmer-light opacity-70" />
        </div>
      </div>
    </div>
  )
}

/**
 * Full library/history layout: sticky sidebar + optional spotlight band + 2–4 column grid.
 * Matches `LifeSyncMangaLibrary` / `LifeSyncAnimeHistory`.
 */
export function LifesyncMediaLibraryPageSkeleton({ gridCount = 8, showSpotlight = true, spotlightHistoryRows = 2 }) {
  const n = Math.min(12, Math.max(4, gridCount))
  return (
    <div
      className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8"
      aria-busy="true"
      aria-label="Loading shelf"
    >
      <aside className="w-full lg:w-[min(100%,280px)] lg:shrink-0">
        <div className="space-y-4 rounded-3xl border border-slate-200/80 bg-[var(--color-surface)]/80 p-5 shadow-[0_8px_30px_-12px_rgba(21, 20, 24,0.12)] ring-1 ring-[var(--color-border-strong)]/60">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 shrink-0 rounded-2xl lifesync-skeleton-shimmer-light" />
            <div className="min-w-0 flex-1 space-y-2 pt-0.5">
              <div className="h-2 w-20 rounded-md lifesync-skeleton-shimmer-light opacity-70" />
              <div className="h-5 w-[78%] rounded-md lifesync-skeleton-shimmer-light" />
            </div>
          </div>
          <div className="h-3 w-full max-w-[240px] rounded-md lifesync-skeleton-shimmer-light opacity-55" />
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2 rounded-2xl bg-slate-50/90 py-3 ring-1 ring-slate-100">
                <div className="mx-auto h-5 w-7 rounded-md lifesync-skeleton-shimmer-light" />
                <div className="mx-auto h-2 w-11 rounded-md lifesync-skeleton-shimmer-light opacity-65" />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="h-[42px] w-full rounded-2xl lifesync-skeleton-shimmer-light" />
            <div className="h-[42px] w-full rounded-2xl lifesync-skeleton-shimmer-light opacity-85" />
          </div>
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <div className="h-2 w-14 rounded lifesync-skeleton-shimmer-light opacity-50" />
            <div className="flex flex-wrap gap-1.5">
              <div className="h-7 w-14 rounded-full lifesync-skeleton-shimmer-light" />
              <div className="h-7 w-20 rounded-full lifesync-skeleton-shimmer-light opacity-85" />
              <div className="h-7 w-16 rounded-full lifesync-skeleton-shimmer-light opacity-75" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-2 w-10 rounded lifesync-skeleton-shimmer-light opacity-50" />
            <div className="flex rounded-xl border border-slate-200 bg-slate-50/80 p-1">
              <div className="h-8 flex-1 rounded-lg lifesync-skeleton-shimmer-light opacity-70" />
              <div className="h-8 flex-1 rounded-lg lifesync-skeleton-shimmer-light opacity-50" />
            </div>
          </div>
          <div className="h-10 w-full rounded-xl border border-slate-200 bg-[var(--color-surface)] lifesync-skeleton-shimmer-light opacity-60" />
        </div>
      </aside>
      <div className="min-w-0 flex-1 space-y-5">
        {showSpotlight ? (
          <div className="rounded-3xl border border-amber-200/70 bg-[var(--color-surface)] p-4 shadow-[0_12px_40px_-14px_rgba(180,140,60,0.14)] ring-1 ring-amber-100/50 sm:p-5">
            <div className="flex flex-col gap-4 border-l-[6px] border-l-amber-400/80 pl-3 sm:flex-row sm:items-stretch sm:gap-6 sm:pl-4">
              <div className="hidden h-11 w-11 shrink-0 rounded-2xl lifesync-skeleton-shimmer-light sm:block" />
              <div className="mx-auto h-[196px] w-[128px] shrink-0 overflow-hidden rounded-2xl ring-2 ring-amber-200/50 sm:mx-0 sm:h-[218px] sm:w-[146px]">
                <div className="lifesync-skeleton-shimmer-light lifesync-shimmer-gloss-light h-full w-full" />
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="h-2 w-28 rounded-md lifesync-skeleton-shimmer-light opacity-55" />
                <div className="h-6 max-w-md rounded-md lifesync-skeleton-shimmer-light" />
                <div className="h-3 w-36 rounded-md lifesync-skeleton-shimmer-light opacity-65" />
                <div className="space-y-2.5 pl-3 pt-1">
                  {Array.from({ length: spotlightHistoryRows }).map((_, i) => (
                    <div key={i} className="h-3 w-44 rounded-md lifesync-skeleton-shimmer-light" />
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <div className="h-11 min-w-[140px] flex-1 rounded-2xl lifesync-skeleton-shimmer-light sm:max-w-[220px]" />
                  <div className="h-11 w-24 rounded-2xl lifesync-skeleton-shimmer-light opacity-75" />
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: n }).map((_, i) => (
            <div
              key={i}
              className="min-w-0 lifesync-ep-grid-enter opacity-0"
              style={{ animationDelay: `${Math.min(i, 12) * 38}ms` }}
            >
              <LifesyncLibraryShelfCardSkeleton />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Anime browse lists (`LifeSyncAnime` seasonal / ranking / search) — poster + title overlay strip. */
export function LifesyncAnimeCatalogGridSkeleton({ count = 12 }) {
  const n = Math.min(18, Math.max(6, count))
  return (
    <div
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
      aria-busy="true"
      aria-label="Loading anime"
    >
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          className="min-h-0 min-w-0 lifesync-ep-grid-enter opacity-0"
          style={{ animationDelay: `${Math.min(i, 18) * 28}ms` }}
        >
          <div className="overflow-hidden rounded-[18px] border border-[var(--mx-color-d2d2d7)]/50 bg-[var(--color-surface)] shadow-sm">
            <div className="relative aspect-[2/3] w-full overflow-hidden bg-[var(--mx-color-f5f5f7)]">
              <div className="lifesync-skeleton-shimmer-light lifesync-shimmer-gloss-light absolute inset-0" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 space-y-1.5 bg-gradient-to-t from-black/55 via-black/20 to-transparent p-3 pt-10">
                <div className="h-2.5 w-[92%] rounded-md bg-[var(--color-surface)]/30" />
                <div className="h-2 w-[40%] rounded-md bg-[var(--color-surface)]/22" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** My List rows (`LifeSyncAnime` mylist tab). */
export function LifesyncMyListGridSkeleton({ count = 6 }) {
  const n = Math.min(9, Math.max(3, count))
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading my list">
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          className="flex gap-3 rounded-[18px] border border-[var(--mx-color-d2d2d7)]/50 bg-[var(--color-surface)] p-3 shadow-sm lifesync-ep-grid-enter opacity-0"
          style={{ animationDelay: `${i * 42}ms` }}
        >
          <div className="h-[92px] w-[64px] shrink-0 overflow-hidden rounded-xl bg-[var(--mx-color-f5f5f7)]">
            <div className="lifesync-skeleton-shimmer-light lifesync-shimmer-gloss-light h-full w-full" />
          </div>
          <div className="min-w-0 flex-1 space-y-2 py-0.5">
            <div className="h-3 w-[90%] rounded-md lifesync-skeleton-shimmer-light" />
            <div className="h-6 w-[5.5rem] rounded-full lifesync-skeleton-shimmer-light opacity-80" />
            <div className="h-2.5 w-32 rounded-md lifesync-skeleton-shimmer-light opacity-60" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Theme-aware description lines (modal / detail). */
export function LifesyncTextLinesSkeleton({ lines = 3, dark = false }) {
  const widths = ['100%', '95%', '72%']
  const shimmer = dark ? 'lifesync-skeleton-shimmer-dark lifesync-shimmer-gloss-dark' : 'lifesync-skeleton-shimmer-light lifesync-shimmer-gloss-light'
  return (
    <div className="space-y-2 py-1" aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-2.5 rounded-md ${shimmer}`}
          style={{ width: widths[i] || '60%' }}
        />
      ))}
    </div>
  )
}

/**
 * Inner image + shimmer; remounted when `effective` URL changes so load state resets without effects.
 */
function LifesyncEpisodeThumbnailInner({
  effective,
  alt,
  imgClassName,
  imgProps,
  dark,
  children,
}) {
  const [loaded, setLoaded] = useState(false)
  const propOnLoad = imgProps?.onLoad
  const propOnError = imgProps?.onError
  const restImgProps = { ...imgProps }
  if (propOnLoad) delete restImgProps.onLoad
  if (propOnError) delete restImgProps.onError

  const onLoad = useCallback(
    (e) => {
      if (typeof propOnLoad === 'function') propOnLoad(e)
      setLoaded(true)
    },
    [propOnLoad]
  )
  const onError = useCallback(
    (e) => {
      if (typeof propOnError === 'function') propOnError(e)
      setLoaded(true)
    },
    [propOnError]
  )
  const shimmer = dark ? 'lifesync-skeleton-shimmer-dark lifesync-shimmer-gloss-dark' : 'lifesync-skeleton-shimmer-light lifesync-shimmer-gloss-light'

  return (
    <>
      {!loaded ? <div className={`absolute inset-0 z-1 ${shimmer}`} aria-hidden /> : null}
      <img
        src={effective}
        alt={alt}
        onLoad={onLoad}
        onError={onError}
        loading="lazy"
        referrerPolicy="no-referrer"
        className={`h-full w-full object-cover transition-opacity duration-500 ease-out ${loaded ? 'opacity-100' : 'opacity-0'} ${imgClassName}`}
        {...restImgProps}
      />
      {children}
    </>
  )
}

/**
 * Thumbnail with shimmer until `src` finishes loading (or errors).
 * @param {{
 *   src?: string | null
 *   poster?: string | null
 *   alt?: string
 *   className?: string
 *   imgClassName?: string
 *   dark?: boolean
 *   imgProps?: Record<string, unknown>
 *   children?: import('react').ReactNode
 * }} props
 */
export function LifesyncEpisodeThumbnail({
  src,
  poster,
  alt = '',
  className = '',
  imgClassName = '',
  imgProps = {},
  dark = false,
  children,
}) {
  const raw = typeof src === 'string' && src.trim() ? src.trim() : ''
  const fall = typeof poster === 'string' && poster.trim() ? poster.trim() : ''
  const effective = raw || fall

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {effective ? (
        <LifesyncEpisodeThumbnailInner
          key={effective}
          effective={effective}
          alt={alt}
          imgClassName={imgClassName}
          imgProps={imgProps}
          dark={dark}
        >
          {children}
        </LifesyncEpisodeThumbnailInner>
      ) : (
        <>
          <div
            className={`flex h-full w-full items-center justify-center ${dark ? 'bg-[var(--color-surface)]/6 text-white/25' : 'bg-apple-bg text-apple-subtext'}`}
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          {children}
        </>
      )}
    </div>
  )
}
