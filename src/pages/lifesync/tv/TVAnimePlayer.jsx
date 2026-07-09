import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { lifesyncFetch, getLifesyncApiBase, getAnimePreferEmbed, lifesyncPatchPreferences } from '../../../lib/lifesyncApi'
import { useLifeSync } from '../../../context/LifeSyncContext'
import AdvancedVideoPlayer from '../../../components/lifesync/AdvancedVideoPlayer'
import { streamIframeSandboxProps } from '../../../lib/lifesyncStreamIframe'
import useLifeSyncGamepadInput from '../../../hooks/useLifeSyncGamepadInput'
import useControllerSupportEnabled from '../../../hooks/useControllerSupportEnabled'
import { XBOX_GAMEPAD_BUTTONS } from '../../../lib/lifeSyncControllerInput'
import useLifeSyncInputSource from '../../../hooks/useLifeSyncInputSource'
import { tvHintLabel } from '../../../lib/lifeSyncKeyboardGamepad'

const NEXT_EP_COUNTDOWN_SECS = 5

// Settings panel sections
const SETTINGS_SECTIONS = ['audio', 'subtitles', 'quality', 'source']

/**
 * Fullscreen anime stream player inside TV mode.
 * B = back. LB/RB = prev/next episode. A = play/pause. LT/RT = seek.
 * X (controller) / Space (keyboard) = open/close settings panel.
 */
