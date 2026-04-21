import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import AdvancedVideoPlayer from '../../components/lifesync/AdvancedVideoPlayer'
import { FadeInImg } from '../../components/lifesync/FadeInImg'
import {
    LifesyncEpisodeThumbnail,
    LifesyncHentaiCatalogGridSkeleton,
    LifesyncHentaiEpisodeGridSkeleton,
    LifesyncStreamPlayerResolvingSkeleton,
    LifesyncTextLinesSkeleton,
} from '../../components/lifesync/EpisodeLoadingSkeletons'
import { useLifeSync } from '../../context/LifeSyncContext'
import { lifesyncFetch, isPluginEnabled } from '../../lib/lifesyncApi'
import { AnimatePresence, LayoutGroup, lifeSyncDetailBackdropFadeTransition, lifeSyncDetailBodyRevealTransition, lifeSyncDetailOverlayFadeTransition, lifeSyncDetailSheetEnterAnimate, lifeSyncDetailSheetEnterInitial, lifeSyncDetailSheetExitVariant, lifeSyncDetailSheetMainTransition, lifeSyncDollyPageTransition, lifeSyncDollyPageVariants, lifeSyncSharedLayoutTransitionProps, MotionDiv } from '../../lib/lifesyncMotion'

const WATCH_HENTAI_SITE = 'https://watchhentai.net'

function isIOSDevice() {
    if (typeof navigator === 'undefined') return false
    const ua = navigator.userAgent || ''
    const iOS = /iPad|iPhone|iPod/.test(ua)
    const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
    return iOS || iPadOS
}

