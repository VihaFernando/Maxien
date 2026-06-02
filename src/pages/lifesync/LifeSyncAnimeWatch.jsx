import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLifeSync } from '../../context/LifeSyncContext'
import { getAnimeStreamAudio, getLifesyncApiBase, lifesyncFetch, lifesyncPatchPreferences } from '../../lib/lifesyncApi'
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
import {
    LifesyncEpisodeThumbnail,
    WatchPageLoadSkeleton,
} from '../../components/lifesync/EpisodeLoadingSkeletons'
import { streamIframeSandboxProps, withStreamIframeAutoplayUrl } from '../../lib/lifesyncStreamIframe'
import {
    lifeSyncDollyPageTransition,
    lifeSyncDollyPageVariants,
    lifeSyncModalSlideProps,
    lifeSyncSharedLayoutTransitionProps,
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

function isIOSDevice() {
    if (typeof navigator === 'undefined') return false
    const ua = navigator.userAgent || ''
    const iOS = /iPad|iPhone|iPod/.test(ua)
    const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
    return iOS || iPadOS
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

function isDirectVideoMirror(mirrorLabel, effectiveAudio) {
    const label = String(mirrorLabel || '').toLowerCase().replace(/[\s\-_]/g, '')
    if (/hd\d/.test(label)) return true
    if (label.includes('hardsub') || label.includes('hsub')) return true
    if (label.includes('dub')) return true
    if (effectiveAudio === 'dub') return true
    return false
}

function isEditableElement(target) {
    if (!target) return false
    if (target.isContentEditable) return true
    const tag = String(target.tagName || '').toUpperCase()
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON'
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
    const [autoplayCountdown, setAutoplayCountdown] = useState(/** @type {number|null} */ (null))
    const autoplayTimerRef = useRef(/** @type {ReturnType<typeof setInterval>|null} */ (null))

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

    const cancelAutoplay = useCallback(() => {
        if (autoplayTimerRef.current != null) {
            clearInterval(autoplayTimerRef.current)
            autoplayTimerRef.current = null
        }
        setAutoplayCountdown(null)
    }, [])

    // Called when episode changes — reset autoplay state
    useEffect(() => {
        cancelAutoplay()
    }, [episodeIdx, cancelAutoplay])

    const resolveAnimeStream = useCallback(
        async (epObj, audioOverride, mirrorId, signal) => {
            const episodeId = epObj?.episodeId
            if (!episodeId) return null
            const base = {
                title: epObj?.title || 'Episode',
                videoUrl: null,
                iframeUrl: null,
                textTracks: [],
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

            const resolvedMirrorLabel = meta.selectedMirrorLabel ?? null
            const useDirect = isDirectVideoMirror(resolvedMirrorLabel, effectiveAudio)

            // For HD/DUB/HSUB mirrors, prefer direct HLS/MP4 sources over iframe embed
            const sources = Array.isArray(pack?.sources) ? pack.sources : []
            const srcKind = (s) => (s?.kind || s?.type || '').toLowerCase()
            if (useDirect && sources.length > 0) {
                const pickDirect =
                    sources.find(s => srcKind(s) === 'hls') ||
                    sources.find(s => srcKind(s) === 'mp4') ||
                    sources.find(s => srcKind(s) !== 'iframe' && srcKind(s) !== 'embed')
                if (pickDirect?.url) {
                    const url = String(pickDirect.url).startsWith('http') ? pickDirect.url : `${apiBase}${pickDirect.url}`
                    const rawSubs = Array.isArray(pack?.subtitles) ? pack.subtitles : []
                    const textTracks = rawSubs.map((s, i) => ({
                        src: String(s?.url || '').startsWith('http') ? s.url : `${apiBase}${s.url}`,
                        label: s?.label || `Subtitles ${i + 1}`,
                        srclang: s?.lang || 'und',
                        default: i === 0,
                    }))
                    return {
                        ...base,
                        title: epObj?.title || base.title,
                        videoUrl: url,
                        iframeUrl: null,
                        isDirect: true,
                        textTracks,
                        mirrors: meta.mirrors || [],
                        selectedMirrorId: meta.selectedMirrorId ?? null,
                        selectedMirrorLabel: resolvedMirrorLabel,
                        provider: meta.provider ?? null,
                        audioAvailability,
                        effectiveAudio,
                    }
                }
            }

            if (iframeFromPack) {
                return {
                    ...base,
                    title: epObj?.title || base.title,
                    iframeUrl: iframeFromPack,
                    isDirect: false,
                    mirrors: meta.mirrors || [],
                    selectedMirrorId: meta.selectedMirrorId ?? null,
                    selectedMirrorLabel: resolvedMirrorLabel,
                    provider: meta.provider ?? null,
                    audioAvailability,
                    effectiveAudio,
                }
            }
            const preferIframe = isIOSDevice()
            const pick = preferIframe
                ? sources.find(s => srcKind(s) === 'iframe') || sources.find(s => srcKind(s) === 'hls') || sources.find(s => srcKind(s) === 'mp4') || sources[0]
                : sources.find(s => srcKind(s) === 'hls') || sources.find(s => srcKind(s) === 'mp4') || sources[0]
            if (!pick?.url) {
                return { ...base, title: epObj?.title || base.title, isDirect: false, audioAvailability, effectiveAudio }
            }
            const url = String(pick.url).startsWith('http') ? pick.url : `${apiBase}${pick.url}`
            const rawSubs = Array.isArray(pack?.subtitles) ? pack.subtitles : []
            const textTracks = rawSubs.map((s, i) => ({
                src: String(s?.url || '').startsWith('http') ? s.url : `${apiBase}${s.url}`,
                label: s?.label || `Subtitles ${i + 1}`,
                srclang: s?.lang || 'und',
                default: i === 0,
            }))
            const pickKind = srcKind(pick)
            return {
                ...base,
                title: epObj?.title || base.title,
                videoUrl: pickKind === 'iframe' ? null : url,
                iframeUrl: pickKind === 'iframe' ? url : null,
                isDirect: pickKind !== 'iframe' && pickKind !== 'embed',
                textTracks,
                mirrors: meta.mirrors || [],
                selectedMirrorId: meta.selectedMirrorId ?? null,
                selectedMirrorLabel: resolvedMirrorLabel,
                provider: meta.provider ?? null,
                audioAvailability,
                effectiveAudio,
            }
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

    useEffect(() => {
        const onKey = e => { if (e.key === 'Escape') close() }
        window.addEventListener('keydown', onKey)
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            window.removeEventListener('keydown', onKey)
            document.body.style.overflow = prev
        }
    }, [close])

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
    const iframeAutoplayUrl = useMemo(
        () => withStreamIframeAutoplayUrl(stream?.iframeUrl || ''),
        [stream?.iframeUrl],
    )

    const startAutoplayCountdown = useCallback((nextIdx, secs = 12) => {
        if (!canNext) return
        if (autoplayTimerRef.current != null) {
            clearInterval(autoplayTimerRef.current)
            autoplayTimerRef.current = null
        }
        setAutoplayCountdown(secs)
        autoplayTimerRef.current = setInterval(() => {
            setAutoplayCountdown(prev => {
                if (prev == null || prev <= 1) {
                    clearInterval(autoplayTimerRef.current)
                    autoplayTimerRef.current = null
                    goEpisode(nextIdx)
                    return null
                }
                return prev - 1
            })
        }, 1000)
    }, [canNext, goEpisode])
    const audioValue = audioOverride === 'dub' || audioOverride === 'sub' ? audioOverride : ''

    const epAudioAvail = epObj?.episodeId ? audioAvailByEp[epObj.episodeId] : null
    const subAvailable = epAudioAvail ? epAudioAvail.sub : true
    const dubAvailable = epAudioAvail ? epAudioAvail.dub : true
    const showSubDubPicker = subAvailable && dubAvailable
    const subOnlyTrack = subAvailable && !dubAvailable
    const dubOnlyTrack = dubAvailable && !subAvailable
    const autoAudioLabel = subOnlyTrack
        ? 'Sub'
        : dubOnlyTrack
          ? 'Dub'
          : `Auto (${streamAudioType === 'dub' ? 'Dub' : 'Sub'})`

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
        [XBOX_GAMEPAD_BUTTONS.B]: () => {
            if (autoplayCountdown != null) {
                cancelAutoplay()
                return
            }
            if (!canNext) return
            startAutoplayCountdown(episodeIdx + 1)
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
    }), [autoplayCountdown, canNext, canPrev, cancelAutoplay, episodeIdx, goEpisode, startAutoplayCountdown, toggleIframeContainerFullscreen])

    useLifeSyncGamepadInput({
        enabled: controllerSupportEnabled && Boolean(stream?.iframeUrl) && !stream?.isDirect,
        handlers: iframeGamepadHandlers,
        repeatableButtons: [
            XBOX_GAMEPAD_BUTTONS.LT,
            XBOX_GAMEPAD_BUTTONS.RT,
            XBOX_GAMEPAD_BUTTONS.DPAD_UP,
            XBOX_GAMEPAD_BUTTONS.DPAD_DOWN,
        ],
    })

    useEffect(() => {
        if (!stream?.iframeUrl || stream?.isDirect || typeof window === 'undefined') return undefined
        const id = window.setTimeout(() => { focusIframeForControllerInput(streamIframeRef.current) }, 180)
        return () => window.clearTimeout(id)
    }, [stream?.iframeUrl, stream?.isDirect])

    useEffect(() => {
        if (!stream?.iframeUrl || stream?.isDirect || typeof window === 'undefined') return undefined
        const timers = []
        const kickoff = () => {
            focusIframeForControllerInput(streamIframeRef.current)
            dispatchBestEffortIframeMediaKeys(streamIframeRef.current, ['MediaPlay'])
        }
        timers.push(window.setTimeout(kickoff, 120))
        timers.push(window.setTimeout(kickoff, 420))
        timers.push(window.setTimeout(kickoff, 900))
        return () => {
            for (const id of timers) window.clearTimeout(id)
        }
    }, [stream?.iframeUrl, stream?.isDirect, episodeIdx])

    useEffect(() => {
        if (!stream?.iframeUrl || stream?.isDirect || typeof window === 'undefined') return undefined
        const onKey = (e) => {
            if (e.defaultPrevented) return
            if (isEditableElement(e.target)) return
            if (e.metaKey || e.ctrlKey || e.altKey) return

            let handled = true
            if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
                dispatchBestEffortIframeMediaKeys(streamIframeRef.current, ['k', ' ', 'Spacebar', 'MediaPlayPause'])
            } else if (e.key === 'ArrowLeft') {
                dispatchBestEffortIframeMediaKeys(streamIframeRef.current, ['j', 'ArrowLeft'])
            } else if (e.key === 'ArrowRight') {
                dispatchBestEffortIframeMediaKeys(streamIframeRef.current, ['l', 'ArrowRight'])
            } else if (e.key === 'ArrowUp') {
                dispatchBestEffortIframeMediaKeys(streamIframeRef.current, ['ArrowUp'])
            } else if (e.key === 'ArrowDown') {
                dispatchBestEffortIframeMediaKeys(streamIframeRef.current, ['ArrowDown'])
            } else if (e.key === 'f' || e.key === 'F') {
                toggleIframeContainerFullscreen()
                dispatchBestEffortIframeMediaKeys(streamIframeRef.current, ['f'])
            } else if (e.key === 'PageUp') {
                if (canPrev) goEpisode(episodeIdx - 1)
                else handled = false
            } else if (e.key === 'PageDown') {
                if (canNext) goEpisode(episodeIdx + 1)
                else handled = false
            } else if (e.key === 'n' || e.key === 'N') {
                if (canNext) startAutoplayCountdown(episodeIdx + 1)
                else handled = false
            } else {
                handled = false
            }

            if (!handled) return
            e.preventDefault()
            e.stopPropagation()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [canNext, canPrev, episodeIdx, goEpisode, startAutoplayCountdown, stream?.iframeUrl, toggleIframeContainerFullscreen])

    useEffect(() => {
        if (!stream?.iframeUrl || stream?.isDirect || typeof window === 'undefined') return undefined
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
    }, [stream?.iframeUrl])

    const relatedAnime = Array.isArray(anime?.related) ? anime.related : []

    if (!isLifeSyncConnected) {
        return (
            <div className="lifesync-anime-watch fixed inset-0 z-9999 flex h-dvh w-full items-center justify-center bg-[var(--mx-color-020202)] text-white">
                <div className="rounded-2xl border border-[var(--color-border-strong)]/10 bg-[var(--color-surface)]/5 px-6 py-5 text-center">
                    <p className="text-[13px] font-semibold text-white/90">Connecting LifeSync…</p>
                    <p className="mt-1 text-[12px] text-white/50">Please wait.</p>
                </div>
            </div>
        )
    }

    return (
        <MotionDiv
            className="lifesync-anime-watch fixed inset-0 z-9999 h-dvh w-full overflow-hidden bg-[var(--mx-color-050506)] text-white"
            style={{ transformOrigin: '50% 0%', viewTransitionName: 'lifesync-anime-watch' }}
            initial="initial"
            animate="animate"
            variants={lifeSyncDollyPageVariants}
            transition={lifeSyncDollyPageTransition}
        >
            {backdropUrl ? (
                <div className="pointer-events-none absolute inset-0">
                    <img
                        src={backdropUrl}
                        alt=""
                        className="h-full w-full object-cover opacity-[0.22] blur-2xl scale-[1.06]"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-linear-to-b from-black/72 via-black/58 to-black/84" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(198,255,0,0.12),transparent_58%)]" />
                </div>
            ) : null}

            <div className="relative flex h-dvh w-full flex-col">
                <header className="shrink-0 border-b border-[var(--color-border-strong)]/12 bg-black/30 backdrop-blur-2xl">
                    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-2.5 sm:px-6 lg:px-10">
                        <div className="flex min-w-0 items-center gap-2 sm:min-w-0 sm:flex-1">
                            <button
                                type="button"
                                onClick={close}
                                aria-label="Back"
                                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--color-border-strong)]/18 bg-[var(--color-surface)]/8 px-3 py-2 text-[12px] font-semibold text-white/90 transition-colors hover:border-[var(--mx-color-c6ff00)]/40 hover:bg-[var(--color-surface)]/14 sm:py-1.5"
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
                                    className="h-10 w-[2.45rem] shrink-0 overflow-hidden rounded-lg ring-1 ring-[var(--color-border-strong)]/30 sm:h-[3.35rem] sm:w-12 sm:rounded-xl"
                                    style={{ aspectRatio: '2/3' }}
                                >
                                    {backdropUrl ? (
                                        <img src={backdropUrl} alt="" className="h-full w-full object-cover" loading="eager" decoding="async" referrerPolicy="no-referrer" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-[var(--color-surface)]/10" aria-hidden />
                                    )}
                                </MotionDiv>
                            ) : null}
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[12px] font-semibold text-white sm:text-[13px]">
                                    {anime?.title || 'Loading…'}
                                </p>
                                <p className="truncate text-[10px] text-white/55 sm:text-[11px]">
                                    {epObj?.number != null ? `Episode ${epObj.number}` : epObj?.title || '—'}
                                </p>
                            </div>
                        </div>

                        <div className="flex w-full items-stretch gap-2 sm:w-auto sm:items-center sm:shrink-0">
                            <button
                                type="button"
                                disabled={!canPrev}
                                onClick={() => goEpisode(episodeIdx - 1)}
                                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[var(--color-border-strong)]/18 bg-[var(--color-surface)]/8 px-3 py-2 text-[12px] font-semibold text-white/90 transition-colors hover:border-[var(--mx-color-c6ff00)]/35 hover:bg-[var(--color-surface)]/14 disabled:opacity-30 sm:min-h-0 sm:flex-none sm:py-1.5"
                                title="Previous episode"
                            >
                                Prev
                            </button>
                            <button
                                type="button"
                                disabled={!canNext}
                                onClick={() => goEpisode(episodeIdx + 1)}
                                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[var(--color-border-strong)]/18 bg-[var(--color-surface)]/8 px-3 py-2 text-[12px] font-semibold text-white/90 transition-colors hover:border-[var(--mx-color-c6ff00)]/35 hover:bg-[var(--color-surface)]/14 disabled:opacity-30 sm:min-h-0 sm:flex-none sm:py-1.5"
                                title="Next episode"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
                    <div className="mx-auto w-full max-w-[1680px] px-3 py-2.5 sm:px-6 sm:py-5 lg:px-10">
                        {busy ? (
                            <WatchPageLoadSkeleton />
                        ) : (
                            <MotionDiv
                                className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-7"
                                {...lifeSyncModalSlideProps}
                            >
                                <main className="min-w-0 space-y-3 sm:space-y-4">
                                    <div className="lifesync-anime-watch-media overflow-hidden rounded-3xl border border-[var(--color-border-strong)]/12 bg-black">
                                        <div ref={streamIframeContainerRef} className="relative aspect-video w-full">
                                            {stream?.resolving ? (
                                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                                                    <div className="w-[min(520px,92vw)] rounded-3xl border border-[var(--color-border-strong)]/10 bg-[var(--mx-color-0b0b0d)]/90 p-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 rounded-2xl border border-[var(--color-border-strong)]/10 bg-[var(--color-surface)]/5 p-2.5">
                                                                <svg className="h-full w-full animate-spin text-white/80" viewBox="0 0 24 24" fill="none">
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
                                                            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface)]/10">
                                                                <div className="h-full w-1/3 animate-[lifesyncbar_1.2s_ease-in-out_infinite] rounded-full bg-[var(--color-surface)]/40" />
                                                            </div>
                                                            <p className="text-[11px] text-white/45">If this hangs, try switching Mirror or Audio below.</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (stream?.isDirect && stream?.videoUrl) || (!stream?.isDirect && !stream?.iframeUrl && stream?.videoUrl) ? (
                                                <AdvancedVideoPlayer
                                                    key={stream.videoUrl}
                                                    src={stream.videoUrl}
                                                    autoPlay
                                                    preload={videoPreload}
                                                    textTracks={stream.textTracks || []}
                                                    skipSegments={[]}
                                                    onPrevEpisode={canPrev ? () => goEpisode(episodeIdx - 1) : undefined}
                                                    onNextEpisode={canNext ? () => goEpisode(episodeIdx + 1) : undefined}
                                                    canPrevEpisode={canPrev}
                                                    canNextEpisode={canNext}
                                                    onEnded={() => { if (canNext) startAutoplayCountdown(episodeIdx + 1) }}
                                                />
                                            ) : stream?.iframeUrl ? (
                                                <>
                                                <iframe
                                                    ref={streamIframeRef}
                                                    key={iframeAutoplayUrl}
                                                    title={stream.title || 'Episode'}
                                                    src={iframeAutoplayUrl}
                                                    tabIndex={0}
                                                    onLoad={() => {
                                                        focusIframeForControllerInput(streamIframeRef.current)
                                                        dispatchBestEffortIframeMediaKeys(streamIframeRef.current, ['MediaPlay'])
                                                    }}
                                                    className="lifesync-anime-watch-media h-full w-full border-0 bg-black"
                                                    allow="fullscreen; encrypted-media; autoplay; picture-in-picture; web-share; clipboard-write"
                                                    allowFullScreen
                                                    {...streamIframeSandboxProps(stream.iframeUrl, {
                                                        provider: stream.provider,
                                                        selectedMirrorLabel: stream.selectedMirrorLabel,
                                                    })}
                                                    referrerPolicy="no-referrer-when-downgrade"
                                                />
                                                </>
                                            ) : (
                                                <div className="lifesync-anime-watch-media flex h-full w-full items-center justify-center bg-[var(--mx-color-0f0f12)] px-4 text-center">
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
                                            {autoplayCountdown != null && canNext && !stream?.resolving && (
                                                <div className="absolute bottom-4 right-4 z-20 flex items-center gap-3 rounded-2xl border border-(--color-border-strong)/20 bg-black/75 px-4 py-3 backdrop-blur-md">
                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-(--mx-color-c6ff00)/60 bg-black/40">
                                                        <span className="text-[13px] font-black tabular-nums text-(--mx-color-c6ff00)">{autoplayCountdown}</span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[11px] font-semibold text-white/90">Up Next</p>
                                                        <p className="text-[10px] text-white/55 truncate max-w-[140px]">
                                                            {episodes?.[episodeIdx + 1]?.number != null ? `Ep ${episodes[episodeIdx + 1].number}` : `Ep ${episodeIdx + 2}`}
                                                            {episodes?.[episodeIdx + 1]?.title ? ` · ${episodes[episodeIdx + 1].title}` : ''}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => { cancelAutoplay(); goEpisode(episodeIdx + 1) }}
                                                            className="rounded-xl bg-(--mx-color-c6ff00) px-3 py-1.5 text-[11px] font-bold text-black transition hover:brightness-95"
                                                        >
                                                            Play
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={cancelAutoplay}
                                                            className="rounded-xl border border-(--color-border-strong)/20 bg-black/30 px-3 py-1.5 text-[11px] font-semibold text-white/80 transition hover:bg-black/50"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Up Next auto-play card */}
                                    {canNext && (stream?.iframeUrl || stream?.videoUrl) && !stream?.resolving && autoplayCountdown == null && (
                                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-(--color-border-strong)/14 bg-black/30 px-4 py-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">Up Next</p>
                                                <p className="mt-0.5 truncate text-[12px] font-semibold text-white/85">
                                                    {episodes?.[episodeIdx + 1]?.number != null ? `Ep ${episodes[episodeIdx + 1].number}` : `Ep ${episodeIdx + 2}`}
                                                    {episodes?.[episodeIdx + 1]?.title ? ` · ${episodes[episodeIdx + 1].title}` : ''}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => startAutoplayCountdown(episodeIdx + 1)}
                                                    className="rounded-xl border border-(--mx-color-c6ff00)/35 bg-(--mx-color-c6ff00)/10 px-3 py-1.5 text-[11px] font-semibold text-(--mx-color-c6ff00) transition hover:bg-(--mx-color-c6ff00)/20"
                                                >
                                                    Auto-play
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => goEpisode(episodeIdx + 1)}
                                                    className="rounded-xl bg-(--color-surface)/10 px-3 py-1.5 text-[11px] font-semibold text-white/80 transition hover:bg-(--color-surface)/18"
                                                >
                                                    Skip
                                                </button>
                                            </div>
                                        </div>
                                    )}

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
                                                                    ? 'border-[var(--color-border-strong)]/30 bg-[var(--color-surface)]/12 text-white'
                                                                    : 'border-[var(--color-border-strong)]/10 bg-black/30 text-white/75 hover:border-[var(--color-border-strong)]/18 hover:bg-[var(--color-surface)]/6'
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

                                    <section className="rounded-3xl border border-[var(--color-border-strong)]/12 bg-linear-to-br from-[var(--color-surface)]/10 via-black/22 to-black/38 p-4 sm:p-6">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
                                            <div className="min-w-0 flex-1 space-y-3 sm:space-y-4">
                                                <div className="flex gap-2.5 sm:gap-4">
                                                    {backdropUrl ? (
                                                        <img
                                                            src={backdropUrl}
                                                            alt=""
                                                            className="h-19 w-[3.35rem] shrink-0 rounded-2xl object-cover ring-1 ring-[var(--color-border-strong)]/12 sm:h-21 sm:w-[3.7rem]"
                                                            loading="lazy"
                                                            referrerPolicy="no-referrer"
                                                        />
                                                    ) : (
                                                        <div className="h-19 w-[3.35rem] shrink-0 rounded-2xl bg-[var(--color-surface)]/6 ring-1 ring-[var(--color-border-strong)]/10 sm:h-21 sm:w-[3.7rem]" />
                                                    )}
                                                    <div className="min-w-0 flex-1 pt-0.5">
                                                        <h2 className="line-clamp-2 text-[15px] font-semibold leading-snug text-white/95 sm:text-base">
                                                            {anime?.title || '—'}
                                                        </h2>
                                                        <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Episode and source details">
                                                            <li>
                                                                <span className="inline-flex items-center rounded-lg border border-[var(--color-border-strong)]/12 bg-black/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70 sm:text-[11px]">
                                                                    {epObj?.number != null ? `Ep ${epObj.number}` : `Ep ${episodeIdx + 1}`}
                                                                </span>
                                                            </li>
                                                            {anime?.status ? (
                                                                <li>
                                                                    <span className="inline-flex items-center rounded-lg border border-[var(--color-border-strong)]/12 bg-black/35 px-2 py-0.5 text-[10px] font-semibold capitalize text-white/70 sm:text-[11px]">
                                                                        {String(anime.status).replace(/_/g, ' ')}
                                                                    </span>
                                                                </li>
                                                            ) : null}
                                                            {stream?.provider ? (
                                                                <li>
                                                                    <span className="inline-flex items-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold capitalize text-emerald-200/90 sm:text-[11px]">
                                                                        {String(stream.provider)}
                                                                    </span>
                                                                </li>
                                                            ) : null}
                                                        </ul>
                                                        {anime?.synopsis ? (
                                                            <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-white/50">
                                                                {anime.synopsis}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="w-full shrink-0 lg:w-[min(100%,22rem)]">
                                                <div className="rounded-2xl border border-[var(--color-border-strong)]/12 bg-black/28 p-3 sm:p-3.5">
                                                    <div className="flex items-center gap-2">
                                                        {/* Audio */}
                                                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                                                            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">Audio</p>
                                                            {showSubDubPicker ? (
                                                                <select
                                                                    value={audioValue}
                                                                    onChange={(e) => {
                                                                        const v = safeText(e.target.value).trim()
                                                                        setAudioOverride(v === 'sub' || v === 'dub' ? v : null)
                                                                        setMirrorOverrideId('')
                                                                        if (v === 'sub' || v === 'dub') {
                                                                            lifesyncPatchPreferences({ animeStreamAudio: v }).catch(() => {})
                                                                        }
                                                                    }}
                                                                    className="h-9 w-full cursor-pointer rounded-xl border border-[var(--color-border-strong)]/14 bg-black/42 px-2.5 text-[12px] font-semibold text-white/90 outline-none transition-colors hover:border-[var(--mx-color-c6ff00)]/30 focus:border-[var(--mx-color-c6ff00)]/45 focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/20"
                                                                >
                                                                    <option value="" className="bg-[var(--mx-color-111)]">{autoAudioLabel}</option>
                                                                    <option value="sub" className="bg-[var(--mx-color-111)]">Sub</option>
                                                                    <option value="dub" className="bg-[var(--mx-color-111)]">Dub</option>
                                                                </select>
                                                            ) : (
                                                                <div className="flex h-9 items-center rounded-xl border border-[var(--color-border-strong)]/10 bg-black/25 px-2.5 text-[11px] font-semibold text-white/60">
                                                                    {subOnlyTrack ? 'Sub only' : dubOnlyTrack ? 'Dub only' : '—'}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Divider */}
                                                        <div className="h-10 w-px shrink-0 bg-[var(--color-border-strong)]/10" />

                                                        {/* Mirror */}
                                                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                                                            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">Mirror</p>
                                                            <select
                                                                value={mirrorOverrideId}
                                                                onChange={(e) => setMirrorOverrideId(safeText(e.target.value).trim())}
                                                                className="h-9 w-full cursor-pointer rounded-xl border border-[var(--color-border-strong)]/14 bg-black/42 px-2.5 text-[12px] font-semibold text-white/90 outline-none transition-colors hover:border-[var(--mx-color-c6ff00)]/30 focus:border-[var(--mx-color-c6ff00)]/45 focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/20 disabled:cursor-not-allowed disabled:opacity-45"
                                                                disabled={!Array.isArray(stream?.mirrors) || stream.mirrors.length === 0}
                                                            >
                                                                <option value="" className="bg-[var(--mx-color-111)]">
                                                                    {stream?.selectedMirrorLabel ? stream.selectedMirrorLabel : 'Auto'}
                                                                </option>
                                                                {(Array.isArray(stream?.mirrors) ? stream.mirrors : []).map((m, idx) => {
                                                                    const id = m?.id != null ? String(m.id) : ''
                                                                    const label = m?.label ? String(m.label) : id || `Mirror ${idx + 1}`
                                                                    if (!id) return null
                                                                    return (
                                                                        <option key={id} value={id} className="bg-[var(--mx-color-111)]">{label}</option>
                                                                    )
                                                                })}
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    {relatedAnime.length > 0 ? (
                                        <section className="rounded-3xl border border-[var(--color-border-strong)]/12 bg-[var(--color-surface)]/8 p-3.5 sm:rounded-3xl sm:p-4">
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
                                                            className="min-h-11 rounded-2xl border border-[var(--color-border-strong)]/12 bg-black/24 px-3 py-2 text-left text-[12px] font-semibold text-white/85 transition-colors hover:border-[var(--mx-color-c6ff00)]/28 hover:bg-[var(--color-surface)]/8 sm:min-h-0"
                                                        >
                                                            {r?.title || slug}
                                                            {r?.relation ? (
                                                                <span className="ml-1.5 text-[10px] font-normal text-white/45">
                                                                    {String(r.relation).replace(/_/g, ' ')}
                                                                </span>
                                                            ) : null}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </section>
                                    ) : null}
                                </main>

                                <aside className="hidden min-w-0 lg:block">
                                    <div className="rounded-3xl border border-[var(--color-border-strong)]/12 bg-black/26">
                                        <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border-strong)]/10 px-3 py-2.5 sm:py-3">
                                            <p className="text-[11px] font-semibold text-white/85">Episodes</p>
                                            <span className="rounded-full border border-[var(--color-border-strong)]/10 bg-[var(--color-surface)]/5 px-2 py-1 text-[10px] font-semibold text-white/60">
                                                {episodes.length || '—'}
                                            </span>
                                        </div>
                                        <div className="max-h-[min(70dvh,720px)] overflow-y-auto p-2">
                                            {episodes.length === 0 ? (
                                                <p className="px-2 py-3 text-[12px] text-white/45">No episode list returned.</p>
                                            ) : (
                                                <ul className="space-y-1.5">
                                                    {episodes.map((ep, i) => {
                                                        const on = i === episodeIdx
                                                        return (
                                                            <li key={ep.episodeId || i}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => goEpisode(i)}
                                                                    className={`flex w-full items-center gap-2 rounded-2xl border px-2.5 py-2 text-left transition-colors ${
                                                                        on
                                                                            ? 'border-[var(--mx-color-c6ff00)]/45 bg-[var(--color-surface)]/14'
                                                                            : 'border-[var(--color-border-strong)]/12 bg-black/22 hover:border-[var(--mx-color-c6ff00)]/24 hover:bg-[var(--color-surface)]/8'
                                                                    }`}
                                                                >
                                                                    <LifesyncEpisodeThumbnail
                                                                        src={ep.thumbnailUrl}
                                                                        poster={backdropUrl}
                                                                        dark
                                                                        className="relative h-10 w-16 shrink-0 overflow-hidden rounded-xl bg-black/40 ring-1 ring-[var(--color-border-strong)]/5"
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
                                                                                    return '—'
                                                                                }
                                                                                return ep.hasDub && ep.hasSub ? 'Sub · Dub' : ep.hasDub ? 'Dub' : ep.hasSub ? 'Sub' : '—'
                                                                            })()}
                                                                        </p>
                                                                    </div>
                                                                    {on ? (
                                                                        <span className="shrink-0 rounded-full border border-[var(--color-border-strong)]/10 bg-black/30 px-2 py-1 text-[10px] font-semibold text-white/65">
                                                                            Playing
                                                                        </span>
                                                                    ) : null}
                                                                </button>
                                                            </li>
                                                        )
                                                    })}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                </aside>
                            </MotionDiv>
                        )}
                    </div>
                </div>
            </div>
        </MotionDiv>
    )
}
