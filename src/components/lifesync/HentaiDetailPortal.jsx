/**
 * Shared hentai detail + stream player portal.
 *
 * Usage:
 *   const { openSeries, portal } = useHentaiDetailPortal()
 *   // somewhere in JSX:
 *   {portal}
 *
 * The hook owns all popup state (selectedSeries, playerState, stream resolution)
 * so any page — home or browse — can trigger the detail sheet without navigating.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import AdvancedVideoPlayer from './AdvancedVideoPlayer'
import { FadeInImg } from './FadeInImg'
import useControllerSupportEnabled from '../../hooks/useControllerSupportEnabled'
import useLifeSyncGamepadInput from '../../hooks/useLifeSyncGamepadInput'
import {
    LifesyncEpisodeThumbnail,
    LifesyncHentaiEpisodeGridSkeleton,
    LifesyncStreamPlayerResolvingSkeleton,
    LifesyncTextLinesSkeleton,
} from './EpisodeLoadingSkeletons'
import { lifesyncFetch } from '../../lib/lifesyncApi'
import { dispatchBestEffortIframeMediaKeys, focusIframeForControllerInput, XBOX_GAMEPAD_BUTTONS } from '../../lib/lifeSyncControllerInput'
import { ControllerHintOverlay } from './ControllerHintOverlay'
import {
    AnimatePresence,
    lifeSyncDetailBackdropFadeTransition,
    lifeSyncDetailBodyRevealTransition,
    lifeSyncDetailOverlayFadeTransition,
    lifeSyncDetailSheetEnterAnimate,
    lifeSyncDetailSheetEnterInitial,
    lifeSyncDetailSheetExitVariant,
    lifeSyncDetailSheetMainTransition,
    lifeSyncSharedLayoutTransitionProps,
    MotionDiv,
} from '../../lib/lifesyncMotion'

// ── Helpers (private to this module) ─────────────────────────────────────────

const WATCH_HENTAI_SITE = 'https://watchhentai.net'

function isIOSDevice() {
    if (typeof navigator === 'undefined') return false
    const ua = navigator.userAgent || ''
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function hentaiSeriesPosterLayoutId(seriesKey) {
    const k = String(seriesKey ?? 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_')
    return `lifesync-hentai-portal-poster-${k}`
}

function seriesMixOrderKey(seriesKey) {
    const s = String(seriesKey || '')
    let h = 2166136261
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
    return h >>> 0
}

function normalizeGenreToken(v) { return String(v || '').trim().toLowerCase().replace(/\s+/g, ' ') }
function toGenreSet(value) {
    const out = new Set()
    for (const row of (Array.isArray(value) ? value : [])) { const t = normalizeGenreToken(row); if (t) out.add(t) }
    return out
}
function seriesEpisodeCount(s) {
    const d = Number(s?.episodeCount)
    return Number.isFinite(d) && d > 0 ? Math.floor(d) : (Array.isArray(s?.episodes) ? s.episodes.length : 0)
}
function seriesNewestEpisodeTime(s) {
    let newest = 0
    for (const ep of (Array.isArray(s?.episodes) ? s.episodes : [])) {
        const ts = Date.parse(String(ep?.pubDate || ''))
        if (Number.isFinite(ts)) newest = Math.max(newest, ts)
    }
    return newest
}
function pickSuggestionEpisode(series) {
    const eps = Array.isArray(series?.episodes) ? series.episodes : []
    return eps.find(ep => ep?.posterUrl) || eps[0] || null
}
function buildSeriesRecommendations({ currentSeries, allSeries, seriesGenresMap, limit = 12 }) {
    const rows = Array.isArray(allSeries) ? allSeries : []
    if (!rows.length) return []
    const currentKey = String(currentSeries?.seriesKey || '').trim()
    const currentGenres = toGenreSet(seriesGenresMap?.get?.(currentKey))
    const currentEpisodeCount = seriesEpisodeCount(currentSeries)
    const currentNewestTime = seriesNewestEpisodeTime(currentSeries)
    const ranked = []
    const seen = new Set(currentKey ? [currentKey] : [])
    for (let i = 0; i < rows.length; i++) {
        const c = rows[i]
        const key = String(c?.seriesKey || '').trim()
        if (!key || seen.has(key)) continue
        seen.add(key)
        if (!pickSuggestionEpisode(c)) continue
        const cg = toGenreSet(seriesGenresMap?.get?.(key))
        let shared = 0
        for (const t of currentGenres) { if (cg.has(t)) shared++ }
        const cc = seriesEpisodeCount(c), ct = seriesNewestEpisodeTime(c)
        let score = shared * 140
        if (currentEpisodeCount > 0 && cc > 0) score += Math.max(0, 28 - Math.abs(currentEpisodeCount - cc) * 4)
        if (ct > 0) score += Math.max(0, 30 - Math.max(0, (Date.now() - ct) / 86400000) / 8)
        if (currentNewestTime > 0 && ct > 0) score += Math.max(0, 18 - Math.abs(currentNewestTime - ct) / 86400000 / 20)
        if (c?.isUpcoming && !currentSeries?.isUpcoming) score -= 14
        else if (c?.isUpcoming && currentSeries?.isUpcoming) score += 10
        score += Math.max(0, 8 - i * 0.35) + (seriesMixOrderKey(key) % 1000) / 1000
        ranked.push({ ...c, _firstEp: pickSuggestionEpisode(c), _sharedGenres: shared, _score: score })
    }
    ranked.sort((a, b) => b._score !== a._score ? b._score - a._score : seriesMixOrderKey(a.seriesKey) - seriesMixOrderKey(b.seriesKey))
    return ranked.slice(0, Math.max(1, Number(limit) || 12))
}

function formatEpisodeDate(pubDate) {
    if (!pubDate) return null
    const t = Date.parse(pubDate)
    if (!Number.isFinite(t)) return null
    try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(t) } catch { return pubDate.slice(0, 10) }
}

export function slugFromItem(it) {
    if (it?.slug && String(it.slug).trim()) return String(it.slug).trim()
    for (const k of ['embedUrl', 'watchUrl']) {
        if (it?.[k]) {
            try {
                const m = /\/(embed|watch|videos)\/([^/?#]+)/.exec(new URL(it[k]).pathname)
                if (m) return decodeURIComponent(m[2])
            } catch { /* ignore */ }
        }
    }
    return ''
}

