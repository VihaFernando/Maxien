import { useEffect, useRef, useState } from 'react'
import { motion as M, AnimatePresence } from 'framer-motion'
import { readStoredReduceAnimationsSetting } from '../../../lib/lifeSyncReduceMotion'

const LOW_END = readStoredReduceAnimationsSetting() === true
const TOTAL_MS = 7200

// ─── Web Audio helpers ────────────────────────────────────────────────────────

function getAudioCtx() {
    if (typeof window === 'undefined') return null
    try { return new (window.AudioContext || window.webkitAudioContext)() } catch { return null }
}

function playTone(ctx, { freq = 440, type = 'sine', gainPeak = 0.18, attack = 0.01, decay = 0.18, start = 0 }) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
    g.gain.setValueAtTime(0, ctx.currentTime + start)
    g.gain.linearRampToValueAtTime(gainPeak, ctx.currentTime + start + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + attack + decay)
    osc.start(ctx.currentTime + start)
    osc.stop(ctx.currentTime + start + attack + decay + 0.05)
}

function playNoise(ctx, { start = 0, duration = 0.25, gainPeak = 0.12, filterFreq = 800 }) {
    const bufLen = Math.floor(ctx.sampleRate * duration)
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'; filter.frequency.value = filterFreq; filter.Q.value = 1.4
    const g = ctx.createGain()
    src.connect(filter); filter.connect(g); g.connect(ctx.destination)
    g.gain.setValueAtTime(0, ctx.currentTime + start)
    g.gain.linearRampToValueAtTime(gainPeak, ctx.currentTime + start + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration)
    src.start(ctx.currentTime + start)
    src.stop(ctx.currentTime + start + duration + 0.05)
}

function playThud(ctx, { start = 0 }) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(80, ctx.currentTime + start)
    osc.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + start + 0.35)
    g.gain.setValueAtTime(0, ctx.currentTime + start)
    g.gain.linearRampToValueAtTime(0.55, ctx.currentTime + start + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + 0.55)
    osc.start(ctx.currentTime + start)
    osc.stop(ctx.currentTime + start + 0.65)
}

function playPad(ctx, { start = 0, duration = 1.8, gainPeak = 0.06, freq = 220 }) {
    for (const detune of [-6, 6]) {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.connect(g); g.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
        osc.detune.setValueAtTime(detune, ctx.currentTime + start)
        g.gain.setValueAtTime(0, ctx.currentTime + start)
        g.gain.linearRampToValueAtTime(gainPeak, ctx.currentTime + start + 0.4)
        g.gain.setValueAtTime(gainPeak, ctx.currentTime + start + duration - 0.5)
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + start + duration)
        osc.start(ctx.currentTime + start)
        osc.stop(ctx.currentTime + start + duration + 0.1)
    }
}

function playAmbient(ctx, { duration = 6.5 }) {
    const osc = ctx.createOscillator()
    const filter = ctx.createBiquadFilter()
    const g = ctx.createGain()
    osc.connect(filter); filter.connect(g); g.connect(ctx.destination)
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(55, ctx.currentTime)
    filter.type = 'lowpass'; filter.frequency.setValueAtTime(90, ctx.currentTime)
    g.gain.setValueAtTime(0, ctx.currentTime)
    g.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.6)
    g.gain.setValueAtTime(0.04, ctx.currentTime + duration - 0.8)
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + duration)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + duration + 0.1)
}

/** Soft tick for each letter appearing */
function playTick(ctx, { start = 0, freq = 1800 }) {
    playTone(ctx, { freq, type: 'sine', gainPeak: 0.025, attack: 0.002, decay: 0.04, start })
}