function hentaiSeriesPosterLayoutId(seriesKey) {
    const k = String(seriesKey ?? 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_')
    return `lifesync-hentai-poster-${k}`
}
const SERIES_PER_PAGE = 24
const hentaiFilterExpandTransition = {
    height: { duration: 0.3 },
    opacity: { duration: 0.22 },
}

/** Stable pseudo-shuffle for recommendation order (pure, no Math.random in render). */
function seriesMixOrderKey(seriesKey) {
    const s = String(seriesKey || '')
    let h = 2166136261
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
    return h >>> 0
}

function formatEpisodeDate(pubDate) {
    if (!pubDate || typeof pubDate !== 'string') return null
    const t = Date.parse(pubDate)
    if (!Number.isFinite(t)) return null
    try {
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(t)
    } catch {
        return pubDate.slice(0, 10)
    }
}

function slugFromItem(it) {
    if (it?.slug && String(it.slug).trim()) return String(it.slug).trim()
    for (const k of ['embedUrl', 'watchUrl']) {
        if (it?.[k]) {
            try {
                const m = /\/(embed|watch)\/([^/?#]+)/.exec(new URL(it[k]).pathname)
                if (m) return decodeURIComponent(m[2])
            } catch { /* ignore */ }
        }
    }
    return ''
}



function hentaiEpisodeThumbnailUrl(ep) {
    return ep?.posterUrl || ''
}

function hentaiSourceApiBase() {
    return '/api/v1/hentai/watchhentai'
}

function pickStableRandomBackdrop(backdropUrls, seedValue) {
    if (!Array.isArray(backdropUrls) || backdropUrls.length === 0) return null
    const clean = backdropUrls.filter(Boolean)
    if (clean.length === 0) return null

    const seed = String(seedValue || 'lifesync-hentai')
    let hash = 2166136261
    for (let i = 0; i < seed.length; i++) {
        hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619)
    }
    const idx = Math.abs(hash >>> 0) % clean.length
    return clean[idx]
}

function qualityRank(value) {
    const m = String(value || '').match(/(\d{3,4})p/i)
    if (!m?.[1]) return 0
    const n = Number(m[1])
    return Number.isFinite(n) ? n : 0
}

function normalizeQualityOptions(rawOptions) {
    if (!Array.isArray(rawOptions)) return []
    const out = []
    const seen = new Set()
    for (const raw of rawOptions) {
        const url = typeof raw?.url === 'string' && raw.url.startsWith('http') ? raw.url : ''
        if (!url) continue
        const type = raw?.type === 'hls' ? 'hls' : 'mp4'
        const rank = Number.isFinite(Number(raw?.rank)) ? Number(raw.rank) : Math.max(qualityRank(raw?.label), qualityRank(url))
        const label = String(raw?.label || (rank > 0 ? `${rank}p` : type === 'hls' ? 'Auto (HLS)' : 'Default')).trim()
        const idBase = String(raw?.id || `${rank || 'default'}p-${type}`).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-') || `${rank || 'default'}p-${type}`
        const uniqueKey = `${type}|${url.toLowerCase()}`
        if (seen.has(uniqueKey)) continue
        seen.add(uniqueKey)
        out.push({ id: idBase, label, url, type, rank })
    }

    out.sort((a, b) => {
        if (b.rank !== a.rank) return b.rank - a.rank
        if (a.type !== b.type) return a.type === 'mp4' ? -1 : 1
        return a.label.localeCompare(b.label)
    })

    const idCounts = new Map()
    return out.map(item => {
        const count = (idCounts.get(item.id) || 0) + 1
        idCounts.set(item.id, count)
        if (count === 1) return item
        return { ...item, id: `${item.id}-${count}` }
    })
}

function pickQualityOption(options, preferredId, iosDevice) {
    if (!Array.isArray(options) || options.length === 0) return null
    const pool = iosDevice
        ? options.filter(opt => opt.type === 'mp4')
        : options
    const candidates = pool.length > 0 ? pool : options

    if (preferredId) {
        const exact = candidates.find(opt => opt.id === preferredId)
        if (exact) return exact
    }

    return candidates[0] || null
}

/* ─── Fullscreen Player Popup (watch layout) ───────────────────────────── */

function StreamPlayerPopup({ playerState, source, onClose, onChangeEpisode, onSelectQuality, allSeries, onPlayFromSeries, onVideoFailure }) {
    const { stream, series, episodeIndex } = playerState
    const episodes = useMemo(() => series?.episodes || [], [series])
    const prevEp = episodeIndex > 0 ? episodes[episodeIndex - 1] : null
    const nextEp = episodeIndex >= 0 && episodeIndex < episodes.length - 1 ? episodes[episodeIndex + 1] : null
    const activeEpisode = episodeIndex >= 0 ? episodes[episodeIndex] : null
    const qualityOptions = Array.isArray(stream?.qualityOptions) ? stream.qualityOptions : []
    const canSelectQuality = Boolean(stream?.videoUrl && qualityOptions.length > 1)
    const playingRef = useRef(null)

    const shuffledPool = useMemo(() => {
        if (!allSeries?.length) return []
        return [...allSeries].sort((a, b) => seriesMixOrderKey(a.seriesKey) - seriesMixOrderKey(b.seriesKey))
    }, [allSeries])

    const recommendations = useMemo(() => {
        const out = []
        const pool = shuffledPool.length ? shuffledPool : allSeries || []
        if (!pool.length) return out
        const seen = new Set()
        if (series?.seriesKey) seen.add(series.seriesKey)
        for (const s of pool) {
            if (seen.has(s.seriesKey)) continue
            seen.add(s.seriesKey)
            const ep = s.episodes?.[0]
            if (!ep) continue
            out.push({ ...s, _firstEp: ep })
            if (out.length >= 12) break
        }
        return out
    }, [series, allSeries, shuffledPool])

    useEffect(() => {
        const el = playingRef.current
        if (!el) return
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }, [episodeIndex])

    useEffect(() => {
        const onKey = e => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            window.removeEventListener('keydown', onKey)
            document.body.style.overflow = prev
        }
    }, [onClose])

    const hideScroll = '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
    const progressLabel = episodes.length > 0 ? `${Math.min(episodes.length, episodeIndex + 1)} / ${episodes.length}` : null

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex h-dvh max-h-dvh w-full max-w-[100vw] flex-col overflow-x-hidden overflow-y-hidden bg-[#020202] text-white"
        >
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#C6FF00]/12 blur-[120px]" />
                <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-[#37c9ff]/8 blur-[135px]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08)_0%,rgba(2,2,2,0)_48%)]" />
            </div>

            <header
                className="relative flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/40 py-2.5 pl-3 pr-3 backdrop-blur-xl sm:flex-nowrap sm:gap-3 sm:px-4 sm:py-3"
            >
                <div className="flex min-w-0 items-center gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex min-w-0 shrink items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white/85 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
                    >
                        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                        <span className="truncate">Back</span>
                    </button>
                    <div className="hidden min-w-0 sm:block">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/45">Now Streaming</p>
                        <p className="truncate text-[12px] font-medium text-white/75">{series?.title || 'LifeSync Stream'}</p>
                    </div>
                </div>

                <div className="flex min-w-0 items-center gap-2">
                    {progressLabel && (
                        <span className="hidden rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold tabular-nums text-white/75 sm:inline-flex">
                            {progressLabel}
                        </span>
                    )}
                    {stream.watchUrl ? (
                        <a
                            href={stream.watchUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Open on source site"
                            className="inline-flex min-w-0 max-w-[min(100%,11rem)] shrink items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1.5 text-[10px] font-medium text-white/70 transition-colors hover:border-[#C6FF00]/45 hover:text-[#C6FF00] sm:max-w-none sm:px-3 sm:text-[11px]"
                        >
                            <span className="truncate sm:whitespace-nowrap">Open source</span>
                            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </a>
                    ) : null}
                </div>
            </header>

            <div
                className={`relative min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden ${hideScroll}`}
            >
                <div className="mx-auto grid w-full min-w-0 max-w-[1680px] gap-4 px-3 py-4 sm:px-4 lg:h-[calc(100dvh-6rem)] lg:grid-cols-[minmax(0,1.55fr)_minmax(310px,0.85fr)] lg:gap-5 lg:px-6">
                    <section className="min-w-0 space-y-4 lg:flex lg:h-full lg:flex-col lg:gap-4 lg:space-y-0">
                        <div className="relative w-full min-w-0 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-black shadow-[0_28px_80px_rgba(0,0,0,0.5)]">
                            <div className="relative aspect-video w-full">
                                <div className="absolute inset-0">
                                    {stream.resolving ? (
                                        <LifesyncStreamPlayerResolvingSkeleton />
                                    ) : stream.videoUrl ? (
                                        <AdvancedVideoPlayer
                                            key={stream.videoUrl}
                                            src={stream.videoUrl}
                                            onEnded={() => nextEp && onChangeEpisode(episodeIndex + 1)}
                                            onError={() => {
                                                onVideoFailure?.()
                                            }}
                                        />
                                    ) : stream.embedUrl ? (
                                        <iframe
                                            title={stream.title}
                                            src={stream.embedUrl}
                                            className="h-full w-full border-0"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                                            allowFullScreen
                                            referrerPolicy="no-referrer-when-downgrade"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-[#111]">
                                            <p className="text-[14px] text-white/35">No stream available.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="min-w-0 shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
                            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1">
                                    <h1 className="wrap-anywhere text-[17px] font-bold leading-snug tracking-tight text-white sm:text-[21px]">{stream.title}</h1>
                                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                                        {series && (
                                            <span className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[11px] text-white/65">
                                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#C6FF00]" aria-hidden />
                                                <span className="min-w-0 truncate">{series.title}</span>
                                            </span>
                                        )}
                                        {progressLabel && (
                                            <span className="inline-flex rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[10px] font-semibold tabular-nums text-white/62">
                                                Episode {progressLabel}
                                            </span>
                                        )}
                                        {activeEpisode?.pubDate && (
                                            <span className="inline-flex rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[10px] text-white/55">
                                                {formatEpisodeDate(activeEpisode.pubDate) || activeEpisode.pubDate}
                                            </span>
                                        )}
                                        {canSelectQuality && (
                                            <label className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-black/35 px-2.5 py-1">
                                                <span className="text-[10px] font-semibold uppercase tracking-wide text-white/55">Quality</span>
                                                <select
                                                    value={stream.activeQuality || qualityOptions[0]?.id || ''}
                                                    onChange={e => onSelectQuality?.(e.target.value)}
                                                    className="rounded bg-transparent text-[10px] font-semibold text-white outline-none"
                                                >
                                                    {qualityOptions.map(opt => (
                                                        <option key={opt.id} value={opt.id} className="text-black">
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                        )}
                                    </div>
                                </div>

                                <div className="flex min-w-0 w-full items-stretch gap-2 sm:w-auto sm:shrink-0">
                                    <button
                                        type="button"
                                        disabled={!prevEp}
                                        onClick={() => prevEp && onChangeEpisode(episodeIndex - 1)}
                                        className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 text-[12px] font-medium text-white/80 transition-colors hover:bg-white/10 disabled:opacity-25 sm:min-w-[118px]"
                                    >
                                        <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                        <span className="truncate">Previous</span>
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!nextEp}
                                        onClick={() => nextEp && onChangeEpisode(episodeIndex + 1)}
                                        className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border border-[#C6FF00]/45 bg-[#C6FF00]/18 px-3 text-[12px] font-semibold text-[#C6FF00] transition-colors hover:bg-[#C6FF00]/28 disabled:opacity-25 sm:min-w-[118px]"
                                    >
                                        <span className="truncate">Next</span>
                                        <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                    </button>
                                </div>
                            </div>

                            {episodes.length > 1 && (
                                <div className="mt-4 rounded-xl border border-white/10 bg-black/35 px-3.5 py-3">
                                    <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/45">Up Next</p>
                                    <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-snug text-white/85">
                                        {nextEp ? nextEp.title : 'You reached the final episode in this series.'}
                                    </p>
                                </div>
                            )}
                        </div>

                        {episodes.length > 0 && (
                            <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-3 sm:p-4 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
                                <div className="mb-3 flex min-w-0 items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">Episode Queue</p>
                                        <p className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-snug text-white/90">{series?.title}</p>
                                    </div>
                                    <span className="shrink-0 rounded-md border border-white/10 bg-white/[0.06] px-2 py-1 text-[10px] font-medium tabular-nums text-white/55">{episodes.length}</span>
                                </div>

                                <div className={`max-h-[42dvh] overflow-y-auto pr-1 lg:min-h-0 lg:max-h-none lg:flex-1 ${hideScroll}`}>
                                    <ul className="space-y-1.5">
                                        {episodes.map((ep, i) => {
                                            const isCurrent = i === episodeIndex
                                            const epLabel = ep.episodeNum > 0 ? `Ep ${ep.episodeNum}` : `Part ${i + 1}`
                                            const dateLabel = formatEpisodeDate(ep.pubDate)
                                            const queueThumb = hentaiEpisodeThumbnailUrl(ep, source) || ep.posterUrl || series?.posterUrl
                                            return (
                                                <li key={ep.slug || ep.watchUrl || i}>
                                                    <button
                                                        ref={isCurrent ? playingRef : undefined}
                                                        type="button"
                                                        onClick={() => onChangeEpisode(i)}
                                                        className={`group flex w-full min-w-0 items-center gap-2.5 rounded-xl border px-2 py-2 text-left transition-all ${
                                                            isCurrent
                                                                ? 'border-[#C6FF00]/50 bg-[#C6FF00]/14'
                                                                : 'border-white/10 bg-black/30 hover:border-white/20 hover:bg-white/[0.06]'
                                                        }`}
                                                    >
                                                        <div className="relative h-12 w-[4.4rem] shrink-0 overflow-hidden rounded-lg bg-black/45">
                                                            {queueThumb ? (
                                                                <LifesyncEpisodeThumbnail
                                                                    src={queueThumb}
                                                                    dark
                                                                    className="absolute inset-0 h-full w-full"
                                                                    imgClassName="h-full w-full object-cover"
                                                                />
                                                            ) : (
                                                                <div className="flex h-full w-full items-center justify-center text-white/20">
                                                                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                                </div>
                                                            )}
                                                            {isCurrent && (
                                                                <span className="absolute left-1 top-1 z-[2] rounded bg-[#C6FF00]/90 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-black">
                                                                    Live
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="min-w-0 flex-1">
                                                            <p className={`line-clamp-2 text-[11px] font-semibold leading-snug ${isCurrent ? 'text-[#C6FF00]' : 'text-white/88'}`}>
                                                                {ep.title}
                                                            </p>
                                                            <p className="mt-1 text-[9px] text-white/42">
                                                                {epLabel}{dateLabel ? ` · ${dateLabel}` : ''}
                                                            </p>
                                                        </div>
                                                    </button>
                                                </li>
                                            )
                                        })}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </section>

                    <aside className="min-w-0 lg:h-full">
                        <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
                            <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">Suggested</p>
                            {recommendations.length > 0 ? (
                                <div className={`mt-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1 ${hideScroll}`}>
                                    <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
                                        {recommendations.map(rec => {
                                            const sugThumb = hentaiEpisodeThumbnailUrl(rec._firstEp) || rec._firstEp?.posterUrl || rec.posterUrl
                                            return (
                                            <li key={rec.seriesKey}>
                                                <button
                                                    type="button"
                                                    onClick={() => onPlayFromSeries?.(rec, 0)}
                                                    className="flex w-full gap-3 rounded-xl border border-transparent bg-black/25 p-2 text-left transition-colors hover:border-white/10 hover:bg-white/[0.06]"
                                                >
                                                    <div className="relative h-[4.5rem] w-[5.5rem] shrink-0 overflow-hidden rounded-lg bg-black/30">
                                                        {sugThumb ? (
                                                            <LifesyncEpisodeThumbnail
                                                                src={sugThumb}
                                                                dark
                                                                className="absolute inset-0 h-full w-full"
                                                                imgClassName="h-full w-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="flex h-full w-full items-center justify-center text-white/12">
                                                                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                            </div>
                                                        )}
                                                        {rec.episodeCount > 1 && (
                                                            <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 py-px text-[8px] font-bold text-white">
                                                                {rec.episodeCount} ep
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1 py-0.5">
                                                        <p className="line-clamp-2 text-[12px] font-semibold leading-snug text-white/92">{rec.title}</p>
                                                        <p className="mt-1 text-[10px] text-white/38">
                                                            {rec.episodeCount === 1 ? 'One episode' : `${rec.episodeCount} episodes`}
                                                        </p>
                                                    </div>
                                                </button>
                                            </li>
                                            )
                                        })}
                                    </ul>
                                </div>
                            ) : (
                                <p className="mt-6 px-1 pb-4 text-center text-[12px] text-white/30">Nothing else to suggest right now.</p>
                            )}
                        </div>
                    </aside>
                </div>
            </div>
        </div>,
        document.body,
    )
}

/* ─── Cinematic Series Detail + Episode Picker ─────────────────────────── */

function SeriesDetailPopup({ series, source, onClose, onPlayEpisode, genreTagClick, onGenresLoaded }) {
    const firstEp = series?.episodes?.[0]
    const initialSlug = series ? slugFromItem(firstEp || series) : ''
    const [detail, setDetail] = useState(null)
    const [detailBusy, setDetailBusy] = useState(() => Boolean(initialSlug))
    const [descExpanded, setDescExpanded] = useState(false)
    const [storyboardFailed, setStoryboardFailed] = useState(false)

    useEffect(() => {
        if (!series) return
        const slug = slugFromItem(series.episodes?.[0] || series)
        if (!slug) return
        let cancelled = false
        const detailApiBase = hentaiSourceApiBase()
        lifesyncFetch(`${detailApiBase}/detail?slug=${encodeURIComponent(slug)}&view=full`)
            .then(d => {
                if (!cancelled) {
                    setDetail(d)
                    if (d?.genres?.length) onGenresLoaded?.(series.seriesKey, d.genres)
                }
            })
            .catch(() => {})
            .finally(() => { if (!cancelled) setDetailBusy(false) })
        return () => { cancelled = true }
    }, [series, source, onGenresLoaded])

    useEffect(() => {
        const onKey = e => { if (e.key === 'Escape') onClose?.() }
        window.addEventListener('keydown', onKey)
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            window.removeEventListener('keydown', onKey)
            document.body.style.overflow = prev
        }
    }, [onClose])

    if (!series) return null

    const posterLayoutId = hentaiSeriesPosterLayoutId(series.seriesKey)

    const coverImg = detail?.coverUrl || series.posterUrl
    const description = detail?.description ? String(detail.description).replace(/<[^>]*>/g, '') : ''
    const genres = detail?.genres || []
    const episodes = Array.isArray(detail?.episodes) && detail.episodes.length > 0 ? detail.episodes : (series.episodes || [])
    const episodeSkeletonCount = Math.min(12, Math.max(3, episodes.length || 6))
    const hentaiSlug = slugFromItem(detail) || slugFromItem(episodes[0] || series)
    const randomWatchBackdrop = source === 'watchhentai'
        ? pickStableRandomBackdrop(detail?.backdropUrls, `${series.seriesKey || series.title}-${hentaiSlug}`)
        : null
    const usingStoryboardBg = Boolean(source !== 'watchhentai' && storyboardBg && !storyboardFailed)
    const heroBackground = source === 'watchhentai' ? (randomWatchBackdrop || coverImg) : (usingStoryboardBg ? storyboardBg : coverImg)
    const playbackSeries = {
        ...series,
        posterUrl: coverImg || series.posterUrl,
        episodes,
        episodeCount: episodes.length,
    }
    const isDarkTheme =
        typeof document !== 'undefined' &&
        document.documentElement?.dataset?.maxienTheme === 'dark'

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
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={lifeSyncDetailBackdropFadeTransition}
            />

            <MotionDiv
                layout="size"
                layoutRoot
                className="lifesync-hentai-detail-sheet relative flex h-dvh max-h-dvh w-full min-w-0 flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[min(88vh,calc(100dvh-2rem))] sm:max-w-4xl sm:rounded-2xl"
                onClick={e => e.stopPropagation()}
                initial={lifeSyncDetailSheetEnterInitial}
                animate={lifeSyncDetailSheetEnterAnimate}
                exit={lifeSyncDetailSheetExitVariant}
                transition={lifeSyncDetailSheetMainTransition}
            >
                {/* Hero with storyboard background */}
                <div className="relative shrink-0">
                    {heroBackground && (
                        <>
                            <div className="absolute inset-0 overflow-hidden">
                                <FadeInImg
                                    src={heroBackground}
                                    alt=""
                                    onError={() => {
                                        if (usingStoryboardBg) setStoryboardFailed(true)
                                    }}
                                    className="w-full h-full object-cover opacity-65"
                                />
                            </div>
                            <div className="absolute inset-0 lifesync-detail-hero-fade" />
                        </>
                    )}
                    {!heroBackground && <div className="absolute inset-0 lifesync-detail-hero-fallback" />}

                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur-sm transition-all hover:bg-black/60 hover:text-white"
                        style={{ top: '0.75rem', right: '0.75rem' }}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>

                    <div className="relative flex flex-col items-center gap-4 px-4 pb-4 pt-5 text-center sm:flex-row sm:items-end sm:gap-5 sm:px-6 sm:pt-5 sm:text-left">
                        <div className="w-24 shrink-0 sm:w-36">
                            <MotionDiv
                                layoutId={posterLayoutId}
                                transition={lifeSyncSharedLayoutTransitionProps}
                                className="w-full overflow-hidden rounded-xl bg-[#f5f5f7] shadow-lg ring-1 ring-black/10"
                                style={{ aspectRatio: '2/3' }}
                            >
                                {coverImg ? (
                                    <FadeInImg src={coverImg} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    <div className="flex h-full min-h-[6.5rem] w-full items-center justify-center">
                                        <svg className="w-10 h-10 text-[#86868b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-12.75" /></svg>
                                    </div>
                                )}
                            </MotionDiv>
                        </div>
                        <div className="flex min-w-0 w-full flex-1 flex-col justify-end pb-1">
                            <h2 className="wrap-anywhere text-[17px] font-bold leading-tight text-[#1d1d1f] line-clamp-4 sm:text-[22px] sm:line-clamp-3">
                                {detail?.title || series.title}
                            </h2>
                            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                                <span className="inline-flex items-center gap-1 bg-[#C6FF00]/20 text-[#1d1d1f] text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" /></svg>
                                    {episodes.length === 1 ? '1 episode' : `${episodes.length} episodes`}
                                </span>
                                {detail?.releaseDate && (
                                    <span className="text-[10px] font-medium text-[#86868b] bg-[#f5f5f7] px-2 py-0.5 rounded-full">{detail.releaseDate}</span>
                                )}
                            </div>
                            {genres.length > 0 && (
                                <div className="mt-2.5 flex flex-wrap justify-center gap-1 sm:justify-start">
                                    {genres.map(g => (
                                        <button
                                            key={g}
                                            type="button"
                                            onClick={e => {
                                                e.stopPropagation()
                                                genreTagClick?.(g)
                                                onClose()
                                            }}
                                            className="bg-[#C6FF00]/10 text-[#1d1d1f] text-[10px] font-medium px-2 py-0.5 rounded-full hover:bg-[#C6FF00]/25 transition-colors cursor-pointer"
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Body: description + episode grid */}
                <div className="min-h-0 flex-1 overflow-y-auto">
                    <MotionDiv
                        key={String(series.seriesKey)}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={lifeSyncDetailBodyRevealTransition}
                    >
                    {/* Description */}
                    {(detailBusy || description) && (
                        <div className="px-5 sm:px-6 py-3 border-b border-[#f0f0f0]">
                            {detailBusy && !description ? (
                                <LifesyncTextLinesSkeleton lines={4} dark={isDarkTheme} />
                            ) : (
                                <>
                                    <p className={`text-[12px] leading-relaxed text-[#424245] ${descExpanded ? '' : 'line-clamp-3'}`}>
                                        {description}
                                    </p>
                                    {description.length > 200 && (
                                        <button type="button" onClick={() => setDescExpanded(v => !v)} className="mt-1 text-[11px] font-semibold text-[#C6FF00] hover:underline">
                                            {descExpanded ? 'Show less' : 'Show more'}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Episode grid — 16:9 thumbs */}
                    <div className="px-5 sm:px-6 py-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#86868b] mb-3">
                            {detailBusy
                                ? 'Episodes'
                                : episodes.length === 1
                                  ? 'Episode'
                                  : `${episodes.length} Episodes`}{' '}
                            — tap to watch
                        </p>
                        {detailBusy ? (
                            <LifesyncHentaiEpisodeGridSkeleton count={episodeSkeletonCount} dark={isDarkTheme} />
                        ) : (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {episodes.map((ep, i) => {
                                const sourceEpThumb = hentaiEpisodeThumbnailUrl(ep, source)
                                const epThumbSrc = sourceEpThumb || ep.posterUrl || coverImg
                                const dimSeriesCover = !sourceEpThumb && !ep.posterUrl && coverImg
                                return (
                                <button
                                    key={ep.watchUrl || ep.slug || i}
                                    type="button"
                                    onClick={() => onPlayEpisode(playbackSeries, ep, i)}
                                    className="group text-left overflow-hidden rounded-[14px] border border-[#d2d2d7]/50 bg-white shadow-sm hover:shadow-md hover:border-[#C6FF00]/40 transition-all"
                                >
                                    <div className="relative aspect-video w-full overflow-hidden bg-[#1d1d1f]">
                                        {epThumbSrc ? (
                                            <LifesyncEpisodeThumbnail
                                                src={epThumbSrc}
                                                className="absolute inset-0 h-full w-full"
                                                imgClassName={`h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]${dimSeriesCover ? ' opacity-50' : ''}`}
                                            />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-white/25">
                                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" /></svg>
                                            </div>
                                        )}
                                        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-1/2 bg-gradient-to-t from-black/75 via-black/25 to-transparent" aria-hidden />
                                        {ep.episodeNum > 0 && (
                                            <span className="absolute left-2 top-2 z-[2] rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-white backdrop-blur-sm ring-1 ring-white/10">
                                                E{ep.episodeNum}
                                            </span>
                                        )}
                                        <div className="absolute inset-0 z-[2] flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 bg-black/25">
                                            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#C6FF00] shadow-lg ring-2 ring-black/20">
                                                <svg className="ml-0.5 h-4 w-4 text-[#1d1d1f]" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                            </span>
                                        </div>
                                        <div className="absolute inset-x-0 bottom-0 z-[2] px-2.5 pb-2 pt-6">
                                            <p className="text-[11px] font-semibold leading-snug text-white line-clamp-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">{ep.title}</p>
                                        </div>
                                    </div>
                                </button>
                                )
                            })}
                        </div>
                        )}
                    </div>
                    </MotionDiv>
                </div>
            </MotionDiv>
        </MotionDiv>
    )

    return createPortal(node, document.body)
}

/* ─── Series Card ──────────────────────────────────────────────────────── */

const SeriesCard = memo(function SeriesCard({ series, onOpenDetail }) {
    return (
        <button type="button" onClick={() => onOpenDetail?.(series)} className="group w-full text-left">
            <div className="bg-white rounded-[18px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden hover:shadow-md transition-all">
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#f5f5f7]">
                    <MotionDiv
                        layoutId={hentaiSeriesPosterLayoutId(series.seriesKey)}
                        transition={lifeSyncSharedLayoutTransitionProps}
                        className="absolute inset-0"
                    >
                        {series.posterUrl ? (
                            <LifesyncEpisodeThumbnail
                                src={series.posterUrl}
                                className="absolute inset-0 h-full w-full"
                                imgClassName="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                            >
                                {series.episodeCount != null && (
                                    <span className="absolute right-2 top-2 z-[2] bg-white/95 text-[#1d1d1f] text-[10px] font-bold px-2 py-0.5 rounded-lg ring-1 ring-[#e5e5ea]">
                                        {series.episodeCount === 1 ? '1 ep' : `${series.episodeCount} ep`}
                                    </span>
                                )}
                                {!series.episodeCount && series.episodes?.length && (
                                    <span className="absolute right-2 top-2 z-[2] bg-white/95 text-[#1d1d1f] text-[10px] font-bold px-2 py-0.5 rounded-lg ring-1 ring-[#e5e5ea]">
                                        {series.episodes.length === 1 ? '1 ep' : `${series.episodes.length} ep`}
                                    </span>
                                )}
                                <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] p-3">
                                    <p className="text-[13px] font-semibold text-white line-clamp-2 drop-shadow">{series.title}</p>
                                </div>
                            </LifesyncEpisodeThumbnail>
                        ) : (
                            <>
                                <div className="flex h-full w-full items-center justify-center text-[#86868b]">
                                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-12.75" />
                                    </svg>
                                </div>
                                {series.episodeCount != null && (
                                    <span className="absolute right-2 top-2 z-[2] bg-white/95 text-[#1d1d1f] text-[10px] font-bold px-2 py-0.5 rounded-lg ring-1 ring-[#e5e5ea]">
                                        {series.episodeCount === 1 ? '1 ep' : `${series.episodeCount} ep`}
                                    </span>
                                )}
                                {!series.episodeCount && series.episodes?.length && (
                                    <span className="absolute right-2 top-2 z-[2] bg-white/95 text-[#1d1d1f] text-[10px] font-bold px-2 py-0.5 rounded-lg ring-1 ring-[#e5e5ea]">
                                        {series.episodes.length === 1 ? '1 ep' : `${series.episodes.length} ep`}
                                    </span>
                                )}
                                <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] p-3">
                                    <p className="text-[13px] font-semibold text-white line-clamp-2 drop-shadow">{series.title}</p>
                                </div>
                            </>
                        )}
                    </MotionDiv>
                </div>
                <div className="flex items-center justify-center gap-1.5 border-t border-[#f0f0f0] bg-[#fafafa] py-2.5 text-[11px] font-semibold text-[#1d1d1f]">
                    <svg className="w-3.5 h-3.5 text-[#86868b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
                    </svg>
                    View episodes
                </div>
            </div>
        </button>
    )
})

/* ─── Main Component ───────────────────────────────────────────────────── */

export default function LifeSyncHentai() {
    const { isLifeSyncConnected, lifeSyncUser, lifeSyncUpdatePreferences } = useLifeSync()
    const prefs = lifeSyncUser?.preferences
    const nsfwEnabled = Boolean(prefs?.nsfwContentEnabled)
    const pluginEnabled = isPluginEnabled(prefs, 'pluginHentaiEnabled')

    const [catalog, setCatalog] = useState(null)
    const [searchQ, setSearchQ] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [page, setPage] = useState(1)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const activeSource = 'watchhentai'
    const [catalogMode, setCatalogMode] = useState('series')
    const [watchGenre, setWatchGenre] = useState('')
    const [watchYear, setWatchYear] = useState('')
    const [filtersExpanded, setFiltersExpanded] = useState(false)

    const [selectedSeries, setSelectedSeries] = useState(null)
    const [playerState, setPlayerState] = useState(null)
    const [preferredQualityId, setPreferredQualityId] = useState(null)
    const [sortOrder, setSortOrder] = useState('random')

    const [knownGenres, setKnownGenres] = useState([])
    const seriesGenresRef = useRef(new Map())
    const pageMountedRef = useRef(true)
    useEffect(() => {
        pageMountedRef.current = true
        return () => {
            pageMountedRef.current = false
        }
    }, [])

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchQ.trim()), 320)
        return () => clearTimeout(t)
    }, [searchQ])

    const load = useCallback(async (p = 1, q = '', refresh = false) => {
        if (pageMountedRef.current) {
            setBusy(true)
            setError('')
        }
        try {
            const params = new URLSearchParams({ page: String(p), perPage: String(SERIES_PER_PAGE) })
            if (q.trim()) params.set('q', q.trim())
            if (refresh) params.set('refresh', '1')
            params.set('view', 'standard')
            params.set('section', 'series')
            params.set('sort', sortOrder)
            if (watchGenre) params.set('genre', watchGenre)
            if (watchYear) params.set('year', watchYear)

            const apiBase = hentaiSourceApiBase()
            let data = await lifesyncFetch(`${apiBase}/home?${params}`)

            // Backward-safe retry for servers that still transform away `series/items` on compact-like views.
            if (!Array.isArray(data?.series) && !Array.isArray(data?.items)) {
                const fallbackParams = new URLSearchParams(params)
                fallbackParams.delete('view')
                data = await lifesyncFetch(`${apiBase}/home?${fallbackParams}`)
            }

            if (!pageMountedRef.current) return
            setCatalog(data)
        } catch (e) {
            if (pageMountedRef.current) {
                setError(e.message || 'Failed to load')
            }
        } finally {
            if (pageMountedRef.current) {
                setBusy(false)
            }
        }
    }, [catalogMode, watchGenre, watchYear, sortOrder])

    useEffect(() => {
        if (isLifeSyncConnected && nsfwEnabled && pluginEnabled) {
            setPage(1)
            load(1, debouncedSearch, false)
        }
    }, [
        isLifeSyncConnected,
        nsfwEnabled,
        pluginEnabled,
        debouncedSearch,
        catalogMode,
        watchGenre,
        watchYear,
        load,
    ])

    const addGenresForSeries = useCallback((seriesKey, genres) => {
        if (!genres?.length) return
        const map = seriesGenresRef.current
        if (map.has(seriesKey)) return
        map.set(seriesKey, genres)
        const all = new Set()
        for (const arr of map.values()) arr.forEach(g => all.add(g))
        setKnownGenres([...all].sort())
    }, [])

    const resolveStream = useCallback(async (ep, preferredQuality = null) => {
        const slug = slugFromItem(ep)
        const embedUrl = ep?.embedUrl || (slug ? `${WATCH_HENTAI_SITE}/videos/${encodeURIComponent(slug)}/` : '')
        const watchUrl = ep?.watchUrl || (slug ? `${WATCH_HENTAI_SITE}/videos/${encodeURIComponent(slug)}/` : '')
        if (!slug || !embedUrl) return null
        const base = { title: ep.title, embedUrl, watchUrl, slug, videoUrl: null, qualityOptions: [], activeQuality: null, resolving: false }
        try {
            const apiBase = hentaiSourceApiBase()
            const data = await lifesyncFetch(`${apiBase}/stream?slug=${encodeURIComponent(slug)}&view=full`)
            const mp4 = typeof data.videoUrl === 'string' && data.videoUrl.startsWith('http') ? data.videoUrl : null
            const hls = typeof data.hlsUrl === 'string' && data.hlsUrl.startsWith('http') ? data.hlsUrl : null
            let qualityOptions = normalizeQualityOptions(data?.qualityOptions)

            if (qualityOptions.length === 0) {
                const inferred = []
                if (mp4) {
                    const rank = qualityRank(mp4)
                    inferred.push({
                        id: `${rank || 'default'}p-mp4`,
                        label: rank > 0 ? `${rank}p` : 'Default',
                        url: mp4,
                        type: 'mp4',
                        rank,
                    })
                }
                if (hls) {
                    const rank = qualityRank(hls)
                    inferred.push({
                        id: `${rank || 'auto'}p-hls`,
                        label: rank > 0 ? `${rank}p (HLS)` : 'Auto (HLS)',
                        url: hls,
                        type: 'hls',
                        rank,
                    })
                }
                qualityOptions = normalizeQualityOptions(inferred)
            }

            const selectedQuality = pickQualityOption(qualityOptions, preferredQuality, isIOSDevice())

            let videoUrl = selectedQuality?.url || null
            if (!videoUrl) {
                if (isIOSDevice()) {
                    videoUrl = mp4 || null
                } else {
                    videoUrl = hls || mp4 || null
                }
            }

            return {
                ...base,
                embedUrl: data.embedUrl || embedUrl,
                videoUrl,
                qualityOptions,
                activeQuality: selectedQuality?.id || null,
            }
        } catch {
            return base
        }
    }, [])

    const playEpisode = useCallback(async (series, ep, epIndex) => {
        setSelectedSeries(null)
        const stream = {
            title: ep.title,
            embedUrl: ep.embedUrl || '',
            watchUrl: ep.watchUrl || '',
            slug: slugFromItem(ep),
            videoUrl: null,
            qualityOptions: [],
            activeQuality: preferredQualityId,
            resolving: true,
        }
        setPlayerState({ stream, series, episodeIndex: epIndex })
        const resolved = await resolveStream(ep, preferredQualityId)
        if (!pageMountedRef.current) return
        if (resolved) {
            setPlayerState(prev => prev ? { ...prev, stream: resolved } : null)
        }
    }, [preferredQualityId, resolveStream])

    const changePlayerEpisode = useCallback(async (newIndex) => {
        setPlayerState(prev => {
            if (!prev?.series?.episodes?.[newIndex]) return prev
            const ep = prev.series.episodes[newIndex]
            const stream = {
                title: ep.title,
                embedUrl: ep.embedUrl || '',
                watchUrl: ep.watchUrl || '',
                slug: slugFromItem(ep),
                videoUrl: null,
                qualityOptions: [],
                activeQuality: preferredQualityId,
                resolving: true,
            }
            return { ...prev, stream, episodeIndex: newIndex }
        })
        const series = playerState?.series
        const ep = series?.episodes?.[newIndex]
        if (ep) {
            const resolved = await resolveStream(ep, preferredQualityId)
            if (!pageMountedRef.current) return
            if (resolved) {
                setPlayerState(prev => prev ? { ...prev, stream: resolved } : null)
            }
        }
    }, [playerState?.series, preferredQualityId, resolveStream])

    const selectStreamQuality = useCallback((qualityId) => {
        setPreferredQualityId(qualityId || null)
        setPlayerState(prev => {
            if (!prev?.stream) return prev
            const options = Array.isArray(prev.stream.qualityOptions) ? prev.stream.qualityOptions : []
            const selected = options.find(opt => opt.id === qualityId)
            if (!selected?.url) return prev
            return {
                ...prev,
                stream: {
                    ...prev.stream,
                    activeQuality: selected.id,
                    videoUrl: selected.url,
                },
            }
        })
    }, [])

    const fallbackStreamQuality = useCallback(() => {
        let nextQualityId = null
        setPlayerState(prev => {
            if (!prev?.stream) return prev
            const options = Array.isArray(prev.stream.qualityOptions) ? prev.stream.qualityOptions : []
            if (options.length === 0) {
                return { ...prev, stream: { ...prev.stream, videoUrl: null, activeQuality: null } }
            }

            const currentIndex = options.findIndex(opt => opt.id === prev.stream.activeQuality)
            const fromIndex = currentIndex >= 0 ? currentIndex + 1 : 0
            const next = options.slice(fromIndex).find(opt => opt?.url && opt.url !== prev.stream.videoUrl)
            if (!next) {
                return { ...prev, stream: { ...prev.stream, videoUrl: null, activeQuality: null } }
            }

            nextQualityId = next.id
            return {
                ...prev,
                stream: {
                    ...prev.stream,
                    activeQuality: next.id,
                    videoUrl: next.url,
                },
            }
        })
        if (nextQualityId) setPreferredQualityId(nextQualityId)
    }, [])

    function handleCatalogModeChange(nextMode) {
        if (nextMode === catalogMode) return
        setCatalogMode('series')
        setPage(1)
        setCatalog(null)
        setError('')
        setSelectedSeries(null)
        setPlayerState(null)
    }

    function handleWatchGenreChange(value) {
        setWatchGenre(value || '')
        setPage(1)
    }

    function handleWatchYearChange(value) {
        setWatchYear(String(value || '').trim())
        setPage(1)
    }

    function handleSearch(e) {
        e.preventDefault()
        setPage(1)
        setDebouncedSearch(searchQ.trim())
    }

    function handleGenreClick(genre) {
        const raw = String(genre || '').trim()
        const normalized = raw.toLowerCase()
        const matched = watchGenreOptions.find(opt => {
            const id = String(opt?.id || '').toLowerCase()
            const label = String(opt?.label || '').toLowerCase()
            return id === normalized || label === normalized
        })
        if (matched) {
            const nextId = String(matched.id)
            handleWatchGenreChange(watchGenre === nextId ? '' : nextId)
            setCatalogMode('series')
            setSearchQ('')
            setDebouncedSearch('')
        } else {
            setSearchQ(raw)
            setDebouncedSearch(raw)
            setCatalogMode('series')
            setPage(1)
        }
    }

    function goPage(p) {
        setPage(p)
        load(p, debouncedSearch, false)
    }

    async function enableNsfw() {
        try {
            await lifeSyncUpdatePreferences({ nsfwContentEnabled: true })
        } catch { /* ignore */ }
    }

    const seriesList = catalog?.series || []
    const flatItems = catalog?.items || []
    const useFlatOnly = seriesList.length === 0 && flatItems.length > 0
    const watchFilters = catalog?.filters || {}
    const watchGenreOptions = Array.isArray(watchFilters.genres) ? watchFilters.genres : []
    const watchYearOptions = Array.isArray(watchFilters.years) ? watchFilters.years : []

    const genreTagOptions = useMemo(() => {
        const map = new Map()
        for (const opt of watchGenreOptions) {
            if (!opt) continue
            const id = String(opt.id || opt.label || '').trim()
            const label = String(opt.label || opt.id || '').trim()
            if (!id || !label) continue
            if (!map.has(id)) map.set(id, { id, label })
        }
        if (!map.size && Array.isArray(knownGenres)) {
            for (const label of knownGenres) {
                const v = String(label || '').trim()
                if (!v || map.has(v)) continue
                map.set(v, { id: v, label: v })
            }
        }
        return [...map.values()].sort((a, b) => a.label.localeCompare(b.label))
    }, [watchGenreOptions, knownGenres])

    const activeFilterCount = (watchGenre ? 1 : 0) + (watchYear ? 1 : 0)

    const filteredFlat = useMemo(() => {
        const q = debouncedSearch.toLowerCase()
        if (!q || !useFlatOnly) return flatItems
        return flatItems.filter(it => String(it.title || '').toLowerCase().includes(q))
    }, [flatItems, debouncedSearch, useFlatOnly])

    if (!isLifeSyncConnected) {
        return (
            <div className="max-w-4xl mx-auto">
                <h1 className="mb-1 text-[28px] font-bold tracking-tight text-[#1a1628]">Hentai</h1>
                <p className="mb-4 max-w-xl text-[13px] leading-relaxed text-[#5b5670]">
                    Adults-only catalog and in-app streaming—connect LifeSync first, then enable NSFW in preferences if you use this hub.
                </p>
                <div className="rounded-[22px] border border-white/90 bg-white/90 px-8 py-16 text-center shadow-sm ring-1 ring-[#e8e4ef]/70">
                    <p className="text-[15px] font-bold text-[#1a1628] mb-2">LifeSync Not Connected</p>
                    <p className="text-[13px] text-[#5b5670] mb-4">Connect LifeSync in your profile first.</p>
                    <Link to="/dashboard/profile?tab=integrations" className="inline-flex items-center gap-2 rounded-xl bg-[#C6FF00] px-5 py-2.5 text-[13px] font-semibold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 transition-all hover:brightness-95">
                        Go to Integrations
                    </Link>
                </div>
            </div>
        )
    }

    if (!nsfwEnabled || !pluginEnabled) {
        return (
            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">LifeSync / Anime</p>
                    <h1 className="text-[28px] font-bold tracking-tight text-[#1a1628]">Hentai</h1>
                    <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[#5b5670]">
                        This area stays hidden until you allow mature content and turn on the Hentai plugin in integrations.
                    </p>
                </div>
                <div className="rounded-[22px] border border-white/90 bg-white/90 px-8 py-16 text-center shadow-sm ring-1 ring-[#fce7f3]/80">
                    <p className="text-[15px] font-bold text-[#1a1628] mb-2">Restricted Content</p>
                    <p className="text-[13px] text-[#5b5670] mb-4">
                        {!nsfwEnabled
                            ? 'NSFW content is disabled. Enable it in your LifeSync preferences.'
                            : 'The Hentai plugin is disabled. Enable it in your profile integrations.'}
                    </p>
                    {!nsfwEnabled ? (
                        <button type="button" onClick={enableNsfw} className="inline-flex items-center gap-2 rounded-xl bg-[#C6FF00] px-5 py-2.5 text-[13px] font-semibold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 transition-all hover:brightness-95">
                            Enable NSFW Content
                        </button>
                    ) : (
                        <Link to="/dashboard/profile?tab=integrations" className="inline-flex items-center gap-2 rounded-xl bg-[#C6FF00] px-5 py-2.5 text-[13px] font-semibold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 transition-all hover:brightness-95">
                            Go to Integrations
                        </Link>
                    )}
                </div>
            </div>
        )
    }

    return (
        <LayoutGroup id="lifesync-hentai">
        <MotionDiv
            className="space-y-6 sm:space-y-8"
            style={{ transformOrigin: '50% 0%' }}
            initial="initial"
            animate="animate"
            variants={lifeSyncDollyPageVariants}
            transition={lifeSyncDollyPageTransition}
        >
            {/* Popups */}
            <AnimatePresence mode="sync">
                {selectedSeries ? (
                    <SeriesDetailPopup
                        key={selectedSeries.seriesKey}
                        series={selectedSeries}
                        source={activeSource}
                        onClose={() => setSelectedSeries(null)}
                        onPlayEpisode={(playSeries, ep, idx) => void playEpisode(playSeries, ep, idx)}
                        onGenresLoaded={addGenresForSeries}
                        genreTagClick={g => {
                            addGenresForSeries(selectedSeries.seriesKey, [g])
                            handleGenreClick(g)
                        }}
                    />
                ) : null}
            </AnimatePresence>
            {playerState && (
                <StreamPlayerPopup
                    playerState={playerState}
                    source={activeSource}
                    onClose={() => setPlayerState(null)}
                    onChangeEpisode={idx => void changePlayerEpisode(idx)}
                    onSelectQuality={selectStreamQuality}
                    allSeries={seriesList}
                    onPlayFromSeries={(ser, epIdx) => void playEpisode(ser, ser.episodes[epIdx], epIdx)}
                    onVideoFailure={fallbackStreamQuality}
                />
            )}

            <div
                className="flex flex-col gap-5 sm:gap-6"
                style={{ pointerEvents: selectedSeries ? 'none' : undefined }}
            >
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">LifeSync / Anime</p>
                    <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight text-[#1a1628]">Hentai</h1>
                    <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[#5b5670]">
                        Browse adult series, open details and episode lists, and watch in the built-in player. Use filters and sync to refresh the catalog.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 self-stretch sm:self-start">
                    <button
                        onClick={() => load(page, debouncedSearch, true)}
                        disabled={busy}
                        className="w-full sm:w-auto text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-2 rounded-xl border border-[#e5e5ea] transition-colors disabled:opacity-50"
                    >
                        {busy ? 'Syncing…' : 'Sync catalog'}
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && <div className="bg-red-50 text-red-600 text-[12px] font-medium px-4 py-3 rounded-xl border border-red-100">{error}</div>}

            {/* Search */}
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
                <input
                    type="search"
                    value={searchQ}
                    onChange={e => { setSearchQ(e.target.value) }}
                    placeholder="Search WatchHentai titles…"
                    className="flex-1 px-4 py-2.5 bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#C6FF00]/60 focus:bg-white rounded-xl text-[13px] text-[#1d1d1f] focus:outline-none transition-all"
                />
                <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-[auto_auto]">
                    <button
                        type="button"
                        onClick={() => setFiltersExpanded(p => !p)}
                        className="rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] px-4 py-2.5 text-[13px] font-semibold text-[#1d1d1f] transition-colors hover:bg-[#ebebed]"
                    >
                        Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                    </button>
                    <button type="submit" disabled={busy} className="rounded-xl bg-[#C6FF00] px-4 py-2.5 text-[13px] font-semibold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 transition-all hover:brightness-95 disabled:opacity-50">
                        Search
                    </button>
                </div>
            </form>

            <AnimatePresence initial={false}>
                {filtersExpanded && (
                    <MotionDiv
                        key="hentai-filter-panel"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={hentaiFilterExpandTransition}
                        className="overflow-hidden"
                    >
                        <div className="rounded-[18px] border border-[#d2d2d7]/50 bg-white shadow-sm">
                            <div className="space-y-4 px-4 py-4">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">Filters &amp; Genres</p>
                                    {activeFilterCount > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleWatchGenreChange('')
                                                handleWatchYearChange('')
                                            }}
                                            className="text-[10px] font-semibold text-[#86868b] transition-colors hover:text-[#1d1d1f]"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>

                            <div className="space-y-1.5">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">Genre</p>
                                    <div className="flex min-w-0 max-w-full flex-wrap gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => handleWatchGenreChange('')}
                                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                                                !watchGenre
                                                    ? 'bg-[#C6FF00]/25 text-[#1d1d1f] ring-1 ring-[#C6FF00]/50'
                                                    : 'bg-[#f5f5f7] text-[#86868b] hover:bg-[#ebebed]'
                                            }`}
                                        >
                                            All genres
                                        </button>
                                        {genreTagOptions.map(opt => (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => handleWatchGenreChange(opt.id)}
                                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                                                    watchGenre === String(opt.id)
                                                        ? 'bg-[#C6FF00]/25 text-[#1d1d1f] ring-1 ring-[#C6FF00]/50'
                                                        : 'bg-[#f5f5f7] text-[#86868b] hover:bg-[#ebebed]'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">Sort order</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setSortOrder('trending')}
                                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                                                sortOrder === 'trending'
                                                    ? 'bg-[#C6FF00]/25 text-[#1d1d1f] ring-1 ring-[#C6FF00]/50'
                                                    : 'bg-[#f5f5f7] text-[#86868b] hover:bg-[#ebebed]'
                                            }`}
                                        >
                                            Trending
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSortOrder('latest')}
                                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                                                sortOrder === 'latest'
                                                    ? 'bg-[#C6FF00]/25 text-[#1d1d1f] ring-1 ring-[#C6FF00]/50'
                                                    : 'bg-[#f5f5f7] text-[#86868b] hover:bg-[#ebebed]'
                                            }`}
                                        >
                                            Latest
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSortOrder('random')}
                                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                                                sortOrder === 'random'
                                                    ? 'bg-[#C6FF00]/25 text-[#1d1d1f] ring-1 ring-[#C6FF00]/50'
                                                    : 'bg-[#f5f5f7] text-[#86868b] hover:bg-[#ebebed]'
                                            }`}
                                        >
                                            Random
                                        </button>
                                    </div>
                                </div>

                                <div className="w-full max-w-[14rem]">
                                    <label className="flex flex-col gap-1">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">Year</span>
                                        <select
                                            value={watchYear}
                                            onChange={e => handleWatchYearChange(e.target.value)}
                                            className="rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] px-3 py-2 text-[12px] text-[#1d1d1f] focus:border-[#C6FF00]/60 focus:bg-white focus:outline-none"
                                        >
                                            <option value="">All years</option>
                                            {watchYearOptions.map(opt => (
                                                <option key={opt.id} value={String(opt.id || '').trim()}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </MotionDiv>
                )}
            </AnimatePresence>

            {/* Stats */}
            {(catalog?.totalSeries != null || catalog?.totalEpisodes != null) && (
                <p className="text-[11px] text-[#86868b]">
                    {catalog.totalSeries != null && <span>{catalog.totalSeries} series</span>}
                    {catalog.totalEpisodes != null && <span> · {catalog.totalEpisodes} episodes</span>}
                    {catalog?.totalUpcoming != null && <span> · {catalog.totalUpcoming} upcoming</span>}
                    {catalog.catalogSource === 'recent_api' && <span> · cached index</span>}
                    {catalog.catalogSource === 'rss' && <span> · RSS mode</span>}
                    <span> · WatchHentai</span>
                </p>
            )}

            {/* Content */}
            {busy && !seriesList.length && !flatItems.length ? (
                <LifesyncHentaiCatalogGridSkeleton count={12} />
            ) : useFlatOnly ? (
                <>
                    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {filteredFlat.map((item, i) => {
                            const wrappedSeries = {
                                seriesKey: item.slug,
                                title: item.title,
                                posterUrl: item.posterUrl,
                                episodeCount: 1,
                                episodes: [item],
                            }
                            return (
                                <SeriesCard key={item.slug || item.watchUrl || i} series={wrappedSeries} onOpenDetail={setSelectedSeries} />
                            )
                        })}
                    </div>
                    {!filteredFlat.length && debouncedSearch && (
                        <div className="bg-white rounded-[18px] border border-[#d2d2d7]/50 shadow-sm px-6 py-10 text-center">
                            <p className="text-[13px] text-[#86868b]">No matches for "{debouncedSearch}".</p>
                        </div>
                    )}
                </>
            ) : seriesList.length > 0 ? (
                <>
                    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                        {seriesList.map((s, i) => (
                            <SeriesCard key={s.seriesKey || i} series={s} onOpenDetail={ser => {
                                setSelectedSeries(ser)
                            }} />
                        ))}
                    </div>
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                        <button disabled={page <= 1 || busy} onClick={() => goPage(page - 1)} className="text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-2 rounded-xl border border-[#e5e5ea] transition-colors disabled:opacity-30">
                            Prev
                        </button>
                        <span className="text-[12px] text-[#86868b] px-2">
                            Page {page}
                            {catalog?.hasMore === false && catalog?.totalSeries != null ? ` · ${catalog.totalSeries} total` : ''}
                        </span>
                        <button disabled={busy || catalog?.hasMore === false} onClick={() => goPage(page + 1)} className="text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-2 rounded-xl border border-[#e5e5ea] transition-colors disabled:opacity-30">
                            Next
                        </button>
                    </div>
                </>
            ) : !busy ? (
                <div className="bg-white rounded-[18px] border border-[#d2d2d7]/50 shadow-sm px-6 py-10 text-center">
                    <p className="text-[13px] text-[#86868b]">No content to display.</p>
                </div>
            ) : null}
            </div>
        </MotionDiv>
        </LayoutGroup>
    )
}
