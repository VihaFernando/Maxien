import { useEffect, useMemo, useRef, useState } from 'react'
import { lifesyncFetch } from '../../../lib/lifesyncApi'
import AdvancedVideoPlayer from '../../../components/lifesync/AdvancedVideoPlayer'
import useLifeSyncGamepadInput from '../../../hooks/useLifeSyncGamepadInput'
import useControllerSupportEnabled from '../../../hooks/useControllerSupportEnabled'
import {
    XBOX_GAMEPAD_BUTTONS,
    dispatchBestEffortIframeMediaKeys,
    focusIframeForControllerInput,
} from '../../../lib/lifeSyncControllerInput'
import useLifeSyncInputSource from '../../../hooks/useLifeSyncInputSource'
import { tvHintLabel } from '../../../lib/lifeSyncKeyboardGamepad'

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

/**
 * Fullscreen hentai stream player inside TV mode.
 */
export function TVHentaiPlayer({ series, initialEpisodeIndex = 0, onBack }) {
    const controllerEnabled = useControllerSupportEnabled()
    const inputSource = useLifeSyncInputSource()
    const episodes = useMemo(() => series?.episodes || [], [series])
    const [episodeIdx, setEpisodeIdx] = useState(initialEpisodeIndex)
    const [stream, setStream] = useState(null)
    const iframeRef = useRef(null)
    const cancelRef = useRef(false)

    const canPrev = episodeIdx > 0
    const canNext = episodeIdx < episodes.length - 1
    const ep = episodes[episodeIdx]

    useEffect(() => {
        if (!ep) return
        cancelRef.current = false
        const slug = slugFromItem(ep)
        if (!slug) return

        const embedUrl = ep?.embedUrl || `https://watchhentai.net/videos/${encodeURIComponent(slug)}/`
        const initialTitle = ep.title
        Promise.resolve().then(() => {
            if (!cancelRef.current) setStream({ title: initialTitle, embedUrl, iframeUrl: null, videoUrl: null, resolving: true })
        })

        lifesyncFetch(`/api/v1/hentai/watchhentai/stream?slug=${encodeURIComponent(slug)}&view=full`)
            .then(data => {
                if (cancelRef.current) return
                const mp4 = typeof data?.videoUrl === 'string' && data.videoUrl.startsWith('http') ? data.videoUrl : null
                const iframe = typeof data?.embedUrl === 'string' && data.embedUrl.startsWith('http') ? data.embedUrl : embedUrl
                setStream({ title: ep.title, embedUrl: iframe, iframeUrl: iframe, videoUrl: mp4, resolving: false })
            })
            .catch(() => {
                if (!cancelRef.current) setStream({ title: ep.title, embedUrl, iframeUrl: embedUrl, videoUrl: null, resolving: false })
            })

        return () => { cancelRef.current = true }
    }, [ep])

    useEffect(() => {
        if (!stream?.iframeUrl) return
        const id = setTimeout(() => { focusIframeForControllerInput(iframeRef.current) }, 200)
        return () => clearTimeout(id)
    }, [stream?.iframeUrl])

    const iframeHandlers = useMemo(() => ({
        [XBOX_GAMEPAD_BUTTONS.A]: () => { dispatchBestEffortIframeMediaKeys(iframeRef.current, ['k', ' ', 'MediaPlayPause']) },
        [XBOX_GAMEPAD_BUTTONS.X]: () => {
            const el = iframeRef.current
            if (!document.fullscreenElement) el?.requestFullscreen?.().catch(() => {})
            else document.exitFullscreen?.().catch(() => {})
            dispatchBestEffortIframeMediaKeys(iframeRef.current, ['f'])
        },
        [XBOX_GAMEPAD_BUTTONS.LT]: () => { dispatchBestEffortIframeMediaKeys(iframeRef.current, ['j', 'ArrowLeft']) },
        [XBOX_GAMEPAD_BUTTONS.RT]: () => { dispatchBestEffortIframeMediaKeys(iframeRef.current, ['l', 'ArrowRight']) },
        [XBOX_GAMEPAD_BUTTONS.DPAD_UP]: () => { dispatchBestEffortIframeMediaKeys(iframeRef.current, ['ArrowUp']) },
        [XBOX_GAMEPAD_BUTTONS.DPAD_DOWN]: () => { dispatchBestEffortIframeMediaKeys(iframeRef.current, ['ArrowDown']) },
        [XBOX_GAMEPAD_BUTTONS.LB]: () => { if (canPrev) setEpisodeIdx(i => i - 1) },
        [XBOX_GAMEPAD_BUTTONS.RB]: () => { if (canNext) setEpisodeIdx(i => i + 1) },
        [XBOX_GAMEPAD_BUTTONS.B]: () => onBack(),
    }), [canNext, canPrev, onBack])

    useLifeSyncGamepadInput({
        enabled: controllerEnabled && Boolean(stream?.iframeUrl) && !stream?.videoUrl,
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
            <div className="relative min-h-0 flex-1 bg-black">
                {stream?.resolving && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--mx-color-c6ff00)] border-t-transparent" />
                    </div>
                )}
                {stream?.videoUrl && !stream.resolving ? (
                    <AdvancedVideoPlayer
                        key={stream.videoUrl}
                        src={stream.videoUrl}
                        textTracks={[]}
                        skipSegments={[]}
                        onPrevEpisode={canPrev ? () => setEpisodeIdx(i => i - 1) : undefined}
                        onNextEpisode={canNext ? () => setEpisodeIdx(i => i + 1) : undefined}
                        canPrevEpisode={canPrev}
                        canNextEpisode={canNext}
                        onEnded={() => { if (canNext) setEpisodeIdx(i => i + 1) }}
                    />
                ) : stream?.iframeUrl && !stream.resolving ? (
                    <iframe
                        ref={iframeRef}
                        key={stream.iframeUrl}
                        title={stream.title || 'Episode'}
                        src={stream.iframeUrl}
                        className="h-full w-full border-0 bg-black"
                        allow="fullscreen; encrypted-media; autoplay; picture-in-picture"
                        referrerPolicy="no-referrer"
                        onLoad={() => focusIframeForControllerInput(iframeRef.current)}
                    />
                ) : null}
            </div>

            <div className="shrink-0 flex items-center justify-between gap-4 border-t border-white/8 bg-black/90 px-8 py-3">
                <button type="button" onClick={onBack} className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-[13px] font-semibold text-white/60">
                    <span className="rounded bg-red-600/80 px-1.5 py-0.5 text-[10px] font-black text-white">{tvHintLabel('B', inputSource)}</span>
                    Back
                </button>
                <p className="flex-1 text-center text-[15px] font-black text-white truncate">
                    {ep?.title || `Episode ${episodeIdx + 1}`}
                    {episodes.length > 1 && <span className="ml-2 text-[12px] font-normal text-white/40 tabular-nums">{episodeIdx + 1}/{episodes.length}</span>}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-white/30">
                    <span className="rounded bg-white/8 px-1.5 py-0.5 font-black">{tvHintLabel('LB', inputSource)}</span>·<span className="rounded bg-white/8 px-1.5 py-0.5 font-black">{tvHintLabel('RB', inputSource)}</span> episodes
                </div>
            </div>
        </div>
    )
}
