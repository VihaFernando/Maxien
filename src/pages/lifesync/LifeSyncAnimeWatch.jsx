import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLifeSync } from '../../context/LifeSyncContext'
import { getAnimeStreamAudio, getLifesyncApiBase, lifesyncFetch } from '../../lib/lifesyncApi'
import useControllerSupportEnabled from '../../hooks/useControllerSupportEnabled'
import useLifeSyncGamepadInput from '../../hooks/useLifeSyncGamepadInput'
import {
    fetchStreamInfoBySlugWithCache,
    writeLifesyncStreamCatalogBySlug,
} from '../../lib/lifesyncStreamCatalogCache'
import { animePosterLayoutId } from '../../lib/lifesyncAnimeSharedLayout'
import { peekAnimeWatchHandoff } from '../../lib/lifesyncWatchHandoff'
import { LIFESYNC_ANIME_WATCH_HISTORY_UPDATED_EVENT } from '../../hooks/useAnimeWatchHistory'
import AdvancedVideoPlayer from '../../components/lifesync/AdvancedVideoPlayer'
import { ControllerHintOverlay } from '../../components/lifesync/ControllerHintOverlay'
import {
    LifesyncEpisodeThumbnail,
    WatchPageLoadSkeleton,
} from '../../components/lifesync/EpisodeLoadingSkeletons'
import { streamIframeSandboxProps } from '../../lib/lifesyncStreamIframe'
import {
    AnimatePresence,
    lifeSyncModalSlideProps,
    lifeSyncSharedLayoutTransitionProps,
    lifeSyncSpringPageVariants,
    lifeSyncSpringPageTransition,
    lifeSyncStaggerContainer,
    lifeSyncStaggerItem,
    MotionDiv,
} from '../../lib/lifesyncMotion'
import {
    dispatchBestEffortIframeMediaKeys,
    focusIframeForControllerInput,
    XBOX_GAMEPAD_BUTTONS,
} from '../../lib/lifeSyncControllerInput'

function clampPage(n) {
    const v = Number.parseInt(String(n || '1'), 10)
    return Number.isFinite(v) && v > 0 ? v : 1
}

function normalizeStreamEpisodesForPlayer(list) {
    return (list || [])
        .map((ep, i) => {
            const episodeId = ep?.episodeId || ep?.id
            if (!episodeId) return null
            const num = ep?.number ?? ep?.episode
            const thumbUrl =
                (typeof ep?.thumbnailUrl === 'string' && ep.thumbnailUrl.trim()) || undefined
            return {
                episodeId: String(episodeId),
                title: ep?.title || (num != null ? `Episode ${num}` : `Episode ${i + 1}`),
                number: num,
                hasDub: ep?.hasDub,
                hasSub: ep?.hasSub,
                thumbnailUrl: thumbUrl,
            }
        })
        .filter(Boolean)
}

function safeText(x) {
    return x == null ? '' : String(x)
}