function scheduleIntroSounds(ctx) {
    playAmbient(ctx, { duration: 6.5 })

    // Heartbeat blips during wave draw-in
    playTone(ctx, { freq: 520, type: 'square', gainPeak: 0.08, attack: 0.004, decay: 0.06, start: 0.9 })
    playNoise(ctx, { start: 0.9, duration: 0.07, gainPeak: 0.06, filterFreq: 1200 })
    playTone(ctx, { freq: 420, type: 'square', gainPeak: 0.07, attack: 0.004, decay: 0.08, start: 1.25 })
    playNoise(ctx, { start: 1.25, duration: 0.07, gainPeak: 0.05, filterFreq: 900 })

    // Collision boom
    playThud(ctx, { start: 1.85 })
    playNoise(ctx, { start: 1.85, duration: 0.3, gainPeak: 0.18, filterFreq: 1800 })
    playTone(ctx, { freq: 1100, type: 'sine', gainPeak: 0.12, attack: 0.005, decay: 0.22, start: 1.85 })

    // Pad swell on logo
    playPad(ctx, { start: 2.6, duration: 2.2, gainPeak: 0.055, freq: 165 })
    playPad(ctx, { start: 2.75, duration: 2.0, gainPeak: 0.04, freq: 220 })

    // Per-character ticks for "LifeSync" (8 chars, starting 2.65s, 0.07s apart)
    'LifeSync'.split('').forEach((_, i) => {
        playTick(ctx, { start: 2.65 + i * 0.07, freq: 1600 + i * 40 })
    })

    // TV MODE badge chime
    playTone(ctx, { freq: 880, type: 'sine', gainPeak: 0.07, attack: 0.008, decay: 0.35, start: 3.35 })
    playTone(ctx, { freq: 1320, type: 'sine', gainPeak: 0.04, attack: 0.008, decay: 0.28, start: 3.45 })

    // Per-character ticks for "TV MODE" (7 chars, 0.06s apart)
    'TV MODE'.split('').forEach((_, i) => {
        if (_ === ' ') return
        playTick(ctx, { start: 3.38 + i * 0.06, freq: 2000 + i * 30 })
    })
}

// ─── Animation variants ───────────────────────────────────────────────────────

const charVariants = {
    hidden: { opacity: 0, y: 22, rotateX: -40, filter: 'blur(4px)' },
    show: (i) => ({
        opacity: 1, y: 0, rotateX: 0, filter: 'blur(0px)',
        transition: { delay: 2.65 + i * 0.07, duration: 0.38, ease: [0.16, 1, 0.3, 1] },
    }),
}

const tagCharVariants = {
    hidden: { opacity: 0, y: 10, filter: 'blur(3px)' },
    show: (i) => ({
        opacity: 1, y: 0, filter: 'blur(0px)',
        transition: { delay: 3.38 + i * 0.06, duration: 0.28, ease: [0.16, 1, 0.3, 1] },
    }),
}

// Persistent ring wave (slow pulse from centre, separate from collision rings)
const RING_PULSE_DELAYS = [0, 0.7, 1.4]

// ─── Component ────────────────────────────────────────────────────────────────