function qualityRank(v) {
    const m = String(v || '').match(/(\d{3,4})p/i)
    if (!m?.[1]) return 0
    const n = Number(m[1])
    return Number.isFinite(n) ? n : 0
}

function normalizeQualityOptions(raw) {
    if (!Array.isArray(raw)) return []
    const out = [], seen = new Set()
    for (const r of raw) {
        const url = typeof r?.url === 'string' && r.url.startsWith('http') ? r.url : ''
        if (!url) continue
        const type = r?.type === 'hls' ? 'hls' : 'mp4'
        const rank = Number.isFinite(Number(r?.rank)) ? Number(r.rank) : Math.max(qualityRank(r?.label), qualityRank(url))
        const label = String(r?.label || (rank > 0 ? `${rank}p` : type === 'hls' ? 'Auto (HLS)' : 'Default')).trim()
        const id = String(r?.id || `${rank || 'default'}p-${type}`).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-') || `${rank || 'default'}p-${type}`
        const k = `${type}|${url.toLowerCase()}`
        if (seen.has(k)) continue
        seen.add(k)
        out.push({ id, label, url, type, rank })
    }
    out.sort((a, b) => b.rank !== a.rank ? b.rank - a.rank : a.type !== b.type ? (a.type === 'mp4' ? -1 : 1) : a.label.localeCompare(b.label))
    const counts = new Map()
    return out.map(item => {
        const n = (counts.get(item.id) || 0) + 1
        counts.set(item.id, n)
        return n === 1 ? item : { ...item, id: `${item.id}-${n}` }
    })
}

function pickQualityOption(options, preferredId, ios) {
    if (!Array.isArray(options) || !options.length) return null
    const pool = ios ? options.filter(o => o.type === 'mp4') : options
    const candidates = pool.length > 0 ? pool : options
    if (preferredId) { const exact = candidates.find(o => o.id === preferredId); if (exact) return exact }
    return candidates[0] || null
}

function pickStableRandomBackdrop(backdropUrls, seed) {
    if (!Array.isArray(backdropUrls) || !backdropUrls.length) return null
    const clean = backdropUrls.filter(Boolean)
    if (!clean.length) return null
    const s = String(seed || 'lifesync-hentai')
    let h = 2166136261
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
    return clean[Math.abs(h >>> 0) % clean.length]
}

// ── Stream Player Popup ───────────────────────────────────────────────────────

