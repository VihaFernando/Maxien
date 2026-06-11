import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { lifesyncFetch, getLifesyncApiBase } from '../../../lib/lifesyncApi'
import { useLifeSync } from '../../../context/LifeSyncContext'
import AdvancedVideoPlayer from '../../../components/lifesync/AdvancedVideoPlayer'
import { streamIframeSandboxProps } from '../../../lib/lifesyncStreamIframe'
import useLifeSyncGamepadInput from '../../../hooks/useLifeSyncGamepadInput'
import useControllerSupportEnabled from '../../../hooks/useControllerSupportEnabled'
import {
    XBOX_GAMEPAD_BUTTONS,
    dispatchBestEffortIframeMediaKeys,
    focusIframeForControllerInput,
} from '../../../lib/lifeSyncControllerInput'
import useLifeSyncInputSource from '../../../hooks/useLifeSyncInputSource'
import { tvHintLabel } from '../../../lib/lifeSyncKeyboardGamepad'

/**
 * Fullscreen anime stream player inside TV mode.
 * B = back to grid (never exits TV mode).
 * LB/RB = prev/next episode, A = play/pause, LT/RT = seek.
 */
export function TVAnimePlayer({ animeId, episodes = [], initialEpisodeIndex = 0, onBack }) {
    const { isLifeSyncConnected } = useLifeSync()
    const controllerEnabled = useControllerSupportEnabled()
    const inputSource = useLifeSyncInputSource()
    const [episodeIdx, setEpisodeIdx] = useState(initialEpisodeIndex)
    const [stream, setStream] = useState(null)
    const iframeRef = useRef(null)
    const iframeContainerRef = useRef(null)
    const cancelRef = useRef(false)

    const canPrev = episodeIdx > 0
    const canNext = episodeIdx < episodes.length - 1
    const epObj = episodes[episodeIdx]

    const resolveStream = useCallback(async (ep, signal) => {
        if (!ep?.episodeId) return null
        const apiBase = getLifesyncApiBase()
        const pack = await lifesyncFetch(
            `/api/v1/anime/stream/watch/${encodeURIComponent(ep.episodeId)}?type=sub&view=full`,
            signal ? { signal } : undefined,
        )
        const iframeFromPack = typeof pack?.iframeUrl === 'string' && /^https?:\/\//i.test(pack.iframeUrl) ? pack.iframeUrl : null
        if (iframeFromPack) return { title: ep.title, iframeUrl: iframeFromPack, videoUrl: null, textTracks: [], mirrors: pack?.streamMeta?.mirrors || [], provider: pack?.streamMeta?.provider ?? null }
        const sources = Array.isArray(pack?.sources) ? pack.sources : []
        const pick = sources.find(s => s?.kind === 'hls') || sources.find(s => s?.kind === 'mp4') || sources[0]
        if (!pick?.url) return { title: ep.title, iframeUrl: null, videoUrl: null, textTracks: [] }
        const url = String(pick.url).startsWith('http') ? pick.url : `${apiBase}${pick.url}`
        const rawSubs = Array.isArray(pack?.subtitles) ? pack.subtitles : []
        const textTracks = rawSubs.map((s, i) => ({
            src: String(s?.url || '').startsWith('http') ? s.url : `${apiBase}${s.url}`,
            label: s?.label || `Subtitles ${i + 1}`,
            srclang: s?.lang || 'und',
            default: i === 0,
        }))
        return { title: ep.title, iframeUrl: null, videoUrl: url, textTracks }
    }, [])

    useEffect(() => {
        if (!epObj) return
        cancelRef.current = false
        const ac = new AbortController()
        const initialTitle = epObj.title
        Promise.resolve().then(() => {
            if (!cancelRef.current) setStream({ title: initialTitle, resolving: true })
        })
        resolveStream(epObj, ac.signal)
            .then(s => { if (!cancelRef.current) setStream(s ? { ...s, resolving: false } : null) })
            .catch(e => { if (!cancelRef.current && e?.name !== 'AbortError') setStream({ title: initialTitle, resolving: false, error: e?.message }) })
        return () => { cancelRef.current = true; ac.abort() }
    }, [epObj, resolveStream])

    useEffect(() => {
        if (!isLifeSyncConnected || !animeId) return
        const epObj = episodes[episodeIdx]
        if (!epObj) return
        const lastEpisodeNumber = epObj.number != null ? Math.max(1, Math.floor(Number(epObj.number) || 1)) : episodeIdx + 1
        const ac = new AbortController()
        lifesyncFetch('/api/v1/anime/watch-progress', {
            method: 'PUT',
            signal: ac.signal,
            json: { animeId, lastEpisodeNumber },
        }).catch(() => {})
        return () => ac.abort()
    }, [animeId, episodeIdx, episodes, isLifeSyncConnected])

    useEffect(() => {
        if (!stream?.iframeUrl) return
        const id = setTimeout(() => { focusIframeForControllerInput(iframeRef.current) }, 200)
        return () => clearTimeout(id)
    }, [stream?.iframeUrl])

    const toggleIframeFullscreen = useCallback(() => {
        const el = iframeContainerRef.current
        if (!el) return
        if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {})
        else document.exitFullscreen?.().catch(() => {})
    }, [])

    const iframeHandlers = useMemo(() => ({
        [XBOX_GAMEPAD_BUTTONS.A]: () => { dispatchBestEffortIframeMediaKeys(iframeRef.current, ['k', ' ', 'MediaPlayPause']) },
        [XBOX_GAMEPAD_BUTTONS.X]: () => { toggleIframeFullscreen(); dispatchBestEffortIframeMediaKeys(iframeRef.current, ['f']) },
        [XBOX_GAMEPAD_BUTTONS.LT]: () => { dispatchBestEffortIframeMediaKeys(iframeRef.current, ['j', 'ArrowLeft']) },
        [XBOX_GAMEPAD_BUTTONS.RT]: () => { dispatchBestEffortIframeMediaKeys(iframeRef.current, ['l', 'ArrowRight']) },
        [XBOX_GAMEPAD_BUTTONS.DPAD_UP]: () => { dispatchBestEffortIframeMediaKeys(iframeRef.current, ['ArrowUp']) },
        [XBOX_GAMEPAD_BUTTONS.DPAD_DOWN]: () => { dispatchBestEffortIframeMediaKeys(iframeRef.current, ['ArrowDown']) },
        [XBOX_GAMEPAD_BUTTONS.LB]: () => { if (canPrev) setEpisodeIdx(i => i - 1) },
        [XBOX_GAMEPAD_BUTTONS.RB]: () => { if (canNext) setEpisodeIdx(i => i + 1) },
        [XBOX_GAMEPAD_BUTTONS.B]: () => onBack(),
    }), [canNext, canPrev, onBack, toggleIframeFullscreen])

    useLifeSyncGamepadInput({
        enabled: controllerEnabled && Boolean(stream?.iframeUrl),
        handlers: iframeHandlers,
        repeatableButtons: [XBOX_GAMEPAD_BUTTONS.LT, XBOX_GAMEPAD_BUTTONS.RT, XBOX_GAMEPAD_BUTTONS.DPAD_UP, XBOX_GAMEPAD_BUTTONS.DPAD_DOWN],
    })

    const videoHandlers = useMemo(() => ({
        [XBOX_GAMEPAD_BUTTONS.LB]: () => { if (canPrev) setEpisodeIdx(i => i - 1) },
        [XBOX_GAMEPAD_BUTTONS.RB]: () => { if (canNext) setEpisodeIdx(i => i + 1) },
        [XBOX_GAMEPAD_BUTTONS.B]: () => onBack(),
    }), [canNext, canPrev, onBack])

    useLifeSyncGamepadInput({
        enabled: controllerEnabled && Boolean(stream?.videoUrl),
        handlers: videoHandlers,
    })

    return (
        <div className="absolute inset-0 z-20 flex flex-col bg-black" style={{ cursor: 'none' }}>
            {/* Player area */}
            <div ref={iframeContainerRef} className="relative min-h-0 flex-1 bg-black">
                {stream?.resolving && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--mx-color-c6ff00)] border-t-transparent" />
                    </div>
                )}
                {stream?.error && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-[15px] text-red-400">{stream.error}</p>
                    </div>
                )}
                {stream?.iframeUrl && !stream.resolving && (
                    <iframe
                        ref={iframeRef}
                        key={stream.iframeUrl}
                        title={stream.title || 'Episode'}
                        src={stream.iframeUrl}
                        className="h-full w-full border-0 bg-black"
                        allow="fullscreen; encrypted-media; autoplay; picture-in-picture"
                        {...streamIframeSandboxProps(stream.iframeUrl, { provider: stream.provider })}
                        referrerPolicy="no-referrer-when-downgrade"
                        onLoad={() => focusIframeForControllerInput(iframeRef.current)}
                    />
                )}
                {stream?.videoUrl && !stream.resolving && (
                    <AdvancedVideoPlayer
                        key={stream.videoUrl}
                        src={stream.videoUrl}
                        textTracks={stream.textTracks || []}
                        skipSegments={[]}
                        onPrevEpisode={canPrev ? () => setEpisodeIdx(i => i - 1) : undefined}
                        onNextEpisode={canNext ? () => setEpisodeIdx(i => i + 1) : undefined}
                        canPrevEpisode={canPrev}
                        canNextEpisode={canNext}
                        onEnded={() => { if (canNext) setEpisodeIdx(i => i + 1) }}
                    />
                )}
            </div>

            {/* Bottom bar */}
            <div className="shrink-0 flex items-center justify-between gap-4 border-t border-white/8 bg-black/90 px-8 py-3 backdrop-blur-xl">
                <button type="button" onClick={onBack} className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-[13px] font-semibold text-white/60">
                    <span className="rounded bg-red-600/80 px-1.5 py-0.5 text-[10px] font-black text-white">{tvHintLabel('B', inputSource)}</span>
                    Back
                </button>

                <div className="text-center min-w-0 flex-1">
                    <p className="text-[15px] font-black text-white truncate">{epObj?.title || `Episode ${episodeIdx + 1}`}</p>
                    {episodes.length > 0 && (
                        <p className="text-[11px] text-white/30 tabular-nums">{episodeIdx + 1} / {episodes.length}</p>
                    )}
                </div>

                <div className="flex items-center gap-2 text-[11px] text-white/30">
                    <span className="rounded bg-white/8 px-1.5 py-0.5 font-black">{tvHintLabel('LB', inputSource)}</span>
                    <span>·</span>
                    <span className="rounded bg-white/8 px-1.5 py-0.5 font-black">{tvHintLabel('RB', inputSource)}</span>
                    <span>episodes</span>
                </div>
            </div>
        </div>
    )
}