export function TVIntroAnimation({ onComplete }) {
    const [skipped, setSkipped] = useState(false)
    const audioCtxRef = useRef(null)

    useEffect(() => {
        if (LOW_END) { onComplete(); return }
        const ctx = getAudioCtx()
        audioCtxRef.current = ctx
        if (ctx) {
            const resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve()
            resume.then(() => scheduleIntroSounds(ctx)).catch(() => {})
        }
        const t = setTimeout(onComplete, TOTAL_MS)
        return () => { clearTimeout(t); ctx?.close().catch(() => {}) }
    }, [onComplete])

    const skip = () => {
        audioCtxRef.current?.close().catch(() => {})
        setSkipped(true); onComplete()
    }

    if (LOW_END) return null

    const lifeSyncChars = 'LifeSync'.split('')
    const tvModeChars = 'TV MODE'.split('')

    return (
        <M.div
            className="fixed inset-0 z-10000 overflow-hidden bg-[#05050a]"
            initial={{ opacity: 0 }}
            animate={{ opacity: skipped ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
        >
            {/* ── Dot grid ──────────────────────────────────────────── */}
            <div
                className="pointer-events-none absolute inset-0"
                aria-hidden
                style={{
                    backgroundImage: 'radial-gradient(circle, rgba(198,255,0,0.085) 1px, transparent 1px)',
                    backgroundSize: '38px 38px',
                }}
            />

            {/* ── Vignette ──────────────────────────────────────────── */}
            <div
                className="pointer-events-none absolute inset-0"
                aria-hidden
                style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 35%, rgba(0,0,0,0.92) 100%)' }}
            />

            {/* ── Aurora orbs ───────────────────────────────────────── */}
            <M.div className="pointer-events-none absolute rounded-full blur-[140px]" aria-hidden
                style={{ width: 580, height: 580, left: '-10%', top: '-18%', background: 'rgba(198,255,0,0.11)' }}
                initial={{ opacity: 0, scale: 0.55 }} animate={{ opacity: 1, scale: 1.18 }}
                transition={{ duration: 2.4, ease: 'easeOut' }}
            />
            <M.div className="pointer-events-none absolute rounded-full blur-[160px]" aria-hidden
                style={{ width: 500, height: 500, right: '-8%', bottom: '-14%', background: 'rgba(198,255,0,0.07)' }}
                initial={{ opacity: 0, scale: 0.45 }} animate={{ opacity: 1, scale: 1.12 }}
                transition={{ delay: 0.25, duration: 2.6, ease: 'easeOut' }}
            />
            {/* Collision bloom */}
            <M.div
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[110px]"
                aria-hidden
                style={{ width: 460, height: 460, background: 'rgba(198,255,0,0.2)' }}
                initial={{ opacity: 0, scale: 0.2 }}
                animate={{ opacity: [0, 1, 0.3], scale: [0.2, 1.4, 1.0] }}
                transition={{ delay: 1.85, duration: 1.3, times: [0, 0.35, 1], ease: 'easeOut' }}
            />

            {/* ── Persistent ring-wave pulse (pre-collision ambient) ── */}
            {RING_PULSE_DELAYS.map((d, i) => (
                <M.div
                    key={`rpre-${i}`}
                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
                    aria-hidden
                    style={{ width: 80, height: 80, borderColor: 'rgba(198,255,0,0.5)' }}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: [0, 0.6, 0], scale: [0.5, 4.5, 7] }}
                    transition={{
                        delay: 0.4 + d,
                        duration: 2.2,
                        repeat: 0,
                        ease: 'easeOut',
                        opacity: { times: [0, 0.15, 1] },
                        scale: { times: [0, 0.2, 1] },
                    }}
                />
            ))}

            {/* ── Post-logo slow ring breathe ───────────────────────── */}
            {[0, 1.1, 2.2].map((d, i) => (
                <M.div
                    key={`rpost-${i}`}
                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
                    aria-hidden
                    style={{ width: 120, height: 120, borderColor: 'rgba(198,255,0,0.3)' }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: [0, 0.45, 0], scale: [0.8, 3.2, 5.5] }}
                    transition={{
                        delay: 2.9 + d,
                        duration: 2.6,
                        repeat: 0,
                        ease: 'easeOut',
                        opacity: { times: [0, 0.18, 1] },
                    }}
                />
            ))}

            {/* ── Synapse SVG ───────────────────────────────────────── */}
            <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox="0 0 1600 900"
                preserveAspectRatio="xMidYMid slice"
                aria-hidden
            >
                <defs>
                    <linearGradient id="lsi-stroke-l" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="rgba(198,255,0,0)" />
                        <stop offset="55%" stopColor="rgba(198,255,0,0.6)" />
                        <stop offset="100%" stopColor="rgba(198,255,0,1)" />
                    </linearGradient>
                    <linearGradient id="lsi-stroke-r" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="rgba(198,255,0,1)" />
                        <stop offset="45%" stopColor="rgba(198,255,0,0.6)" />
                        <stop offset="100%" stopColor="rgba(198,255,0,0)" />
                    </linearGradient>
                    <radialGradient id="lsi-pulse-g" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="rgba(230,255,80,0.75)" />
                        <stop offset="35%" stopColor="rgba(198,255,0,0.22)" />
                        <stop offset="100%" stopColor="rgba(198,255,0,0)" />
                    </radialGradient>
                    <filter id="lsi-glow">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                </defs>

                {/* Left wave glow */}
                <M.path
                    d="M-40,450 L220,450 L270,450 L300,360 L330,540 L360,260 L390,640 L420,450 L520,450 L570,450 L600,410 L630,490 L660,450 L800,450"
                    stroke="rgba(198,255,0,0.22)" strokeWidth="8" fill="none"
                    strokeLinecap="round" strokeLinejoin="round" filter="url(#lsi-glow)"
                    initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ delay: 0.28, duration: 1.65, ease: [0.4, 0, 0.2, 1] }}
                />
                {/* Left wave sharp */}
                <M.path
                    d="M-40,450 L220,450 L270,450 L300,360 L330,540 L360,260 L390,640 L420,450 L520,450 L570,450 L600,410 L630,490 L660,450 L800,450"
                    stroke="url(#lsi-stroke-l)" strokeWidth="2.5" fill="none"
                    strokeLinecap="round" strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ delay: 0.3, duration: 1.6, ease: [0.4, 0, 0.2, 1] }}
                />

                {/* Right wave glow */}
                <M.path
                    d="M1640,450 L1380,450 L1330,450 L1300,360 L1270,540 L1240,260 L1210,640 L1180,450 L1080,450 L1030,450 L1000,410 L970,490 L940,450 L800,450"
                    stroke="rgba(198,255,0,0.22)" strokeWidth="8" fill="none"
                    strokeLinecap="round" strokeLinejoin="round" filter="url(#lsi-glow)"
                    initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ delay: 0.28, duration: 1.65, ease: [0.4, 0, 0.2, 1] }}
                />
                {/* Right wave sharp */}
                <M.path
                    d="M1640,450 L1380,450 L1330,450 L1300,360 L1270,540 L1240,260 L1210,640 L1180,450 L1080,450 L1030,450 L1000,410 L970,490 L940,450 L800,450"
                    stroke="url(#lsi-stroke-r)" strokeWidth="2.5" fill="none"
                    strokeLinecap="round" strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ delay: 0.3, duration: 1.6, ease: [0.4, 0, 0.2, 1] }}
                />

                {/* Collision radial fill */}
                <M.circle cx="800" cy="450" r="300" fill="url(#lsi-pulse-g)"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 1.55, 1.1], opacity: [0, 1, 0] }}
                    transition={{ delay: 1.85, duration: 1.05, times: [0, 0.36, 1], ease: 'easeOut' }}
                    style={{ transformOrigin: '800px 450px' }}
                />
                {/* Shockwave ring 1 */}
                <M.circle cx="800" cy="450" r="44" fill="none" stroke="rgba(230,255,60,0.95)" strokeWidth="3"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 2, 0.3], opacity: [0, 1, 0] }}
                    transition={{ delay: 1.85, duration: 1.0, ease: 'easeOut', times: [0, 0.3, 1] }}
                    style={{ transformOrigin: '800px 450px' }}
                />
                {/* Shockwave ring 2 */}
                <M.circle cx="800" cy="450" r="44" fill="none" stroke="rgba(198,255,0,0.6)" strokeWidth="2"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 4, 0.8], opacity: [0, 0.75, 0] }}
                    transition={{ delay: 1.9, duration: 1.25, ease: 'easeOut', times: [0, 0.28, 1] }}
                    style={{ transformOrigin: '800px 450px' }}
                />
                {/* Shockwave ring 3 */}
                <M.circle cx="800" cy="450" r="44" fill="none" stroke="rgba(198,255,0,0.25)" strokeWidth="1.5"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 6.5, 1.5], opacity: [0, 0.45, 0] }}
                    transition={{ delay: 1.95, duration: 1.5, ease: 'easeOut', times: [0, 0.26, 1] }}
                    style={{ transformOrigin: '800px 450px' }}
                />
                {/* Shockwave ring 4 — outermost ghost */}
                <M.circle cx="800" cy="450" r="44" fill="none" stroke="rgba(198,255,0,0.1)" strokeWidth="1"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 9, 2], opacity: [0, 0.3, 0] }}
                    transition={{ delay: 2.0, duration: 1.6, ease: 'easeOut', times: [0, 0.24, 1] }}
                    style={{ transformOrigin: '800px 450px' }}
                />
            </svg>

            {/* ── Logo lockup ───────────────────────────────────────── */}
            <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ gap: 28 }}>

                {/* Mark + Wordmark row */}
                <div className="flex items-center" style={{ gap: 22 }}>

                    {/* Animated mark — icon with two orbiting dots */}
                    <M.div
                        className="relative flex items-center justify-center"
                        style={{ width: 82, height: 82 }}
                        initial={{ opacity: 0, scale: 0.5, rotate: -15 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        transition={{ delay: 2.52, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                    >
                        {/* Icon bg */}
                        <M.div
                            className="absolute inset-0 rounded-3xl bg-(--mx-color-c6ff00)"
                            initial={{ boxShadow: '0 0 0px rgba(198,255,0,0)' }}
                            animate={{ boxShadow: ['0 0 0px rgba(198,255,0,0)', '0 0 100px rgba(198,255,0,0.75)', '0 0 55px rgba(198,255,0,0.48)'] }}
                            transition={{ delay: 2.75, duration: 1.0, times: [0, 0.4, 1] }}
                        />
                        <svg className="relative h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="black" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                        </svg>

                        {/* Orbiting dot 1 */}
                        <M.span
                            className="absolute rounded-full bg-(--mx-color-c6ff00)"
                            style={{ width: 7, height: 7, top: -4, right: -4 }}
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: [0, 1, 0.7], scale: [0, 1.4, 1] }}
                            transition={{ delay: 2.9, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        />
                        {/* Orbiting dot 2 */}
                        <M.span
                            className="absolute rounded-full bg-white/60"
                            style={{ width: 5, height: 5, bottom: -3, left: -3 }}
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: [0, 0.8, 0.5], scale: [0, 1.3, 1] }}
                            transition={{ delay: 3.05, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                        />
                    </M.div>

                    {/* Wordmark — per-character reveal */}
                    <div className="flex items-baseline" style={{ perspective: 600 }}>
                        {lifeSyncChars.map((char, i) => {
                            const isSync = i >= 4
                            return (
                                <M.span
                                    key={i}
                                    custom={i}
                                    variants={charVariants}
                                    initial="hidden"
                                    animate="show"
                                    className="inline-block text-[68px] font-black leading-none tracking-[-0.02em]"
                                    style={{
                                        color: isSync ? '#c6ff00' : '#ffffff',
                                        textShadow: isSync ? '0 0 40px rgba(198,255,0,0.5)' : 'none',
                                        display: 'inline-block',
                                    }}
                                >
                                    {char}
                                </M.span>
                            )
                        })}
                    </div>
                </div>

                {/* TV MODE tag — redesigned architectural badge */}
                <M.div
                    className="relative overflow-hidden"
                    initial={{ opacity: 0, scaleX: 0.4, y: 8 }}
                    animate={{ opacity: 1, scaleX: 1, y: 0 }}
                    transition={{ delay: 3.28, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                    style={{ transformOrigin: 'center' }}
                >
                    {/* Animated border sweep */}
                    <M.div
                        className="absolute inset-0 rounded-full"
                        style={{ border: '1px solid rgba(198,255,0,0.5)' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 3.3, duration: 0.3 }}
                    />
                    {/* Top border shine sweep */}
                    <M.div
                        className="pointer-events-none absolute inset-x-0 top-0 h-px"
                        style={{ background: 'linear-gradient(90deg, transparent 0%, #c6ff00 50%, transparent 100%)' }}
                        initial={{ scaleX: 0, opacity: 0 }}
                        animate={{ scaleX: 1, opacity: [0, 1, 0.5] }}
                        transition={{ delay: 3.32, duration: 0.5, ease: 'easeOut', opacity: { times: [0, 0.4, 1] } }}
                    />

                    <div
                        className="flex items-center rounded-full px-6 py-2.5"
                        style={{ background: 'rgba(198,255,0,0.07)', gap: 10 }}
                    >
                        {/* Live dot */}
                        <M.span
                            className="inline-block rounded-full"
                            style={{ width: 7, height: 7, background: '#c6ff00', boxShadow: '0 0 8px rgba(198,255,0,0.9)' }}
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: [0, 1, 0.8, 1], scale: [0, 1.5, 1] }}
                            transition={{ delay: 3.55, duration: 0.4, times: [0, 0.4, 0.7, 1] }}
                        />

                        {/* Per-character TV MODE */}
                        <div className="flex items-center" style={{ gap: 0 }}>
                            {tvModeChars.map((char, i) => (
                                <M.span
                                    key={i}
                                    custom={i}
                                    variants={tagCharVariants}
                                    initial="hidden"
                                    animate="show"
                                    className="inline-block font-black uppercase"
                                    style={{
                                        fontSize: 15,
                                        letterSpacing: char === ' ' ? '0.12em' : '0.3em',
                                        color: '#c6ff00',
                                        width: char === ' ' ? '0.5em' : 'auto',
                                    }}
                                >
                                    {char}
                                </M.span>
                            ))}
                        </div>
                    </div>
                </M.div>

                {/* Underline sweep */}
                <M.div
                    className="h-px rounded-full"
                    style={{ background: 'linear-gradient(90deg, transparent, #c6ff00 40%, rgba(198,255,0,0.4) 60%, transparent)', width: 340 }}
                    initial={{ scaleX: 0, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: [0, 1, 0] }}
                    transition={{ delay: 3.85, duration: 0.8, ease: 'easeInOut', opacity: { times: [0, 0.28, 1] } }}
                />
            </div>

            {/* ── Scanlines ─────────────────────────────────────────── */}
            <div
                className="pointer-events-none absolute inset-0 opacity-55"
                aria-hidden
                style={{
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.14) 3px, rgba(0,0,0,0.14) 4px)',
                }}
            />

            {/* ── White flash ───────────────────────────────────────── */}
            <M.div className="pointer-events-none absolute inset-0 bg-white" aria-hidden
                initial={{ opacity: 0 }} animate={{ opacity: [0, 0.24, 0] }}
                transition={{ delay: 1.85, duration: 0.3, times: [0, 0.2, 1] }}
            />

            {/* ── Lime afterglow ────────────────────────────────────── */}
            <M.div className="pointer-events-none absolute inset-0" aria-hidden
                style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(198,255,0,0.24) 0%, transparent 68%)' }}
                initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }}
                transition={{ delay: 1.9, duration: 0.85, times: [0, 0.2, 1] }}
            />

            {/* ── Fade to black ─────────────────────────────────────── */}
            <M.div className="pointer-events-none absolute inset-0 bg-black" aria-hidden
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 6.5, duration: 0.7 }}
            />

            {/* ── Skip ──────────────────────────────────────────────── */}
            <M.button
                type="button"
                onClick={skip}
                className="absolute bottom-8 right-8 rounded-full border px-4 py-1.5 text-[12px] font-bold tracking-wide text-white/40 transition-colors hover:text-white/70"
                style={{ borderColor: 'rgba(255,255,255,0.09)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.4 }}
            >
                Skip intro →
            </M.button>
        </M.div>
    )
}
