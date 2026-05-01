import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLifeSync } from '../../context/LifeSyncContext'
import { getAnimeStreamAudio, getLifesyncApiBase, lifesyncFetch } from '../../lib/lifesyncApi'
import useControllerSupportEnabled from '../../hooks/useControllerSupportEnabled'
import useLifeSyncGamepadInput from '../../hooks/useLifeSyncGamepadInput'
import { MalListStatusControl } from './malListStatusUi'
import {
    fetchStreamInfoByMalWithCache,
    writeLifesyncStreamCatalogByMal,
} from '../../lib/lifesyncStreamCatalogCache'
import { animePosterLayoutId } from '../../lib/lifesyncAnimeSharedLayout'
import { peekAnimeWatchHandoff } from '../../lib/lifesyncWatchHandoff'
import { LIFESYNC_ANIME_WATCH_HISTORY_UPDATED_EVENT } from '../../hooks/useAnimeWatchHistory'
import AdvancedVideoPlayer from '../../components/lifesync/AdvancedVideoPlayer'
import {
    LifesyncEpisodeThumbnail,
    WatchPageLoadSkeleton,
} from '../../components/lifesync/EpisodeLoadingSkeletons'
import { streamIframeSandboxProps } from '../../lib/lifesyncStreamIframe'
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

