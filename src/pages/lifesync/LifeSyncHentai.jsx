import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import AdvancedVideoPlayer from '../../components/lifesync/AdvancedVideoPlayer'
import { useLifeSync } from '../../context/LifeSyncContext'
import { lifesyncFetch, isPluginEnabled } from '../../lib/lifesyncApi'

const HENTAI_OCEAN_SITE = 'https://hentaiocean.com'
const SERIES_PER_PAGE = 24

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

/* ─── Fullscreen Player Popup (watch layout) ───────────────────────────── */

function StreamPlayerPopup({ playerState, onClose, onChangeEpisode, allSeries, onPlayFromSeries }) {
    const { stream, series, episodeIndex } = playerState
    const episodes = useMemo(() => series?.episodes || [], [series])
    const prevEp = episodeIndex > 0 ? episodes[episodeIndex - 1] : null
    const nextEp = episodeIndex >= 0 && episodeIndex < episodes.length - 1 ? episodes[episodeIndex + 1] : null
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
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
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

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex h-dvh max-h-dvh w-full max-w-[100vw] flex-col overflow-x-hidden overflow-y-hidden bg-[#0a0a0a] text-white"
            style={{ paddingLeft: 'max(0px, env(safe-area-inset-left))', paddingRight: 'max(0px, env(safe-area-inset-right))' }}
        >
            <header
                className="flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-[#0a0a0a]/95 py-2.5 pl-3 pr-3 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur-md sm:flex-nowrap sm:gap-3 sm:px-4 sm:py-3"
            >
                <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex min-w-0 shrink items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white/80 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
                >
                    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                    <span className="truncate">Back</span>
                </button>
                {stream.watchUrl ? (
                    <a
                        href={stream.watchUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Open on source site"
                        className="inline-flex min-w-0 max-w-[min(100%,11rem)] shrink items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-medium text-white/65 transition-colors hover:border-[#C6FF00]/35 hover:text-[#C6FF00] sm:max-w-none sm:px-3 sm:text-[11px]"
                    >
                        <span className="truncate sm:whitespace-nowrap">Open source</span>
                        <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                ) : <span className="w-px shrink-0" aria-hidden />}
            </header>

            <div
                className={`min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden pb-[env(safe-area-inset-bottom,0px)] ${hideScroll}`}
            >
                <div className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-col gap-0 px-3 pb-8 pt-3 sm:px-4 lg:flex-row lg:items-start lg:gap-8 lg:px-6 lg:pt-4">
                    {/* Primary column — inset from viewport so rounded player + controls are never clipped by overflow-x-hidden */}
                    <div className="flex min-w-0 w-full max-w-full flex-1 flex-col">
                        {/* Player: absolute fill fixes AdvancedVideoPlayer height inside aspect box */}
                        <div className="relative w-full max-w-full overflow-hidden rounded-xl bg-black ring-1 ring-white/10 sm:rounded-2xl">
                            <div className="relative aspect-video w-full">
                                <div className="absolute inset-0">
                                    {stream.resolving ? (
                                        <div className="flex h-full w-full flex-col items-center justify-center bg-[#111]">
                                            <div className="flex gap-1.5">{[0, 150, 300].map(d => <span key={d} className="h-2.5 w-2.5 rounded-full bg-[#C6FF00] animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</div>
                                            <p className="mt-3 text-[13px] text-white/45">Resolving stream…</p>
                                        </div>
                                    ) : stream.videoUrl ? (
                                        <AdvancedVideoPlayer
                                            key={stream.videoUrl}
                                            src={stream.videoUrl}
                                            onEnded={() => nextEp && onChangeEpisode(episodeIndex + 1)}
                                        />
                                    ) : stream.embedUrl ? (
                                        <iframe
                                            title={stream.title}
                                            src={stream.embedUrl}
                                            className="h-full w-full border-0"
                                            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
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

                        {/* Title + actions (YouTube order) */}
                        <div className="min-w-0 max-w-full border-b border-white/[0.06] py-4 lg:px-0">
                            <h1 className="wrap-anywhere text-[17px] font-bold leading-snug tracking-tight text-white sm:text-[20px]">{stream.title}</h1>
                            <div className="mt-3 flex min-w-0 max-w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                                {series && (
                                    <span className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1.5 text-[12px] text-white/55">
                                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#C6FF00]" aria-hidden />
                                        <span className="min-w-0 truncate">{series.title}</span>
                                        <span className="shrink-0 text-white/25">·</span>
                                        <span className="shrink-0 tabular-nums">{episodeIndex + 1} / {episodes.length}</span>
                                    </span>
                                )}
                                <div className="flex min-w-0 w-full items-stretch gap-2 sm:ml-auto sm:w-auto sm:items-center">
                                    <button
                                        type="button"
                                        disabled={!prevEp}
                                        onClick={() => prevEp && onChangeEpisode(episodeIndex - 1)}
                                        className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 text-[12px] font-medium text-white/75 transition-colors hover:bg-white/10 disabled:opacity-25 sm:flex-initial sm:px-4"
                                    >
                                        <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                        <span className="truncate">Previous</span>
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!nextEp}
                                        onClick={() => nextEp && onChangeEpisode(episodeIndex + 1)}
                                        className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border border-[#C6FF00]/40 bg-[#C6FF00]/15 px-3 text-[12px] font-semibold text-[#C6FF00] transition-colors hover:bg-[#C6FF00]/25 disabled:opacity-25 sm:flex-initial sm:px-4"
                                    >
                                        <span className="truncate">Next</span>
                                        <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Episode rail */}
                        {episodes.length > 0 && series && (
                            <div className="min-w-0 max-w-full py-4 lg:px-0">
                                <div className="mb-3 flex min-w-0 max-w-full items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">Episodes</p>
                                        <p className="mt-0.5 line-clamp-2 wrap-anywhere text-[13px] font-semibold leading-snug text-white/90">{series.title}</p>
                                    </div>
                                    <span className="shrink-0 rounded-md bg-white/[0.06] px-2 py-1 text-[10px] font-medium tabular-nums text-white/45">{episodes.length} videos</span>
                                </div>
                                <div className={`flex w-full min-w-0 gap-2.5 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-1 pt-0.5 ${hideScroll} snap-x snap-mandatory`}>
                                    {episodes.map((ep, i) => {
                                        const isCurrent = i === episodeIndex
                                        const poster = ep.posterUrl || series.posterUrl
                                        const dateLabel = formatEpisodeDate(ep.pubDate)
                                        const epLabel = ep.episodeNum > 0 ? `Ep. ${ep.episodeNum}` : `Part ${i + 1}`
                                        const detailTitle = [epLabel, dateLabel, ep.slug].filter(Boolean).join(' · ')
                                        return (
                                            <button
                                                key={ep.slug || ep.watchUrl || i}
                                                ref={isCurrent ? playingRef : undefined}
                                                type="button"
                                                onClick={() => onChangeEpisode(i)}
                                                title={detailTitle || ep.title}
                                                className={`w-[min(132px,calc(100%-0.5rem))] shrink-0 snap-start overflow-hidden rounded-xl text-left transition-all sm:w-[152px] ${
                                                    isCurrent
                                                        ? 'bg-[#C6FF00]/12 ring-1 ring-inset ring-[#C6FF00]/50'
                                                        : 'bg-white/[0.04] ring-1 ring-inset ring-white/10 hover:bg-white/[0.08]'
                                                }`}
                                            >
                                                <div className="relative aspect-video w-full bg-black/40">
                                                    {poster ? (
                                                        <img src={poster} alt="" className="h-full w-full object-cover" loading="lazy" />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center text-white/15">
                                                            <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                        </div>
                                                    )}
                                                    {isCurrent ? (
                                                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/95 via-black/50 to-transparent py-1.5 pt-5">
                                                            <span className="flex h-2.5 items-end gap-0.5">
                                                                {[0, 100, 50].map((d, bi) => (
                                                                    <span key={bi} className="w-0.5 animate-pulse rounded-full bg-[#C6FF00]" style={{ height: `${5 + bi * 2}px`, animationDelay: `${d}ms` }} />
                                                                ))}
                                                            </span>
                                                            <span className="text-[8px] font-bold uppercase tracking-wider text-[#C6FF00]">Live</span>
                                                        </div>
                                                    ) : (
                                                        <span className="absolute left-1 top-1 rounded bg-black/70 px-1 py-0.5 text-[8px] font-bold tabular-nums text-white">
                                                            {i + 1}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="min-w-0 p-2">
                                                    <p className={`line-clamp-3 wrap-anywhere text-[10px] font-semibold leading-snug ${isCurrent ? 'text-[#C6FF00]' : 'text-white/88'}`}>
                                                        {ep.title}
                                                    </p>
                                                    <p className="mt-1 wrap-anywhere text-[9px] leading-snug text-white/38">{epLabel}{dateLabel ? ` · ${dateLabel}` : ''}</p>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <aside className="w-full min-w-0 max-w-full shrink-0 border-t border-white/[0.06] bg-[#0a0a0a] lg:w-[min(100%,340px)] lg:max-w-[340px] lg:border-l lg:border-t-0 lg:bg-transparent lg:pl-2 lg:pr-0 xl:max-w-[380px] xl:w-[min(100%,380px)]">
                        <div className={`min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto ${hideScroll}`}>
                            <div className="min-w-0 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 lg:p-4">
                                <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">Suggested</p>
                                {recommendations.length > 0 ? (
                                    <ul className="mt-3 flex flex-col gap-1">
                                        {recommendations.map(rec => (
                                            <li key={rec.seriesKey}>
                                                <button
                                                    type="button"
                                                    onClick={() => onPlayFromSeries?.(rec, 0)}
                                                    className="flex w-full gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/[0.06]"
                                                >
                                                    <div className="relative h-[4.5rem] w-[5.5rem] shrink-0 overflow-hidden rounded-lg bg-black/30">
                                                        {(rec._firstEp?.posterUrl || rec.posterUrl) ? (
                                                            <img src={rec._firstEp?.posterUrl || rec.posterUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
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
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="mt-6 px-1 pb-4 text-center text-[12px] text-white/30">Nothing else to suggest right now.</p>
                                )}
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </div>,
        document.body,
    )
}

/* ─── Cinematic Series Detail + Episode Picker ─────────────────────────── */

function SeriesDetailPopup({ series, onClose, onPlayEpisode, genreTagClick, onGenresLoaded }) {
    const [detail, setDetail] = useState(null)
    const [detailBusy, setDetailBusy] = useState(false)
    const [descExpanded, setDescExpanded] = useState(false)

    useEffect(() => {
        if (!series) return
        const firstEp = series.episodes?.[0]
        const slug = slugFromItem(firstEp || series)
        if (!slug) return
        let cancelled = false
        setDetailBusy(true)
        lifesyncFetch(`/api/anime/hentai-ocean/detail?slug=${encodeURIComponent(slug)}`)
            .then(d => {
                if (!cancelled) {
                    setDetail(d)
                    if (d?.genres?.length) onGenresLoaded?.(series.seriesKey, d.genres)
                }
            })
            .catch(() => {})
            .finally(() => { if (!cancelled) setDetailBusy(false) })
        return () => { cancelled = true }
    }, [series, onGenresLoaded])

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

    const coverImg = detail?.coverUrl || series.posterUrl
    const description = detail?.description ? String(detail.description).replace(/<[^>]*>/g, '') : ''
    const genres = detail?.genres || []
    const episodes = series.episodes || []

    const node = (
        <div
            className="fixed inset-0 z-[9998] flex min-w-0 items-end justify-center p-0 sm:items-center sm:p-4"
            onClick={onClose}
            style={{ paddingLeft: 'max(0px, env(safe-area-inset-left))', paddingRight: 'max(0px, env(safe-area-inset-right))' }}
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

            <div
                className="relative flex max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)))] w-full min-w-0 max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl animate-[slideUp_0.3s_ease-out] sm:max-h-[min(88vh,calc(100dvh-2rem))] sm:rounded-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Hero with blurred poster background */}
                <div className="relative shrink-0">
                    {coverImg && (
                        <>
                            <div className="absolute inset-0 overflow-hidden">
                                <img src={coverImg} alt="" className="w-full h-full object-cover scale-110 blur-2xl opacity-60" />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-white" />
                        </>
                    )}
                    {!coverImg && <div className="absolute inset-0 bg-gradient-to-b from-[#1d1d1f] to-white" />}

                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur-sm transition-all hover:bg-black/60 hover:text-white"
                        style={{ top: 'max(0.75rem, env(safe-area-inset-top))', right: 'max(0.75rem, env(safe-area-inset-right))' }}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>

                    <div className="relative flex flex-col items-center gap-4 px-4 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] text-center sm:flex-row sm:items-end sm:gap-5 sm:px-6 sm:pt-5 sm:text-left">
                        <div className="w-24 shrink-0 sm:w-36">
                            {coverImg ? (
                                <img src={coverImg} alt="" className="w-full aspect-[2/3] object-cover rounded-xl shadow-lg ring-1 ring-black/10" />
                            ) : (
                                <div className="w-full aspect-[2/3] rounded-xl bg-[#f5f5f7] flex items-center justify-center">
                                    <svg className="w-10 h-10 text-[#86868b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-12.75" /></svg>
                                </div>
                            )}
                        </div>
                        <div className="flex min-w-0 w-full flex-1 flex-col justify-end pb-1">
                            <h2 className="wrap-anywhere text-[17px] font-bold leading-tight text-[#1d1d1f] line-clamp-4 sm:text-[22px] sm:line-clamp-3">
                                {detail?.title || series.title}
                            </h2>
                            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                                <span className="inline-flex items-center gap-1 bg-[#C6FF00]/20 text-[#1d1d1f] text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" /></svg>
                                    {series.episodeCount === 1 ? '1 episode' : `${series.episodeCount} episodes`}
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
                <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom,0px)]">
                    {/* Description */}
                    {(detailBusy || description) && (
                        <div className="px-5 sm:px-6 py-3 border-b border-[#f0f0f0]">
                            {detailBusy && !description ? (
                                <div className="flex gap-1.5">{[0, 150, 300].map(d => <span key={d} className="w-2 h-2 rounded-full bg-[#e5e5ea] animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</div>
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

                    {/* Episode grid */}
                    <div className="px-5 sm:px-6 py-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#86868b] mb-3">
                            {episodes.length === 1 ? 'Episode' : `${episodes.length} Episodes`} — tap to watch
                        </p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                            {episodes.map((ep, i) => (
                                <button
                                    key={ep.watchUrl || ep.slug || i}
                                    type="button"
                                    onClick={() => onPlayEpisode(ep, i)}
                                    className="group text-left overflow-hidden rounded-[14px] border border-[#d2d2d7]/50 bg-white shadow-sm hover:shadow-md hover:border-[#C6FF00]/40 transition-all"
                                >
                                    <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#f5f5f7]">
                                        {ep.posterUrl ? (
                                            <img src={ep.posterUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" />
                                        ) : coverImg ? (
                                            <img src={coverImg} alt="" className="h-full w-full object-cover opacity-50" loading="lazy" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-[#86868b]">
                                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" /></svg>
                                            </div>
                                        )}
                                        {ep.episodeNum > 0 && (
                                            <span className="absolute left-1.5 top-1.5 rounded-md bg-[#1d1d1f]/80 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-white backdrop-blur-sm">
                                                E{ep.episodeNum}
                                            </span>
                                        )}
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                                            <span className="w-10 h-10 bg-[#C6FF00] rounded-full flex items-center justify-center shadow-lg">
                                                <svg className="w-4 h-4 ml-0.5 text-[#1d1d1f]" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                            </span>
                                        </div>
                                    </div>
                                    <div className="p-2">
                                        <p className="text-[10px] font-semibold text-[#1d1d1f] line-clamp-2 leading-snug">{ep.title}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )

    return createPortal(node, document.body)
}

/* ─── Series Card ──────────────────────────────────────────────────────── */

function SeriesCard({ series, onOpenDetail }) {
    return (
        <button type="button" onClick={() => onOpenDetail?.(series)} className="group w-full text-left">
            <div className="bg-white rounded-[18px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden hover:shadow-md transition-all">
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#f5f5f7]">
                    {series.posterUrl ? (
                        <img src={series.posterUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" loading="lazy" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#86868b]">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-12.75" />
                            </svg>
                        </div>
                    )}
                    {series.episodeCount != null && (
                        <span className="absolute right-2 top-2 bg-white/95 text-[#1d1d1f] text-[10px] font-bold px-2 py-0.5 rounded-lg ring-1 ring-[#e5e5ea]">
                            {series.episodeCount === 1 ? '1 ep' : `${series.episodeCount} ep`}
                        </span>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute bottom-0 inset-x-0 p-3 pointer-events-none">
                        <p className="text-[13px] font-semibold text-white line-clamp-2 drop-shadow">{series.title}</p>
                    </div>
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
}

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

    const [selectedSeries, setSelectedSeries] = useState(null)
    const [playerState, setPlayerState] = useState(null)

    const [knownGenres, setKnownGenres] = useState([])
    const seriesGenresRef = useRef(new Map())
    const [activeGenre, setActiveGenre] = useState(null)

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchQ.trim()), 320)
        return () => clearTimeout(t)
    }, [searchQ])

    const load = useCallback(async (p = 1, q = '', refresh = false) => {
        setBusy(true)
        setError('')
        try {
            const params = new URLSearchParams({ page: String(p), perPage: String(SERIES_PER_PAGE) })
            if (q.trim()) params.set('q', q.trim())
            if (refresh) params.set('refresh', '1')
            const data = await lifesyncFetch(`/api/anime/hentai-ocean/home?${params}`)
            setCatalog(data)
        } catch (e) {
            setError(e.message || 'Failed to load')
        } finally {
            setBusy(false)
        }
    }, [])

    useEffect(() => {
        if (isLifeSyncConnected && nsfwEnabled && pluginEnabled) {
            setPage(1)
            load(1, debouncedSearch, false)
        }
    }, [isLifeSyncConnected, nsfwEnabled, pluginEnabled, debouncedSearch, load])

    const addGenresForSeries = useCallback((seriesKey, genres) => {
        if (!genres?.length) return
        const map = seriesGenresRef.current
        if (map.has(seriesKey)) return
        map.set(seriesKey, genres)
        const all = new Set()
        for (const arr of map.values()) arr.forEach(g => all.add(g))
        setKnownGenres([...all].sort())
    }, [])

    const resolveStream = useCallback(async (ep) => {
        const slug = slugFromItem(ep)
        const embedUrl = ep?.embedUrl || (slug ? `${HENTAI_OCEAN_SITE}/embed/${encodeURIComponent(slug)}` : '')
        const watchUrl = ep?.watchUrl || (slug ? `${HENTAI_OCEAN_SITE}/watch/${encodeURIComponent(slug)}` : '')
        if (!slug || !embedUrl) return null
        const base = { title: ep.title, embedUrl, watchUrl, slug, videoUrl: null, resolving: false }
        try {
            const data = await lifesyncFetch(`/api/anime/hentai-ocean/stream?slug=${encodeURIComponent(slug)}`)
            const videoUrl = typeof data.videoUrl === 'string' && data.videoUrl.startsWith('http') ? data.videoUrl : null
            return { ...base, embedUrl: data.embedUrl || embedUrl, videoUrl }
        } catch {
            return base
        }
    }, [])

    const playEpisode = useCallback(async (series, ep, epIndex) => {
        setSelectedSeries(null)
        const stream = { title: ep.title, embedUrl: ep.embedUrl || '', watchUrl: ep.watchUrl || '', slug: slugFromItem(ep), videoUrl: null, resolving: true }
        setPlayerState({ stream, series, episodeIndex: epIndex })
        const resolved = await resolveStream(ep)
        if (resolved) {
            setPlayerState(prev => prev ? { ...prev, stream: resolved } : null)
        }
    }, [resolveStream])

    const changePlayerEpisode = useCallback(async (newIndex) => {
        setPlayerState(prev => {
            if (!prev?.series?.episodes?.[newIndex]) return prev
            const ep = prev.series.episodes[newIndex]
            const stream = { title: ep.title, embedUrl: ep.embedUrl || '', watchUrl: ep.watchUrl || '', slug: slugFromItem(ep), videoUrl: null, resolving: true }
            return { ...prev, stream, episodeIndex: newIndex }
        })
        const series = playerState?.series
        const ep = series?.episodes?.[newIndex]
        if (ep) {
            const resolved = await resolveStream(ep)
            if (resolved) {
                setPlayerState(prev => prev ? { ...prev, stream: resolved } : null)
            }
        }
    }, [playerState?.series, resolveStream])

    function handleSearch(e) {
        e.preventDefault()
        setActiveGenre(null)
        setPage(1)
        setDebouncedSearch(searchQ.trim())
    }

    function handleGenreClick(genre) {
        if (activeGenre === genre) {
            setActiveGenre(null)
            setSearchQ('')
            setDebouncedSearch('')
        } else {
            setActiveGenre(genre)
            setSearchQ(genre)
            setDebouncedSearch(genre)
        }
        setPage(1)
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

    const filteredFlat = useMemo(() => {
        const q = debouncedSearch.toLowerCase()
        if (!q || !useFlatOnly) return flatItems
        return flatItems.filter(it => String(it.title || '').toLowerCase().includes(q))
    }, [flatItems, debouncedSearch, useFlatOnly])

    if (!isLifeSyncConnected) {
        return (
            <div className="max-w-4xl mx-auto">
                <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight mb-2">Hentai</h1>
                <div className="bg-white rounded-[20px] border border-[#d2d2d7]/50 shadow-sm px-8 py-16 text-center">
                    <p className="text-[15px] font-bold text-[#1d1d1f] mb-2">LifeSync Not Connected</p>
                    <p className="text-[13px] text-[#86868b] mb-4">Connect LifeSync in your profile first.</p>
                    <Link to="/dashboard/profile?tab=integrations" className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-black transition-colors">
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
                    <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight">Hentai</h1>
                </div>
                <div className="bg-white rounded-[20px] border border-[#d2d2d7]/50 shadow-sm px-8 py-16 text-center">
                    <p className="text-[15px] font-bold text-[#1d1d1f] mb-2">Restricted Content</p>
                    <p className="text-[13px] text-[#86868b] mb-4">
                        {!nsfwEnabled
                            ? 'NSFW content is disabled. Enable it in your LifeSync preferences.'
                            : 'The Hentai plugin is disabled. Enable it in your profile integrations.'}
                    </p>
                    {!nsfwEnabled ? (
                        <button onClick={enableNsfw} className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-black transition-colors">
                            Enable NSFW Content
                        </button>
                    ) : (
                        <Link to="/dashboard/profile?tab=integrations" className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-black transition-colors">
                            Go to Integrations
                        </Link>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
            {/* Popups */}
            {selectedSeries && (
                <SeriesDetailPopup
                    series={selectedSeries}
                    onClose={() => setSelectedSeries(null)}
                    onPlayEpisode={(ep, idx) => void playEpisode(selectedSeries, ep, idx)}
                    onGenresLoaded={addGenresForSeries}
                    genreTagClick={g => {
                        addGenresForSeries(selectedSeries.seriesKey, [g])
                        handleGenreClick(g)
                    }}
                />
            )}
            {playerState && (
                <StreamPlayerPopup
                    playerState={playerState}
                    onClose={() => setPlayerState(null)}
                    onChangeEpisode={idx => void changePlayerEpisode(idx)}
                    allSeries={seriesList}
                    onPlayFromSeries={(ser, epIdx) => void playEpisode(ser, ser.episodes[epIdx], epIdx)}
                />
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">LifeSync / Anime</p>
                    <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight">Hentai</h1>
                    <p className="text-[13px] text-[#86868b] mt-1">Browse series, view details and episodes, then stream.</p>
                </div>
                <div className="flex flex-wrap gap-2 self-start">
                    <button
                        onClick={() => load(page, debouncedSearch, true)}
                        disabled={busy}
                        className="text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-2 rounded-xl border border-[#e5e5ea] transition-colors disabled:opacity-50"
                    >
                        {busy ? 'Syncing…' : 'Sync catalog'}
                    </button>
                    <button
                        onClick={() => load(page, debouncedSearch, false)}
                        disabled={busy}
                        className="text-[12px] font-semibold text-[#1d1d1f] bg-white hover:bg-[#fafafa] px-3 py-2 rounded-xl border border-[#e5e5ea] transition-colors disabled:opacity-50"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && <div className="bg-red-50 text-red-600 text-[12px] font-medium px-4 py-3 rounded-xl border border-red-100">{error}</div>}

            {/* Search */}
            <form onSubmit={handleSearch} className="flex gap-2">
                <input
                    type="search"
                    value={searchQ}
                    onChange={e => { setSearchQ(e.target.value); setActiveGenre(null) }}
                    placeholder="Search catalog…"
                    className="flex-1 px-4 py-2.5 bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#C6FF00]/60 focus:bg-white rounded-xl text-[13px] text-[#1d1d1f] focus:outline-none transition-all"
                />
                <button type="submit" disabled={busy} className="bg-[#1d1d1f] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-black transition-colors disabled:opacity-50">
                    Search
                </button>
            </form>

            {/* Genre filter pills */}
            {knownGenres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider self-center mr-1">Genres</span>
                    {knownGenres.map(g => (
                        <button
                            key={g}
                            type="button"
                            onClick={() => handleGenreClick(g)}
                            className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${
                                activeGenre === g
                                    ? 'bg-[#C6FF00] text-[#1d1d1f] border-[#C6FF00] shadow-sm'
                                    : 'bg-white text-[#424245] border-[#e5e5ea] hover:border-[#C6FF00]/50 hover:bg-[#C6FF00]/5'
                            }`}
                        >
                            {g}
                        </button>
                    ))}
                    {activeGenre && (
                        <button
                            type="button"
                            onClick={() => { setActiveGenre(null); setSearchQ(''); setDebouncedSearch(''); setPage(1) }}
                            className="text-[10px] font-semibold text-[#86868b] hover:text-[#1d1d1f] self-center ml-1"
                        >
                            Clear
                        </button>
                    )}
                </div>
            )}

            {/* Stats */}
            {(catalog?.totalSeries != null || catalog?.totalEpisodes != null) && (
                <p className="text-[11px] text-[#86868b]">
                    {catalog.totalSeries != null && <span>{catalog.totalSeries} series</span>}
                    {catalog.totalEpisodes != null && <span> · {catalog.totalEpisodes} episodes</span>}
                    {catalog.catalogSource === 'recent_api' && <span> · cached index</span>}
                    {catalog.catalogSource === 'rss' && <span> · RSS mode</span>}
                </p>
            )}

            {/* Content */}
            {busy && !seriesList.length && !flatItems.length ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-[#e5e5ea] bg-white py-20">
                    <div className="flex gap-1.5 justify-center">
                        {[0, 150, 300].map(d => <span key={d} className="w-2.5 h-2.5 rounded-full bg-[#C6FF00] animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                    </div>
                    <p className="text-[13px] text-[#86868b]">Loading catalog…</p>
                </div>
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
    )
}