export function TVAnimePlayer({ animeId, episodes = [], initialEpisodeIndex = 0, onBack }) {
    const { isLifeSyncConnected, lifeSyncUser } = useLifeSync()
    const controllerEnabled = useControllerSupportEnabled()
    const inputSource = useLifeSyncInputSource()

    const [episodeIdx, setEpisodeIdx] = useState(initialEpisodeIndex)
    const [stream, setStream] = useState(null)
    const [audioType, setAudioType] = useState('sub')
    const [subtitlesOn, setSubtitlesOn] = useState(true)
    const [preferEmbed, setPreferEmbed] = useState(() => getAnimePreferEmbed(lifeSyncUser?.preferences))
    // Bumped by the player's error-screen Retry  re-resolves the stream from
    // the API so proxy URLs get a fresh signed token (they expire after 3h)
    const [resolveKey, setResolveKey] = useState(0)
    // { forUrl: string, url: string }  quality resets automatically when video URL changes
    const [qualitySelection, setQualitySelection] = useState({ forUrl: '', url: '' })
    // Derive effective quality: only apply if it was set for the current video URL
    const qualityUrl = qualitySelection.forUrl === stream?.videoUrl ? qualitySelection.url : ''
    const setQualityUrl = useCallback((url) => {
        setQualitySelection({ forUrl: stream?.videoUrl || '', url: url || '' })
    }, [stream?.videoUrl])
    const [nextEpCountdown, setNextEpCountdown] = useState(null)
    const [toast, setToast] = useState(null)

    // Settings panel state
    const [settingsOpen, setSettingsOpen] = useState(false)
    const settingsOpenRef = useRef(false)
    useEffect(() => { settingsOpenRef.current = settingsOpen }, [settingsOpen])
    const [settingsFocus, setSettingsFocus] = useState(0) // index into SETTINGS_SECTIONS

    const iframeContainerRef = useRef(null)
    const cancelRef = useRef(false)
    const countdownRef = useRef(null)
    const toastTimerRef = useRef(null)

    const canPrev = episodeIdx > 0
    const canNext = episodeIdx < episodes.length - 1
    const epObj = episodes[episodeIdx]

    // ── Stream resolution ────────────────────────────────────────────────────

    const resolveStream = useCallback(async (ep, type, signal, embed) => {
        if (!ep?.episodeId) return null
        const apiBase = getLifesyncApiBase()
        const embedQ = embed ? '&preferEmbed=true' : ''
        const pack = await lifesyncFetch(
            `/api/v1/anime/stream/watch/${encodeURIComponent(ep.episodeId)}?type=${type}${embedQ}&view=full`,
            signal ? { signal } : undefined,
        )
        const iframeFromPack = typeof pack?.iframeUrl === 'string' && /^https?:\/\//i.test(pack.iframeUrl) ? pack.iframeUrl : null
        const meta = pack?.streamMeta && typeof pack.streamMeta === 'object' ? pack.streamMeta : {}
        const toAbs = u => (String(u || '').startsWith('http') ? String(u) : `${apiBase}${u}`)
        const sources = Array.isArray(pack?.sources) ? pack.sources : []
        const pick = sources.find(s => s?.type === 'hls') || sources.find(s => s?.type === 'mp4') || sources[0]
        const audioAvailability = meta.audioAvailability && typeof meta.audioAvailability === 'object'
            ? { sub: !!meta.audioAvailability.sub, dub: !!meta.audioAvailability.dub }
            : null
        if (pick?.url) {
            const rawSubs = Array.isArray(pack?.subtitles) ? pack.subtitles : []
            const textTracks = rawSubs.map((s, i) => ({
                src: toAbs(s?.url),
                label: s?.label || `Subtitles ${i + 1}`,
                srclang: s?.lang || 'und',
                default: i === 0,
            }))
            const qualities = (Array.isArray(pack?.qualities) ? pack.qualities : [])
                .filter(q => q?.url)
                .map((q, i) => ({ id: q.id || q.label || `q${i}`, label: q.label || q.id || `Quality ${i + 1}`, url: toAbs(q.url) }))
            return { title: ep.title, iframeUrl: iframeFromPack, videoUrl: toAbs(pick.url), textTracks, qualities, mirrors: meta.mirrors || [], provider: meta.provider ?? null, audioAvailability }
        }
        if (iframeFromPack) return { title: ep.title, iframeUrl: iframeFromPack, videoUrl: null, textTracks: [], qualities: [], mirrors: meta.mirrors || [], provider: meta.provider ?? null, audioAvailability }
        return { title: ep.title, iframeUrl: null, videoUrl: null, textTracks: [], qualities: [], audioAvailability }
    }, [])


    useEffect(() => {
        if (!epObj) return
        cancelRef.current = false
        const ac = new AbortController()
        const initialTitle = epObj.title
        Promise.resolve().then(() => {
            if (!cancelRef.current) setStream({ title: initialTitle, resolving: true })
        })
        resolveStream(epObj, audioType, ac.signal, preferEmbed)
            .then(s => { if (!cancelRef.current) setStream(s ? { ...s, resolving: false } : null) })
            .catch(e => { if (!cancelRef.current && e?.name !== 'AbortError') setStream({ title: initialTitle, resolving: false, error: e?.message }) })
        return () => { cancelRef.current = true; ac.abort() }
    }, [epObj, resolveStream, audioType, preferEmbed, resolveKey])

    useEffect(() => {
        if (!isLifeSyncConnected || !animeId) return
        const ep = episodes[episodeIdx]
        if (!ep) return
        const lastEpisodeNumber = ep.number != null ? Math.max(1, Math.floor(Number(ep.number) || 1)) : episodeIdx + 1
        const ac = new AbortController()
        lifesyncFetch('/api/v1/anime/watch-progress', {
            method: 'PUT', signal: ac.signal, json: { animeId, lastEpisodeNumber },
        }).catch(() => {})
        return () => ac.abort()
    }, [animeId, episodeIdx, episodes, isLifeSyncConnected])

    // ── Countdown ────────────────────────────────────────────────────────────

    useEffect(() => {
        clearInterval(countdownRef.current)
        countdownRef.current = null
    }, [episodeIdx])

    const startNextEpCountdown = useCallback(() => {
        if (!canNext) return
        clearInterval(countdownRef.current)
        let remaining = NEXT_EP_COUNTDOWN_SECS
        setNextEpCountdown(remaining)
        countdownRef.current = setInterval(() => {
            remaining -= 1
            if (remaining <= 0) {
                clearInterval(countdownRef.current)
                countdownRef.current = null
                setNextEpCountdown(null)
                setEpisodeIdx(i => i + 1)
            } else {
                setNextEpCountdown(remaining)
            }
        }, 1000)
    }, [canNext])

    const cancelNextEpCountdown = useCallback(() => {
        clearInterval(countdownRef.current)
        countdownRef.current = null
        setNextEpCountdown(null)
    }, [])

    // ── Toast ────────────────────────────────────────────────────────────────

    const showToast = useCallback((label) => {
        clearTimeout(toastTimerRef.current)
        setToast(label)
        toastTimerRef.current = setTimeout(() => setToast(null), 1800)
    }, [])

    // ── Settings helpers ─────────────────────────────────────────────────────

    const qualityList = useMemo(() => (stream?.qualities || []).filter(q => q?.url), [stream?.qualities])

    const audioAvailability = stream?.audioAvailability ?? null
    const canSub = !audioAvailability || audioAvailability.sub !== false
    const canDub = !audioAvailability || audioAvailability.dub !== false
    const showSubDub = canSub && canDub
    const hasSubtitleTracks = (stream?.textTracks || []).length > 0
    const hasQualities = qualityList.length > 0

    const openSettings = useCallback(() => {
        setSettingsOpen(true)
        setSettingsFocus(0)
    }, [])

    const closeSettings = useCallback(() => {
        setSettingsOpen(false)
    }, [])

    const setAudio = useCallback((type) => {
        if (type === audioType) return
        setAudioType(type)
        showToast(type.toUpperCase())
    }, [audioType, showToast])

    const setSubtitles = useCallback((on) => {
        setSubtitlesOn(on)
        showToast(on ? 'CC ON' : 'CC OFF')
    }, [showToast])

    const setSource = useCallback((embed) => {
        if (embed === preferEmbed) return
        setPreferEmbed(embed)
        showToast(embed ? 'EMBED' : 'DIRECT')
        lifesyncPatchPreferences({ animePreferEmbed: embed }).catch(() => {})
    }, [preferEmbed, showToast])

    const setQuality = useCallback((url) => {
        setQualityUrl(url)
        const label = url
            ? (qualityList.find(q => q.url === url)?.label || 'Custom')
            : 'Auto'
        showToast(label)
    }, [qualityList, showToast, setQualityUrl])

    // ── Keyboard handler ─────────────────────────────────────────────────────

    useEffect(() => {
        const onKey = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
            const open = settingsOpenRef.current
            if (e.key === ' ' || e.key === 'x' || e.key === 'X') {
                e.preventDefault()
                if (open) closeSettings()
                else openSettings()
                return
            }
            if (e.key === 'Escape' && open) {
                e.preventDefault()
                closeSettings()
                return
            }
            if (!open) return
            // Navigate sections when panel is open
            if (e.key === 'ArrowUp') { e.preventDefault(); setSettingsFocus(f => Math.max(0, f - 1)); return }
            if (e.key === 'ArrowDown') { e.preventDefault(); setSettingsFocus(f => Math.min(SETTINGS_SECTIONS.length - 1, f + 1)); return }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [openSettings, closeSettings])

    // ── Gamepad handlers ─────────────────────────────────────────────────────

    // Controller: A/DPAD_LEFT/DPAD_RIGHT change the value in the focused section
    const settingsActivate = useCallback((dir) => {
        const section = SETTINGS_SECTIONS[settingsFocus]
        if (section === 'audio' && showSubDub) {
            setAudio(dir === 1 ? 'dub' : 'sub')
        } else if (section === 'subtitles') {
            setSubtitles(dir === 1 ? false : true)
        } else if (section === 'quality') {
            const opts = ['', ...qualityList.map(q => q.url)]
            const cur = opts.indexOf(qualityUrl)
            const next = Math.max(0, Math.min(opts.length - 1, cur + dir))
            setQuality(opts[next])
        } else if (section === 'source') {
            setSource(dir === 1)
        }
    }, [settingsFocus, showSubDub, setAudio, setSubtitles, qualityList, qualityUrl, setQuality, setSource])

    const settingsNavHandlers = useMemo(() => ({
        [XBOX_GAMEPAD_BUTTONS.B]: () => closeSettings(),
        [XBOX_GAMEPAD_BUTTONS.X]: () => closeSettings(),
        [XBOX_GAMEPAD_BUTTONS.DPAD_UP]: () => setSettingsFocus(f => Math.max(0, f - 1)),
        [XBOX_GAMEPAD_BUTTONS.DPAD_DOWN]: () => setSettingsFocus(f => Math.min(SETTINGS_SECTIONS.length - 1, f + 1)),
        [XBOX_GAMEPAD_BUTTONS.DPAD_LEFT]: () => settingsActivate(-1),
        [XBOX_GAMEPAD_BUTTONS.DPAD_RIGHT]: () => settingsActivate(1),
        [XBOX_GAMEPAD_BUTTONS.A]: () => settingsActivate(1),
    }), [closeSettings, settingsActivate])

    useLifeSyncGamepadInput({
        enabled: controllerEnabled && settingsOpen,
        handlers: settingsNavHandlers,
        repeatableButtons: [XBOX_GAMEPAD_BUTTONS.DPAD_UP, XBOX_GAMEPAD_BUTTONS.DPAD_DOWN],
    })

    // X/LB/RB/B apply the same way whether the active player is native video or
    // the embed shell  A/fullscreen/seek for embed mode are handled inside
    // AdvancedVideoPlayer itself.
    const videoHandlers = useMemo(() => ({
        [XBOX_GAMEPAD_BUTTONS.X]: () => { settingsOpen ? closeSettings() : openSettings() },
        [XBOX_GAMEPAD_BUTTONS.LB]: () => { if (canPrev) setEpisodeIdx(i => i - 1) },
        [XBOX_GAMEPAD_BUTTONS.RB]: () => { if (canNext) setEpisodeIdx(i => i + 1) },
        [XBOX_GAMEPAD_BUTTONS.B]: () => onBack(),
    }), [canNext, canPrev, onBack, settingsOpen, openSettings, closeSettings])

    useLifeSyncGamepadInput({
        enabled: controllerEnabled && Boolean(stream?.videoUrl || stream?.iframeUrl) && !settingsOpen,
        handlers: videoHandlers,
    })

    // Cleanup
    useEffect(() => () => {
        clearInterval(countdownRef.current)
        clearTimeout(toastTimerRef.current)
    }, [])

    const activeTextTracks = stream?.textTracks || []

    return (
        <div className="absolute inset-0 z-20 flex flex-col bg-black" style={{ cursor: 'none' }}>

            {/* ── Player area ─────────────────────────────────────────────── */}
            <div ref={iframeContainerRef} className="relative min-h-0 flex-1 bg-black">

                {/* Loading */}
                {stream?.resolving && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4">
                        <div className="relative">
                            <div className="h-14 w-14 animate-spin rounded-full border-2 border-(--mx-color-c6ff00)/20 border-t-(--mx-color-c6ff00)" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="h-5 w-5 animate-pulse rounded-full bg-(--mx-color-c6ff00)/10" />
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-[13px] font-semibold text-white/70">Loading stream</p>
                            <p className="mt-0.5 text-[11px] uppercase tracking-widest text-white/35">{audioType}</p>
                        </div>
                    </div>
                )}

                {/* Error */}
                {stream?.error && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center">
                        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-4 text-center">
                            <p className="text-[13px] font-semibold text-red-300">Stream error</p>
                            <p className="mt-1 text-[11px] text-white/40">{stream.error}</p>
                        </div>
                    </div>
                )}

                {/* Video player */}
                {stream?.videoUrl && !stream.resolving ? (
                    <AdvancedVideoPlayer
                        key={`${stream.videoUrl}|${audioType}`}
                        src={stream.videoUrl}
                        textTracks={activeTextTracks}
                        qualities={stream.qualities || []}
                        autoPlay
                        suppressKeys={settingsOpen}
                        subtitlesOnOverride={subtitlesOn}
                        activeQualityUrl={qualityUrl}
                        onQualityChange={setQualityUrl}
                        onPrevEpisode={canPrev ? () => setEpisodeIdx(i => i - 1) : undefined}
                        onNextEpisode={canNext ? () => setEpisodeIdx(i => i + 1) : undefined}
                        canPrevEpisode={canPrev}
                        canNextEpisode={canNext}
                        onEnded={() => { if (canNext) startNextEpCountdown() }}
                        onTimeNearEnd={canNext ? startNextEpCountdown : undefined}
                        onTimeNearEndCancel={cancelNextEpCountdown}
                        onRetry={() => setResolveKey(k => k + 1)}
                        onUseEmbed={() => setSource(true)}
                    />
                ) : stream?.iframeUrl && !stream.resolving ? (
                    <iframe
                        key={stream.iframeUrl}
                        title={stream.title || 'Episode'}
                        src={stream.iframeUrl}
                        className="h-full w-full border-0 bg-black"
                        allow="fullscreen; encrypted-media; autoplay; picture-in-picture"
                        {...streamIframeSandboxProps(stream.iframeUrl, { provider: stream.provider })}
                        referrerPolicy="no-referrer-when-downgrade"
                    />
                ) : null}

                {/* Toast */}
                {toast && (
                    <div className="pointer-events-none absolute left-1/2 top-8 z-50 -translate-x-1/2">
                        <div className="flex items-center gap-2 rounded-2xl border border-(--mx-color-c6ff00)/30 bg-black/85 px-5 py-2.5 shadow-2xl backdrop-blur-xl">
                            <span className="text-[11px] font-black uppercase tracking-[0.22em] text-(--mx-color-c6ff00)">{toast}</span>
                        </div>
                    </div>
                )}

                {/* Next-episode countdown */}
                {nextEpCountdown !== null && canNext && (
                    <div className="pointer-events-none absolute inset-0 z-40">
                        {/* Cinematic vignette sweep from right */}
                        <div
                            className="absolute inset-0"
                            style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 40%, transparent 70%)' }}
                        />

                        {/* Card  anchored bottom-right */}
                        <div className="absolute bottom-10 right-10 flex w-[min(100vw-5rem,26rem)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-black/80 shadow-[0_8px_64px_rgba(0,0,0,0.8)] backdrop-blur-2xl">

                            {/* Accent bar that depletes as countdown progresses */}
                            <div className="relative h-0.75 w-full bg-white/8">
                                <div
                                    className="absolute inset-y-0 right-0 bg-(--mx-color-c6ff00) transition-all duration-1000 ease-linear"
                                    style={{ width: `${(nextEpCountdown / NEXT_EP_COUNTDOWN_SECS) * 100}%` }}
                                />
                            </div>

                            <div className="px-6 py-5">
                                {/* Label row */}
                                <div className="flex items-center gap-2">
                                    <svg className="h-3.5 w-3.5 shrink-0 text-(--mx-color-c6ff00)" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 010 1.954l-7.108 4.061A1.125 1.125 0 013 16.811V8.69zM12.75 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 010 1.954l-7.108 4.061a1.125 1.125 0 01-1.683-.977V8.69z" />
                                    </svg>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-(--mx-color-c6ff00)">Up Next</span>
                                </div>

                                {/* Episode title */}
                                <p className="mt-2 truncate text-[16px] font-black leading-snug text-white">
                                    {episodes[episodeIdx + 1]?.title || `Episode ${episodeIdx + 2}`}
                                </p>
                                <p className="mt-0.5 text-[11px] font-medium text-white/40">
                                    Episode {episodeIdx + 2}
                                </p>

                                {/* Countdown row */}
                                <div className="mt-4 flex items-center gap-4">
                                    {/* Ring timer */}
                                    <div className="relative shrink-0">
                                        <svg className="h-14 w-14 -rotate-90" viewBox="0 0 48 48">
                                            <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
                                            <circle
                                                cx="24" cy="24" r="20" fill="none"
                                                stroke="var(--mx-color-c6ff00)" strokeWidth="3.5"
                                                strokeLinecap="round"
                                                strokeDasharray={`${2 * Math.PI * 20}`}
                                                strokeDashoffset={`${2 * Math.PI * 20 * (1 - nextEpCountdown / NEXT_EP_COUNTDOWN_SECS)}`}
                                                style={{ transition: 'stroke-dashoffset 1s linear' }}
                                            />
                                        </svg>
                                        <span className="absolute inset-0 flex items-center justify-center text-[18px] font-black tabular-nums text-white">
                                            {nextEpCountdown}
                                        </span>
                                    </div>

                                    <p className="text-[12px] leading-snug text-white/50">
                                        Starting next episode<br />
                                        <span className="text-white/30">automatically…</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Settings panel ───────────────────────────────────────── */}
                {settingsOpen && (
                    <div
                        className="absolute inset-0 z-50 flex items-end justify-end"
                        style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.35) 55%, transparent 100%)' }}
                        onClick={closeSettings}
                    >
                        <div
                            className="relative m-6 flex w-[min(100vw-3rem,22rem)] flex-col gap-1 rounded-3xl border border-white/10 bg-[#0a0a0a]/95 p-5 shadow-2xl backdrop-blur-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Accent line */}
                            <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-3xl bg-linear-to-r from-transparent via-(--mx-color-c6ff00)/60 to-transparent" />

                            {/* Header */}
                            <div className="mb-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-(--mx-color-c6ff00)/12">
                                        <svg className="h-3.5 w-3.5 text-(--mx-color-c6ff00)" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.764-.384.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </div>
                                    <p className="text-[13px] font-black text-white">Playback Settings</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeSettings}
                                    className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/6 text-white/50 hover:bg-white/12 hover:text-white/80 transition-colors"
                                >
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* ── Audio / Sub–Dub ─────────────────────────────── */}
                            <SettingsSection
                                focused={settingsFocus === 0}
                                icon={
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.59-.714-1.59-1.596v-5.47c0-.882.71-1.596 1.59-1.596H6.75z" />
                                    </svg>
                                }
                                label="Audio"
                                hint={tvHintLabel('↑↓', inputSource)}
                            >
                                {showSubDub ? (
                                    <div className="flex gap-2">
                                        {['sub', 'dub'].map(opt => (
                                            <button
                                                key={opt}
                                                type="button"
                                                onClick={() => setAudio(opt)}
                                                className={`flex-1 rounded-xl border py-2 text-[12px] font-black uppercase tracking-widest transition-all ${
                                                    audioType === opt
                                                        ? 'border-(--mx-color-c6ff00)/50 bg-(--mx-color-c6ff00)/14 text-(--mx-color-c6ff00) shadow-[0_0_12px_rgba(198,255,0,0.15)]'
                                                        : 'border-white/10 bg-white/4 text-white/55 hover:border-white/20 hover:text-white/80'
                                                }`}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="rounded-xl border border-white/8 bg-white/4 px-3 py-2 text-[12px] font-semibold text-white/55">
                                        {canDub && !canSub ? 'Dub only' : 'Sub only'} for this episode
                                    </p>
                                )}
                            </SettingsSection>

                            {/* ── Subtitles ───────────────────────────────────── */}
                            <SettingsSection
                                focused={settingsFocus === 1}
                                icon={
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                                    </svg>
                                }
                                label="Subtitles"
                                hint="C"
                            >
                                <div className="flex gap-2">
                                    {[
                                        { val: true, label: 'On' },
                                        { val: false, label: 'Off' },
                                    ].map(({ val, label }) => (
                                        <button
                                            key={label}
                                            type="button"
                                            onClick={() => setSubtitles(val)}
                                            disabled={val && !hasSubtitleTracks}
                                            className={`flex-1 rounded-xl border py-2 text-[12px] font-black uppercase tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-30 ${
                                                subtitlesOn === val
                                                    ? val
                                                        ? 'border-blue-400/50 bg-blue-500/14 text-blue-300 shadow-[0_0_12px_rgba(96,165,250,0.15)]'
                                                        : 'border-white/20 bg-white/8 text-white/80'
                                                    : 'border-white/10 bg-white/4 text-white/55 hover:border-white/20 hover:text-white/80'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                {!hasSubtitleTracks && (
                                    <p className="mt-1.5 text-[10px] text-white/30">No subtitle tracks for this episode</p>
                                )}
                            </SettingsSection>

                            {/* ── Quality ──────────────────────────────────────── */}
                            <SettingsSection
                                focused={settingsFocus === 2}
                                icon={
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .03 2.703-1.342 2.703H6.14c-1.372 0-2.342-1.703-1.342-2.703L5 14.5" />
                                    </svg>
                                }
                                label="Quality"
                            >
                                {hasQualities ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setQuality('')}
                                            className={`rounded-xl border px-3 py-1.5 text-[11px] font-black uppercase tracking-wide transition-all ${
                                                !qualityUrl
                                                    ? 'border-(--mx-color-c6ff00)/50 bg-(--mx-color-c6ff00)/14 text-(--mx-color-c6ff00)'
                                                    : 'border-white/10 bg-white/4 text-white/55 hover:border-white/20 hover:text-white/80'
                                            }`}
                                        >
                                            Auto
                                        </button>
                                        {qualityList.map(q => (
                                            <button
                                                key={q.id || q.url}
                                                type="button"
                                                onClick={() => setQuality(q.url)}
                                                className={`rounded-xl border px-3 py-1.5 text-[11px] font-black tabular-nums tracking-wide transition-all ${
                                                    qualityUrl === q.url
                                                        ? 'border-(--mx-color-c6ff00)/50 bg-(--mx-color-c6ff00)/14 text-(--mx-color-c6ff00)'
                                                        : 'border-white/10 bg-white/4 text-white/55 hover:border-white/20 hover:text-white/80'
                                                }`}
                                            >
                                                {q.label}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="rounded-xl border border-white/8 bg-white/4 px-3 py-2 text-[12px] font-semibold text-white/55">
                                        {stream?.resolving ? 'Loading…' : 'Quality variants not available'}
                                    </p>
                                )}
                            </SettingsSection>

                            {/* ── Source ───────────────────────────────────────── */}
                            <SettingsSection
                                focused={settingsFocus === 3}
                                icon={
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 17l10-10M7 7h10v10" />
                                    </svg>
                                }
                                label="Source"
                            >
                                <div className="flex gap-2">
                                    {[{ val: false, label: 'Direct' }, { val: true, label: 'Embed' }].map(({ val, label }) => (
                                        <button
                                            key={label}
                                            type="button"
                                            onClick={() => setSource(val)}
                                            className={`flex-1 rounded-xl border py-2 text-[12px] font-black uppercase tracking-widest transition-all ${
                                                preferEmbed === val
                                                    ? 'border-(--mx-color-c6ff00)/50 bg-(--mx-color-c6ff00)/14 text-(--mx-color-c6ff00) shadow-[0_0_12px_rgba(198,255,0,0.15)]'
                                                    : 'border-white/10 bg-white/4 text-white/55 hover:border-white/20 hover:text-white/80'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-1.5 text-[10px] text-white/30">Embed uses the provider's player when direct playback fails</p>
                            </SettingsSection>

                            {/* Footer hint */}
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/6 pt-3">
                                <div className="flex items-center gap-1.5 text-[10px] text-white/30">
                                    <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-semibold">{tvHintLabel('↑↓', inputSource)}</span>
                                    <span>Section</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-white/30">
                                    <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-semibold">{tvHintLabel('◀▶', inputSource)}</span>
                                    <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-semibold">{tvHintLabel('A', inputSource)}</span>
                                    <span>Change</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-white/30">
                                    <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-semibold">{tvHintLabel('B', inputSource)}</span>
                                    <span>/</span>
                                    <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-semibold">{tvHintLabel('X', inputSource)}</span>
                                    <span>Close</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Bottom bar ──────────────────────────────────────────────── */}
            <div className="shrink-0 flex items-center justify-between gap-3 border-t border-white/8 bg-black/92 px-6 py-3 backdrop-blur-xl">
                <button type="button" onClick={onBack} className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-[12px] font-semibold text-white/60 transition-colors hover:bg-white/10">
                    <span className="rounded bg-red-600/80 px-1.5 py-0.5 text-[10px] font-black text-white">{tvHintLabel('B', inputSource)}</span>
                    Back
                </button>

                <div className="min-w-0 flex-1 text-center">
                    <p className="truncate text-[14px] font-black text-white">{epObj?.title || `Episode ${episodeIdx + 1}`}</p>
                    {episodes.length > 0 && (
                        <p className="tabular-nums text-[10px] text-white/30">{episodeIdx + 1} / {episodes.length}</p>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Settings button */}
                    <button
                        type="button"
                        onClick={settingsOpen ? closeSettings : openSettings}
                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition-all ${
                            settingsOpen
                                ? 'border-(--mx-color-c6ff00)/40 bg-(--mx-color-c6ff00)/10 text-(--mx-color-c6ff00)'
                                : 'border-white/10 bg-white/5 text-white/55 hover:border-white/20 hover:text-white/75'
                        }`}
                        title="Settings (X / Space)"
                    >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.764-.384.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="hidden sm:inline">Settings</span>
                        <span className="rounded border border-white/12 bg-white/8 px-1 py-0.5 text-[9px] font-black">{tvHintLabel('X', inputSource)}</span>
                    </button>

                    {/* State badges */}
                    <span className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wide transition-all ${
                        audioType === 'dub'
                            ? 'bg-(--mx-color-c6ff00) text-black'
                            : 'bg-white/8 text-white/60'
                    }`}>
                        {audioType}
                    </span>
                    <span className={`rounded-lg border px-2 py-1 text-[10px] font-black uppercase transition-all ${
                        subtitlesOn
                            ? 'border-blue-400/40 bg-blue-500/12 text-blue-300'
                            : 'border-white/8 bg-white/4 text-white/25'
                    }`}>
                        CC
                    </span>

                    <div className="flex items-center gap-1.5 text-[11px] text-white/30">
                        <span className="rounded bg-white/8 px-1.5 py-0.5 font-black">{tvHintLabel('LB', inputSource)}</span>
                        <span>·</span>
                        <span className="rounded bg-white/8 px-1.5 py-0.5 font-black">{tvHintLabel('RB', inputSource)}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

function SettingsSection({ focused, icon, label, hint, children }) {
    return (
        <div className={`rounded-2xl border p-3.5 transition-all ${
            focused
                ? 'border-(--mx-color-c6ff00)/25 bg-white/4'
                : 'border-white/6 bg-transparent'
        }`}>
            <div className="mb-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className={`transition-colors ${focused ? 'text-(--mx-color-c6ff00)' : 'text-white/40'}`}>
                        {icon}
                    </span>
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/60">{label}</p>
                </div>
                {hint && (
                    <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold text-white/30">{hint}</span>
                )}
            </div>
            {children}
        </div>
    )
}