function normalizeStreamEpisodesForPlayer(list, episodeThumbnails = {}) {
    const thumbs = episodeThumbnails && typeof episodeThumbnails === 'object' ? episodeThumbnails : {}
    return (list || [])
        .map((ep, i) => {
            const episodeId = ep?.episodeId || ep?.id
            if (!episodeId) return null
            const num = ep?.number ?? ep?.episode
            const tn = num != null ? thumbs[String(num)] : null
            const thumbUrl =
                (typeof ep?.thumbnailUrl === 'string' && ep.thumbnailUrl.trim()) ||
                (typeof tn === 'string' && tn.trim()) ||
                undefined
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

function parseEpisodeNumber(epObj, fallbackEpisodeNumber) {
    const fromRow = Number(epObj?.number ?? epObj?.episode)
    if (Number.isFinite(fromRow) && fromRow > 0) return Math.round(fromRow * 1000) / 1000
    const fromFallback = Number(fallbackEpisodeNumber)
    if (Number.isFinite(fromFallback) && fromFallback > 0) return Math.round(fromFallback * 1000) / 1000
    return 1
}

function normalizeAniSkipSegments(payload) {
    const list = Array.isArray(payload?.results) ? payload.results : []
    const out = []
    for (const raw of list) {
        if (!raw || typeof raw !== 'object') continue
        const startRaw = Number(raw.startTime)
        const endRaw = Number(raw.endTime)
        if (!Number.isFinite(startRaw) || !Number.isFinite(endRaw) || endRaw <= startRaw) continue
        const skipType = String(raw.skipType || '').trim().toLowerCase()
        if (!skipType) continue
        const labelRaw = String(raw.label || '').trim()
        out.push({
            id: String(raw.skipId || `${skipType}:${startRaw}:${endRaw}`),
            skipType,
            label:
                labelRaw ||
                (skipType === 'op' || skipType === 'mixed-op'
                    ? 'Skip Intro'
                    : skipType === 'ed' || skipType === 'mixed-ed'
                      ? 'Skip Outro'
                      : 'Skip Recap'),
            startTime: startRaw,
            endTime: endRaw,
        })
    }
    out.sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime)
    return out
}

function formatStartSeason(anime) {
    const s = anime?.start_season
    if (!s || typeof s !== 'object') return null
    const y = s.year != null ? String(s.year) : ''
    const season = s.season != null ? String(s.season) : ''
    if (!y && !season) return null
    const label = season ? `${season[0].toUpperCase()}${season.slice(1)}` : ''
    return [label, y].filter(Boolean).join(' ')
}

function buildSeriesSeasonOptions(anime) {
    const out = []
    const curId = anime?.id != null ? String(anime.id) : null
    const curTitle = anime?.title ? String(anime.title) : null
    if (curId) out.push({ id: curId, title: curTitle || `Anime ${curId}`, rel: 'current' })

    const rel = Array.isArray(anime?.related_anime) ? anime.related_anime : []
    for (const r of rel) {
        const node = r?.node
        const id = node?.id != null ? String(node.id) : null
        if (!id || id === curId) continue
        const title = node?.title ? String(node.title) : `Anime ${id}`
        const relType = r?.relation_type ? String(r.relation_type) : 'related'
        out.push({ id, title, rel: relType })
    }

    // Prefer prequels first, then current, then sequels, then everything else.
    const score = (rel) => {
        if (rel === 'prequel') return 0
        if (rel === 'current') return 1
        if (rel === 'sequel') return 2
        return 3
    }
    out.sort((a, b) => score(a.rel) - score(b.rel) || a.title.localeCompare(b.title))
    // Deduplicate.
    const seen = new Set()
    return out.filter(o => (seen.has(o.id) ? false : (seen.add(o.id), true)))
}

export default function LifeSyncAnimeWatch() {
    const { malId: malIdParam, ep: epParam } = useParams()
    const location = useLocation()
    const navigate = useNavigate()
    const { isLifeSyncConnected, lifeSyncUser } = useLifeSync()
    const malLinked = Boolean(
        lifeSyncUser?.integrations?.mal || lifeSyncUser?.integrations?.malUsername,
    )

    const malId = useMemo(() => String(malIdParam || '').trim(), [malIdParam])
    const episodeIndex = useMemo(() => clampPage(epParam) - 1, [epParam])
    const streamAudioType = getAnimeStreamAudio(lifeSyncUser?.preferences)

    const from = location.state?.from
    const titleHintFromState = typeof location.state?.title === 'string' ? location.state.title.trim() : ''
    const closeTo =
        typeof from === 'string' && from.startsWith('/dashboard/lifesync/anime/anime')
            ? from
            : '/dashboard/lifesync/anime/anime/seasonal/page/1'
    const fromResumeDeckState = location.state?.fromResumeDeck
    const fromResumeDeck =
        fromResumeDeckState === true ||
        fromResumeDeckState === '1' ||
        fromResumeDeckState === 'true'

    const [episodes, setEpisodes] = useState([])
    const [busy, setBusy] = useState(true)
    const [stream, setStream] = useState(null)
    const [skipSegments, setSkipSegments] = useState([])
    const [anime, setAnime] = useState(null)
    const [episodeIdx, setEpisodeIdx] = useState(episodeIndex)
    const [audioOverride, setAudioOverride] = useState(null) // 'sub' | 'dub' | null
    const [mirrorOverrideId, setMirrorOverrideId] = useState('')
    /** Per-episode sub/dub availability from stream API (avoids merging into `episodes` → refetch loops). */
    const [audioAvailByEp, setAudioAvailByEp] = useState(() => (/** @type {Record<string, { sub: boolean, dub: boolean }>} */ ({})))
    const audioAvailRef = useRef(audioAvailByEp)
    audioAvailRef.current = audioAvailByEp

    /** Detail → watch handoff: skip skeleton + first stream resolve when catalog/stream were prefetched. */
    const seedCatalogQuietRef = useRef(false)
    const skipStreamResolveOnceRef = useRef(false)
    const prevMalRef = useRef(/** @type {string | null} */ (null))
    const handoffHydratedRef = useRef(false)
    const [videoPreload, setVideoPreload] = useState('metadata')
    const [streamCatalogMirror, setStreamCatalogMirror] = useState(() => {
        const m = location.state?.streamCatalogMirror
        return typeof m === 'string' && m.toLowerCase() === 'kickassanime' ? 'kickassanime' : ''
    })
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

    const startSeasonLabel = useMemo(() => formatStartSeason(anime), [anime])
    const seriesSeasonOptions = useMemo(() => buildSeriesSeasonOptions(anime), [anime])
    const selectedSeriesSeasonId = anime?.id != null ? String(anime.id) : ''
    const sequelOptions = useMemo(() => {
        const rel = Array.isArray(anime?.related_anime) ? anime.related_anime : []
        return rel
            .filter(r => String(r?.relation_type || '').toLowerCase() === 'sequel')
            .map(r => {
                const node = r?.node
                const id = node?.id != null ? String(node.id) : ''
                const title = node?.title ? String(node.title) : id ? `Anime ${id}` : 'Sequel'
                return { id, title }
            })
            .filter(x => x.id)
    }, [anime])

    const onListStatusPatched = useCallback(patch => {
        if (!patch || typeof patch !== 'object') return
        setAnime(prev => {
            if (!prev) return prev
            return {
                ...prev,
                my_list_status: { ...(prev.my_list_status || {}), ...patch },
            }
        })
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
            const malQ = malId ? `&malId=${encodeURIComponent(malId)}` : ''
            const mirrorQ =
                mirrorId != null && String(mirrorId).trim() !== ''
                    ? `&server=${encodeURIComponent(String(mirrorId).trim())}`
                    : ''

            const pack = await lifesyncFetch(
                `/api/v1/anime/stream/watch/${encodeURIComponent(episodeId)}?type=${type}${malQ}${mirrorQ}&view=full`,
                signal ? { signal } : undefined
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

            if (iframeFromPack) {
                return {
                    ...base,
                    title: epObj?.title || base.title,
                    iframeUrl: iframeFromPack,
                    mirrors: meta.mirrors || [],
                    selectedMirrorId: meta.selectedMirrorId ?? null,
                    selectedMirrorLabel: meta.selectedMirrorLabel ?? null,
                    provider: meta.provider ?? null,
                    audioAvailability,
                    effectiveAudio,
                }
            }
            const sources = Array.isArray(pack?.sources) ? pack.sources : []
            const preferIframe = isIOSDevice()
            const pick = preferIframe
                ? sources.find(s => s?.kind === 'iframe') || sources.find(s => s?.kind === 'hls') || sources.find(s => s?.kind === 'mp4') || sources[0]
                : sources.find(s => s?.kind === 'hls') || sources.find(s => s?.kind === 'mp4') || sources[0]
            if (!pick?.url) {
                return { ...base, title: epObj?.title || base.title, audioAvailability, effectiveAudio }
            }
            const url = String(pick.url).startsWith('http') ? pick.url : `${apiBase}${pick.url}`
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
                videoUrl: pick.kind === 'iframe' ? null : url,
                iframeUrl: pick.kind === 'iframe' ? url : null,
                textTracks,
                mirrors: meta.mirrors || [],
                selectedMirrorId: meta.selectedMirrorId ?? null,
                selectedMirrorLabel: meta.selectedMirrorLabel ?? null,
                provider: meta.provider ?? null,
                audioAvailability,
                effectiveAudio,
            }
        },
        [malId, streamAudioType]
    )

    useEffect(() => {
        setEpisodeIdx(episodeIndex)
    }, [episodeIndex])

    useEffect(() => {
        setAudioAvailByEp({})
    }, [malId])

    useLayoutEffect(() => {
        if (handoffHydratedRef.current) return
        const id = location.state?.handoffId
        const fromPath = location.state?.from
        if (!id || !malId) return

        const row = peekAnimeWatchHandoff(id)

        const stripHandoffState = () => {
            navigate(`${location.pathname}${location.search || ''}`, {
                replace: true,
                state: typeof fromPath === 'string' && fromPath.startsWith('/dashboard') ? { from: fromPath } : {},
            })
        }

        if (!row || String(row.malId) !== malId) {
            handoffHydratedRef.current = true
            stripHandoffState()
            return
        }

        handoffHydratedRef.current = true

        if (String(row.streamCatalogMirror || '').toLowerCase() === 'kickassanime') {
            setStreamCatalogMirror('kickassanime')
        }

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
        if (
            s &&
            typeof s === 'object' &&
            (s.videoUrl || s.iframeUrl) &&
            epForStream?.episodeId
        ) {
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
    }, [episodeIndex, location.pathname, location.search, location.state?.from, location.state?.handoffId, malId, navigate, bumpWatchHistory])

    useEffect(() => {
        if (prevMalRef.current === null) {
            prevMalRef.current = malId
            return
        }
        if (prevMalRef.current !== malId) {
            prevMalRef.current = malId
            seedCatalogQuietRef.current = false
            skipStreamResolveOnceRef.current = false
            handoffHydratedRef.current = false
            setVideoPreload('metadata')
            shouldForceCatalogRefreshRef.current = fromResumeDeck
            const m = location.state?.streamCatalogMirror
            setStreamCatalogMirror(
                typeof m === 'string' && m.toLowerCase() === 'kickassanime' ? 'kickassanime' : '',
            )
        }
    }, [fromResumeDeck, location.state?.streamCatalogMirror, malId])

    useEffect(() => {
        if (!isLifeSyncConnected) return
        if (!malId) return
        const ac = new AbortController()
        const quiet = seedCatalogQuietRef.current
        if (!quiet) {
            setBusy(true)
        }

        ;(async () => {
            try {
                const audio = streamAudioType === 'dub' ? 'dub' : 'sub'
                const forceCatalogRefresh = shouldForceCatalogRefreshRef.current
                const [detail, streamInfo, thumbs] = await Promise.all([
                    lifesyncFetch(
                        `/api/v1/anime/details/${encodeURIComponent(malId)}?fields=related_anime,my_list_status&view=full`,
                        { signal: ac.signal }
                    ).catch(() => null),
                    fetchStreamInfoByMalWithCache(malId, lifesyncFetch, { signal: ac.signal }, {
                        mirror: streamCatalogMirror === 'kickassanime' ? 'kickassanime' : '',
                        ...(forceCatalogRefresh ? { forceRefresh: true, fromResumeDeck: true } : {}),
                        title: typeof anime?.title === 'string' && anime.title.trim() ? anime.title : titleHintFromState,
                    }).catch(() => null),
                    lifesyncFetch(
                        `/api/v1/anime/mal-episode-thumbnails/${encodeURIComponent(malId)}?audio=${audio}&view=compact`,
                        { signal: ac.signal }
                    ).catch(() => null),
                ])
                if (ac.signal.aborted) return
                if (streamInfo?.data != null) {
                    writeLifesyncStreamCatalogByMal(
                        malId,
                        streamInfo,
                        streamCatalogMirror === 'kickassanime' ? 'kickassanime' : '',
                    )
                }
                setAnime(detail || null)
                const thumbMap =
                    thumbs?.thumbnails && typeof thumbs.thumbnails === 'object' ? thumbs.thumbnails : {}
                const catalog = streamInfo?.data && typeof streamInfo.data === 'object' ? streamInfo.data : null
                const eps = normalizeStreamEpisodesForPlayer(catalog?.episodes, thumbMap)
                if (eps.length > 0) setEpisodes(eps)
            } finally {
                if (!ac.signal.aborted) {
                    setBusy(false)
                    seedCatalogQuietRef.current = false
                    shouldForceCatalogRefreshRef.current = false
                }
            }
        })()

        return () => {
            ac.abort()
        }
    }, [anime?.title, isLifeSyncConnected, malId, streamAudioType, streamCatalogMirror, titleHintFromState])

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
                    ac.signal
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

        return () => {
            ac.abort()
        }
    }, [episodes, episodeIdx, isLifeSyncConnected, resolveAnimeStream, audioOverride, mirrorOverrideId, bumpWatchHistory])

    useEffect(() => {
        if (!isLifeSyncConnected) return
        if (!malId) {
            setSkipSegments([])
            return
        }
        if (!stream?.videoUrl || stream?.resolving) {
            setSkipSegments([])
            return
        }

        const epObj = episodes?.[episodeIdx]
        if (!epObj) {
            setSkipSegments([])
            return
        }

        const episodeNumber = parseEpisodeNumber(epObj, episodeIdx + 1)
        const ac = new AbortController()

        ;(async () => {
            try {
                const raw = await lifesyncFetch(
                    `/api/v1/anime/stream/skip-times/${encodeURIComponent(malId)}/${encodeURIComponent(String(episodeNumber))}?episodeLength=0&view=full`,
                    { signal: ac.signal }
                )
                if (ac.signal.aborted) return
                setSkipSegments(normalizeAniSkipSegments(raw))
            } catch {
                if (ac.signal.aborted) return
                setSkipSegments([])
            }
        })()

        return () => ac.abort()
    }, [episodes, episodeIdx, isLifeSyncConnected, malId, stream?.resolving, stream?.videoUrl])

    // Persist “continue watching” progress (single slot per MAL title).
    useEffect(() => {
        if (!isLifeSyncConnected) return
        if (!malId) return
        const epObj = episodes?.[episodeIdx]
        if (!epObj) return

        const lastEpisodeNumber =
            epObj?.number != null ? Math.max(1, Math.floor(Number(epObj.number) || 1)) : episodeIdx + 1

        const ac = new AbortController()
        void lifesyncFetch('/api/v1/anime/watch-progress', {
            method: 'PUT',
            signal: ac.signal,
            json: { malId, lastEpisodeNumber },
        })
            .then(() => bumpWatchHistory())
            .catch(() => {})

        return () => ac.abort()
    }, [bumpWatchHistory, episodeIdx, episodes, isLifeSyncConnected, malId])

    const close = useCallback(() => navigate(closeTo, { replace: true }), [closeTo, navigate])

    useEffect(() => {
        const onKey = e => {
            if (e.key === 'Escape') close()
        }
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
            navigate(`/dashboard/lifesync/anime/anime/watch/${encodeURIComponent(malId)}/${next + 1}`, {
                replace: true,
                state: { from: closeTo },
            })
        },
        [closeTo, episodes?.length, malId, navigate]
    )

    const epObj = episodes?.[episodeIdx]
    const canPrev = episodeIdx > 0
    const canNext = episodeIdx < (episodes?.length || 0) - 1
    const backdropUrl = anime?.main_picture?.large || anime?.main_picture?.medium || ''
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
                        window.setTimeout(() => {
                            focusIframeForControllerInput(streamIframeRef.current)
                        }, 60)
                    })
                    .catch(() => {})
            }
            return
        }
        if (document.exitFullscreen) {
            document.exitFullscreen()
                .then(() => {
                    if (typeof window === 'undefined') return
                    window.setTimeout(() => {
                        focusIframeForControllerInput(streamIframeRef.current)
                    }, 30)
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
        [XBOX_GAMEPAD_BUTTONS.LB]: () => {
            if (!canPrev) return
            goEpisode(episodeIdx - 1)
        },
        [XBOX_GAMEPAD_BUTTONS.RB]: () => {
            if (!canNext) return
            goEpisode(episodeIdx + 1)
        },
    }), [canNext, canPrev, episodeIdx, goEpisode, toggleIframeContainerFullscreen])

    useLifeSyncGamepadInput({
        enabled: controllerSupportEnabled && Boolean(stream?.iframeUrl),
        handlers: iframeGamepadHandlers,
        repeatableButtons: [
            XBOX_GAMEPAD_BUTTONS.LT,
            XBOX_GAMEPAD_BUTTONS.RT,
            XBOX_GAMEPAD_BUTTONS.DPAD_UP,
            XBOX_GAMEPAD_BUTTONS.DPAD_DOWN,
        ],
    })

    useEffect(() => {
        if (!stream?.iframeUrl || typeof window === 'undefined') return undefined
        const id = window.setTimeout(() => {
            focusIframeForControllerInput(streamIframeRef.current)
        }, 180)
        return () => window.clearTimeout(id)
    }, [stream?.iframeUrl])

    useEffect(() => {
        if (!stream?.iframeUrl || typeof window === 'undefined') return undefined
        const onFullscreenChange = () => {
            const container = streamIframeContainerRef.current
            const fullscreenEl = document.fullscreenElement
            if (!container || !fullscreenEl) return
            const isAnimePlayerFullscreen =
                fullscreenEl === container || container.contains(fullscreenEl)
            if (!isAnimePlayerFullscreen) return
            window.setTimeout(() => {
                focusIframeForControllerInput(streamIframeRef.current)
            }, 60)
        }
        document.addEventListener('fullscreenchange', onFullscreenChange)
        document.addEventListener('webkitfullscreenchange', onFullscreenChange)
        return () => {
            document.removeEventListener('fullscreenchange', onFullscreenChange)
            document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
        }
    }, [stream?.iframeUrl])

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
            style={{
                transformOrigin: '50% 0%',
                viewTransitionName: 'lifesync-anime-watch',
            }}
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
                                    <path
                                        d="M12.5 4.5L7 10l5.5 5.5"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                                <span className="max-[380px]:hidden">Back</span>
                            </button>
                            {malId ? (
                                <MotionDiv
                                    layoutId={animePosterLayoutId(malId)}
                                    transition={lifeSyncSharedLayoutTransitionProps}
                                    className="h-10 w-[2.45rem] shrink-0 overflow-hidden rounded-lg ring-1 ring-[var(--color-border-strong)]/30 sm:h-[3.35rem] sm:w-12 sm:rounded-xl"
                                    style={{ aspectRatio: '2/3' }}
                                >
                                    {backdropUrl ? (
                                        <img
                                            src={backdropUrl}
                                            alt=""
                                            className="h-full w-full object-cover"
                                            loading="eager"
                                            decoding="async"
                                            referrerPolicy="no-referrer"
                                        />
                                    ) : (
                                        <div
                                            className="flex h-full w-full items-center justify-center bg-[var(--color-surface)]/10"
                                            aria-hidden
                                        />
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
                                                                    <path
                                                                        d="M12 2a10 10 0 1010 10"
                                                                        stroke="currentColor"
                                                                        strokeWidth="2.2"
                                                                        strokeLinecap="round"
                                                                    />
                                                                </svg>
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-[13px] font-semibold text-white/90">
                                                                    Starting your stream
                                                                </p>
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
                                                            <p className="text-[11px] text-white/45">
                                                                If this hangs, try switching Mirror or Audio below.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : stream?.iframeUrl ? (
                                                <iframe
                                                    ref={streamIframeRef}
                                                    key={stream.iframeUrl}
                                                    title={stream.title || 'Episode'}
                                                    src={stream.iframeUrl}
                                                    tabIndex={0}
                                                    onLoad={() => {
                                                        focusIframeForControllerInput(streamIframeRef.current)
                                                    }}
                                                    className="lifesync-anime-watch-media h-full w-full border-0 bg-black"
                                                    allow="fullscreen; encrypted-media; autoplay; picture-in-picture"
                                                    {...streamIframeSandboxProps(stream.iframeUrl, {
                                                        provider: stream.provider,
                                                        selectedMirrorLabel: stream.selectedMirrorLabel,
                                                    })}
                                                    referrerPolicy="no-referrer-when-downgrade"
                                                />
                                            ) : stream?.videoUrl ? (
                                                <AdvancedVideoPlayer
                                                    key={stream.videoUrl}
                                                    src={stream.videoUrl}
                                                    preload={videoPreload}
                                                    textTracks={stream.textTracks || []}
                                                    skipSegments={skipSegments}
                                                    onPrevEpisode={canPrev ? () => goEpisode(episodeIdx - 1) : undefined}
                                                    onNextEpisode={canNext ? () => goEpisode(episodeIdx + 1) : undefined}
                                                    canPrevEpisode={canPrev}
                                                    canNextEpisode={canNext}
                                                    onEnded={() => {
                                                        if (canNext) goEpisode(episodeIdx + 1)
                                                    }}
                                                />
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
                                        </div>
                                    </div>

                                    {episodes.length > 0 ? (
                                        <div className="lg:hidden">
                                            <div className="mb-1 flex items-center justify-between gap-2 px-0.5">
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
                                                    Episodes
                                                </p>
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
                                                        ? av.sub && av.dub
                                                            ? 'S·D'
                                                            : av.dub
                                                              ? 'D'
                                                              : av.sub
                                                                ? 'S'
                                                                : ''
                                                        : ep.hasDub && ep.hasSub
                                                          ? 'S·D'
                                                          : ep.hasDub
                                                            ? 'D'
                                                            : ep.hasSub
                                                              ? 'S'
                                                              : ''
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
                                                            <span className="text-[13px] font-bold tabular-nums leading-none">
                                                                {label}
                                                            </span>
                                                            {trackHint ? (
                                                                <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wide text-white/40">
                                                                    {trackHint}
                                                                </span>
                                                            ) : null}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ) : null}

                                    <section className="rounded-3xl border border-[var(--color-border-strong)]/12 bg-linear-to-br from-[var(--color-surface)]/10 via-black/22 to-black/38 p-4 sm:p-6">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
                                            {/* Series identity + rating */}
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
                                                                <span className="inline-flex items-center rounded-lg border border-[var(--color-border-strong)]/12 bg-black/35 px-2 py-0.5 text-[10px] font-semibold tabular-nums uppercase tracking-wide text-white/70 sm:text-[11px]">
                                                                    MAL {malId}
                                                                </span>
                                                            </li>
                                                            <li>
                                                                <span className="inline-flex items-center rounded-lg border border-[var(--color-border-strong)]/12 bg-black/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70 sm:text-[11px]">
                                                                    {epObj?.number != null ? `Ep ${epObj.number}` : `Ep ${episodeIdx + 1}`}
                                                                </span>
                                                            </li>
                                                            {startSeasonLabel ? (
                                                                <li>
                                                                    <span className="inline-flex items-center rounded-lg border border-[var(--color-border-strong)]/12 bg-black/35 px-2 py-0.5 text-[10px] font-semibold text-white/70 sm:text-[11px]">
                                                                        {startSeasonLabel}
                                                                    </span>
                                                                </li>
                                                            ) : null}
                                                            {anime?.mean != null ? (
                                                                <li>
                                                                    <span className="inline-flex items-center rounded-lg border border-[var(--color-border-strong)]/12 bg-black/35 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white/70 sm:text-[11px]">
                                                                        MAL {String(anime.mean)}
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
                                                    </div>
                                                </div>

                                                <div className="rounded-2xl border border-[var(--color-border-strong)]/10 bg-black/35 px-3 py-3 sm:px-4 sm:py-3.5">
                                                    <div className="flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,12.5rem)] md:items-start md:gap-5">
                                                        <div className="min-w-0">
                                                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                                                                List status
                                                            </p>
                                                            <p className="mt-1 text-[11px] leading-snug text-white/45 md:hidden">
                                                                Only category is editable. Score and progress sync from playback or MAL.
                                                            </p>
                                                            <p className="mt-1 hidden text-[11px] leading-snug text-white/45 md:block">
                                                                Only category can be changed here. Score and progress update when you watch or on MyAnimeList.
                                                            </p>
                                                            <div className="mt-2 w-full md:mt-3 md:max-w-44">
                                                                <MalListStatusControl
                                                                    id={`watch-mal-status-${malId}`}
                                                                    malId={malId}
                                                                    malLinked={malLinked}
                                                                    currentStatus={anime?.my_list_status?.status}
                                                                    variant="dark"
                                                                    className="w-full md:w-auto"
                                                                    onPatched={onListStatusPatched}
                                                                />
                                                            </div>
                                                        </div>
                                                        <dl className="flex flex-col gap-2 border-t border-[var(--color-border-strong)]/10 pt-3 text-[11px] text-white/50 md:border-l md:border-t-0 md:pl-5 md:pt-0">
                                                            <div className="flex flex-wrap items-center justify-between gap-2 md:flex-col md:items-stretch md:gap-1">
                                                                <dt className="text-white/35">Your score</dt>
                                                                <dd className="tabular-nums text-[13px] font-semibold text-white/80 md:text-[15px]">
                                                                    {anime?.my_list_status?.score > 0
                                                                        ? `${anime.my_list_status.score}/10`
                                                                        : '—'}
                                                                </dd>
                                                            </div>
                                                            <div className="flex flex-wrap items-center justify-between gap-2 md:flex-col md:items-stretch md:gap-1">
                                                                <dt className="text-white/35">Progress</dt>
                                                                <dd className="text-[13px] font-semibold text-white/80 md:text-[15px]">
                                                                    {anime?.my_list_status?.num_episodes_watched != null
                                                                        ? `${anime.my_list_status.num_episodes_watched} ep watched`
                                                                        : '—'}
                                                                </dd>
                                                            </div>
                                                        </dl>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Playback controls — stacked rail on desktop */}
                                            <div className="flex w-full shrink-0 flex-col gap-2 sm:grid sm:grid-cols-2 sm:gap-2.5 lg:w-[min(100%,15.5rem)] lg:grid-cols-1 lg:gap-2">
                                                <div className="rounded-2xl border border-[var(--color-border-strong)]/12 bg-black/28 p-3.5">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                                                            Audio
                                                        </p>
                                                        {showSubDubPicker ? (
                                                            <span className="text-[10px] font-medium text-white/35" aria-hidden>
                                                                Sub / Dub
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    {showSubDubPicker ? (
                                                        <select
                                                            value={audioValue}
                                                            onChange={(e) => {
                                                                const v = safeText(e.target.value).trim()
                                                                setAudioOverride(v === 'sub' || v === 'dub' ? v : null)
                                                                setMirrorOverrideId('')
                                                            }}
                                                            className="mt-2 h-10 w-full cursor-pointer rounded-xl border border-[var(--color-border-strong)]/14 bg-black/42 px-3 text-[12px] font-semibold text-white/90 outline-none transition-colors hover:border-[var(--mx-color-c6ff00)]/30 focus:border-[var(--mx-color-c6ff00)]/45 focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/20"
                                                        >
                                                            <option value="" className="bg-[var(--mx-color-111)]">
                                                                {autoAudioLabel}
                                                            </option>
                                                            <option value="sub" className="bg-[var(--mx-color-111)]">
                                                                Sub
                                                            </option>
                                                            <option value="dub" className="bg-[var(--mx-color-111)]">
                                                                Dub
                                                            </option>
                                                        </select>
                                                    ) : subOnlyTrack ? (
                                                        <p className="mt-2 rounded-xl border border-[var(--color-border-strong)]/10 bg-black/25 px-3 py-2.5 text-[12px] font-semibold text-white/75">
                                                            Sub only — no dub track for this episode.
                                                        </p>
                                                    ) : dubOnlyTrack ? (
                                                        <p className="mt-2 rounded-xl border border-[var(--color-border-strong)]/10 bg-black/25 px-3 py-2.5 text-[12px] font-semibold text-white/75">
                                                            Dub only for this episode.
                                                        </p>
                                                    ) : (
                                                        <p className="mt-2 text-[12px] text-white/45">No audio tracks reported.</p>
                                                    )}
                                                </div>

                                                <div className="rounded-2xl border border-[var(--color-border-strong)]/12 bg-black/28 p-3.5">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                                                            Mirror
                                                        </p>
                                                        <svg
                                                            className="h-3.5 w-3.5 shrink-0 text-white/30"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            aria-hidden
                                                        >
                                                            <path
                                                                d="M7 17l10-10M7 7h10v10"
                                                                stroke="currentColor"
                                                                strokeWidth="1.6"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                            />
                                                        </svg>
                                                    </div>
                                                    <select
                                                        value={mirrorOverrideId}
                                                        onChange={(e) => setMirrorOverrideId(safeText(e.target.value).trim())}
                                                        className="mt-2 h-10 w-full cursor-pointer rounded-xl border border-[var(--color-border-strong)]/14 bg-black/42 px-3 text-[12px] font-semibold text-white/90 outline-none transition-colors hover:border-[var(--mx-color-c6ff00)]/30 focus:border-[var(--mx-color-c6ff00)]/45 focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/20 disabled:cursor-not-allowed disabled:opacity-45"
                                                        disabled={!Array.isArray(stream?.mirrors) || stream.mirrors.length === 0}
                                                    >
                                                        <option value="" className="bg-[var(--mx-color-111)]">
                                                            Auto
                                                            {stream?.selectedMirrorLabel ? ` (${stream.selectedMirrorLabel})` : ''}
                                                        </option>
                                                        {(Array.isArray(stream?.mirrors) ? stream.mirrors : []).map((m, idx) => {
                                                            const id = m?.id != null ? String(m.id) : ''
                                                            const label = m?.label ? String(m.label) : id || `Mirror ${idx + 1}`
                                                            if (!id) return null
                                                            return (
                                                                <option key={id} value={id} className="bg-[var(--mx-color-111)]">
                                                                    {label}
                                                                </option>
                                                            )
                                                        })}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    {seriesSeasonOptions.length > 1 || sequelOptions.length > 0 ? (
                                        <section className="grid gap-2.5 sm:gap-3 lg:grid-cols-2">
                                            {seriesSeasonOptions.length > 1 ? (
                                                <div className="rounded-2xl border border-[var(--color-border-strong)]/12 bg-[var(--color-surface)]/8 p-3.5 sm:rounded-3xl">
                                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-white/45">
                                                        Series season
                                                    </p>
                                                    <select
                                                        value={selectedSeriesSeasonId}
                                                        onChange={(e) => {
                                                            const nextId = safeText(e.target.value).trim()
                                                            if (!nextId) return
                                                            setAudioOverride(null)
                                                            setMirrorOverrideId('')
                                                            navigate(
                                                                `/dashboard/lifesync/anime/anime/watch/${encodeURIComponent(nextId)}/1`,
                                                                {
                                                                    replace: true,
                                                                    state: { from: closeTo },
                                                                }
                                                            )
                                                        }}
                                                        className="mt-2 h-10 w-full rounded-2xl border border-[var(--color-border-strong)]/12 bg-black/34 px-3 text-[12px] font-semibold text-white/90 outline-none hover:border-[var(--mx-color-c6ff00)]/28 focus:border-[var(--mx-color-c6ff00)]/42"
                                                    >
                                                        {seriesSeasonOptions.map((o) => (
                                                            <option key={o.id} value={o.id} className="bg-[var(--mx-color-111)]">
                                                                {o.rel === 'current'
                                                                    ? o.title
                                                                    : `${o.title} (${o.rel.replace(/_/g, ' ')})`}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            ) : null}

                                            {sequelOptions.length > 0 ? (
                                                <div className="rounded-2xl border border-[var(--color-border-strong)]/12 bg-[var(--color-surface)]/8 p-3.5 sm:rounded-3xl">
                                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-white/45">
                                                        Sequels
                                                    </p>
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {sequelOptions.map((s) => (
                                                            <button
                                                                key={s.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setAudioOverride(null)
                                                                    setMirrorOverrideId('')
                                                                    navigate(
                                                                        `/dashboard/lifesync/anime/anime/watch/${encodeURIComponent(s.id)}/1`,
                                                                        {
                                                                            replace: true,
                                                                            state: { from: closeTo },
                                                                        }
                                                                    )
                                                                }}
                                                                className="min-h-11 rounded-2xl border border-[var(--color-border-strong)]/12 bg-black/24 px-3 py-2 text-left text-[12px] font-semibold text-white/85 transition-colors hover:border-[var(--mx-color-c6ff00)]/28 hover:bg-[var(--color-surface)]/8 sm:min-h-0"
                                                            >
                                                                {s.title}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : null}
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
                                                <p className="px-2 py-3 text-[12px] text-white/45">
                                                    No episode list returned.
                                                </p>
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
                                                                        poster={anime?.main_picture?.large || anime?.main_picture?.medium}
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
                                                                                return ep.hasDub && ep.hasSub
                                                                                    ? 'Sub · Dub'
                                                                                    : ep.hasDub
                                                                                      ? 'Dub'
                                                                                      : ep.hasSub
                                                                                        ? 'Sub'
                                                                                        : '—'
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