function StreamPlayerPopup({ playerState, onClose, onChangeEpisode, onSelectQuality, allSeries, seriesGenresMap, onPlayFromSeries, onVideoFailure }) {
    const { stream, series, episodeIndex } = playerState
    const episodes = useMemo(() => series?.episodes || [], [series])
    const prevEp = episodeIndex > 0 ? episodes[episodeIndex - 1] : null
    const nextEp = episodeIndex >= 0 && episodeIndex < episodes.length - 1 ? episodes[episodeIndex + 1] : null
    const activeEpisode = episodeIndex >= 0 ? episodes[episodeIndex] : null
    const qualityOptions = Array.isArray(stream?.qualityOptions) ? stream.qualityOptions : []
    const canSelectQuality = Boolean(stream?.videoUrl && qualityOptions.length > 1)
    const playingRef = useRef(null)
    const streamIframeContainerRef = useRef(null)
    const streamIframeRef = useRef(null)
    const controllerSupportEnabled = useControllerSupportEnabled()
    const [isDarkTheme, setIsDarkTheme] = useState(() => typeof document !== 'undefined' && document.documentElement?.dataset?.maxienTheme === 'dark')

    useEffect(() => {
        if (typeof document === 'undefined') return undefined
        const root = document.documentElement
        const sync = () => setIsDarkTheme(root?.dataset?.maxienTheme === 'dark')
        sync()
        const obs = new MutationObserver(sync)
        obs.observe(root, { attributes: true, attributeFilter: ['data-maxien-theme'] })
        return () => obs.disconnect()
    }, [])

    const recommendations = useMemo(() => buildSeriesRecommendations({ currentSeries: series, allSeries, seriesGenresMap, limit: 12 }), [allSeries, series, seriesGenresMap])

    const dk = isDarkTheme
    const rootCls = dk ? 'bg-black text-white' : 'bg-(--color-surface-muted) text-(--color-text-primary)'
    const headerCls = dk ? 'border-b border-(--color-border-strong)/10 bg-black/40' : 'border-b border-(--color-border-strong)/70 bg-(--color-surface)/90'
    const panelCls = dk ? 'border border-(--color-border-strong)/10 bg-(--color-surface)/[0.04]' : 'border border-(--color-border-strong)/70 bg-(--color-surface)'
    const softPanelCls = dk ? 'border border-(--color-border-strong)/10 bg-black/35' : 'border border-(--color-border-soft) bg-(--color-surface-soft)'
    const mutedTxt = dk ? 'text-white/60' : 'text-(--color-text-secondary)'
    const subtleTxt = dk ? 'text-white/45' : 'text-(--color-text-secondary)'
    const titleTxt = dk ? 'text-white' : 'text-(--color-text-primary)'
    const accentTxt = dk ? 'text-(--color-primary)' : 'text-(--color-text-primary)'
    const hideScroll = '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

    useEffect(() => { playingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }) }, [episodeIndex])
    useEffect(() => {
        const onKey = e => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
    }, [onClose])

    const canPrevEpisode = Boolean(prevEp)
    const canNextEpisode = Boolean(nextEp)
    const progressLabel = episodes.length > 0 ? `${Math.min(episodes.length, episodeIndex + 1)} / ${episodes.length}` : null

    const toggleFullscreen = useCallback(() => {
        const el = streamIframeContainerRef.current
        if (!el) return
        if (!document.fullscreenElement) { el.requestFullscreen?.().catch(() => {}) }
        else { document.exitFullscreen?.().catch(() => {}) }
    }, [])

    const iframeHandlers = useMemo(() => ({
        [XBOX_GAMEPAD_BUTTONS.A]: () => dispatchBestEffortIframeMediaKeys(streamIframeRef.current, ['k', ' ', 'Spacebar', 'MediaPlayPause']),
        [XBOX_GAMEPAD_BUTTONS.Y]: () => dispatchBestEffortIframeMediaKeys(streamIframeRef.current, ['k', ' ', 'MediaPlay', 'MediaPlayPause']),
        [XBOX_GAMEPAD_BUTTONS.X]: () => { toggleFullscreen(); dispatchBestEffortIframeMediaKeys(streamIframeRef.current, ['f']) },
        [XBOX_GAMEPAD_BUTTONS.LT]: () => dispatchBestEffortIframeMediaKeys(streamIframeRef.current, ['j', 'ArrowLeft']),
        [XBOX_GAMEPAD_BUTTONS.RT]: () => dispatchBestEffortIframeMediaKeys(streamIframeRef.current, ['l', 'ArrowRight']),
        [XBOX_GAMEPAD_BUTTONS.DPAD_UP]: () => dispatchBestEffortIframeMediaKeys(streamIframeRef.current, ['ArrowUp']),
        [XBOX_GAMEPAD_BUTTONS.DPAD_DOWN]: () => dispatchBestEffortIframeMediaKeys(streamIframeRef.current, ['ArrowDown']),
        [XBOX_GAMEPAD_BUTTONS.LB]: () => { if (canPrevEpisode) onChangeEpisode(episodeIndex - 1) },
        [XBOX_GAMEPAD_BUTTONS.RB]: () => { if (canNextEpisode) onChangeEpisode(episodeIndex + 1) },
    }), [canNextEpisode, canPrevEpisode, episodeIndex, onChangeEpisode, toggleFullscreen])

    useLifeSyncGamepadInput({
        enabled: controllerSupportEnabled && Boolean(stream?.embedUrl) && !stream?.videoUrl,
        handlers: iframeHandlers,
        repeatableButtons: [XBOX_GAMEPAD_BUTTONS.LT, XBOX_GAMEPAD_BUTTONS.RT, XBOX_GAMEPAD_BUTTONS.DPAD_UP, XBOX_GAMEPAD_BUTTONS.DPAD_DOWN],
    })

    useEffect(() => {
        if (!stream?.embedUrl || typeof window === 'undefined') return undefined
        const id = window.setTimeout(() => focusIframeForControllerInput(streamIframeRef.current), 180)
        return () => window.clearTimeout(id)
    }, [stream?.embedUrl])

    return createPortal(
        <div className={`fixed inset-0 z-[9999] flex h-dvh max-h-dvh w-full max-w-[100vw] flex-col overflow-x-hidden overflow-y-hidden ${rootCls}`}>
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {dk ? (
                    <>
                        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-(--color-primary)/12 blur-[120px]" />
                        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-sky-400/8 blur-[135px]" />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08)_0%,rgba(2,2,2,0)_48%)]" />
                    </>
                ) : (
                    <>
                        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-(--color-primary)/18 blur-[120px]" />
                        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-sky-400/10 blur-[135px]" />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.85)_0%,rgba(255,255,255,0)_58%)]" />
                    </>
                )}
            </div>

            <header className={`relative flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-2 py-2.5 pl-3 pr-3 backdrop-blur-xl sm:flex-nowrap sm:gap-3 sm:px-4 sm:py-3 ${headerCls}`}>
                <div className="flex min-w-0 items-center gap-2.5">
                    <button type="button" onClick={onClose} className={`inline-flex min-w-0 shrink items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${dk ? 'border-(--color-border-strong)/15 bg-(--color-surface)/5 text-white/85 hover:bg-(--color-surface)/10 hover:text-white' : 'border-(--color-border-strong) bg-(--color-surface) text-(--color-text-primary) hover:bg-(--color-surface-muted)'}`}>
                        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                        <span className="truncate">Back</span>
                    </button>
                    <div className="hidden min-w-0 sm:block">
                        <p className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${subtleTxt}`}>Now Streaming</p>
                        <p className={`truncate text-[12px] font-medium ${mutedTxt}`}>{series?.title || 'LifeSync Stream'}</p>
                    </div>
                </div>
                <div className="flex min-w-0 items-center gap-2">
                    {progressLabel && <span className={`hidden rounded-full border px-2.5 py-1 text-[10px] font-semibold tabular-nums sm:inline-flex ${dk ? 'border-(--color-border-strong)/10 bg-(--color-surface)/[0.06] text-white/75' : 'border-(--color-border-strong) bg-(--color-surface-muted) text-(--color-text-secondary)'}`}>{progressLabel}</span>}
                    {stream.watchUrl && (
                        <a href={stream.watchUrl} target="_blank" rel="noreferrer" className={`inline-flex min-w-0 max-w-[min(100%,11rem)] shrink items-center justify-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-medium transition-colors sm:max-w-none sm:px-3 sm:text-[11px] ${dk ? 'border-(--color-border-strong)/15 bg-(--color-surface)/5 text-white/70 hover:border-(--color-primary)/45 hover:text-(--color-primary)' : 'border-(--color-border-strong) bg-(--color-surface) text-(--color-text-secondary) hover:border-(--color-primary)/60 hover:text-(--color-text-primary)'}`}>
                            <span className="truncate sm:whitespace-nowrap">Open source</span>
                            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </a>
                    )}
                </div>
            </header>

            <div className={`relative min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden ${hideScroll}`}>
                <div className="mx-auto grid w-full min-w-0 max-w-[1680px] gap-4 px-3 py-4 sm:px-4 lg:h-[calc(100dvh-6rem)] lg:grid-cols-[minmax(0,1.55fr)_minmax(310px,0.85fr)] lg:gap-5 lg:px-6">
                    <section className="min-w-0 space-y-4 lg:flex lg:h-full lg:flex-col lg:gap-4 lg:space-y-0">
                        <div className={`relative w-full min-w-0 shrink-0 overflow-hidden rounded-2xl border shadow-[0_28px_80px_rgba(0,0,0,0.5)] ${dk ? 'border-(--color-border-strong)/15 bg-black' : 'border-(--color-border-strong) bg-(--color-surface-muted)'}`}>
                            <div ref={streamIframeContainerRef} className="relative aspect-video w-full">
                                <div className="absolute inset-0">
                                    {stream.resolving ? <LifesyncStreamPlayerResolvingSkeleton />
                                        : stream.videoUrl ? (
                                            <AdvancedVideoPlayer key={stream.videoUrl} src={stream.videoUrl}
                                                onPrevEpisode={canPrevEpisode ? () => onChangeEpisode(episodeIndex - 1) : undefined}
                                                onNextEpisode={canNextEpisode ? () => onChangeEpisode(episodeIndex + 1) : undefined}
                                                canPrevEpisode={canPrevEpisode} canNextEpisode={canNextEpisode}
                                                onEnded={() => nextEp && onChangeEpisode(episodeIndex + 1)}
                                                onError={() => onVideoFailure?.()}
                                            />
                                        ) : stream.embedUrl ? (
                                            <iframe ref={streamIframeRef} title={stream.title} src={stream.embedUrl} tabIndex={0}
                                                onLoad={() => focusIframeForControllerInput(streamIframeRef.current)}
                                                className="h-full w-full border-0"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                                                allowFullScreen referrerPolicy="no-referrer-when-downgrade"
                                            />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center bg-(--color-surface-muted)">
                                                <p className={`text-[14px] ${dk ? 'text-white/35' : 'text-white/75'}`}>No stream available.</p>
                                            </div>
                                        )}
                                </div>
                            </div>
                        </div>

                        <div className={`min-w-0 shrink-0 rounded-2xl p-4 sm:p-5 ${panelCls}`}>
                            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1">
                                    <h1 className={`wrap-anywhere text-[17px] font-bold leading-snug tracking-tight sm:text-[21px] ${titleTxt}`}>{stream.title}</h1>
                                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                                        {series && <span className={`inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] ${dk ? 'border-(--color-border-strong)/10 bg-black/35 text-white/65' : 'border-(--color-border-strong) bg-(--color-surface-muted) text-(--color-text-secondary)'}`}><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-(--color-primary)" /><span className="min-w-0 truncate">{series.title}</span></span>}
                                        {progressLabel && <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold tabular-nums ${dk ? 'border-(--color-border-strong)/10 bg-black/35 text-white/62' : 'border-(--color-border-strong) bg-(--color-surface-muted) text-(--color-text-secondary)'}`}>Episode {progressLabel}</span>}
                                        {activeEpisode?.pubDate && <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] ${dk ? 'border-(--color-border-strong)/10 bg-black/35 text-white/55' : 'border-(--color-border-strong) bg-(--color-surface-muted) text-(--color-text-secondary)'}`}>{formatEpisodeDate(activeEpisode.pubDate) || activeEpisode.pubDate}</span>}
                                        {canSelectQuality && (
                                            <label className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${dk ? 'border-(--color-border-strong)/12 bg-black/35' : 'border-(--color-border-strong) bg-(--color-surface-muted)'}`}>
                                                <span className={`text-[10px] font-semibold uppercase tracking-wide ${dk ? 'text-white/55' : 'text-(--color-text-secondary)'}`}>Quality</span>
                                                <select value={stream.activeQuality || qualityOptions[0]?.id || ''} onChange={e => onSelectQuality?.(e.target.value)} className={`rounded bg-transparent text-[10px] font-semibold outline-none ${dk ? 'text-white' : 'text-(--color-text-primary)'}`}>
                                                    {qualityOptions.map(opt => <option key={opt.id} value={opt.id} className="text-black">{opt.label}</option>)}
                                                </select>
                                            </label>
                                        )}
                                    </div>
                                </div>
                                <div className="flex min-w-0 w-full items-stretch gap-2 sm:w-auto sm:shrink-0">
                                    <button type="button" disabled={!prevEp} onClick={() => prevEp && onChangeEpisode(episodeIndex - 1)} className={`inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-colors disabled:opacity-25 sm:min-w-[118px] ${dk ? 'border-(--color-border-strong)/15 bg-(--color-surface)/5 text-white/80 hover:bg-(--color-surface)/10' : 'border-(--color-border-strong) bg-(--color-surface) text-(--color-text-primary) hover:bg-(--color-surface-muted)'}`}>
                                        <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                        <span className="truncate">Previous</span>
                                    </button>
                                    <button type="button" disabled={!nextEp} onClick={() => nextEp && onChangeEpisode(episodeIndex + 1)} className={`inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border border-(--color-primary)/45 px-3 text-[12px] font-semibold transition-colors disabled:opacity-25 sm:min-w-[118px] ${dk ? 'bg-(--color-primary)/18 text-(--color-primary) hover:bg-(--color-primary)/28' : 'bg-(--color-primary)/45 text-(--color-text-primary) hover:bg-(--color-primary)/65'}`}>
                                        <span className="truncate">Next</span>
                                        <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                    </button>
                                </div>
                            </div>
                            {episodes.length > 1 && (
                                <div className={`mt-4 rounded-xl px-3.5 py-3 ${softPanelCls}`}>
                                    <p className={`text-[9px] font-semibold uppercase tracking-[0.16em] ${subtleTxt}`}>Up Next</p>
                                    <p className={`mt-1 line-clamp-2 text-[12px] font-medium leading-snug ${titleTxt}`}>{nextEp ? nextEp.title : 'You reached the final episode in this series.'}</p>
                                </div>
                            )}
                        </div>

                        {episodes.length > 0 && (
                            <div className={`min-w-0 rounded-2xl p-3 sm:p-4 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col ${panelCls}`}>
                                <div className="mb-3 flex min-w-0 items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${subtleTxt}`}>Episode Queue</p>
                                        <p className={`mt-0.5 line-clamp-2 text-[13px] font-semibold leading-snug ${titleTxt}`}>{series?.title}</p>
                                    </div>
                                    <span className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-medium tabular-nums ${dk ? 'border-(--color-border-strong)/10 bg-(--color-surface)/[0.06] text-white/55' : 'border-(--color-border-strong) bg-(--color-surface-muted) text-(--color-text-secondary)'}`}>{episodes.length}</span>
                                </div>
                                <div className={`max-h-[42dvh] overflow-y-auto pr-1 lg:min-h-0 lg:max-h-none lg:flex-1 ${hideScroll}`}>
                                    <ul className="space-y-1.5">
                                        {episodes.map((ep, i) => {
                                            const isCurrent = i === episodeIndex
                                            const epLabel = ep.episodeNum > 0 ? `Ep ${ep.episodeNum}` : `Part ${i + 1}`
                                            const dateLabel = formatEpisodeDate(ep.pubDate)
                                            const thumb = ep?.posterUrl || series?.posterUrl
                                            return (
                                                <li key={ep.slug || ep.watchUrl || i}>
                                                    <button ref={isCurrent ? playingRef : undefined} type="button" onClick={() => onChangeEpisode(i)} className={`group flex w-full min-w-0 items-center gap-2.5 rounded-xl border px-2 py-2 text-left transition-all ${isCurrent ? 'border-(--color-primary)/50 bg-(--color-primary)/14' : dk ? 'border-(--color-border-strong)/10 bg-black/30 hover:border-(--color-border-strong)/20 hover:bg-(--color-surface)/[0.06]' : 'border-(--color-border-soft) bg-(--color-surface-muted) hover:border-(--color-border-strong) hover:bg-(--color-surface)'}`}>
                                                        <div className={`relative h-12 w-[4.4rem] shrink-0 overflow-hidden rounded-lg ${dk ? 'bg-black/45' : 'bg-(--color-border-soft)'}`}>
                                                            {thumb ? <LifesyncEpisodeThumbnail src={thumb} dark={dk} className="absolute inset-0 h-full w-full" imgClassName="h-full w-full object-cover" /> : <div className={`flex h-full w-full items-center justify-center ${dk ? 'text-white/20' : 'text-(--color-text-secondary)'}`}><svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></div>}
                                                            {isCurrent && <span className="absolute left-1 top-1 z-[2] rounded bg-(--color-primary)/90 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-black">Live</span>}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className={`line-clamp-2 text-[11px] font-semibold leading-snug ${isCurrent ? accentTxt : titleTxt}`}>{ep.title}</p>
                                                            <p className={`mt-1 text-[9px] ${subtleTxt}`}>{epLabel}{dateLabel ? ` · ${dateLabel}` : ''}</p>
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
                        <div className={`min-w-0 rounded-2xl p-3 sm:p-4 lg:flex lg:h-full lg:min-h-0 lg:flex-col ${panelCls}`}>
                            <p className={`px-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${subtleTxt}`}>Suggested</p>
                            {recommendations.length > 0 ? (
                                <div className={`mt-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1 ${hideScroll}`}>
                                    <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
                                        {recommendations.map(rec => {
                                            const thumb = rec._firstEp?.posterUrl || rec.posterUrl
                                            return (
                                                <li key={rec.seriesKey}>
                                                    <button type="button" onClick={() => onPlayFromSeries?.(rec, 0)} className={`flex w-full gap-3 rounded-xl border p-2 text-left transition-colors ${dk ? 'border-transparent bg-black/25 hover:border-(--color-border-strong)/10 hover:bg-(--color-surface)/[0.06]' : 'border-(--color-border-soft) bg-(--color-surface-soft) hover:border-(--color-border-strong) hover:bg-(--color-surface)'}`}>
                                                        <div className={`relative h-[4.5rem] w-[5.5rem] shrink-0 overflow-hidden rounded-lg ${dk ? 'bg-black/30' : 'bg-(--color-border-soft)'}`}>
                                                            {thumb ? <LifesyncEpisodeThumbnail src={thumb} dark={dk} className="absolute inset-0 h-full w-full" imgClassName="h-full w-full object-cover" /> : <div className={`flex h-full w-full items-center justify-center ${dk ? 'text-white/12' : 'text-(--color-text-secondary)'}`}><svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></div>}
                                                            {rec.episodeCount > 1 && <span className={`absolute bottom-1 right-1 rounded px-1 py-px text-[8px] font-bold ${dk ? 'bg-black/75 text-white' : 'bg-(--color-surface)/95 text-(--color-text-primary) ring-1 ring-(--color-border-strong)'}`}>{rec.episodeCount} ep</span>}
                                                        </div>
                                                        <div className="min-w-0 flex-1 py-0.5">
                                                            <p className={`line-clamp-2 text-[12px] font-semibold leading-snug ${titleTxt}`}>{rec.title}</p>
                                                            <p className={`mt-1 text-[10px] ${subtleTxt}`}>{rec.episodeCount === 1 ? 'One episode' : `${rec.episodeCount} episodes`}</p>
                                                            {rec._sharedGenres > 0 && <p className={`mt-0.5 text-[9px] font-semibold ${accentTxt}`}>{rec._sharedGenres} shared genre{rec._sharedGenres === 1 ? '' : 's'}</p>}
                                                        </div>
                                                    </button>
                                                </li>
                                            )
                                        })}
                                    </ul>
                                </div>
                            ) : (
                                <p className={`mt-6 px-1 pb-4 text-center text-[12px] ${mutedTxt}`}>Nothing else to suggest right now.</p>
                            )}
                        </div>
                    </aside>
                </div>
            </div>

            <ControllerHintOverlay dark position="bottom-right" cols={2} hints={[
                { btns: ['A'], label: 'Play / Pause' }, { btns: ['LB'], label: 'Prev episode' },
                { btns: ['RB'], label: 'Next episode' }, { btns: ['LT'], label: 'Seek back' },
                { btns: ['RT'], label: 'Seek forward' }, { btns: ['↑↓'], label: 'Volume' }, { btns: ['X'], label: 'Fullscreen' },
            ]} />
        </div>,
        document.body,
    )
}

// ── Series Detail Popup ───────────────────────────────────────────────────────

function SeriesDetailPopup({ series, onClose, onPlayEpisode, genreTagClick, onGenresLoaded }) {
    const firstEp = series?.episodes?.[0]
    const initialSlug = series ? slugFromItem(firstEp || series) : ''
    const [detail, setDetail] = useState(null)
    const [detailBusy, setDetailBusy] = useState(() => Boolean(initialSlug))
    const [descExpanded, setDescExpanded] = useState(false)
    const [storyboardFailed, setStoryboardFailed] = useState(false)
    const [focusedEpIndex, setFocusedEpIndex] = useState(-1)
    const detailControllerEnabled = useControllerSupportEnabled()

    useEffect(() => {
        if (!series) return
        const slug = slugFromItem(series.episodes?.[0] || series)
        if (!slug) return
        let cancelled = false
        lifesyncFetch(`/api/v1/hentai/watchhentai/detail?slug=${encodeURIComponent(slug)}&view=full`)
            .then(d => { if (!cancelled) { setDetail(d); if (d?.genres?.length) onGenresLoaded?.(series.seriesKey, d.genres) } })
            .catch(() => {})
            .finally(() => { if (!cancelled) setDetailBusy(false) })
        return () => { cancelled = true }
    }, [series, onGenresLoaded])

    const episodes = useMemo(() =>
        Array.isArray(detail?.episodes) && detail?.episodes.length > 0 ? detail.episodes : (series?.episodes || []),
    [detail, series])

    const playbackSeries = useMemo(() => ({
        ...series,
        posterUrl: detail?.coverUrl || series?.posterUrl,
        episodes,
        episodeCount: episodes.length,
    }), [series, detail, episodes])

    const detailGamepadHandlers = useMemo(() => ({
        [XBOX_GAMEPAD_BUTTONS.DPAD_UP]: () => setFocusedEpIndex(prev => Math.max(0, prev <= 0 ? episodes.length - 1 : prev - 1)),
        [XBOX_GAMEPAD_BUTTONS.DPAD_DOWN]: () => setFocusedEpIndex(prev => (prev + 1) % Math.max(1, episodes.length)),
        [XBOX_GAMEPAD_BUTTONS.A]: () => { if (focusedEpIndex >= 0 && episodes[focusedEpIndex]) onPlayEpisode(playbackSeries, episodes[focusedEpIndex], focusedEpIndex) },
        [XBOX_GAMEPAD_BUTTONS.B]: () => { onClose?.() },
    }), [episodes, focusedEpIndex, onClose, onPlayEpisode, playbackSeries])

    useLifeSyncGamepadInput({ enabled: detailControllerEnabled && Boolean(series), handlers: detailGamepadHandlers, repeatableButtons: [XBOX_GAMEPAD_BUTTONS.DPAD_UP, XBOX_GAMEPAD_BUTTONS.DPAD_DOWN] })

    useEffect(() => {
        if (focusedEpIndex < 0) return
        document.querySelector('[data-focused-ep="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, [focusedEpIndex])

    useEffect(() => {
        const onKey = e => { if (e.key === 'Escape') onClose?.() }
        window.addEventListener('keydown', onKey)
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
    }, [onClose])

    if (!series) return null

    const posterLayoutId = hentaiSeriesPosterLayoutId(series.seriesKey)
    const coverImg = detail?.coverUrl || series.posterUrl
    const description = detail?.description ? String(detail.description).replace(/<[^>]*>/g, '') : ''
    const genres = detail?.genres || []
    const episodeSkeletonCount = Math.min(12, Math.max(3, episodes.length || 6))
    const isDark = typeof document !== 'undefined' && document.documentElement?.dataset?.maxienTheme === 'dark'
    const randomWatchBackdrop = pickStableRandomBackdrop(detail?.backdropUrls, `${series.seriesKey || series.title}-${slugFromItem(episodes[0] || series)}`)
    const heroBackground = randomWatchBackdrop || coverImg
    const usingStoryboard = Boolean(detail?.backdropUrl && !storyboardFailed)

    const node = (
        <MotionDiv className="fixed inset-0 z-[9998] flex h-dvh max-h-dvh w-full max-w-[100vw] min-w-0 items-end justify-center overflow-hidden p-0 sm:items-center sm:p-4" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={lifeSyncDetailOverlayFadeTransition}>
            <MotionDiv className="absolute inset-0 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={lifeSyncDetailBackdropFadeTransition} />
            <MotionDiv layout="size" layoutRoot className="lifesync-hentai-detail-sheet relative flex h-dvh max-h-dvh w-full min-w-0 flex-col overflow-hidden bg-(--color-surface) shadow-2xl sm:h-auto sm:max-h-[min(88vh,calc(100dvh-2rem))] sm:max-w-4xl sm:rounded-2xl" onClick={e => e.stopPropagation()} initial={lifeSyncDetailSheetEnterInitial} animate={lifeSyncDetailSheetEnterAnimate} exit={lifeSyncDetailSheetExitVariant} transition={lifeSyncDetailSheetMainTransition}>

                <div className="relative shrink-0">
                    {heroBackground && (
                        <>
                            <div className="absolute inset-0 overflow-hidden">
                                <FadeInImg src={heroBackground} alt="" onError={() => { if (usingStoryboard) setStoryboardFailed(true) }} className="w-full h-full object-cover opacity-65" />
                            </div>
                            <div className="absolute inset-0 lifesync-detail-hero-fade" />
                        </>
                    )}
                    {!heroBackground && <div className="absolute inset-0 lifesync-detail-hero-fallback" />}

                    <button type="button" onClick={onClose} className="absolute z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur-sm transition-all hover:bg-black/60 hover:text-white" style={{ top: '0.75rem', right: '0.75rem' }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>

                    <div className="relative flex flex-col items-center gap-4 px-4 pb-4 pt-5 text-center sm:flex-row sm:items-end sm:gap-5 sm:px-6 sm:pt-5 sm:text-left">
                        <div className="w-24 shrink-0 sm:w-36">
                            <MotionDiv layoutId={posterLayoutId} transition={lifeSyncSharedLayoutTransitionProps} className="w-full overflow-hidden rounded-xl bg-(--color-surface-muted) shadow-lg ring-1 ring-black/10" style={{ aspectRatio: '2/3' }}>
                                {coverImg ? <FadeInImg src={coverImg} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full min-h-[6.5rem] w-full items-center justify-center"><svg className="w-10 h-10 text-(--color-text-secondary)" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-12.75" /></svg></div>}
                            </MotionDiv>
                        </div>
                        <div className="flex min-w-0 w-full flex-1 flex-col justify-end pb-1">
                            <h2 className="wrap-anywhere text-[17px] font-bold leading-tight text-(--color-text-primary) line-clamp-4 sm:text-[22px] sm:line-clamp-3">{detail?.title || series.title}</h2>
                            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                                <span className="inline-flex items-center gap-1 bg-(--color-primary)/20 text-(--color-text-primary) text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" /></svg>
                                    {episodes.length === 1 ? '1 episode' : `${episodes.length} episodes`}
                                </span>
                                {detail?.releaseDate && <span className="text-[10px] font-medium text-(--color-text-secondary) bg-(--color-surface-muted) px-2 py-0.5 rounded-full">{detail.releaseDate}</span>}
                            </div>
                            {genres.length > 0 && (
                                <div className="mt-2.5 flex flex-wrap justify-center gap-1 sm:justify-start">
                                    {genres.map(g => (
                                        <button key={g} type="button" onClick={e => { e.stopPropagation(); genreTagClick?.(g); onClose() }} className="bg-(--color-primary)/10 text-(--color-text-primary) text-[10px] font-medium px-2 py-0.5 rounded-full hover:bg-(--color-primary)/25 transition-colors cursor-pointer">{g}</button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                    <MotionDiv key={String(series.seriesKey)} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={lifeSyncDetailBodyRevealTransition}>
                        {(detailBusy || description) && (
                            <div className="px-5 sm:px-6 py-3 border-b border-(--color-border-soft)">
                                {detailBusy && !description ? <LifesyncTextLinesSkeleton lines={4} dark={isDark} /> : (
                                    <>
                                        <p className={`text-[12px] leading-relaxed text-(--color-text-secondary) ${descExpanded ? '' : 'line-clamp-3'}`}>{description}</p>
                                        {description.length > 200 && <button type="button" onClick={() => setDescExpanded(v => !v)} className="mt-1 text-[11px] font-semibold text-(--color-primary) hover:underline">{descExpanded ? 'Show less' : 'Show more'}</button>}
                                    </>
                                )}
                            </div>
                        )}

                        <div className="px-5 sm:px-6 py-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-(--color-text-secondary) mb-3">
                                {detailBusy ? 'Episodes' : episodes.length === 1 ? 'Episode' : `${episodes.length} Episodes`}{' '}· tap to watch
                            </p>
                            {detailBusy ? <LifesyncHentaiEpisodeGridSkeleton count={episodeSkeletonCount} dark={isDark} /> : (
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {episodes.map((ep, i) => {
                                        const epThumb = ep?.posterUrl || coverImg
                                        const dimCover = !ep?.posterUrl && coverImg
                                        return (
                                            <button key={ep.watchUrl || ep.slug || i} type="button" data-focused-ep={focusedEpIndex === i ? 'true' : undefined} onClick={() => onPlayEpisode(playbackSeries, ep, i)} className={`group text-left overflow-hidden rounded-[14px] border bg-(--color-surface) shadow-sm hover:shadow-md transition-all ${focusedEpIndex === i ? 'border-(--color-primary) ring-2 ring-(--color-primary)/60' : 'border-(--color-border-strong)/50 hover:border-(--color-primary)/40'}`}>
                                                <div className="relative aspect-video w-full overflow-hidden bg-(--color-text-primary)">
                                                    {epThumb ? <LifesyncEpisodeThumbnail src={epThumb} className="absolute inset-0 h-full w-full" imgClassName={`h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]${dimCover ? ' opacity-50' : ''}`} /> : <div className="flex h-full w-full items-center justify-center text-white/25"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" /></svg></div>}
                                                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-1/2 bg-linear-to-t from-black/75 via-black/25 to-transparent" />
                                                    {ep.episodeNum > 0 && <span className="absolute left-2 top-2 z-[2] rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-white backdrop-blur-sm ring-1 ring-(--color-border-strong)/10">E{ep.episodeNum}</span>}
                                                    <div className="absolute inset-0 z-[2] flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 bg-black/25">
                                                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-(--color-primary) shadow-lg ring-2 ring-black/20"><svg className="ml-0.5 h-4 w-4 text-(--color-text-primary)" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></span>
                                                    </div>
                                                    <div className="absolute inset-x-0 bottom-0 z-[2] px-2.5 pb-2 pt-6"><p className="text-[11px] font-semibold leading-snug text-white line-clamp-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">{ep.title}</p></div>
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

// ── useHentaiDetailPortal hook ────────────────────────────────────────────────

/**
 * Encapsulates all hentai detail + stream player state.
 *
 * @param {Object} opts
 * @param {Array}  opts.allSeries        - full catalog series list for recommendations
 * @param {Map}    opts.seriesGenresMap  - Map<seriesKey, string[]> for genre-based recommendations
 * @param {Function} opts.onGenreClick  - called when a genre tag is clicked in the detail popup
 * @returns {{ openSeries, portal }}
 */
export function useHentaiDetailPortal({ allSeries = [], seriesGenresMap = null, onGenreClick = null } = {}) {
    const navigate = useNavigate()
    const [selectedSeries, setSelectedSeries] = useState(null)
    const [playerState, setPlayerState] = useState(null)
    const [preferredQualityId, setPreferredQualityId] = useState(null)
    const mountedRef = useRef(true)
    const seriesGenresRef = useRef(seriesGenresMap || new Map())

    useEffect(() => {
        mountedRef.current = true
        return () => { mountedRef.current = false }
    }, [])

    // Keep the genres map ref in sync when caller updates it
    useEffect(() => {
        if (seriesGenresMap) seriesGenresRef.current = seriesGenresMap
    }, [seriesGenresMap])

    const resolveStream = useCallback(async (ep, preferredQuality = null) => {
        const slug = slugFromItem(ep)
        const embedUrl = ep?.embedUrl || (slug ? `${WATCH_HENTAI_SITE}/videos/${encodeURIComponent(slug)}/` : '')
        const watchUrl = ep?.watchUrl || (slug ? `${WATCH_HENTAI_SITE}/videos/${encodeURIComponent(slug)}/` : '')
        if (!slug || !embedUrl) return null
        const base = { title: ep.title, embedUrl, watchUrl, slug, videoUrl: null, qualityOptions: [], activeQuality: null, resolving: false }
        try {
            const data = await lifesyncFetch(`/api/v1/hentai/watchhentai/stream?slug=${encodeURIComponent(slug)}&view=full`)
            const mp4 = typeof data.videoUrl === 'string' && data.videoUrl.startsWith('http') ? data.videoUrl : null
            const hls = typeof data.hlsUrl === 'string' && data.hlsUrl.startsWith('http') ? data.hlsUrl : null
            let qualityOptions = normalizeQualityOptions(data?.qualityOptions)
            if (!qualityOptions.length) {
                const inferred = []
                if (mp4) inferred.push({ id: `${qualityRank(mp4) || 'default'}p-mp4`, label: qualityRank(mp4) > 0 ? `${qualityRank(mp4)}p` : 'Default', url: mp4, type: 'mp4', rank: qualityRank(mp4) })
                if (hls) inferred.push({ id: `${qualityRank(hls) || 'auto'}p-hls`, label: qualityRank(hls) > 0 ? `${qualityRank(hls)}p (HLS)` : 'Auto (HLS)', url: hls, type: 'hls', rank: qualityRank(hls) })
                qualityOptions = normalizeQualityOptions(inferred)
            }
            const selected = pickQualityOption(qualityOptions, preferredQuality, isIOSDevice())
            const videoUrl = selected?.url || (isIOSDevice() ? mp4 : (hls || mp4)) || null
            return { ...base, embedUrl: data.embedUrl || embedUrl, videoUrl, qualityOptions, activeQuality: selected?.id || null }
        } catch { return base }
    }, [])

    const playEpisode = useCallback(async (series, ep, epIndex) => {
        setSelectedSeries(null)
        const stream = { title: ep.title, embedUrl: ep.embedUrl || '', watchUrl: ep.watchUrl || '', slug: slugFromItem(ep), videoUrl: null, qualityOptions: [], activeQuality: preferredQualityId, resolving: true }
        setPlayerState({ stream, series, episodeIndex: epIndex })
        const resolved = await resolveStream(ep, preferredQualityId)
        if (!mountedRef.current) return
        if (resolved) setPlayerState(prev => prev ? { ...prev, stream: resolved } : null)
    }, [preferredQualityId, resolveStream])

    const changePlayerEpisode = useCallback(async (newIndex) => {
        setPlayerState(prev => {
            if (!prev?.series?.episodes?.[newIndex]) return prev
            const ep = prev.series.episodes[newIndex]
            return { ...prev, stream: { title: ep.title, embedUrl: ep.embedUrl || '', watchUrl: ep.watchUrl || '', slug: slugFromItem(ep), videoUrl: null, qualityOptions: [], activeQuality: preferredQualityId, resolving: true }, episodeIndex: newIndex }
        })
        setPlayerState(snap => {
            const ep = snap?.series?.episodes?.[newIndex]
            if (!ep) return snap
            resolveStream(ep, preferredQualityId).then(resolved => {
                if (!mountedRef.current || !resolved) return
                setPlayerState(prev => prev ? { ...prev, stream: resolved } : null)
            })
            return snap
        })
    }, [preferredQualityId, resolveStream])

    const selectStreamQuality = useCallback((qualityId) => {
        setPreferredQualityId(qualityId || null)
        setPlayerState(prev => {
            if (!prev?.stream) return prev
            const opt = (prev.stream.qualityOptions || []).find(o => o.id === qualityId)
            if (!opt?.url) return prev
            return { ...prev, stream: { ...prev.stream, activeQuality: opt.id, videoUrl: opt.url } }
        })
    }, [])

    const fallbackStreamQuality = useCallback(() => {
        let nextId = null
        setPlayerState(prev => {
            if (!prev?.stream) return prev
            const opts = Array.isArray(prev.stream.qualityOptions) ? prev.stream.qualityOptions : []
            if (!opts.length) return { ...prev, stream: { ...prev.stream, videoUrl: null, activeQuality: null } }
            const idx = opts.findIndex(o => o.id === prev.stream.activeQuality)
            const next = opts.slice(idx >= 0 ? idx + 1 : 0).find(o => o?.url && o.url !== prev.stream.videoUrl)
            if (!next) return { ...prev, stream: { ...prev.stream, videoUrl: null, activeQuality: null } }
            nextId = next.id
            return { ...prev, stream: { ...prev.stream, activeQuality: next.id, videoUrl: next.url } }
        })
        if (nextId) setPreferredQualityId(nextId)
    }, [])

    const addGenresForSeries = useCallback((seriesKey, genres) => {
        if (!genres?.length || seriesGenresRef.current.has(seriesKey)) return
        seriesGenresRef.current.set(seriesKey, genres)
    }, [])

    const openSeries = useCallback((seriesItem) => {
        setSelectedSeries(seriesItem)
        setPlayerState(null)
    }, [])

    const close = useCallback(() => {
        setSelectedSeries(null)
        setPlayerState(null)
    }, [])

    const portal = (
        <AnimatePresence mode="sync">
            {selectedSeries ? (
                <SeriesDetailPopup
                    key={selectedSeries.seriesKey}
                    series={selectedSeries}
                    onClose={close}
                    onPlayEpisode={(playSeries, ep, idx) => void playEpisode(playSeries, ep, idx)}
                    onGenresLoaded={addGenresForSeries}
                    genreTagClick={g => { addGenresForSeries(selectedSeries.seriesKey, [g]); onGenreClick?.(g) }}
                />
            ) : null}
        </AnimatePresence>
    )

    const playerPortal = playerState ? (
        <StreamPlayerPopup
            playerState={playerState}
            onClose={close}
            onChangeEpisode={idx => void changePlayerEpisode(idx)}
            onSelectQuality={selectStreamQuality}
            allSeries={allSeries}
            seriesGenresMap={seriesGenresRef.current}
            onPlayFromSeries={(ser, epIdx) => void playEpisode(ser, ser.episodes[epIdx], epIdx)}
            onVideoFailure={fallbackStreamQuality}
        />
    ) : null

    return {
        openSeries,
        portal: <>{portal}{playerPortal}</>,
        /** true when either popup is open — callers can use this to suppress pointer events */
        isOpen: Boolean(selectedSeries || playerState),
        close,
    }
}
