import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import useControllerSupportEnabled from '../../hooks/useControllerSupportEnabled'
import useLifeSyncGamepadInput from '../../hooks/useLifeSyncGamepadInput'
import { XBOX_GAMEPAD_BUTTONS } from '../../lib/lifeSyncControllerInput'
import { ControllerHintOverlay } from './ControllerHintOverlay'

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
const SKIP_SEC = 10
const VOLUME_STORAGE_KEY = 'mx-player-volume'
const SPEED_STORAGE_KEY = 'mx-player-speed'
const CC_STORAGE_KEY = 'mx-player-cc'

function readStoredVolume() {
    try {
        const n = Number(localStorage.getItem(VOLUME_STORAGE_KEY))
        // Never restore a silent/near-silent volume — a stored 0 would make
        // every video start inaudible while the UI looks normal.
        return Number.isFinite(n) && n >= 0.05 && n <= 1 ? n : null
    } catch {
        return null
    }
}

function writeStoredVolume(vol) {
    try {
        if (Number.isFinite(vol) && vol >= 0.05) localStorage.setItem(VOLUME_STORAGE_KEY, String(vol))
        else localStorage.removeItem(VOLUME_STORAGE_KEY)
    } catch { /* ignore */ }
}

function readStoredSpeed() {
    try {
        const n = Number(localStorage.getItem(SPEED_STORAGE_KEY))
        return SPEEDS.includes(n) ? n : 1
    } catch {
        return 1
    }
}

function writeStoredSpeed(s) {
    try {
        if (s === 1) localStorage.removeItem(SPEED_STORAGE_KEY)
        else localStorage.setItem(SPEED_STORAGE_KEY, String(s))
    } catch { /* ignore */ }
}

function readStoredCC() {
    try {
        return localStorage.getItem(CC_STORAGE_KEY) !== 'off'
    } catch {
        return true
    }
}

