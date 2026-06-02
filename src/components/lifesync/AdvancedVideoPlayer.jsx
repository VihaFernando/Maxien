import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import useControllerSupportEnabled from '../../hooks/useControllerSupportEnabled'
import useLifeSyncGamepadInput from '../../hooks/useLifeSyncGamepadInput'
import { XBOX_GAMEPAD_BUTTONS } from '../../lib/lifeSyncControllerInput'

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
const SKIP_SEC = 10

function pad(n) { return String(Math.floor(n)).padStart(2, '0') }
function fmtTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) return '0:00'
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = Math.floor(sec % 60)
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

function isHlsUrl(u) {
    // Match any .m3u8 in the URL (query-only playlists, CDNs with unusual paths).
    return typeof u === 'string' && /\.m3u8/i.test(u.trim())
}

function videoSupportsNativeHls(video) {
    if (!video?.canPlayType) return false
    return video.canPlayType('application/vnd.apple.mpegurl') !== ''
}

/**
 * @param {{ src: string, label?: string, srclang?: string, default?: boolean }[]} [textTracks] - WebVTT URLs for <track kind="subtitles">
 */
export default function AdvancedVideoPlayer({
    src,
    onEnded,
    onError,
    onPrevEpisode,
    onNextEpisode,
    canPrevEpisode = false,
    canNextEpisode = false,
    autoPlay = false,
    textTracks = [],
    /** @type {'none' | 'metadata' | 'auto'} */
    preload = 'metadata',
}) {
    const videoRef = useRef(null)
    const wrapRef = useRef(null)
    const idleTimer = useRef(null)
    const seekBarRef = useRef(null)
    const playingRef = useRef(false)

    const [playing, setPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [buffered, setBuffered] = useState(0)
    const [volume, setVolume] = useState(1)
    const [muted, setMuted] = useState(false)
    const [speed, setSpeed] = useState(1)
    const [showControls, setShowControls] = useState(true)
    const [showSpeedMenu, setShowSpeedMenu] = useState(false)
    const [showVolumeSlider, setShowVolumeSlider] = useState(false)
    const [isSeeking, setIsSeeking] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [pipActive, setPipActive] = useState(false)
    const controllerSupportEnabled = useControllerSupportEnabled()

    const resetIdle = useCallback(() => {
        setShowControls(true)
        clearTimeout(idleTimer.current)
        if (playingRef.current) {
            idleTimer.current = setTimeout(() => {
                setShowControls(false)
                setShowSpeedMenu(false)
                setShowVolumeSlider(false)
            }, 3000)
        }
    }, [setShowControls, setShowSpeedMenu, setShowVolumeSlider])

    useEffect(() => {
        playingRef.current = playing
    }, [playing])

    useEffect(
        () => () => {
            clearTimeout(idleTimer.current)
            idleTimer.current = null
        },
        [],
    )

    const trackKey = (textTracks || []).map(t => t.src).join('|')

    useLayoutEffect(() => {
        const v = videoRef.current
        if (!v) return
        const s = typeof src === 'string' && src.trim() ? src.trim() : ''
        if (!s) {
            v.removeAttribute('src')
            v.load()
            return undefined
        }

        let hls = null
        let cancelled = false
        const destroyHls = () => {
            if (hls) {
                try {
                    hls.destroy()
                } catch { /* ignore */ }
                hls = null
            }
        }

        const attachSource = async () => {
            if (isHlsUrl(s)) {
                if (videoSupportsNativeHls(v)) {
                    v.src = s
                    v.load()
                    return
                }

                try {
                    const { default: Hls } = await import('hls.js')
                    if (cancelled) return

                    if (Hls.isSupported()) {
                        hls = new Hls({
                            enableWorker: true,
                            lowLatencyMode: false,
                        })
                        hls.on(Hls.Events.ERROR, (_e, data) => {
                            if (data?.fatal) destroyHls()
                        })
                        hls.loadSource(s)
                        hls.attachMedia(v)
                        return
                    }
                } catch {
                    // fallback to direct source assignment below
                }

                if (cancelled) return
                v.src = s
                v.load()
                return
            }

            v.src = s
            v.load()
        }

        void attachSource()

        return () => {
            cancelled = true
            destroyHls()
            v.removeAttribute('src')
            v.load()
        }
    }, [src, trackKey])

    useEffect(() => {
        const v = videoRef.current
        if (!v) return
        const onPlay = () => {
            playingRef.current = true
            setPlaying(true)
            resetIdle()
        }
        const onPause = () => {
            playingRef.current = false
            setPlaying(false)
            clearTimeout(idleTimer.current)
            setShowControls(true)
            setShowSpeedMenu(false)
            setShowVolumeSlider(false)
        }
        const onErr = () => {
            const err = v.error
            onError?.(err)
        }
        const onTime = () => {
            if (!isSeeking) setCurrentTime(v.currentTime)
        }
        const onDur = () => setDuration(v.duration || 0)
        const onProgress = () => {
            if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1))
        }
        const onEnd = () => { setPlaying(false); onEnded?.() }
        const onVol = () => { setVolume(v.volume); setMuted(v.muted) }

        v.addEventListener('play', onPlay)
        v.addEventListener('pause', onPause)
        v.addEventListener('error', onErr)
        v.addEventListener('timeupdate', onTime)
        v.addEventListener('durationchange', onDur)
        v.addEventListener('loadedmetadata', onDur)
        v.addEventListener('progress', onProgress)
        v.addEventListener('ended', onEnd)
        v.addEventListener('volumechange', onVol)

        return () => {
            v.removeEventListener('play', onPlay)
            v.removeEventListener('pause', onPause)
            v.removeEventListener('error', onErr)
            v.removeEventListener('timeupdate', onTime)
            v.removeEventListener('durationchange', onDur)
            v.removeEventListener('loadedmetadata', onDur)
            v.removeEventListener('progress', onProgress)
            v.removeEventListener('ended', onEnd)
            v.removeEventListener('volumechange', onVol)
        }
    }, [src, isSeeking, onEnded, onError, resetIdle])

    useEffect(() => {
        const onFsChange = () => {
            const v = videoRef.current
            const nativeFs = Boolean(document.fullscreenElement)
            const webkitFs = Boolean(v && v.webkitDisplayingFullscreen)
            setIsFullscreen(nativeFs || webkitFs)
        }
        const v = videoRef.current
        document.addEventListener('fullscreenchange', onFsChange)
        document.addEventListener('webkitfullscreenchange', onFsChange)
        v?.addEventListener?.('webkitbeginfullscreen', onFsChange)
        v?.addEventListener?.('webkitendfullscreen', onFsChange)
        return () => {
            document.removeEventListener('fullscreenchange', onFsChange)
            document.removeEventListener('webkitfullscreenchange', onFsChange)
            v?.removeEventListener?.('webkitbeginfullscreen', onFsChange)
            v?.removeEventListener?.('webkitendfullscreen', onFsChange)
        }
    }, [src])

    useEffect(() => {
        const v = videoRef.current
        if (!v) return
        const onPipEnter = () => setPipActive(true)
        const onPipLeave = () => setPipActive(false)
        v.addEventListener('enterpictureinpicture', onPipEnter)
        v.addEventListener('leavepictureinpicture', onPipLeave)
        return () => {
            v.removeEventListener('enterpictureinpicture', onPipEnter)
            v.removeEventListener('leavepictureinpicture', onPipLeave)
        }
    }, [src])

    const togglePlay = useCallback(() => {
        const v = videoRef.current
        if (!v) return
        if (v.paused) v.play().catch(() => {})
        else v.pause()
        resetIdle()
    }, [resetIdle])

    const playOnly = useCallback(() => {
        const v = videoRef.current
        if (!v || !v.paused) return
        v.play().catch(() => {})
        resetIdle()
    }, [resetIdle])

    const seek = useCallback((t) => {
        const v = videoRef.current
        if (!v || !Number.isFinite(t)) return
        v.currentTime = Math.max(0, Math.min(t, v.duration || 0))
        setCurrentTime(v.currentTime)
    }, [setCurrentTime])

    const skip = useCallback((delta) => {
        const v = videoRef.current
        if (v) seek(v.currentTime + delta)
        resetIdle()
    }, [seek, resetIdle])

    const changeVolume = useCallback((val) => {
        const v = videoRef.current
        if (!v) return
        v.volume = Math.max(0, Math.min(1, val))
        if (val > 0 && v.muted) v.muted = false
    }, [])

    const toggleMute = useCallback(() => {
        const v = videoRef.current
        if (v) v.muted = !v.muted
    }, [])

    const changeSpeed = useCallback((s) => {
        const v = videoRef.current
        if (v) v.playbackRate = s
        setSpeed(s)
        setShowSpeedMenu(false)
        resetIdle()
    }, [resetIdle, setShowSpeedMenu, setSpeed])

    const toggleFullscreen = useCallback(() => {
        const el = wrapRef.current
        const v = videoRef.current
        if (!el && !v) return
        if (!document.fullscreenElement) {
            if (el?.requestFullscreen) {
                el.requestFullscreen().catch(() => {})
                return
            }
            if (v?.webkitEnterFullscreen) {
                try { v.webkitEnterFullscreen() } catch { /* ignore */ }
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {})
                return
            }
            if (v?.webkitExitFullscreen) {
                try { v.webkitExitFullscreen() } catch { /* ignore */ }
            }
        }
    }, [])

    const togglePiP = useCallback(async () => {
        const v = videoRef.current
        if (!v) return
        try {
            if (document.pictureInPictureElement) await document.exitPictureInPicture()
            else await v.requestPictureInPicture()
        } catch { /* PiP not supported */ }
    }, [])

    const gamepadHandlers = useMemo(() => ({
        [XBOX_GAMEPAD_BUTTONS.A]: () => {
            togglePlay()
        },
        [XBOX_GAMEPAD_BUTTONS.Y]: () => {
            playOnly()
        },
        [XBOX_GAMEPAD_BUTTONS.X]: () => {
            toggleFullscreen()
        },
        [XBOX_GAMEPAD_BUTTONS.LT]: () => {
            skip(-SKIP_SEC)
        },
        [XBOX_GAMEPAD_BUTTONS.RT]: () => {
            skip(SKIP_SEC)
        },
        [XBOX_GAMEPAD_BUTTONS.DPAD_UP]: () => {
            const v = videoRef.current
            if (!v) return
            changeVolume(v.volume + 0.1)
            resetIdle()
        },
        [XBOX_GAMEPAD_BUTTONS.DPAD_DOWN]: () => {
            const v = videoRef.current
            if (!v) return
            changeVolume(v.volume - 0.1)
            resetIdle()
        },
        [XBOX_GAMEPAD_BUTTONS.LB]: () => {
            if (!canPrevEpisode) return
            onPrevEpisode?.()
            resetIdle()
        },
        [XBOX_GAMEPAD_BUTTONS.RB]: () => {
            if (!canNextEpisode) return
            onNextEpisode?.()
            resetIdle()
        },
    }), [
        canNextEpisode,
        canPrevEpisode,
        changeVolume,
        onNextEpisode,
        onPrevEpisode,
        playOnly,
        resetIdle,
        skip,
        toggleFullscreen,
        togglePlay,
    ])

    useLifeSyncGamepadInput({
        enabled: controllerSupportEnabled,
        handlers: gamepadHandlers,
        repeatableButtons: [
            XBOX_GAMEPAD_BUTTONS.LT,
            XBOX_GAMEPAD_BUTTONS.RT,
            XBOX_GAMEPAD_BUTTONS.DPAD_UP,
            XBOX_GAMEPAD_BUTTONS.DPAD_DOWN,
        ],
    })

    useEffect(() => {
        const onKey = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
            const v = videoRef.current
            if (!v) return
            let handled = true
            switch (e.key) {
                case ' ':
                case 'k':
                    togglePlay()
                    break
                case 'ArrowRight':
                    skip(e.shiftKey ? 30 : SKIP_SEC)
                    break
                case 'ArrowLeft':
                    skip(e.shiftKey ? -30 : -SKIP_SEC)
                    break
                case 'ArrowUp':
                    changeVolume(v.volume + 0.1)
                    break
                case 'ArrowDown':
                    changeVolume(v.volume - 0.1)
                    break
                case 'm':
                case 'M':
                    toggleMute()
                    break
                case 'f':
                case 'F':
                    toggleFullscreen()
                    break
                case 'p':
                case 'P':
                    void togglePiP()
                    break
                case '>':
                    changeSpeed(Math.min(2, speed + 0.25))
                    break
                case '<':
                    changeSpeed(Math.max(0.25, speed - 0.25))
                    break
                default:
                    handled = false
            }
            if (handled) { e.preventDefault(); resetIdle() }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [togglePlay, skip, changeVolume, toggleMute, toggleFullscreen, togglePiP, changeSpeed, speed, resetIdle])

    const handleSeekBarPointer = useCallback((e) => {
        const bar = seekBarRef.current
        if (!bar) return
        const rect = bar.getBoundingClientRect()
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        seek(ratio * (duration || 0))
    }, [duration, seek])

    const onSeekPointerDown = useCallback((e) => {
        setIsSeeking(true)
        handleSeekBarPointer(e)
        const onMove = (ev) => handleSeekBarPointer(ev)
        const onUp = () => {
            setIsSeeking(false)
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
    }, [handleSeekBarPointer, setIsSeeking])

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0
    const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0
    const volumeIcon = muted || volume === 0 ? 'muted' : volume < 0.5 ? 'low' : 'high'
    const pipSupported = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document

    return (
        <div
            ref={wrapRef}
            className="relative w-full h-full bg-black select-none group/player"
            onMouseMove={resetIdle}
            onTouchStart={resetIdle}
            onClick={(e) => {
                if (e.target === e.currentTarget || e.target.tagName === 'VIDEO') {
                    togglePlay()
                    resetIdle()
                }
            }}
            onDoubleClick={(e) => {
                if (e.target === e.currentTarget || e.target.tagName === 'VIDEO') toggleFullscreen()
            }}
        >
            <video
                ref={videoRef}
                key={`${src}|${trackKey}`}
                className="absolute inset-0 w-full h-full object-contain"
                playsInline
                webkitPlaysInline
                autoPlay={autoPlay}
                preload={preload}
            >
                {(textTracks || []).map((t, i) => (
                    <track
                        key={`${t.src}-${i}`}
                        kind="subtitles"
                        src={t.src}
                        label={t.label || `CC ${i + 1}`}
                        srcLang={t.srclang || 'und'}
                        default={t.default ?? i === 0}
                    />
                ))}
            </video>

            {/* Big center play/pause */}
            {!playing && !showControls && (
                <button
                    type="button"
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center z-10"
                >
                    <span className="w-16 h-16 rounded-full bg-[var(--color-surface)]/20 backdrop-blur-md flex items-center justify-center">
                        <svg className="w-7 h-7 ml-1 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    </span>
                </button>
            )}

            {/* Center play icon on first load / paused */}
            {!playing && showControls && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <span className="w-16 h-16 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center animate-pulse">
                        <svg className="w-7 h-7 ml-1 text-white/90" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    </span>
                </div>
            )}

            {/* Controls overlay */}
            <div
                className={`absolute inset-x-0 bottom-0 z-20 transition-all duration-300 ${
                    showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
                }`}
            >
                {/* Gradient backdrop */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

                <div className="relative min-w-0 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-8 sm:px-4 sm:pb-4">
                    {/* Seek bar */}
                    <div
                        ref={seekBarRef}
                        className="group/seek relative h-5 flex items-center cursor-pointer mb-2"
                        onPointerDown={onSeekPointerDown}
                    >
                        <div className="absolute inset-x-0 h-1 rounded-full bg-[var(--color-surface)]/20 group-hover/seek:h-1.5 transition-all">
                            <div
                                className="absolute inset-y-0 left-0 rounded-full bg-[var(--color-surface)]/30"
                                style={{ width: `${bufferedPct}%` }}
                            />
                            <div
                                className="absolute inset-y-0 left-0 rounded-full bg-[var(--mx-color-c6ff00)]"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <div
                            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[var(--mx-color-c6ff00)] shadow-lg shadow-black/40 scale-0 group-hover/seek:scale-100 transition-transform"
                            style={{ left: `calc(${progress}% - 7px)` }}
                        />
                    </div>

                    {/* Bottom row — wraps on narrow widths; secondary cluster full-width on xs */}
                    <div className="flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-2">
                        {/* Play / Pause */}
                        <button type="button" onClick={togglePlay} className="flex h-8 w-8 shrink-0 items-center justify-center text-white transition-colors hover:text-[var(--mx-color-c6ff00)]">
                            {playing ? (
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
                            ) : (
                                <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                            )}
                        </button>

                        {/* Skip back */}
                        <button type="button" onClick={() => skip(-SKIP_SEC)} className="flex h-7 w-7 shrink-0 items-center justify-center text-white/70 transition-colors hover:text-white" title={`-${SKIP_SEC}s`}>
                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                            </svg>
                        </button>

                        {/* Skip forward */}
                        <button type="button" onClick={() => skip(SKIP_SEC)} className="flex h-7 w-7 shrink-0 items-center justify-center text-white/70 transition-colors hover:text-white" title={`+${SKIP_SEC}s`}>
                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
                            </svg>
                        </button>

                        {/* Volume */}
                        <div className="relative flex shrink-0 items-center">
                            <button
                                type="button"
                                onClick={toggleMute}
                                onMouseEnter={() => setShowVolumeSlider(true)}
                                className="flex h-7 w-7 items-center justify-center text-white/70 transition-colors hover:text-white"
                            >
                                {volumeIcon === 'muted' ? (
                                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                                ) : volumeIcon === 'low' ? (
                                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                                ) : (
                                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                                )}
                            </button>
                            {showVolumeSlider && (
                                <div
                                    className="flex items-center ml-1 w-20"
                                    onMouseLeave={() => setShowVolumeSlider(false)}
                                >
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={muted ? 0 : volume}
                                        onChange={e => changeVolume(Number(e.target.value))}
                                        className="w-full h-1 appearance-none rounded-full bg-[var(--color-surface)]/20 accent-[var(--mx-color-c6ff00)] cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--mx-color-c6ff00)]"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Time */}
                        <span className="ml-auto min-w-0 max-w-[min(100%,11rem)] truncate text-end font-mono text-[10px] tabular-nums text-white/60 sm:ml-1 sm:max-w-none sm:whitespace-nowrap sm:text-[11px] sm:text-start">
                            {fmtTime(currentTime)} / {fmtTime(duration)}
                        </span>

                        {/* Spacer — desktop only */}
                        <div className="hidden min-w-0 flex-1 sm:block" />

                        {/* Speed + PiP + FS — full-width row on xs so controls do not overflow */}
                        <div className="flex w-full min-w-0 shrink-0 items-center justify-end gap-1 sm:ml-auto sm:w-auto">
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowSpeedMenu(v => !v)}
                                    className={`h-7 rounded-md px-2 text-[11px] font-semibold tabular-nums transition-colors ${
                                        speed !== 1
                                            ? 'bg-[var(--mx-color-c6ff00)]/20 text-[var(--mx-color-c6ff00)]'
                                            : 'text-white/70 hover:bg-[var(--color-surface)]/10 hover:text-white'
                                    }`}
                                >
                                    {speed}x
                                </button>
                                {showSpeedMenu && (
                                    <div className="absolute bottom-full right-0 z-30 mb-2 min-w-[5rem] overflow-hidden rounded-xl border border-[var(--color-border-strong)]/10 bg-[var(--mx-color-1c1c1e)] shadow-xl">
                                        {SPEEDS.map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => changeSpeed(s)}
                                                className={`block w-full px-3 py-1.5 text-left text-[11px] font-medium tabular-nums transition-colors ${
                                                    s === speed
                                                        ? 'bg-[var(--mx-color-c6ff00)]/20 text-[var(--mx-color-c6ff00)]'
                                                        : 'text-white/80 hover:bg-[var(--color-surface)]/10'
                                                }`}
                                            >
                                                {s}x
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {pipSupported && (
                                <button
                                    type="button"
                                    onClick={togglePiP}
                                    className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                                        pipActive ? 'text-[var(--mx-color-c6ff00)]' : 'text-white/70 hover:text-white'
                                    }`}
                                    title="Picture-in-Picture (P)"
                                >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <rect x="2" y="3" width="20" height="14" rx="2" />
                                        <rect x="11" y="9" width="9" height="7" rx="1" fill="currentColor" opacity=".4" />
                                    </svg>
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={toggleFullscreen}
                                className="flex h-7 w-7 items-center justify-center text-white/70 transition-colors hover:text-white"
                                title="Fullscreen (F)"
                            >
                                {isFullscreen ? (
                                    <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" /></svg>
                                ) : (
                                    <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Keyboard shortcut hint (shows briefly on first mount) */}
            <ShortcutHint />
        </div>
    )
}

function ShortcutHint() {
    const [visible, setVisible] = useState(true)
    useEffect(() => {
        const t = setTimeout(() => setVisible(false), 4000)
        return () => clearTimeout(t)
    }, [])
    if (!visible) return null
    return (
        <div className="pointer-events-none absolute left-2 top-[max(0.75rem,env(safe-area-inset-top,0px))] z-30 max-w-[calc(100%-1rem)] rounded-xl bg-black/60 px-2 py-2 text-[9px] leading-snug text-white/60 backdrop-blur-md animate-[fadeOut_0.5s_3.5s_forwards] sm:left-3 sm:max-w-sm sm:px-3 sm:text-[10px]">
            <p className="mb-0.5 font-semibold text-white/80">Keyboard shortcuts</p>
            <p className="wrap-anywhere">Space/K — play/pause · ←→ — seek {SKIP_SEC}s · Shift+←→ — 30s</p>
            <p className="wrap-anywhere">↑↓ — volume · M — mute · F — fullscreen · P — PiP · {'<>'} — speed</p>
        </div>
    )
}