export default function LifeSyncAnimeWatch() {
    const { animeId: animeIdParam, ep: epParam } = useParams()
    const location = useLocation()
    const navigate = useNavigate()
    const { isLifeSyncConnected, lifeSyncUser } = useLifeSync()

    const animeId = useMemo(() => String(animeIdParam || '').trim(), [animeIdParam])
    const episodeIndex = useMemo(() => clampPage(epParam) - 1, [epParam])
    const streamAudioType = getAnimeStreamAudio(lifeSyncUser?.preferences)

    const from = location.state?.from
    const titleHintFromState = typeof location.state?.title === 'string' ? location.state.title.trim() : ''
    const closeTo =
        typeof from === 'string' && from.startsWith('/dashboard/lifesync/anime')
            ? from
            : '/dashboard/lifesync/anime/anime/home'
    const fromResumeDeckState = location.state?.fromResumeDeck
    const fromResumeDeck =
        fromResumeDeckState === true ||
        fromResumeDeckState === '1' ||
        fromResumeDeckState === 'true'

    const [episodes, setEpisodes] = useState([])
    const [busy, setBusy] = useState(true)
    const [stream, setStream] = useState(null)
    const [anime, setAnime] = useState(null)
    const [episodeIdx, setEpisodeIdx] = useState(episodeIndex)
    const [audioOverride, setAudioOverride] = useState(null)
    const [mirrorOverrideId, setMirrorOverrideId] = useState('')
    const [audioAvailByEp, setAudioAvailByEp] = useState(() => (/** @type {Record<string, { sub: boolean, dub: boolean }>} */ ({})))
    const audioAvailRef = useRef(audioAvailByEp)
    audioAvailRef.current = audioAvailByEp

    const seedCatalogQuietRef = useRef(false)
    const skipStreamResolveOnceRef = useRef(false)
    const prevAnimeIdRef = useRef(/** @type {string | null} */ (null))
    const handoffHydratedRef = useRef(false)
    const [videoPreload, setVideoPreload] = useState('metadata')
    const shouldForceCatalogRefreshRef = useRef(fromResumeDeck)
    const streamIframeContainerRef = useRef(null)
    const streamIframeRef = useRef(null)
    const controllerSupportEnabled = useControllerSupportEnabled()

    const bumpWatchHistory = useCallback(() => {
        try {
            window.dispatchEvent(new Event(LIFESYNC_ANIME_WATCH_HISTORY_UPDATED_EVENT))
        } catch {
            // ignore
        }
    }, [])

    const resolveAnimeStream = useCallback(
        async (epObj, audioOverride, mirrorId, signal) => {
            const episodeId = epObj?.episodeId
            if (!episodeId) return null
            const base = {
                title: epObj?.title || 'Episode',
                videoUrl: null,
                iframeUrl: null,
                textTracks: [],
                qualities: [],
                mirrors: [],
                selectedMirrorId: null,
                selectedMirrorLabel: null,
                provider: null,
                audioAvailability: null,
                effectiveAudio: null,
            }
            let audio =
                audioOverride === 'dub' || audioOverride === 'sub'
                    ? audioOverride
                    : streamAudioType === 'dub'
                      ? 'dub'
                      : 'sub'
            const known = audioAvailRef.current[episodeId]
            if (known && known.dub === false && audio === 'dub') audio = 'sub'
            if (known && known.sub === false && audio === 'sub') audio = 'dub'
            const type = audio === 'dub' ? 'dub' : 'sub'
            const mirrorQ =
                mirrorId != null && String(mirrorId).trim() !== ''
                    ? `&server=${encodeURIComponent(String(mirrorId).trim())}`
                    : ''

            const pack = await lifesyncFetch(
                `/api/v1/anime/stream/watch/${encodeURIComponent(episodeId)}?type=${type}${mirrorQ}&view=full`,
                signal ? { signal } : undefined,
            )
            const apiBase = getLifesyncApiBase()
            const iframeFromPack =
                typeof pack?.iframeUrl === 'string' && /^https?:\/\//i.test(pack.iframeUrl) ? pack.iframeUrl : null
            const meta = pack?.streamMeta && typeof pack.streamMeta === 'object' ? pack.streamMeta : {}
            const av = meta.audioAvailability
            const audioAvailability =
                av && typeof av === 'object'
                    ? { sub: !!av.sub, dub: !!av.dub }
                    : null
            const effectiveAudio =
                meta.effectiveAudio === 'dub' || meta.effectiveAudio === 'sub' ? meta.effectiveAudio : type
            const metaFields = {
                mirrors: meta.mirrors || [],
                selectedMirrorId: meta.selectedMirrorId ?? null,
                selectedMirrorLabel: meta.selectedMirrorLabel ?? null,
                provider: meta.provider ?? null,
                audioAvailability,
                effectiveAudio,
            }

            const toAbs = u => (String(u || '').startsWith('http') ? String(u) : `${apiBase}${u}`)
            const sources = Array.isArray(pack?.sources) ? pack.sources : []
            // Backend marks sources by `type` ('hls' | 'mp4'); prefer HLS (it carries
            // the quality variants), then MP4. iOS Safari plays HLS natively too.
            const pick = sources.find(s => s?.type === 'hls') || sources.find(s => s?.type === 'mp4') || sources[0]
            const rawUrl = pick?.url ? toAbs(pick.url) : null

            // Prefer the raw stream so the advanced player (subtitles + quality dropdown)
            // is used; fall back to the embed iframe only when no raw source resolved.
            if (rawUrl) {
                const rawSubs = Array.isArray(pack?.subtitles) ? pack.subtitles : []
                const textTracks = rawSubs.map((s, i) => ({
                    src: toAbs(s?.url),
                    label: s?.label || `Subtitles ${i + 1}`,
                    srclang: s?.lang || 'und',
                    default: i === 0,
                }))
                const rawQualities = Array.isArray(pack?.qualities) ? pack.qualities : []
                const qualities = rawQualities
                    .filter(q => q?.url)
                    .map((q, i) => ({ id: q.id || q.label || `q${i}`, label: q.label || q.id || `Quality ${i + 1}`, url: toAbs(q.url) }))
                return {
                    ...base,
                    ...metaFields,
                    title: epObj?.title || base.title,
                    videoUrl: rawUrl,
                    iframeUrl: iframeFromPack,
                    textTracks,
                    qualities,
                }
            }

            if (iframeFromPack) {
                return {
                    ...base,
                    ...metaFields,
                    title: epObj?.title || base.title,
                    iframeUrl: iframeFromPack,
                }
            }
            return { ...base, ...metaFields, title: epObj?.title || base.title }
        },
        [streamAudioType],
    )

    useEffect(() => {
        setEpisodeIdx(episodeIndex)
    }, [episodeIndex])

    useEffect(() => {
        setAudioAvailByEp({})
    }, [animeId])

    useLayoutEffect(() => {
        if (handoffHydratedRef.current) return
        const id = location.state?.handoffId
        const fromPath = location.state?.from
        if (!id || !animeId) return

        const row = peekAnimeWatchHandoff(id)

        const stripHandoffState = () => {
            navigate(`${location.pathname}${location.search || ''}`, {
                replace: true,
                state: typeof fromPath === 'string' && fromPath.startsWith('/dashboard') ? { from: fromPath } : {},
            })
        }

        if (!row || String(row.animeId) !== animeId) {
            handoffHydratedRef.current = true
            stripHandoffState()
            return
        }

        handoffHydratedRef.current = true

        if (row.episodeIndex !== episodeIndex) {
            if (Array.isArray(row.episodes) && row.episodes.length > 0) {
                seedCatalogQuietRef.current = true
                setEpisodes(row.episodes)
                setBusy(false)
            }
            if (row.anime != null) setAnime(row.anime)
            stripHandoffState()
            return
        }

        seedCatalogQuietRef.current = true
        if (Array.isArray(row.episodes) && row.episodes.length > 0) {
            setEpisodes(row.episodes)
            setBusy(false)
        }
        if (row.anime != null) setAnime(row.anime)

        const epForStream =
            Array.isArray(row.episodes) && row.episodes[episodeIndex] ? row.episodes[episodeIndex] : null
        const s = row.stream
        if (s && typeof s === 'object' && (s.videoUrl || s.iframeUrl) && epForStream?.episodeId) {
            setStream({ ...s, resolving: false })
            bumpWatchHistory()
            skipStreamResolveOnceRef.current = true
            setVideoPreload('auto')
            const av = s.audioAvailability
            const eid = epForStream.episodeId
            if (av && typeof av === 'object' && eid) {
                setAudioAvailByEp(prev => ({
                    ...prev,
                    [eid]: { sub: !!av.sub, dub: !!av.dub },
                }))
            }
        }

        stripHandoffState()
    }, [episodeIndex, location.pathname, location.search, location.state?.from, location.state?.handoffId, animeId, navigate, bumpWatchHistory])

    useEffect(() => {
        if (prevAnimeIdRef.current === null) {
            prevAnimeIdRef.current = animeId
            return
        }
        if (prevAnimeIdRef.current !== animeId) {
            prevAnimeIdRef.current = animeId
            seedCatalogQuietRef.current = false
            skipStreamResolveOnceRef.current = false
            handoffHydratedRef.current = false
            setVideoPreload('metadata')
            shouldForceCatalogRefreshRef.current = fromResumeDeck
        }
    }, [fromResumeDeck, animeId])

    useEffect(() => {
        if (!isLifeSyncConnected) return
        if (!animeId) return
        const ac = new AbortController()
        const quiet = seedCatalogQuietRef.current
        if (!quiet) setBusy(true)

        ;(async () => {
            try {
                const forceCatalogRefresh = shouldForceCatalogRefreshRef.current
                const streamInfo = await fetchStreamInfoBySlugWithCache(animeId, lifesyncFetch, { signal: ac.signal }, {
                    ...(forceCatalogRefresh ? { forceRefresh: true, fromResumeDeck: true } : {}),
                    title: typeof anime?.title === 'string' && anime.title.trim() ? anime.title : titleHintFromState,
                }).catch(() => null)
                if (ac.signal.aborted) return
                if (streamInfo?.data != null) {
                    writeLifesyncStreamCatalogBySlug(animeId, streamInfo)
                }
                const catalog = streamInfo?.data && typeof streamInfo.data === 'object' ? streamInfo.data : null
                if (catalog) {
                    setAnime({
                        title: catalog.title || catalog.name || catalog.animeTitle || '',
                        poster: catalog.image || catalog.poster || '',
                        status: catalog.status || '',
                        synopsis: catalog.synopsis || catalog.description || '',
                        related: Array.isArray(catalog.related) ? catalog.related : [],
                    })
                }
                const eps = normalizeStreamEpisodesForPlayer(catalog?.episodes)
                if (eps.length > 0) setEpisodes(eps)
            } finally {
                if (!ac.signal.aborted) {
                    setBusy(false)
                    seedCatalogQuietRef.current = false
                    shouldForceCatalogRefreshRef.current = false
                }
            }
        })()

        return () => { ac.abort() }
    }, [anime?.title, isLifeSyncConnected, animeId, streamAudioType, titleHintFromState])

    useEffect(() => {
        if (!isLifeSyncConnected) return
        const epObj = episodes?.[episodeIdx]
        if (!epObj) return
        if (skipStreamResolveOnceRef.current) {
            skipStreamResolveOnceRef.current = false
            return
        }
        const ac = new AbortController()
        setStream({ title: epObj.title, resolving: true })

        ;(async () => {
            try {
                const resolved = await resolveAnimeStream(
                    epObj,
                    audioOverride,
                    mirrorOverrideId ? mirrorOverrideId : undefined,
                    ac.signal,
                )
                if (ac.signal.aborted) return
                const av = resolved?.audioAvailability
                const eid = epObj?.episodeId
                if (av && eid) {
                    setAudioAvailByEp(prev => ({
                        ...prev,
                        [eid]: { sub: !!av.sub, dub: !!av.dub },
                    }))
                }
                if (resolved?.effectiveAudio === 'sub') {
                    setAudioOverride(prev => (prev === 'dub' ? null : prev))
                }
                setStream({ ...resolved, resolving: false })
                bumpWatchHistory()
            } catch (err) {
                if (ac.signal.aborted) return
                setStream({
                    title: epObj.title,
                    resolving: false,
                    error: err?.message || 'Failed to resolve stream.',
                })
            }
        })()

        return () => { ac.abort() }
    }, [episodes, episodeIdx, isLifeSyncConnected, resolveAnimeStream, audioOverride, mirrorOverrideId, bumpWatchHistory])

    // Persist "continue watching" progress.
    useEffect(() => {
        if (!isLifeSyncConnected) return
        if (!animeId) return
        const epObj = episodes?.[episodeIdx]
        if (!epObj) return

        const lastEpisodeNumber =
            epObj?.number != null ? Math.max(1, Math.floor(Number(epObj.number) || 1)) : episodeIdx + 1

        const ac = new AbortController()
        void lifesyncFetch('/api/v1/anime/watch-progress', {
            method: 'PUT',
            signal: ac.signal,
            json: { animeId, lastEpisodeNumber },
        })
            .then(() => bumpWatchHistory())
            .catch(() => {})

        return () => ac.abort()
    }, [bumpWatchHistory, episodeIdx, episodes, isLifeSyncConnected, animeId])

    const close = useCallback(() => navigate(closeTo, { replace: true }), [closeTo, navigate])

    const goEpisode = useCallback(
        idx => {
            const next = Math.max(0, Math.min((episodes?.length || 1) - 1, idx))
            setEpisodeIdx(next)
            navigate(`/dashboard/lifesync/anime/anime/watch/${encodeURIComponent(animeId)}/${next + 1}`, {
                replace: true,
                state: { from: closeTo },
            })
        },
        [closeTo, episodes?.length, animeId, navigate],
    )

    const epObj = episodes?.[episodeIdx]
    const canPrev = episodeIdx > 0
    const canNext = episodeIdx < (episodes?.length || 0) - 1
    const backdropUrl = typeof anime?.poster === 'string' ? anime.poster : ''
    const audioValue = audioOverride === 'dub' || audioOverride === 'sub' ? audioOverride : ''

    const epAudioAvail = epObj?.episodeId ? audioAvailByEp[epObj.episodeId] : null
    const subAvailable = epAudioAvail ? epAudioAvail.sub : true
    const dubAvailable = epAudioAvail ? epAudioAvail.dub : true
    const showSubDubPicker = subAvailable && dubAvailable
    const subOnlyTrack = subAvailable && !dubAvailable
    const dubOnlyTrack = dubAvailable && !subAvailable
    const hasSubtitleTracks = (stream?.textTracks || []).length > 0
    const qualityList = (stream?.qualities || []).filter(q => q?.url)
    const hasQualities = qualityList.length > 0

    const [settingsOpen, setSettingsOpen] = useState(false)
    const [subtitlesOn, setSubtitlesOn] = useState(true)

    // Reset quality when stream source changes
    const streamVideoUrl = stream?.videoUrl || ''
    const [qualitySelection, setQualitySelection] = useState({ forUrl: '', url: '' })
    const resolvedQualityUrl = qualitySelection.forUrl === streamVideoUrl ? qualitySelection.url : ''
    const handleQualityChange = useCallback((url) => {
        setQualitySelection({ forUrl: streamVideoUrl, url: url || '' })
    }, [streamVideoUrl])

    useEffect(() => {
        const onKey = e => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return
            if (e.key === 'Escape') {
                if (settingsOpen) { setSettingsOpen(false); return }
                close()
            }
            if (e.key === ' ') {
                e.preventDefault()
                setSettingsOpen(v => !v)
            }
        }
        window.addEventListener('keydown', onKey)
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            window.removeEventListener('keydown', onKey)
            document.body.style.overflow = prev
        }
    }, [close, settingsOpen])
    const toggleIframeContainerFullscreen = useCallback(() => {
        const el = streamIframeContainerRef.current
        if (!el) return
        if (!document.fullscreenElement) {
            if (el.requestFullscreen) {
                el.requestFullscreen()
                    .then(() => {
                        if (typeof window === 'undefined') return
                        window.setTimeout(() => { focusIframeForControllerInput(streamIframeRef.current) }, 60)
                    })
                    .catch(() => {})
            }
            return
        }
        if (document.exitFullscreen) {
            document.exitFullscreen()
                .then(() => {
                    if (typeof window === 'undefined') return
                    window.setTimeout(() => { focusIframeForControllerInput(streamIframeRef.current) }, 30)
                })
                .catch(() => {})
        }
    }, [])

    const iframeGamepadHandlers = useMemo(() => ({
        [XBOX_GAMEPAD_BUTTONS.A]: () => {
            dispatchBestEffortIframeMediaKeys(streamIframeRef.current, ['k', ' ', 'Spacebar', 'MediaPlayPause'])
        },
        [XBOX_GAMEPAD_BUTTONS.Y]: () => {
            dispatchBestEffortIframeMediaKeys(streamIframeRef.current, ['k', ' ', 'MediaPlay', 'MediaPlayPause'])
        },
        [XBOX_GAMEPAD_BUTTONS.X]: () => {
            toggleIframeContainerFullscreen()
            dispatchBestEffortIframeMediaKeys(streamIframeRef.current, ['f'])
        },
        [XBOX_GAMEPAD_BUTTONS.LT]: () => {
            dispatchBestEffortIframeMediaKeys(streamIframeRef.current, ['j', 'ArrowLeft'])
        },
        [XBOX_GAMEPAD_BUTTONS.RT]: () => {
            dispatchBestEffortIframeMediaKeys(streamIframeRef.current, ['l', 'ArrowRight'])
        },
        [XBOX_GAMEPAD_BUTTONS.DPAD_UP]: () => {
            dispatchBestEffortIframeMediaKeys(streamIframeRef.current, ['ArrowUp'])
        },
        [XBOX_GAMEPAD_BUTTONS.DPAD_DOWN]: () => {
            dispatchBestEffortIframeMediaKeys(streamIframeRef.current, ['ArrowDown'])
        },
        [XBOX_GAMEPAD_BUTTONS.LB]: () => { if (!canPrev) return; goEpisode(episodeIdx - 1) },
        [XBOX_GAMEPAD_BUTTONS.RB]: () => { if (!canNext) return; goEpisode(episodeIdx + 1) },
    }), [canNext, canPrev, episodeIdx, goEpisode, toggleIframeContainerFullscreen])

    // Iframe controller handlers apply only when the embed iframe is actually
    // rendered (i.e. no raw videoUrl took priority).
    const usingIframe = Boolean(stream?.iframeUrl) && !stream?.videoUrl

    useLifeSyncGamepadInput({
        enabled: controllerSupportEnabled && usingIframe,
        handlers: iframeGamepadHandlers,
        repeatableButtons: [
            XBOX_GAMEPAD_BUTTONS.LT,
            XBOX_GAMEPAD_BUTTONS.RT,
            XBOX_GAMEPAD_BUTTONS.DPAD_UP,
            XBOX_GAMEPAD_BUTTONS.DPAD_DOWN,
        ],
    })

    useEffect(() => {
        if (!usingIframe || typeof window === 'undefined') return undefined
        const id = window.setTimeout(() => { focusIframeForControllerInput(streamIframeRef.current) }, 180)
        return () => window.clearTimeout(id)
    }, [usingIframe])

    useEffect(() => {
        if (!usingIframe || typeof window === 'undefined') return undefined
        const onFullscreenChange = () => {
            const container = streamIframeContainerRef.current
            const fullscreenEl = document.fullscreenElement
            if (!container || !fullscreenEl) return
            const isAnimePlayerFullscreen =
                fullscreenEl === container || container.contains(fullscreenEl)
            if (!isAnimePlayerFullscreen) return
            window.setTimeout(() => { focusIframeForControllerInput(streamIframeRef.current) }, 60)
        }
        document.addEventListener('fullscreenchange', onFullscreenChange)
        document.addEventListener('webkitfullscreenchange', onFullscreenChange)
        return () => {
            document.removeEventListener('fullscreenchange', onFullscreenChange)
            document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
        }
    }, [usingIframe])

    const relatedAnime = Array.isArray(anime?.related) ? anime.related : []

    if (!isLifeSyncConnected) {
        return (
            <div className="lifesync-anime-watch fixed inset-0 z-9999 flex h-dvh w-full items-center justify-center bg-(--mx-color-020202) text-white">
                <div className="rounded-2xl border border-(--color-border-strong)/10 bg-(--color-surface)/5 px-6 py-5 text-center">
                    <p className="text-[13px] font-semibold text-white/90">Connecting LifeSync…</p>
                    <p className="mt-1 text-[12px] text-white/50">Please wait.</p>
                </div>
            </div>
        )
    }

    return (
        <MotionDiv
            className="lifesync-anime-watch fixed inset-0 z-9999 h-dvh w-full overflow-hidden bg-(--mx-color-050506) text-white"
            style={{ transformOrigin: '50% 0%', viewTransitionName: 'lifesync-anime-watch' }}
            initial="initial"
            animate="animate"
            variants={lifeSyncSpringPageVariants}
            transition={lifeSyncSpringPageTransition}
        >
            <AnimatePresence>
                {backdropUrl ? (
                    <MotionDiv
                        key={backdropUrl}
                        className="pointer-events-none absolute inset-0"
                        initial={{ opacity: 0, scale: 1.06 }}
                        animate={{ opacity: 1, scale: 1.02 }}
                        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <img
                            src={backdropUrl}
                            alt=""
                            className="h-full w-full object-cover opacity-25 blur-2xl"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-linear-to-b from-black/70 via-black/55 to-black/85" />
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(198,255,0,0.14),transparent_60%)]" />
                    </MotionDiv>
                ) : null}
            </AnimatePresence>

            <div className="relative flex h-dvh w-full flex-col">
                <header className="relative shrink-0 border-b border-(--color-border-strong)/12 bg-black/30 backdrop-blur-2xl">
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-(--mx-color-c6ff00)/45 to-transparent" aria-hidden />
                    <div className="mx-auto flex w-full max-w-420 flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-2.5 sm:px-6 lg:px-10">
                        <div className="flex min-w-0 items-center gap-2 sm:min-w-0 sm:flex-1">
                            <button
                                type="button"
                                onClick={close}
                                aria-label="Back"
                                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-(--color-border-strong)/18 bg-(--color-surface)/8 px-3 py-2 text-[12px] font-semibold text-white/90 transition-colors hover:border-(--mx-color-c6ff00)/40 hover:bg-(--color-surface)/14 sm:py-1.5"
                            >
                                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden>
                                    <path d="M12.5 4.5L7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <span className="max-[380px]:hidden">Back</span>
                            </button>
                            {animeId ? (
                                <MotionDiv
                                    layoutId={animePosterLayoutId(animeId)}
                                    transition={lifeSyncSharedLayoutTransitionProps}
                                    className="h-10 w-[2.45rem] shrink-0 overflow-hidden rounded-lg ring-1 ring-(--color-border-strong)/30 sm:h-[3.35rem] sm:w-12 sm:rounded-xl"
                                    style={{ aspectRatio: '2/3' }}
                                >
                                    {backdropUrl ? (
                                        <img src={backdropUrl} alt="" className="h-full w-full object-cover" loading="eager" decoding="async" referrerPolicy="no-referrer" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-(--color-surface)/10" aria-hidden />
                                    )}
                                </MotionDiv>
                            ) : null}
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[12px] font-bold tracking-tight text-white sm:text-[13px]">
                                    {anime?.title || 'Loading…'}
                                </p>
                                <p className="flex items-center gap-1.5 truncate text-[10px] font-semibold text-white/55 sm:text-[11px]">
                                    <span className="inline-block h-1 w-1 shrink-0 animate-pulse rounded-full bg-(--mx-color-c6ff00)" aria-hidden />
                                    {epObj?.number != null ? `Episode ${epObj.number}` : epObj?.title || ''}
                                </p>
                            </div>
                        </div>

                        <div className="flex w-full items-stretch gap-2 sm:w-auto sm:items-center sm:shrink-0">
                            <button
                                type="button"
                                disabled={!canPrev}
                                onClick={() => goEpisode(episodeIdx - 1)}
                                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-(--color-border-strong)/18 bg-(--color-surface)/8 px-3 py-2 text-[12px] font-semibold text-white/90 transition-colors hover:border-(--mx-color-c6ff00)/35 hover:bg-(--color-surface)/14 disabled:opacity-30 sm:min-h-0 sm:flex-none sm:py-1.5"
                                title="Previous episode"
                            >
                                Prev
                            </button>
                            <button
                                type="button"
                                disabled={!canNext}
                                onClick={() => goEpisode(episodeIdx + 1)}
                                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-(--mx-color-c6ff00) px-4 py-2 text-[12px] font-black text-black shadow-[0_8px_22px_-8px_rgba(198,255,0,0.65)] transition-all hover:brightness-105 disabled:opacity-30 disabled:shadow-none sm:min-h-0 sm:flex-none sm:py-1.5"
                                title="Next episode"
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
                    <div className="mx-auto w-full max-w-420 px-3 py-2.5 sm:px-6 sm:py-5 lg:px-10">
                        {busy ? (
                            <WatchPageLoadSkeleton />
                        ) : (
                            <MotionDiv
                                className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-7"
                                {...lifeSyncModalSlideProps}
                            >
                                <main className="min-w-0 space-y-3 sm:space-y-4">
                                    <div className="lifesync-anime-watch-media overflow-hidden rounded-3xl border border-(--color-border-strong)/12 bg-black">
                                        <div ref={streamIframeContainerRef} className="relative aspect-video w-full">
                                            {/* Settings trigger button  top right of player */}
                                            {!stream?.resolving && (stream?.videoUrl || stream?.iframeUrl) && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSettingsOpen(v => !v)}
                                                    className={`absolute right-2 top-2 z-30 flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold backdrop-blur-md transition-all ${
                                                        settingsOpen
                                                            ? 'border-(--mx-color-c6ff00)/40 bg-(--mx-color-c6ff00)/10 text-(--mx-color-c6ff00)'
                                                            : 'border-white/15 bg-black/50 text-white/70 hover:border-white/30 hover:text-white'
                                                    }`}
                                                    title="Playback settings (Space)"
                                                >
                                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.764-.384.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                    <span className="hidden sm:inline">Settings</span>
                                                </button>
                                            )}

                                            {/* Settings drawer  slides in from right inside the player */}
                                            {settingsOpen && (
                                                <div
                                                    className="absolute inset-0 z-20 flex items-stretch justify-end overflow-hidden rounded-3xl"
                                                    style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.4) 55%, transparent 100%)' }}
                                                    onClick={() => setSettingsOpen(false)}
                                                >
                                                    <div
                                                        className="relative flex h-full w-[min(100%,22rem)] flex-col gap-1.5 overflow-y-auto p-4"
                                                        onClick={e => e.stopPropagation()}
                                                    >
                                                        {/* Accent top line */}
                                                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--mx-color-c6ff00)/50 to-transparent" />

                                                        {/* Header */}
                                                        <div className="mb-1 flex items-center justify-between">
                                                            <p className="text-[12px] font-black text-white">Playback Settings</p>
                                                            <button type="button" onClick={() => setSettingsOpen(false)} className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/8 text-white/50 hover:bg-white/14 hover:text-white transition-colors">
                                                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                            </button>
                                                        </div>

                                                        {/* Audio */}
                                                        <WatchSettingsSection label="Audio" icon="audio">
                                                            {showSubDubPicker ? (
                                                                <div className="flex gap-1.5">
                                                                    {['sub', 'dub'].map(opt => (
                                                                        <button key={opt} type="button"
                                                                            onClick={() => { setAudioOverride(opt); setMirrorOverrideId('') }}
                                                                            className={`flex-1 rounded-xl border py-2 text-[11px] font-black uppercase tracking-widest transition-all ${
                                                                                (audioValue || (streamAudioType === 'dub' ? 'dub' : 'sub')) === opt
                                                                                    ? 'border-(--mx-color-c6ff00)/50 bg-(--mx-color-c6ff00)/14 text-(--mx-color-c6ff00)'
                                                                                    : 'border-white/10 bg-white/4 text-white/55 hover:border-white/20 hover:text-white/80'
                                                                            }`}
                                                                        >{opt}</button>
                                                                    ))}
                                                                </div>
                                                            ) : subOnlyTrack ? (
                                                                <p className="text-[11px] text-white/50">Sub only for this episode</p>
                                                            ) : dubOnlyTrack ? (
                                                                <p className="text-[11px] text-white/50">Dub only for this episode</p>
                                                            ) : (
                                                                <p className="text-[11px] text-white/40">No audio tracks reported</p>
                                                            )}
                                                            {showSubDubPicker && audioValue ? (
                                                                <button type="button" onClick={() => { setAudioOverride(null); setMirrorOverrideId('') }}
                                                                    className="mt-1 w-full rounded-xl border border-white/8 py-1 text-[10px] font-semibold text-white/35 hover:text-white/55 transition-colors">
                                                                    Auto ({streamAudioType === 'dub' ? 'Dub' : 'Sub'})
                                                                </button>
                                                            ) : null}
                                                        </WatchSettingsSection>

                                                        {/* Subtitles */}
                                                        <WatchSettingsSection label="Subtitles" icon="cc">
                                                            <div className="flex gap-1.5">
                                                                {[{ val: true, label: 'On' }, { val: false, label: 'Off' }].map(({ val, label }) => (
                                                                    <button key={label} type="button"
                                                                        onClick={() => setSubtitlesOn(val)}
                                                                        disabled={val && !hasSubtitleTracks}
                                                                        className={`flex-1 rounded-xl border py-2 text-[11px] font-black uppercase tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-30 ${
                                                                            subtitlesOn === val
                                                                                ? val
                                                                                    ? 'border-blue-400/50 bg-blue-500/14 text-blue-300'
                                                                                    : 'border-white/20 bg-white/8 text-white/80'
                                                                                : 'border-white/10 bg-white/4 text-white/55 hover:border-white/20 hover:text-white/80'
                                                                        }`}
                                                                    >{label}</button>
                                                                ))}
                                                            </div>
                                                            {!hasSubtitleTracks && <p className="mt-1 text-[10px] text-white/30">No subtitle tracks available</p>}
                                                        </WatchSettingsSection>

                                                        {/* Quality */}
                                                        <WatchSettingsSection label="Quality" icon="quality">
                                                            {hasQualities ? (
                                                                <div className="flex flex-wrap gap-1">
                                                                    <button type="button" onClick={() => handleQualityChange('')}
                                                                        className={`rounded-xl border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide transition-all ${
                                                                            !resolvedQualityUrl ? 'border-(--mx-color-c6ff00)/50 bg-(--mx-color-c6ff00)/14 text-(--mx-color-c6ff00)' : 'border-white/10 bg-white/4 text-white/55 hover:border-white/20 hover:text-white/80'
                                                                        }`}>Auto</button>
                                                                    {qualityList.map(q => (
                                                                        <button key={q.id || q.url} type="button" onClick={() => handleQualityChange(q.url)}
                                                                            className={`rounded-xl border px-2.5 py-1.5 text-[10px] font-black tabular-nums tracking-wide transition-all ${
                                                                                resolvedQualityUrl === q.url ? 'border-(--mx-color-c6ff00)/50 bg-(--mx-color-c6ff00)/14 text-(--mx-color-c6ff00)' : 'border-white/10 bg-white/4 text-white/55 hover:border-white/20 hover:text-white/80'
                                                                            }`}>{q.label}</button>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-[11px] text-white/40">{stream?.resolving ? 'Loading…' : 'Not available'}</p>
                                                            )}
                                                        </WatchSettingsSection>

                                                        {/* Mirror */}
                                                        <WatchSettingsSection label="Mirror" icon="mirror">
                                                            <select
                                                                value={mirrorOverrideId}
                                                                onChange={e => setMirrorOverrideId(safeText(e.target.value).trim())}
                                                                disabled={!Array.isArray(stream?.mirrors) || stream.mirrors.length === 0}
                                                                className="h-9 w-full cursor-pointer rounded-xl border border-white/12 bg-black/50 px-2.5 text-[11px] font-semibold text-white/90 outline-none transition-colors hover:border-(--mx-color-c6ff00)/30 focus:border-(--mx-color-c6ff00)/45 disabled:cursor-not-allowed disabled:opacity-45"
                                                            >
                                                                <option value="" className="bg-(--mx-color-111)">Auto{stream?.selectedMirrorLabel ? ` (${stream.selectedMirrorLabel})` : ''}</option>
                                                                {(Array.isArray(stream?.mirrors) ? stream.mirrors : []).map((m, idx) => {
                                                                    const id = m?.id != null ? String(m.id) : ''
                                                                    const label = m?.label ? String(m.label) : id || `Mirror ${idx + 1}`
                                                                    if (!id) return null
                                                                    return <option key={id} value={id} className="bg-(--mx-color-111)">{label}</option>
                                                                })}
                                                            </select>
                                                        </WatchSettingsSection>

                                                        <p className="mt-auto pt-2 text-center text-[9px] text-white/20">Space · toggle · Esc · close</p>
                                                    </div>
                                                </div>
                                            )}
                                            <AnimatePresence>
                                                {stream?.resolving ? (
                                                <MotionDiv
                                                    className="absolute inset-0 z-10 flex items-center justify-center bg-black/65 backdrop-blur-md"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    transition={{ duration: 0.22 }}
                                                >
                                                    <MotionDiv
                                                        className="w-[min(520px,92vw)] overflow-hidden rounded-3xl border border-white/10 bg-black/80 p-5 shadow-2xl backdrop-blur-xl"
                                                        initial={{ opacity: 0, y: 18, scale: 0.97 }}
                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                        transition={{ type: 'spring', stiffness: 320, damping: 28, delay: 0.05 }}
                                                    >
                                                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--mx-color-c6ff00)/50 to-transparent" aria-hidden />
                                                        <div className="flex items-center gap-3">
                                                            <div className="relative h-10 w-10 shrink-0 rounded-2xl border border-white/10 bg-white/5 p-2.5">
                                                                <svg className="h-full w-full animate-spin text-(--mx-color-c6ff00)" viewBox="0 0 24 24" fill="none">
                                                                    <path d="M12 2a10 10 0 1010 10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                                                                </svg>
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-[13px] font-semibold text-white/90">Starting your stream</p>
                                                                <p className="mt-0.5 text-[12px] text-white/55">
                                                                    {audioOverride
                                                                        ? `Audio: ${audioOverride.toUpperCase()}`
                                                                        : `Audio: Auto (${streamAudioType === 'dub' ? 'Dub' : 'Sub'})`}
                                                                    {mirrorOverrideId ? ` · Mirror: ${mirrorOverrideId}` : ''}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="mt-4 grid gap-2">
                                                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                                                                <div className="h-full w-1/3 animate-[lifesyncbar_1.2s_ease-in-out_infinite] rounded-full bg-(--mx-color-c6ff00)/60" />
                                                            </div>
                                                            <p className="text-[11px] text-white/40">If this hangs, try switching Mirror or Audio below.</p>
                                                        </div>
                                                    </MotionDiv>
                                                </MotionDiv>
                                                ) : null}
                                            </AnimatePresence>
                                            {!stream?.resolving && stream?.videoUrl ? (
                                                <AdvancedVideoPlayer
                                                    key={stream.videoUrl}
                                                    src={stream.videoUrl}
                                                    preload={videoPreload}
                                                    textTracks={stream.textTracks || []}
                                                    qualities={stream.qualities || []}
                                                    skipSegments={[]}
                                                    suppressKeys={settingsOpen}
                                                    subtitlesOnOverride={subtitlesOn}
                                                    activeQualityUrl={resolvedQualityUrl}
                                                    onQualityChange={handleQualityChange}
                                                    onPrevEpisode={canPrev ? () => goEpisode(episodeIdx - 1) : undefined}
                                                    onNextEpisode={canNext ? () => goEpisode(episodeIdx + 1) : undefined}
                                                    canPrevEpisode={canPrev}
                                                    canNextEpisode={canNext}
                                                    onEnded={() => { if (canNext) goEpisode(episodeIdx + 1) }}
                                                />
                                            ) : !stream?.resolving && stream?.iframeUrl ? (
                                                <iframe
                                                    ref={streamIframeRef}
                                                    key={stream.iframeUrl}
                                                    title={stream.title || 'Episode'}
                                                    src={stream.iframeUrl}
                                                    tabIndex={0}
                                                    onLoad={() => { focusIframeForControllerInput(streamIframeRef.current) }}
                                                    className="lifesync-anime-watch-media h-full w-full border-0 bg-black"
                                                    allow="fullscreen; encrypted-media; autoplay; picture-in-picture"
                                                    {...streamIframeSandboxProps(stream.iframeUrl, {
                                                        provider: stream.provider,
                                                        selectedMirrorLabel: stream.selectedMirrorLabel,
                                                    })}
                                                    referrerPolicy="no-referrer-when-downgrade"
                                                />
                                            ) : (
                                                <div className="lifesync-anime-watch-media flex h-full w-full items-center justify-center bg-(--mx-color-0f0f12) px-4 text-center">
                                                    <div className="max-w-md">
                                                        <p className="text-[13px] font-semibold text-white/85">
                                                            {stream?.error ? 'Stream error' : 'No stream available'}
                                                        </p>
                                                        <p className="mt-1 text-[12px] text-white/45">
                                                            {stream?.error
                                                                ? String(stream.error)
                                                                : 'Try switching Audio or Mirror, or pick another episode.'}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {episodes.length > 0 ? (
                                        <div className="lg:hidden">
                                            <div className="mb-1 flex items-center justify-between gap-2 px-0.5">
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">Episodes</p>
                                                <span className="tabular-nums text-[10px] font-semibold text-white/35">
                                                    {episodeIdx + 1}/{episodes.length}
                                                </span>
                                            </div>
                                            <div
                                                className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 pt-0.5 [scrollbar-width:thin] touch-pan-x"
                                                style={{ WebkitOverflowScrolling: 'touch' }}
                                            >
                                                {episodes.map((ep, i) => {
                                                    const on = i === episodeIdx
                                                    const label = ep.number != null ? String(ep.number) : String(i + 1)
                                                    const av = ep.episodeId ? audioAvailByEp[ep.episodeId] : null
                                                    const trackHint = av
                                                        ? av.sub && av.dub ? 'S·D' : av.dub ? 'D' : av.sub ? 'S' : ''
                                                        : ep.hasDub && ep.hasSub ? 'S·D' : ep.hasDub ? 'D' : ep.hasSub ? 'S' : ''
                                                    return (
                                                        <button
                                                            key={ep.episodeId || i}
                                                            type="button"
                                                            onClick={() => goEpisode(i)}
                                                            className={`flex min-h-11 min-w-11 shrink-0 flex-col items-center justify-center rounded-2xl border px-2.5 py-1.5 text-center transition-colors ${
                                                                on
                                                                    ? 'border-(--color-border-strong)/30 bg-(--color-surface)/12 text-white'
                                                                    : 'border-(--color-border-strong)/10 bg-black/30 text-white/75 hover:border-(--color-border-strong)/18 hover:bg-(--color-surface)/6'
                                                            }`}
                                                            title={ep.title || `Episode ${label}`}
                                                        >
                                                            <span className="text-[13px] font-bold tabular-nums leading-none">{label}</span>
                                                            {trackHint ? (
                                                                <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wide text-white/40">{trackHint}</span>
                                                            ) : null}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ) : null}

                                    <MotionDiv
                                        className="rounded-3xl border border-(--color-border-strong)/12 bg-linear-to-br from-(--color-surface)/10 via-black/22 to-black/38 p-4 sm:p-5"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.12 }}
                                    >
                                        <div className="flex gap-2.5 sm:gap-4">
                                            {backdropUrl ? (
                                                <img src={backdropUrl} alt="" className="h-19 w-[3.35rem] shrink-0 rounded-2xl object-cover ring-1 ring-(--color-border-strong)/12 sm:h-21 sm:w-[3.7rem]" loading="lazy" referrerPolicy="no-referrer" />
                                            ) : (
                                                <div className="h-19 w-[3.35rem] shrink-0 rounded-2xl bg-(--color-surface)/6 ring-1 ring-(--color-border-strong)/10 sm:h-21 sm:w-[3.7rem]" />
                                            )}
                                            <div className="min-w-0 flex-1 pt-0.5">
                                                <h2 className="line-clamp-2 text-[15px] font-semibold leading-snug text-white/95 sm:text-base">{anime?.title || ''}</h2>
                                                <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Episode and source details">
                                                    <li><span className="inline-flex items-center rounded-lg border border-(--color-border-strong)/12 bg-black/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70 sm:text-[11px]">{epObj?.number != null ? `Ep ${epObj.number}` : `Ep ${episodeIdx + 1}`}</span></li>
                                                    {anime?.status ? <li><span className="inline-flex items-center rounded-lg border border-(--color-border-strong)/12 bg-black/35 px-2 py-0.5 text-[10px] font-semibold capitalize text-white/70 sm:text-[11px]">{String(anime.status).replace(/_/g, ' ')}</span></li> : null}
                                                    {stream?.provider ? <li><span className="inline-flex items-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold capitalize text-emerald-200/90 sm:text-[11px]">{String(stream.provider)}</span></li> : null}
                                                </ul>
                                                {anime?.synopsis ? <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-white/50">{anime.synopsis}</p> : null}
                                            </div>
                                        </div>
                                    </MotionDiv>

                                    {relatedAnime.length > 0 ? (
                                        <section className="rounded-3xl border border-(--color-border-strong)/12 bg-(--color-surface)/8 p-3.5 sm:rounded-3xl sm:p-4">
                                            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/45">Related</p>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {relatedAnime.map((r) => {
                                                    const slug = r?.slug || r?.aninekoSlug
                                                    if (!slug) return null
                                                    return (
                                                        <button
                                                            key={slug}
                                                            type="button"
                                                            onClick={() => {
                                                                setAudioOverride(null)
                                                                setMirrorOverrideId('')
                                                                navigate(
                                                                    `/dashboard/lifesync/anime/anime/watch/${encodeURIComponent(slug)}/1`,
                                                                    { replace: true, state: { from: closeTo } },
                                                                )
                                                            }}
                                                            className="flex w-[calc(50%-4px)] min-w-32.5 flex-1 items-center gap-2.5 rounded-2xl border border-(--color-border-strong)/12 bg-black/24 p-2 text-left transition-colors hover:border-(--mx-color-c6ff00)/28 hover:bg-(--color-surface)/8 sm:w-auto sm:flex-none"
                                                        >
                                                            {r?.poster ? (
                                                                <img
                                                                    src={r.poster}
                                                                    alt=""
                                                                    className="h-12 w-8 shrink-0 rounded-lg object-cover"
                                                                    loading="lazy"
                                                                />
                                                            ) : (
                                                                <div className="h-12 w-8 shrink-0 rounded-lg bg-white/8" />
                                                            )}
                                                            <div className="min-w-0">
                                                                <p className="line-clamp-2 text-[11px] font-semibold leading-tight text-white/85">
                                                                    {r?.title || slug}
                                                                </p>
                                                                {r?.relation ? (
                                                                    <p className="mt-0.5 text-[10px] capitalize text-white/40">
                                                                        {String(r.relation).replace(/_/g, ' ')}
                                                                    </p>
                                                                ) : null}
                                                            </div>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </section>
                                    ) : null}
                                </main>

                                <aside className="hidden min-w-0 lg:block">
                                    <MotionDiv
                                        className="rounded-3xl border border-(--color-border-strong)/12 bg-black/26"
                                        initial={{ opacity: 0, x: 16 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.08 }}
                                    >
                                        <div className="flex items-center justify-between gap-2 border-b border-(--color-border-strong)/10 px-3 py-2.5 sm:py-3">
                                            <p className="text-[11px] font-semibold text-white/85">Episodes</p>
                                            <span className="rounded-full border border-(--color-border-strong)/10 bg-(--color-surface)/5 px-2 py-1 text-[10px] font-semibold text-white/60">
                                                {episodes.length || ''}
                                            </span>
                                        </div>
                                        <div className="max-h-[min(70dvh,720px)] overflow-y-auto p-2">
                                            {episodes.length === 0 ? (
                                                <p className="px-2 py-3 text-[12px] text-white/45">No episode list returned.</p>
                                            ) : (
                                                <MotionDiv
                                                    className="space-y-1.5"
                                                    variants={lifeSyncStaggerContainer}
                                                    initial="hidden"
                                                    animate="show"
                                                >
                                                    {episodes.map((ep, i) => {
                                                        const on = i === episodeIdx
                                                        return (
                                                            <MotionDiv key={ep.episodeId || i} variants={lifeSyncStaggerItem}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => goEpisode(i)}
                                                                    className={`flex w-full items-center gap-2 rounded-2xl border px-2.5 py-2 text-left transition-colors ${
                                                                        on
                                                                            ? 'border-(--mx-color-c6ff00)/45 bg-(--color-surface)/14'
                                                                            : 'border-(--color-border-strong)/12 bg-black/22 hover:border-(--mx-color-c6ff00)/24 hover:bg-(--color-surface)/8'
                                                                    }`}
                                                                >
                                                                    <LifesyncEpisodeThumbnail
                                                                        src={ep.thumbnailUrl}
                                                                        poster={backdropUrl}
                                                                        dark
                                                                        className="relative h-10 w-16 shrink-0 overflow-hidden rounded-xl bg-black/40 ring-1 ring-(--color-border-strong)/5"
                                                                    />
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="truncate text-[12px] font-semibold text-white/90">
                                                                            {ep.number != null ? `Ep ${ep.number}` : `Ep ${i + 1}`} · {ep.title}
                                                                        </p>
                                                                        <p className="mt-0.5 truncate text-[11px] text-white/50">
                                                                            {(() => {
                                                                                const av = ep.episodeId ? audioAvailByEp[ep.episodeId] : null
                                                                                if (av) {
                                                                                    if (av.sub && av.dub) return 'Sub · Dub'
                                                                                    if (av.dub) return 'Dub'
                                                                                    if (av.sub) return 'Sub'
                                                                                    return ''
                                                                                }
                                                                                return ep.hasDub && ep.hasSub ? 'Sub · Dub' : ep.hasDub ? 'Dub' : ep.hasSub ? 'Sub' : ''
                                                                            })()}
                                                                        </p>
                                                                    </div>
                                                                    {on ? (
                                                                        <span className="shrink-0 rounded-full border border-(--mx-color-c6ff00)/30 bg-(--mx-color-c6ff00)/10 px-2 py-1 text-[10px] font-semibold text-(--mx-color-c6ff00)">
                                                                            Playing
                                                                        </span>
                                                                    ) : null}
                                                                </button>
                                                            </MotionDiv>
                                                        )
                                                    })}
                                                </MotionDiv>
                                            )}
                                        </div>
                                    </MotionDiv>
                                </aside>
                            </MotionDiv>
                        )}
                    </div>
                </div>
            </div>

            {/* Controller hint overlay */}
            <ControllerHintOverlay
                dark
                position="bottom-right"
                cols={2}
                hints={[
                    { btns: ['A'], label: 'Play / Pause' },
                    { btns: ['LB'], label: 'Prev episode' },
                    { btns: ['RB'], label: 'Next episode' },
                    { btns: ['LT'], label: 'Seek back' },
                    { btns: ['RT'], label: 'Seek forward' },
                    { btns: ['↑↓'], label: 'Volume' },
                    { btns: ['X'], label: 'Fullscreen' },
                    { btns: ['Space'], label: 'Settings' },
                ]}
            />
        </MotionDiv>
    )
}

function WatchSettingsSection({ label, icon, children }) {
    const icons = {
        audio: <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.59-.714-1.59-1.596v-5.47c0-.882.71-1.596 1.59-1.596H6.75z" />,
        cc: <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />,
        quality: <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .03 2.703-1.342 2.703H6.14c-1.372 0-2.342-1.703-1.342-2.703L5 14.5" />,
        mirror: <path strokeLinecap="round" strokeLinejoin="round" d="M7 17l10-10M7 7h10v10" />,
    }
    return (
        <div className="rounded-2xl border border-white/8 bg-white/3 p-3">
            <div className="mb-2 flex items-center gap-1.5">
                <svg className="h-3 w-3 shrink-0 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    {icons[icon]}
                </svg>
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/40">{label}</p>
            </div>
            {children}
        </div>
    )
}