function writeStoredCC(on) {
    try {
        if (on) localStorage.removeItem(CC_STORAGE_KEY)
        else localStorage.setItem(CC_STORAGE_KEY, 'off')
    } catch { /* ignore */ }
}

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
 * @param {{ id?: string, label: string, url: string }[]} [qualities] - selectable variant streams; when present a quality dropdown is shown ("Auto" = `src`)
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
    qualities = [],
    /** @type {'none' | 'metadata' | 'auto'} */
    preload = 'metadata',
    onTimeNearEnd,
    onTimeNearEndCancel,
    /** Controlled quality URL from parent (TV mode settings panel). '' = Auto. */
    activeQualityUrl,
    onQualityChange,
    /** When true, keyboard shortcuts are disabled (e.g. TV settings panel is open). */
    suppressKeys = false,
    /** Controlled subtitle on/off from parent. Undefined = use internal state. */
    subtitlesOnOverride,
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
    const [speed, setSpeed] = useState(readStoredSpeed)
    const [showControls, setShowControls] = useState(true)
    const [showSpeedMenu, setShowSpeedMenu] = useState(false)
    const [showVolumeSlider, setShowVolumeSlider] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [pipActive, setPipActive] = useState(false)
    const [showQualityMenu, setShowQualityMenu] = useState(false)
    const [buffering, setBuffering] = useState(false)
    const [showRemaining, setShowRemaining] = useState(false)
    // { forSrc, message } — only displayed while forSrc matches the active source,
    // so it auto-clears on episode/quality change without an effect
    const [mediaError, setMediaError] = useState(null)
    const [retryNonce, setRetryNonce] = useState(0)
    const [hoverInfo, setHoverInfo] = useState(null) // { x: %, time: seconds } seek-bar preview
    const [skipFlash, setSkipFlash] = useState(null) // { dir: 1|-1, total, key }
    const [volumeFlash, setVolumeFlash] = useState(null) // { value: 0..1, muted, key } transient HUD
    const skipFlashTimer = useRef(null)
    const volumeFlashTimer = useRef(null)
    const hlsRef = useRef(null)
    const isSeekingRef = useRef(false)
    const dragTimeRef = useRef(0)
    const bufferingDelayTimer = useRef(null)
    const speedRef = useRef(speed)
    const lastTapRef = useRef({ t: 0, x: 0 })
    // Playhead watchdog: detects real stalls (time not advancing while "playing")
    const stallStateRef = useRef({ time: -1, at: 0, recoveries: 0 })
    // '' = Auto (the master `src`); otherwise a variant url from `qualities`
    const [qualityUrl, setQualityUrl] = useState('')
    const [subtitlesOnInternal, setSubtitlesOn] = useState(readStoredCC)
    // If parent provides a controlled value, use it; otherwise use internal toggle state
    const subtitlesOn = subtitlesOnOverride !== undefined ? subtitlesOnOverride : subtitlesOnInternal
    const resumeTimeRef = useRef(0)
    const nearEndFiredRef = useRef(false)
    const controllerSupportEnabled = useControllerSupportEnabled()

    const qualityList = Array.isArray(qualities) ? qualities.filter(q => q?.url) : []
    const hasQualities = qualityList.length > 0
    // If parent controls quality (TV mode), use that; otherwise use internal state
    const resolvedQualityUrl = activeQualityUrl !== undefined ? activeQualityUrl : qualityUrl
    const activeSrc = resolvedQualityUrl || src
    const activeQualityLabel = resolvedQualityUrl
        ? (qualityList.find(q => q.url === resolvedQualityUrl)?.label || 'Auto')
        : 'Auto'

    // Reset to Auto whenever the underlying master source changes (e.g. new episode)
    useEffect(() => {
        setQualityUrl('')
        nearEndFiredRef.current = false
    }, [src])

    // Debounced buffering indicator: only show the spinner if the wait lasts
    // longer than 300ms, so micro-rebuffers and spurious events never flash it.
    const markBuffering = useCallback(() => {
        if (bufferingDelayTimer.current) return
        bufferingDelayTimer.current = setTimeout(() => {
            bufferingDelayTimer.current = null
            setBuffering(true)
        }, 300)
    }, [])

    const clearBuffering = useCallback(() => {
        clearTimeout(bufferingDelayTimer.current)
        bufferingDelayTimer.current = null
        setBuffering(false)
    }, [])

    const resetIdle = useCallback(() => {
        setShowControls(true)
        clearTimeout(idleTimer.current)
        if (playingRef.current) {
            idleTimer.current = setTimeout(() => {
                setShowControls(false)
                setShowSpeedMenu(false)
                setShowVolumeSlider(false)
                setShowQualityMenu(false)
            }, 3000)
        }
    }, [])

    useEffect(() => {
        playingRef.current = playing
    }, [playing])

    useEffect(
        () => () => {
            clearTimeout(idleTimer.current)
            idleTimer.current = null
            clearTimeout(skipFlashTimer.current)
            skipFlashTimer.current = null
            clearTimeout(volumeFlashTimer.current)
            volumeFlashTimer.current = null
            clearTimeout(bufferingDelayTimer.current)
            bufferingDelayTimer.current = null
        },
        [],
    )

    // Close popover menus when clicking/tapping anywhere outside them
    useEffect(() => {
        if (!showSpeedMenu && !showQualityMenu) return undefined
        const onDown = (e) => {
            if (e.target.closest?.('[data-player-menu]')) return
            setShowSpeedMenu(false)
            setShowQualityMenu(false)
        }
        window.addEventListener('pointerdown', onDown)
        return () => window.removeEventListener('pointerdown', onDown)
    }, [showSpeedMenu, showQualityMenu])

    const trackKey = (textTracks || []).map(t => t.src).join('|')
    // CORS mode is required for cross-origin WebVTT <track> elements, but it
    // breaks direct CDN sources that don't send Access-Control-Allow-Origin
    // (e.g. hentai mp4 mirrors) — only request it when subtitles are present.
    const needsCrossOrigin = (textTracks || []).length > 0

    // Sync subtitle visibility to native text track mode
    useEffect(() => {
        const v = videoRef.current
        if (!v) return
        const apply = () => {
            for (let i = 0; i < v.textTracks.length; i++) {
                v.textTracks[i].mode = subtitlesOn ? 'showing' : 'hidden'
            }
        }
        apply()
        v.textTracks.addEventListener('addtrack', apply)
        return () => v.textTracks.removeEventListener('addtrack', apply)
    }, [subtitlesOn, src, trackKey])

    useLayoutEffect(() => {
        const v = videoRef.current
        if (!v) return
        const s = typeof activeSrc === 'string' && activeSrc.trim() ? activeSrc.trim() : ''
        if (!s) {
            v.removeAttribute('src')
            v.load()
            return undefined
        }

        // Restore last used volume before playback starts
        const storedVol = readStoredVolume()
        if (storedVol != null) v.volume = storedVol

        // The <video> element is recreated per episode (key={src}) and reloaded
        // per quality change, both of which reset playbackRate to 1 — reapply
        // the user's speed so the UI and actual rate never drift apart.
        v.playbackRate = speedRef.current

        // Resume position when only the quality variant changed (same episode)
        const resumeAt = resumeTimeRef.current
        const wasPlaying = playingRef.current
        if (resumeAt > 0) {
            const seekOnReady = () => {
                try { v.currentTime = resumeAt } catch { /* ignore */ }
                if (wasPlaying) v.play?.().catch(() => {})
                resumeTimeRef.current = 0
                v.removeEventListener('loadedmetadata', seekOnReady)
            }
            v.addEventListener('loadedmetadata', seekOnReady)
        }

        stallStateRef.current = { time: -1, at: 0, recoveries: 0 }

        let hls = null
        let cancelled = false
        const destroyHls = () => {
            if (hls) {
                try {
                    hls.destroy()
                } catch { /* ignore */ }
                hls = null
                hlsRef.current = null
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
                            // Buffer only a window around the playhead — a seek to the
                            // middle fetches just the segments it needs instead of
                            // downloading the whole stream, and memory behind the
                            // playhead is released.
                            maxBufferLength: 30,
                            maxMaxBufferLength: 120,
                            maxBufferSize: 60 * 1000 * 1000,
                            backBufferLength: 30,
                            startFragPrefetch: true,
                            fragLoadingMaxRetry: 4,
                            manifestLoadingMaxRetry: 2,
                            levelLoadingMaxRetry: 4,
                            nudgeMaxRetry: 6,
                        })
                        let netRecoveries = 0
                        let mediaRecoveries = 0
                        hls.on(Hls.Events.ERROR, (_e, data) => {
                            if (!data?.fatal || !hls) return
                            if (data.type === Hls.ErrorTypes.NETWORK_ERROR && netRecoveries < 3) {
                                netRecoveries += 1
                                hls.startLoad()
                                return
                            }
                            if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 2) {
                                mediaRecoveries += 1
                                hls.recoverMediaError()
                                return
                            }
                            destroyHls()
                            if (!cancelled) {
                                setBuffering(false)
                                setMediaError({ forSrc: s, message: data?.details || 'Playback failed' })
                            }
                        })
                        hls.loadSource(s)
                        hls.attachMedia(v)
                        hlsRef.current = hls
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
    // trackKey intentionally excluded — subtitle track changes must NOT reload the stream
    }, [activeSrc, retryNonce])

    // Switch to a specific quality variant, remembering the current position
    const changeQuality = useCallback((url) => {
        const v = videoRef.current
        resumeTimeRef.current = v ? v.currentTime || 0 : 0
        if (onQualityChange) {
            onQualityChange(url || '')
        } else {
            setQualityUrl(url || '')
        }
        setShowQualityMenu(false)
    }, [onQualityChange])

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
            clearBuffering()
            clearTimeout(idleTimer.current)
            setShowControls(true)
            setShowSpeedMenu(false)
            setShowVolumeSlider(false)
        }
        const onErr = () => {
            const err = v.error
            clearBuffering()
            // hls.js handles MSE errors itself; this catches direct-src failures
            if (err) setMediaError(prev => prev ?? { forSrc: activeSrc, message: err.message || 'Video playback error' })
            onError?.(err)
        }
        const onDur = () => setDuration(v.duration || 0)
        // `stalled` intentionally NOT used — Chrome fires it spuriously during
        // perfectly fine playback, which left the spinner stuck on screen.
        const onWaiting = () => { if (!v.paused) markBuffering() }
        const onPlayable = () => clearBuffering()
        const onSeeked = () => clearBuffering()
        const onProgress = () => {
            if (v.buffered.length === 0) return
            // Report the range containing the playhead — after a seek, the last
            // range can be far behind/ahead and made the buffer bar misleading.
            const t = v.currentTime
            for (let i = 0; i < v.buffered.length; i++) {
                if (v.buffered.start(i) <= t + 0.5 && t <= v.buffered.end(i)) {
                    setBuffered(v.buffered.end(i))
                    return
                }
            }
            setBuffered(v.buffered.end(v.buffered.length - 1))
        }
        const onEnd = () => { setPlaying(false); nearEndFiredRef.current = false; clearBuffering(); onEnded?.() }
        const onTime = () => {
            if (!isSeekingRef.current) setCurrentTime(v.currentTime)
            // Any timeupdate while not waiting means frames are flowing
            if (!v.seeking && v.readyState >= 3) clearBuffering()
            // Near-end trigger: last 5 seconds
            if (onTimeNearEnd && v.duration > 10 && v.currentTime >= v.duration - 5 && !nearEndFiredRef.current) {
                nearEndFiredRef.current = true
                onTimeNearEnd()
            }
            if (onTimeNearEndCancel && nearEndFiredRef.current && v.duration > 0 && v.currentTime < v.duration - 5) {
                nearEndFiredRef.current = false
                onTimeNearEndCancel()
            }
        }
        const onVol = () => {
            setVolume(v.volume)
            setMuted(v.muted)
            writeStoredVolume(v.volume)
        }

        v.addEventListener('play', onPlay)
        v.addEventListener('pause', onPause)
        v.addEventListener('error', onErr)
        v.addEventListener('timeupdate', onTime)
        v.addEventListener('durationchange', onDur)
        v.addEventListener('loadedmetadata', onDur)
        v.addEventListener('progress', onProgress)
        v.addEventListener('ended', onEnd)
        v.addEventListener('volumechange', onVol)
        v.addEventListener('waiting', onWaiting)
        v.addEventListener('playing', onPlayable)
        v.addEventListener('canplay', onPlayable)
        v.addEventListener('seeked', onSeeked)

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
            v.removeEventListener('waiting', onWaiting)
            v.removeEventListener('playing', onPlayable)
            v.removeEventListener('canplay', onPlayable)
            v.removeEventListener('seeked', onSeeked)
        }
    }, [src, activeSrc, onEnded, onError, onTimeNearEnd, onTimeNearEndCancel, resetIdle, markBuffering, clearBuffering])

    // Playhead watchdog: if the video claims to be playing but currentTime
    // stops advancing, escalate through recovery steps instead of staying
    // frozen — (1) nudge the playhead past a buffer hole, (2) restart the
    // loader (hls) or reload the element (mp4) at the same position.
    useEffect(() => {
        const id = setInterval(() => {
            const v = videoRef.current
            if (!v) return
            const st = stallStateRef.current
            const now = Date.now()
            if (v.paused || v.ended || v.seeking || isSeekingRef.current) {
                st.time = v.currentTime
                st.at = now
                return
            }
            if (v.currentTime !== st.time) {
                st.time = v.currentTime
                st.at = now
                st.recoveries = 0
                return
            }
            const stuckMs = now - st.at
            if (stuckMs < 3000) return
            markBuffering()
            if (st.recoveries === 0) {
                st.recoveries = 1
                // Nudge past a potential buffer hole
                try { v.currentTime = v.currentTime + 0.1 } catch { /* ignore */ }
                v.play?.().catch(() => {})
            } else if (st.recoveries === 1 && stuckMs > 8000) {
                st.recoveries = 2
                const hls = hlsRef.current
                if (hls) {
                    try { hls.recoverMediaError() } catch { /* ignore */ }
                    try { hls.startLoad() } catch { /* ignore */ }
                } else {
                    // Direct mp4: reload the element and resume at the same spot
                    const t = v.currentTime
                    try {
                        v.load()
                        const resume = () => {
                            try { v.currentTime = t } catch { /* ignore */ }
                            v.play?.().catch(() => {})
                            v.removeEventListener('loadedmetadata', resume)
                        }
                        v.addEventListener('loadedmetadata', resume)
                    } catch { /* ignore */ }
                }
            }
        }, 1000)
        return () => clearInterval(id)
    }, [activeSrc, retryNonce, markBuffering])

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
    }, [])

    const skip = useCallback((delta) => {
        const v = videoRef.current
        if (v) seek(v.currentTime + delta)
        const dir = delta > 0 ? 1 : -1
        setSkipFlash(prev => ({
            dir,
            total: prev && prev.dir === dir ? prev.total + Math.abs(delta) : Math.abs(delta),
            key: Date.now(),
        }))
        clearTimeout(skipFlashTimer.current)
        skipFlashTimer.current = setTimeout(() => setSkipFlash(null), 700)
        resetIdle()
    }, [seek, resetIdle])

    // Reload the source from scratch, keeping the current position
    const retryPlayback = useCallback(() => {
        const v = videoRef.current
        if (v && Number.isFinite(v.currentTime) && v.currentTime > 0) {
            resumeTimeRef.current = v.currentTime
        }
        setMediaError(null)
        setRetryNonce(n => n + 1)
    }, [])

    const changeVolume = useCallback((val) => {
        const v = videoRef.current
        if (!v) return
        v.volume = Math.max(0, Math.min(1, val))
        if (val > 0 && v.muted) v.muted = false
    }, [])

    // Volume change from keys/gamepad — also flashes the transient volume HUD
    const nudgeVolume = useCallback((delta) => {
        const v = videoRef.current
        if (!v) return
        const next = Math.max(0, Math.min(1, v.volume + delta))
        changeVolume(next)
        setVolumeFlash({ value: next, muted: next === 0, key: Date.now() })
        clearTimeout(volumeFlashTimer.current)
        volumeFlashTimer.current = setTimeout(() => setVolumeFlash(null), 900)
        resetIdle()
    }, [changeVolume, resetIdle])

    const toggleMute = useCallback(() => {
        const v = videoRef.current
        if (v) v.muted = !v.muted
    }, [])

    const changeSpeed = useCallback((s) => {
        const v = videoRef.current
        if (v) v.playbackRate = s
        speedRef.current = s
        writeStoredSpeed(s)
        setSpeed(s)
        setShowSpeedMenu(false)
        resetIdle()
    }, [resetIdle])

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

    const toggleSubtitles = useCallback(() => {
        setSubtitlesOn(v => {
            writeStoredCC(!v)
            return !v
        })
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
            nudgeVolume(0.1)
        },
        [XBOX_GAMEPAD_BUTTONS.DPAD_DOWN]: () => {
            nudgeVolume(-0.1)
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
        nudgeVolume,
        onNextEpisode,
        onPrevEpisode,
        playOnly,
        resetIdle,
        skip,
        toggleFullscreen,
        togglePlay,
    ])

    useLifeSyncGamepadInput({
        enabled: controllerSupportEnabled && !suppressKeys,
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
            if (suppressKeys) return
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
                case 'l':
                case 'L':
                    skip(SKIP_SEC)
                    break
                case 'j':
                case 'J':
                    skip(-SKIP_SEC)
                    break
                case 'ArrowUp':
                    nudgeVolume(0.1)
                    break
                case 'ArrowDown':
                    nudgeVolume(-0.1)
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
                case 'c':
                case 'C':
                    toggleSubtitles()
                    break
                case 'Home':
                    seek(0)
                    break
                case 'End':
                    if (Number.isFinite(v.duration)) seek(v.duration - 1)
                    break
                default:
                    // 0–9 jumps to 0%–90% of the video, YouTube-style
                    if (/^[0-9]$/.test(e.key) && Number.isFinite(v.duration) && v.duration > 0) {
                        seek((Number(e.key) / 10) * v.duration)
                    } else {
                        handled = false
                    }
            }
            if (handled) { e.preventDefault(); resetIdle() }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [suppressKeys, togglePlay, skip, seek, nudgeVolume, toggleMute, toggleFullscreen, togglePiP, changeSpeed, speed, resetIdle, toggleSubtitles])

    const barTimeFromEvent = useCallback((e) => {
        const bar = seekBarRef.current
        if (!bar) return 0
        const rect = bar.getBoundingClientRect()
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        return ratio * (duration || 0)
    }, [duration])

    // Drag-to-seek: live UI preview while dragging, commit the actual seek on
    // release — committing every pointermove caused seek-thrashing on HLS.
    const onSeekPointerDown = useCallback((e) => {
        isSeekingRef.current = true
        const t = barTimeFromEvent(e)
        dragTimeRef.current = t
        setCurrentTime(t)
        const onMove = (ev) => {
            const mt = barTimeFromEvent(ev)
            dragTimeRef.current = mt
            setCurrentTime(mt)
        }
        const onUp = () => {
            isSeekingRef.current = false
            seek(dragTimeRef.current)
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
    }, [barTimeFromEvent, seek])

    const onSeekBarHover = useCallback((e) => {
        const bar = seekBarRef.current
        if (!bar || !duration) return
        const rect = bar.getBoundingClientRect()
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        setHoverInfo({ x: ratio * 100, time: ratio * duration })
    }, [duration])

    const isSurfaceTarget = (e) => e.target === e.currentTarget || e.target.tagName === 'VIDEO'

    // Touch gestures: single tap toggles control visibility, double-tap on the
    // left/right thirds skips ∓/± 10s, double-tap center toggles play.
    const onSurfaceTouchEnd = useCallback((e) => {
        if (!isSurfaceTarget(e)) return
        const wrap = wrapRef.current
        const touch = e.changedTouches?.[0]
        if (!wrap || !touch) return
        e.preventDefault() // suppress the synthetic click → no accidental play toggle
        const rect = wrap.getBoundingClientRect()
        const xr = (touch.clientX - rect.left) / rect.width
        const now = Date.now()
        const last = lastTapRef.current
        if (now - last.t < 300 && Math.abs(xr - last.x) < 0.25) {
            lastTapRef.current = { t: 0, x: 0 }
            if (xr < 0.35) skip(-SKIP_SEC)
            else if (xr > 0.65) skip(SKIP_SEC)
            else togglePlay()
            return
        }
        lastTapRef.current = { t: now, x: xr }
        if (showControls && playingRef.current) {
            setShowControls(false)
            setShowSpeedMenu(false)
            setShowVolumeSlider(false)
            setShowQualityMenu(false)
            clearTimeout(idleTimer.current)
        } else {
            resetIdle()
        }
    }, [skip, togglePlay, showControls, resetIdle])

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0
    const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0
    const volumeIcon = muted || volume === 0 ? 'muted' : volume < 0.5 ? 'low' : 'high'
    const pipSupported = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document
    const showError = Boolean(mediaError && mediaError.forSrc === activeSrc)

    const iconBtn = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/75 transition-all hover:bg-white/10 hover:text-white active:scale-90'
    const pillBtn = (active) => `h-8 shrink-0 rounded-lg px-2.5 text-[11px] font-bold tabular-nums transition-all active:scale-95 ${
        active
            ? 'bg-(--mx-color-c6ff00)/15 text-(--mx-color-c6ff00) ring-1 ring-(--mx-color-c6ff00)/30'
            : 'text-white/75 hover:bg-white/10 hover:text-white'
    }`

    return (
        <div
            ref={wrapRef}
            className={`relative w-full h-full bg-black select-none group/player ${playing && !showControls ? 'cursor-none' : ''}`}
            onMouseMove={resetIdle}
            onTouchEnd={onSurfaceTouchEnd}
            onClick={(e) => {
                if (isSurfaceTarget(e)) {
                    togglePlay()
                    resetIdle()
                }
            }}
            onDoubleClick={(e) => {
                if (isSurfaceTarget(e)) toggleFullscreen()
            }}
        >
            <video
                ref={videoRef}
                key={src}
                className="absolute inset-0 w-full h-full object-contain"
                style={{ fontSize: '14px' }}
                playsInline
                webkitPlaysInline
                crossOrigin={needsCrossOrigin ? 'anonymous' : undefined}
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

            {/* Buffering spinner */}
            {buffering && !showError && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                    <div className="relative flex h-16 w-16 items-center justify-center">
                        <div className="absolute inset-0 animate-spin rounded-full border-2 border-white/10 border-t-(--mx-color-c6ff00)" />
                        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-(--mx-color-c6ff00)" />
                    </div>
                </div>
            )}

            {/* Volume HUD (keyboard / gamepad changes) */}
            {volumeFlash && (
                <div
                    key={volumeFlash.key}
                    className="pointer-events-none absolute left-1/2 top-[12%] z-10 -translate-x-1/2"
                >
                    <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-black/65 px-4 py-2 backdrop-blur-xl">
                        <svg className="h-4 w-4 text-white/85" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            {volumeFlash.muted ? (
                                <><path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></>
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            )}
                        </svg>
                        <div className="h-1 w-24 overflow-hidden rounded-full bg-white/15">
                            <div
                                className="h-full rounded-full bg-(--mx-color-c6ff00) transition-[width] duration-150"
                                style={{ width: `${Math.round(volumeFlash.value * 100)}%` }}
                            />
                        </div>
                        <span className="min-w-[2.2rem] text-end font-mono text-[11px] font-bold tabular-nums text-white/85">
                            {Math.round(volumeFlash.value * 100)}%
                        </span>
                    </div>
                </div>
            )}

            {/* Skip flash (±10s indicator) */}
            {skipFlash && (
                <div
                    key={skipFlash.key}
                    className={`pointer-events-none absolute inset-y-0 z-10 flex items-center ${skipFlash.dir > 0 ? 'right-[10%]' : 'left-[10%]'}`}
                >
                    <div className="flex flex-col items-center gap-1.5 rounded-3xl border border-white/10 bg-black/55 px-5 py-4 backdrop-blur-md">
                        <div className={`flex items-center ${skipFlash.dir < 0 ? 'flex-row-reverse' : ''}`}>
                            {[0, 1, 2].map(i => (
                                <svg
                                    key={i}
                                    className={`h-5 w-5 text-(--mx-color-c6ff00) ${skipFlash.dir < 0 ? 'rotate-180' : ''} animate-pulse`}
                                    style={{ animationDelay: `${i * 100}ms`, animationDuration: '600ms' }}
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
                                </svg>
                            ))}
                        </div>
                        <span className="text-[12px] font-black tabular-nums text-white">
                            {skipFlash.dir > 0 ? '+' : '−'}{skipFlash.total}s
                        </span>
                    </div>
                </div>
            )}

            {/* Playback error + retry */}
            {showError && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/80 backdrop-blur-sm">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 ring-1 ring-red-500/25">
                        <svg className="h-7 w-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                    </div>
                    <div className="text-center">
                        <p className="text-[14px] font-bold text-white">Playback failed</p>
                        <p className="mt-1 max-w-xs text-[11px] text-white/40">{mediaError?.message}</p>
                    </div>
                    <button
                        type="button"
                        onClick={retryPlayback}
                        className="rounded-xl bg-(--mx-color-c6ff00) px-6 py-2.5 text-[12px] font-black text-black transition-all hover:brightness-110 active:scale-95"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Center play button (paused) */}
            {!playing && !buffering && !showError && (
                <button
                    type="button"
                    onClick={() => { togglePlay(); resetIdle() }}
                    className="absolute inset-0 z-10 flex items-center justify-center"
                >
                    <span className="flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-black/40 backdrop-blur-xl shadow-2xl shadow-black/50 transition-transform duration-200 hover:scale-110 active:scale-95">
                        <svg className="ml-1 h-8 w-8 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    </span>
                </button>
            )}

            {/* Controls overlay */}
            <div
                className={`absolute inset-x-0 bottom-0 z-20 transition-all duration-300 ${
                    showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
                }`}
            >
                {/* Gradient backdrop */}
                <div className="pointer-events-none absolute -top-16 inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/35 to-transparent" />

                <div className="relative mx-2 mb-[max(0.5rem,env(safe-area-inset-bottom,0px))] min-w-0 rounded-2xl border border-white/8 bg-black/45 px-3 pb-2 pt-1 backdrop-blur-xl sm:mx-4 sm:mb-3 sm:px-4">
                    {/* Seek bar */}
                    <div
                        ref={seekBarRef}
                        className="group/seek relative mb-1 flex h-6 cursor-pointer touch-none items-center"
                        onPointerDown={onSeekPointerDown}
                        onPointerMove={onSeekBarHover}
                        onPointerLeave={() => setHoverInfo(null)}
                    >
                        {/* Hover time bubble */}
                        {hoverInfo && duration > 0 && (
                            <div
                                className="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 rounded-lg border border-white/10 bg-black/85 px-2 py-1 font-mono text-[10px] font-bold tabular-nums text-white backdrop-blur-sm"
                                style={{ left: `${hoverInfo.x}%` }}
                            >
                                {fmtTime(hoverInfo.time)}
                            </div>
                        )}
                        <div className="absolute inset-x-0 h-1 overflow-hidden rounded-full bg-white/15 transition-all group-hover/seek:h-1.75">
                            {/* Hover ghost fill */}
                            {hoverInfo && (
                                <div
                                    className="absolute inset-y-0 left-0 bg-white/10"
                                    style={{ width: `${hoverInfo.x}%` }}
                                />
                            )}
                            <div
                                className="absolute inset-y-0 left-0 rounded-full bg-white/20"
                                style={{ width: `${bufferedPct}%` }}
                            />
                            <div
                                className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-(--mx-color-c6ff00)/70 to-(--mx-color-c6ff00)"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <div
                            className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 scale-0 rounded-full bg-(--mx-color-c6ff00) shadow-[0_0_12px_rgba(198,255,0,0.6)] ring-2 ring-black/30 transition-transform group-hover/seek:scale-100"
                            style={{ left: `calc(${progress}% - 7px)` }}
                        />
                    </div>

                    {/* Bottom row — wraps on narrow widths; secondary cluster full-width on xs */}
                    <div className="flex w-full min-w-0 flex-wrap items-center gap-x-1 gap-y-1.5">
                        {/* Play / Pause */}
                        <button type="button" onClick={togglePlay} className={`${iconBtn} text-white hover:text-(--mx-color-c6ff00)`}>
                            {playing ? (
                                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
                            ) : (
                                <svg className="ml-0.5 h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                            )}
                        </button>

                        {/* Skip back */}
                        <button type="button" onClick={() => skip(-SKIP_SEC)} className={iconBtn} title={`-${SKIP_SEC}s (J)`}>
                            <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                            </svg>
                        </button>

                        {/* Skip forward */}
                        <button type="button" onClick={() => skip(SKIP_SEC)} className={iconBtn} title={`+${SKIP_SEC}s (L)`}>
                            <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
                            </svg>
                        </button>

                        {/* Volume */}
                        <div
                            className="flex shrink-0 items-center"
                            onMouseEnter={() => setShowVolumeSlider(true)}
                            onMouseLeave={() => setShowVolumeSlider(false)}
                        >
                            <button type="button" onClick={toggleMute} className={iconBtn} title="Mute (M)">
                                {volumeIcon === 'muted' ? (
                                    <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                                ) : volumeIcon === 'low' ? (
                                    <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                                ) : (
                                    <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                                )}
                            </button>
                            <div className={`flex items-center overflow-hidden transition-all duration-200 ${showVolumeSlider ? 'w-20 opacity-100 ml-0.5' : 'w-0 opacity-0'}`}>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={muted ? 0 : volume}
                                    onChange={e => changeVolume(Number(e.target.value))}
                                    className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-(--mx-color-c6ff00) [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-(--mx-color-c6ff00) [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(198,255,0,0.5)]"
                                />
                            </div>
                        </div>

                        {/* Time — click toggles remaining time */}
                        <button
                            type="button"
                            onClick={() => setShowRemaining(r => !r)}
                            className="ml-auto min-w-0 max-w-[min(100%,11rem)] truncate text-end font-mono text-[10px] tabular-nums text-white/55 transition-colors hover:text-white/85 sm:ml-1.5 sm:max-w-none sm:whitespace-nowrap sm:text-[11px] sm:text-start"
                            title="Toggle remaining time"
                        >
                            <span className="text-white/90">
                                {showRemaining && duration > 0 ? `−${fmtTime(Math.max(0, duration - currentTime))}` : fmtTime(currentTime)}
                            </span>
                            <span className="mx-1 text-white/30">/</span>
                            {fmtTime(duration)}
                        </button>

                        {/* Spacer — desktop only */}
                        <div className="hidden min-w-0 flex-1 sm:block" />

                        {/* Quality + Speed + CC + PiP + FS — full-width row on xs so controls do not overflow */}
                        <div className="flex w-full min-w-0 shrink-0 items-center justify-end gap-0.5 sm:ml-auto sm:w-auto">
                            {hasQualities && (
                                <div className="relative" data-player-menu>
                                    <button
                                        type="button"
                                        onClick={() => { setShowQualityMenu(v => !v); setShowSpeedMenu(false) }}
                                        className={pillBtn(Boolean(resolvedQualityUrl))}
                                        title="Quality"
                                    >
                                        {activeQualityLabel}
                                    </button>
                                    {showQualityMenu && (
                                        <MenuPopover
                                            title="Quality"
                                            items={[{ key: '', label: 'Auto', active: !resolvedQualityUrl }, ...qualityList.map(q => ({
                                                key: q.url,
                                                label: q.label,
                                                active: q.url === resolvedQualityUrl,
                                            }))]}
                                            onSelect={changeQuality}
                                        />
                                    )}
                                </div>
                            )}
                            <div className="relative" data-player-menu>
                                <button
                                    type="button"
                                    onClick={() => { setShowSpeedMenu(v => !v); setShowQualityMenu(false) }}
                                    className={pillBtn(speed !== 1)}
                                    title="Playback speed (< >)"
                                >
                                    {speed}×
                                </button>
                                {showSpeedMenu && (
                                    <MenuPopover
                                        title="Speed"
                                        items={SPEEDS.map(s => ({ key: s, label: `${s}×`, active: s === speed }))}
                                        onSelect={changeSpeed}
                                    />
                                )}
                            </div>
                            {/* CC / Subtitles toggle */}
                            <button
                                type="button"
                                onClick={toggleSubtitles}
                                className={pillBtn(subtitlesOn)}
                                title="Subtitles (C)"
                            >
                                CC
                            </button>
                            {pipSupported && (
                                <button
                                    type="button"
                                    onClick={togglePiP}
                                    className={`${iconBtn} ${pipActive ? 'text-(--mx-color-c6ff00)!' : ''}`}
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
                                className={iconBtn}
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

            {/* Controller hint overlay */}
            <ControllerHintOverlay
                dark
                position="bottom-left"
                cols={2}
                hints={[
                    { btns: ['A'], label: 'Play / Pause' },
                    { btns: ['X'], label: 'Fullscreen' },
                    { btns: ['LB'], label: 'Prev episode' },
                    { btns: ['RB'], label: 'Next episode' },
                    { btns: ['LT'], label: 'Seek back' },
                    { btns: ['RT'], label: 'Seek forward' },
                    { btns: ['↑↓'], label: 'Volume' },
                ]}
            />
        </div>
    )
}

function MenuPopover({ title, items, onSelect }) {
    return (
        <div className="absolute bottom-full right-0 z-30 mb-2 min-w-30 overflow-hidden rounded-xl border border-white/10 bg-black/85 shadow-2xl shadow-black/60 backdrop-blur-xl">
            <p className="px-3 pb-1 pt-2 text-[9px] font-black uppercase tracking-[0.12em] text-white/35">{title}</p>
            <div className="max-h-56 overflow-y-auto pb-1">
                {items.map(item => (
                    <button
                        key={String(item.key)}
                        type="button"
                        onClick={() => onSelect(item.key)}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[11px] font-semibold tabular-nums transition-colors ${
                            item.active
                                ? 'text-(--mx-color-c6ff00)'
                                : 'text-white/75 hover:bg-white/8 hover:text-white'
                        }`}
                    >
                        {item.label}
                        {item.active && (
                            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                        )}
                    </button>
                ))}
            </div>
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
        <div className="pointer-events-none absolute left-2 top-[max(0.75rem,env(safe-area-inset-top,0px))] z-30 max-w-[calc(100%-1rem)] rounded-xl border border-white/8 bg-black/60 px-2 py-2 text-[9px] leading-snug text-white/60 backdrop-blur-md animate-[fadeOut_0.5s_3.5s_forwards] sm:left-3 sm:max-w-sm sm:px-3 sm:text-[10px]">
            <p className="mb-0.5 font-semibold text-white/80">Keyboard shortcuts</p>
            <p className="wrap-anywhere">Space/K — play/pause · ←→/J/L — seek {SKIP_SEC}s · Shift+←→ — 30s</p>
            <p className="wrap-anywhere">↑↓ — volume · M — mute · F — fullscreen · P — PiP · C — subtitles · {'<>'} — speed · 0–9 — jump</p>
        </div>
    )
}
