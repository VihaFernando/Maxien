import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion as Motion } from 'framer-motion'
import { FaBook, FaBookOpen, FaFilm, FaFire, FaHistory, FaHome, FaPowerOff } from 'react-icons/fa'
import { TVModeContext } from '../../context/TVModeContextObject'
import { useLifeSync } from '../../context/LifeSyncContext'
import { isLifeSyncHentaiHubVisible, isLifeSyncHManhwaVisible, isPluginEnabled, lifesyncFetch } from '../../lib/lifesyncApi'
import useLifeSyncGamepadInput from '../../hooks/useLifeSyncGamepadInput'
import useControllerSupportEnabled from '../../hooks/useControllerSupportEnabled'
import { XBOX_GAMEPAD_BUTTONS } from '../../lib/lifeSyncControllerInput'
import { useFocusedCardScroll } from '../../hooks/useFocusedCardScroll'
import { readStoredReduceAnimationsSetting } from '../../lib/lifeSyncReduceMotion'
import { setLifeSyncKeyboardGamepadActive, tvHintLabel } from '../../lib/lifeSyncKeyboardGamepad'
import useLifeSyncInputSource from '../../hooks/useLifeSyncInputSource'
import { useAnimeWatchHistory } from '../../hooks/useAnimeWatchHistory'
import { useMangaReadingList } from '../../hooks/useMangaReadingList'

import { clearTVHomeImagesCache, pickCollageImages, useTVHomeImages } from './tv/tvHomeImages'
import { TVImageCollage } from './tv/TVImageCollage'
import { TVIntroAnimation } from './tv/TVIntroAnimation'
import { TVExitConfirmPopup } from './tv/TVExitConfirmPopup'
import { TVDetailSheet } from './tv/TVDetailSheet'
import { TVFilterPanel } from './tv/TVFilterPanel'
import { TVMangaReader } from './tv/TVMangaReader'
import { TVAnimePlayer } from './tv/TVAnimePlayer'
import { TVHentaiPlayer } from './tv/TVHentaiPlayer'
import { TVAnimeSection } from './tv/sections/TVAnimeSection'
import { TVMangaSection } from './tv/sections/TVMangaSection'
import { TVHManhwaSection } from './tv/sections/TVHManhwaSection'
import { TVMangaDNASection } from './tv/sections/TVMangaDNASection'
import { TVHentaiSection } from './tv/sections/TVHentaiSection'
import { TVHistorySection } from './tv/sections/TVHistorySection'

const LOW_END = readStoredReduceAnimationsSetting() === true

// ─── spatial navigation helpers ──────────────────────────────────────────────

function colsInRow(itemCount, cols, row) {
    const start = row * cols
    return Math.min(cols, itemCount - start)
}

function maxRow(itemCount, cols) {
    if (itemCount <= 0) return 0
    return Math.ceil(itemCount / cols) - 1
}

function movePos(pos, dir, itemCount, cols) {
    if (itemCount <= 0) return pos
    let { row, col } = pos
    if (dir === 'right') {
        const rowCols = colsInRow(itemCount, cols, row)
        if (col < rowCols - 1) return { row, col: col + 1 }
        if (row < maxRow(itemCount, cols)) { row++; return { row, col: 0 } }
        return pos
    }
    if (dir === 'left') {
        if (col > 0) return { row, col: col - 1 }
        if (row > 0) { row--; return { row, col: colsInRow(itemCount, cols, row) - 1 } }
        return pos
    }
    if (dir === 'down') {
        const nextRow = row + 1
        if (nextRow > maxRow(itemCount, cols)) return pos
        return { row: nextRow, col: Math.min(col, colsInRow(itemCount, cols, nextRow) - 1) }
    }
    if (dir === 'up') {
        if (row === 0) return pos
        return { row: row - 1, col: Math.min(col, colsInRow(itemCount, cols, row - 1) - 1) }
    }
    return pos
}

// ─── tab bar ─────────────────────────────────────────────────────────────────

const TAB_ICONS = {
    home: FaHome,
    anime: FaFilm,
    manga: FaBookOpen,
    hmanhwa: FaBook,
    mangadna: FaBook,
    hentai: FaFire,
    history: FaHistory,
    exit: FaPowerOff,
}

/** Per-section accent used to tint home cards and tab glyphs. */
const TAB_ACCENTS = {
    anime: { text: 'text-sky-300', glow: 'rgba(56,189,248,0.20)', grad: 'from-sky-400/18 via-sky-400/4 to-transparent' },
    manga: { text: 'text-amber-300', glow: 'rgba(251,191,36,0.20)', grad: 'from-amber-400/18 via-amber-400/4 to-transparent' },
    hmanhwa: { text: 'text-rose-300', glow: 'rgba(251,113,133,0.20)', grad: 'from-rose-400/18 via-rose-400/4 to-transparent' },
    mangadna: { text: 'text-rose-300', glow: 'rgba(251,113,133,0.20)', grad: 'from-rose-400/18 via-rose-400/4 to-transparent' },
    hentai: { text: 'text-fuchsia-300', glow: 'rgba(232,121,249,0.20)', grad: 'from-fuchsia-400/18 via-fuchsia-400/4 to-transparent' },
    history: { text: 'text-violet-300', glow: 'rgba(167,139,250,0.20)', grad: 'from-violet-400/18 via-violet-400/4 to-transparent' },
}
const DEFAULT_ACCENT = { text: 'text-(--mx-color-c6ff00)', glow: 'rgba(198,255,0,0.18)', grad: 'from-(--mx-color-c6ff00)/15 via-transparent to-transparent' }

function TVKeycap({ children, accent = false }) {
    return (
        <span className={`flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[9px] font-black ${
            accent ? 'bg-(--mx-color-c6ff00) text-black' : 'bg-white/8 text-white/70 ring-1 ring-white/10'
        }`}>
            {children}
        </span>
    )
}

function TVClock({ compact = false }) {
    const [now, setNow] = useState(() => new Date())
    useEffect(() => {
        const tick = setInterval(() => setNow(new Date()), 30000)
        return () => clearInterval(tick)
    }, [])
    return (
        <span className={`font-black tabular-nums tracking-tight text-white/80 ${compact ? 'text-[12px]' : 'text-[15px]'}`}>
            {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </span>
    )
}

function TVTabBar({ tabs, activeIndex, compact = false }) {
    const inputSource = useLifeSyncInputSource()
    return (
        <div className={`relative z-10 flex shrink-0 items-center justify-between gap-4 border-b border-white/6 ${LOW_END ? 'bg-[#08080d]' : 'bg-[#0a0a10]/55 backdrop-blur-2xl'} ${compact ? 'px-4 py-1.5' : 'px-7 py-3'}`}>
            {/* Brand */}
            <div className="mr-6 flex shrink-0 items-center gap-2.5">
                <div className={`flex items-center justify-center rounded-xl bg-(--mx-color-c6ff00) shadow-[0_0_24px_rgba(198,255,0,0.35)] ${compact ? 'h-6 w-6' : 'h-8 w-8'}`}>
                    <svg className={compact ? 'h-3 w-3' : 'h-4 w-4'} fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="black" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                    </svg>
                </div>
                <span className={`font-black tracking-tight text-white ${compact ? 'text-[12px]' : 'text-[15px]'}`}>
                    LifeSync
                </span>
                <span className={`rounded-md bg-white/8 px-1.5 py-0.5 font-black uppercase tracking-[0.14em] text-white/55 ring-1 ring-white/10 ${compact ? 'text-[8px]' : 'text-[9px]'}`}>
                    TV
                </span>
            </div>

            {/* Tab pills with animated active indicator */}
            <div className={`flex flex-1 items-center rounded-full p-1 ${LOW_END ? 'bg-white/4' : 'bg-white/4 ring-1 ring-white/6'}`}>
                {tabs.map((tab, i) => {
                    const Icon = TAB_ICONS[tab.id]
                    const active = i === activeIndex
                    return (
                        <div
                            key={tab.id}
                            className={`relative flex items-center gap-2 rounded-full font-black transition-colors duration-200 ${compact ? 'px-3 py-1 text-[12px]' : 'px-4.5 py-1.5 text-[14px]'} ${
                                active
                                    ? tab.isExit ? 'text-white' : 'text-black'
                                    : tab.isExit ? 'text-white/30' : 'text-white/45'
                            }`}
                        >
                            {active && (
                                <Motion.span
                                    layoutId="tv-tab-active-pill"
                                    className={`absolute inset-0 rounded-full ${
                                        tab.isExit
                                            ? 'bg-red-500/85 shadow-[0_0_22px_rgba(239,68,68,0.45)]'
                                            : 'bg-(--mx-color-c6ff00) shadow-[0_0_22px_rgba(198,255,0,0.35)]'
                                    }`}
                                    transition={LOW_END ? { duration: 0 } : { type: 'spring', stiffness: 480, damping: 38 }}
                                    aria-hidden
                                />
                            )}
                            {Icon && <Icon className={`relative ${compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} ${active ? '' : 'opacity-60'}`} aria-hidden />}
                            <span className="relative">{tab.label}</span>
                        </div>
                    )
                })}
            </div>

            {/* Hints + clock */}
            <div className="ml-6 flex shrink-0 items-center gap-4 text-[10px] font-bold text-white/35">
                {!compact && (
                    <>
                        <div className="flex items-center gap-1.5">
                            <TVKeycap>{tvHintLabel('LB', inputSource)}</TVKeycap>
                            <TVKeycap>{tvHintLabel('RB', inputSource)}</TVKeycap>
                            <span>tabs</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <TVKeycap>{tvHintLabel('LT', inputSource)}</TVKeycap>
                            <TVKeycap>{tvHintLabel('RT', inputSource)}</TVKeycap>
                            <span>page</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <TVKeycap accent>{tvHintLabel('Y', inputSource)}</TVKeycap>
                            <span>filter</span>
                        </div>
                        <span className="h-4 w-px bg-white/10" aria-hidden />
                    </>
                )}
                <TVClock compact={compact} />
            </div>
        </div>
    )
}

function TVSectionHeading({ title, subtitle }) {
    return (
        <div className="mb-6 flex shrink-0 items-end justify-between gap-6">
            <div className="flex items-center gap-4">
                <span className="h-10 w-1.5 rounded-full bg-linear-to-b from-(--mx-color-c6ff00) to-(--mx-color-c6ff00)/10" aria-hidden />
                <h2 className="text-[34px] font-black leading-none tracking-tight text-white">{title}</h2>
            </div>
            {subtitle && (
                <p className="rounded-full bg-white/5 px-4 py-1.5 text-[12px] font-bold text-white/45 ring-1 ring-white/8">
                    {subtitle}
                </p>
            )}
        </div>
    )
}

function tvGreeting() {
    const hour = new Date().getHours()
    if (hour < 5) return 'Up late'
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
}

const HERO_ROTATE_MS = 14000

function TVHomeSection({ tabs, focusPos, onOpenTab }) {
    const inputSource = useLifeSyncInputSource()
    const { lifeSyncUser } = useLifeSync()
    const prefs = lifeSyncUser?.preferences

    const cards = useMemo(() => tabs.filter(tab => !tab.isHome && !tab.isExit), [tabs])
    const cardIds = useMemo(() => cards.map(card => card.id), [cards])

    // Pull user history to populate the history tile collage with real covers
    const { entries: animeEntries } = useAnimeWatchHistory({ enabled: true, limit: 30 })
    const { visibleEntries: mangaEntries } = useMangaReadingList({
        enabled: true,
        nsfwEnabled: Boolean(prefs?.nsfwContentEnabled),
        hManhwaEnabled: Boolean(prefs?.hmanhwaEnabled || prefs?.nsfwContentEnabled),
        filters: { sortBy: 'updatedAt', order: 'desc', limit: 30 },
    })
    const historyImages = useMemo(() => {
        const urls = [
            ...(Array.isArray(animeEntries) ? animeEntries : []).map(e => e?.imageUrl || e?.posterUrl),
            ...(Array.isArray(mangaEntries) ? mangaEntries : []).map(e => e?.coverUrl || e?.cover),
        ]
        return urls.filter(url => typeof url === 'string' && /^https?:\/\//.test(url))
    }, [animeEntries, mangaEntries])

    const homeImages = useTVHomeImages(cardIds, historyImages)

    // Fresh seed per TV session so every visit deals a different hand of covers
    const [sessionSeed] = useState(() => Math.floor(Math.random() * 0xffffffff))
    const [heroTick, setHeroTick] = useState(0)
    const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

    // Slowly cycle the hero collage through the focused tab's pool
    useEffect(() => {
        if (LOW_END) return
        const timer = setInterval(() => setHeroTick(tick => tick + 1), HERO_ROTATE_MS)
        return () => clearInterval(timer)
    }, [])

    // Which card is focused (or default to 0)
    const focusedIndex = Math.max(0, Math.min(focusPos.row, cards.length - 1))
    const focusedCard = cards[focusedIndex]
    const focusedAccent = focusedCard ? (TAB_ACCENTS[focusedCard.id] || DEFAULT_ACCENT) : DEFAULT_ACCENT
    const heroSeed = `${sessionSeed}-${focusedIndex}-${heroTick}`
    const heroCollageImages = useMemo(
        () => focusedCard ? pickCollageImages(homeImages, focusedCard.id, heroSeed, 12) : [],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [homeImages, focusedCard?.id, heroTick, sessionSeed, focusedIndex],
    )

    return (
        <div className="flex h-full gap-6" style={{ minHeight: 'calc(100vh - 200px)' }}>
            {/* ── LEFT: Spotlight panel ──────────────────────────────────── */}
            <div className="relative flex-1 overflow-hidden rounded-[28px]">
                <AnimatePresence mode="crossfade">
                    {!LOW_END && focusedCard && (
                        <Motion.div
                            key={`hero-${focusedCard.id}-${heroTick}`}
                            className="absolute inset-0"
                            initial={{ opacity: 0, scale: 1.04 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <TVImageCollage images={heroCollageImages} seed={heroSeed} />
                        </Motion.div>
                    )}
                </AnimatePresence>

                {/* Multi-stop gradient scrim */}
                <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-black/10" aria-hidden />
                <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-black/30 to-transparent" aria-hidden />

                {/* Accent colour glow at bottom */}
                {!LOW_END && (
                    <Motion.div
                        key={`glow-${focusedCard?.id}`}
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-64 blur-3xl"
                        style={{ background: `radial-gradient(ellipse at 50% 100%, ${focusedAccent.glow} 0%, transparent 70%)` }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        aria-hidden
                    />
                )}

                {/* Content */}
                <div className="absolute inset-0 flex flex-col justify-between p-10">
                    {/* Top: greeting + date */}
                    <div className="flex items-start justify-between">
                        <p className="flex items-center gap-3 text-[13px] font-black uppercase tracking-[0.26em] text-(--mx-color-c6ff00)">
                            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-(--mx-color-c6ff00)" aria-hidden />
                            {tvGreeting()}
                        </p>
                        <p className="rounded-full bg-black/30 px-4 py-1.5 text-[12px] font-bold text-white/50 ring-1 ring-white/10 backdrop-blur-sm">
                            {dateLabel}
                        </p>
                    </div>

                    {/* Bottom: title + cta */}
                    <div>
                        <AnimatePresence mode="wait">
                            <Motion.div
                                key={`label-${focusedCard?.id}`}
                                initial={{ opacity: 0, y: 14 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            >
                                {focusedCard && (() => {
                                    const Icon = TAB_ICONS[focusedCard.id]
                                    const accent = TAB_ACCENTS[focusedCard.id] || DEFAULT_ACCENT
                                    return (
                                        <>
                                            <div className={`mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] ring-1 ring-white/15 backdrop-blur-sm ${accent.text}`}
                                                style={{ background: 'rgba(0,0,0,0.35)' }}>
                                                {Icon && <Icon className="h-3 w-3" aria-hidden />}
                                                {focusedCard.label}
                                            </div>
                                            <h1 className="text-[62px] font-black leading-[0.92] tracking-tight text-white drop-shadow-2xl">
                                                What are we
                                                <br />
                                                <span className={`bg-clip-text text-transparent bg-linear-to-r from-(--mx-color-c6ff00) to-lime-200`}>
                                                    watching tonight?
                                                </span>
                                            </h1>
                                            <div className="mt-6 flex items-center gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenTab(focusedCard.id)}
                                                    className={`flex items-center gap-2.5 rounded-full bg-(--mx-color-c6ff00) px-6 py-2.5 text-[14px] font-black text-black shadow-[0_0_28px_rgba(198,255,0,0.4)] transition-transform active:scale-95`}
                                                >
                                                    <TVKeycap accent>{tvHintLabel('A', inputSource)}</TVKeycap>
                                                    Open {focusedCard.label}
                                                </button>
                                                <div className="flex items-center gap-3 text-[12px] font-bold text-white/45">
                                                    <span className="flex items-center gap-1.5"><TVKeycap>{tvHintLabel('✛', inputSource)}</TVKeycap> navigate</span>
                                                    <span className="flex items-center gap-1.5"><TVKeycap>{tvHintLabel('B', inputSource)}</TVKeycap> back</span>
                                                </div>
                                            </div>
                                        </>
                                    )
                                })()}
                            </Motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* ── RIGHT: Category tiles ──────────────────────────────────── */}
            <div className="flex w-[340px] shrink-0 flex-col gap-3">
                {cards.map((tab, index) => {
                    const focused = focusPos.row === index && focusPos.col === 0
                    const accent = TAB_ACCENTS[tab.id] || DEFAULT_ACCENT
                    const Icon = TAB_ICONS[tab.id]
                    const tileBgImg = pickCollageImages(homeImages, tab.id, `${sessionSeed}-tile-${index}`, 1)[0]
                    return (
                        <Motion.div
                            key={tab.id}
                            animate={focused
                                ? { scale: 1.03, x: -6, transition: { type: 'spring', stiffness: 420, damping: 28 } }
                                : { scale: 1, x: 0, transition: { type: 'spring', stiffness: 420, damping: 28 } }
                            }
                            className="flex-1"
                        >
                            <button
                                type="button"
                                data-focused-card={focused ? 'true' : undefined}
                                onClick={() => onOpenTab(tab.id)}
                                className={`group relative flex h-full w-full items-center gap-4 overflow-hidden rounded-2xl border p-5 text-left transition-all duration-200 ${
                                    focused
                                        ? 'border-(--mx-color-c6ff00)/60'
                                        : 'border-white/6 hover:border-white/12'
                                }`}
                                style={focused && !LOW_END
                                    ? { boxShadow: `0 0 0 3px rgba(198,255,0,0.16), 0 0 40px ${accent.glow}` }
                                    : { background: 'rgba(255,255,255,0.03)' }
                                }
                            >
                                {/* BG image */}
                                {!LOW_END && tileBgImg && (
                                    <img
                                        src={tileBgImg}
                                        alt=""
                                        className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-all duration-500 ${focused ? 'opacity-30 scale-105' : 'opacity-12'}`}
                                    />
                                )}
                                {/* Scrim */}
                                <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-black/80 via-black/50 to-black/20" aria-hidden />
                                {/* Accent tint */}
                                <div className={`pointer-events-none absolute inset-0 bg-linear-to-br ${accent.grad} transition-opacity duration-200 ${focused ? 'opacity-100' : 'opacity-40'}`} aria-hidden />

                                {/* Icon badge */}
                                <div className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ring-white/10 transition-all duration-200 ${
                                    focused ? `bg-white/15 ${accent.text}` : 'bg-white/6 text-white/50'
                                }`}>
                                    {Icon ? <Icon className="h-5 w-5" aria-hidden /> : <span className="text-[16px] font-black">{index + 1}</span>}
                                </div>

                                {/* Text */}
                                <div className="relative z-10 flex-1 overflow-hidden">
                                    <p className={`text-[11px] font-black uppercase tracking-[0.22em] transition-colors ${focused ? 'text-(--mx-color-c6ff00)' : 'text-white/30'}`}>
                                        0{index + 1}
                                    </p>
                                    <h3 className="text-[20px] font-black leading-tight tracking-tight text-white">{tab.label}</h3>
                                </div>

                                {/* Arrow indicator */}
                                <Motion.div
                                    className="relative z-10 shrink-0"
                                    animate={focused ? { x: 0, opacity: 1 } : { x: -4, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <svg className="h-5 w-5 text-(--mx-color-c6ff00)" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                </Motion.div>

                                {/* Focus bar */}
                                <div className={`pointer-events-none absolute bottom-0 left-0 h-[3px] bg-(--mx-color-c6ff00) transition-all duration-300 rounded-full ${focused ? 'w-full opacity-100' : 'w-0 opacity-0'}`} aria-hidden />
                            </button>
                        </Motion.div>
                    )
                })}
            </div>
        </div>
    )
}

function TVNumberPrompt({ title, value, onValueChange, onConfirm, onCancel }) {
    const controllerEnabled = useControllerSupportEnabled()
    const inputSource = useLifeSyncInputSource()
    const inputRef = useRef(null)

    useEffect(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
    }, [])

    const handlers = useMemo(() => ({
        [XBOX_GAMEPAD_BUTTONS.A]: () => onConfirm(),
        [XBOX_GAMEPAD_BUTTONS.B]: () => onCancel(),
        [XBOX_GAMEPAD_BUTTONS.X]: () => onCancel(),
    }), [onCancel, onConfirm])

    useLifeSyncGamepadInput({ enabled: controllerEnabled, handlers })

    return (
        <div className={`absolute inset-0 z-40 flex items-center justify-center bg-black/70 ${LOW_END ? '' : 'backdrop-blur-md'}`}>
            <div className="w-105 overflow-hidden rounded-[28px] bg-linear-to-b from-[#14141c] to-[#0c0c12] p-6 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--mx-color-c6ff00)/60 to-transparent" aria-hidden />
                <h3 className="text-[24px] font-black tracking-tight text-white">{title}</h3>
                <input
                    ref={inputRef}
                    type="number"
                    min="1"
                    value={value}
                    onChange={event => onValueChange(event.target.value)}
                    onKeyDown={event => {
                        if (event.key === 'Enter') onConfirm()
                        if (event.key === 'Escape') onCancel()
                    }}
                    className="mt-5 w-full rounded-2xl border border-white/12 bg-black/40 px-5 py-4 text-center text-[34px] font-black tabular-nums text-white outline-none transition focus:border-(--mx-color-c6ff00) focus:shadow-[0_0_0_4px_rgba(198,255,0,0.15)]"
                />
                <div className="mt-5 flex gap-3">
                    <button type="button" onClick={onConfirm} className="min-h-12 flex-1 rounded-2xl bg-(--mx-color-c6ff00) text-[16px] font-black text-black shadow-[0_8px_24px_-8px_rgba(198,255,0,0.5)] transition hover:brightness-105">Go</button>
                    <button type="button" onClick={onCancel} className="min-h-12 rounded-2xl bg-white/8 px-6 text-[16px] font-bold text-white/60 ring-1 ring-white/10 transition hover:bg-white/12">Cancel</button>
                </div>
                <p className="mt-4 flex items-center justify-center gap-2 text-[11px] font-bold text-white/30">
                    <TVKeycap accent>{tvHintLabel('A', inputSource)}</TVKeycap> confirm <TVKeycap>{tvHintLabel('B', inputSource)}</TVKeycap> close
                </p>
            </div>
        </div>
    )
}

// ─── main inner component ─────────────────────────────────────────────────────

function LifeSyncTVModeInner({ onExit }) {
    const { lifeSyncUser } = useLifeSync()
    const prefs = lifeSyncUser?.preferences
    const controllerEnabled = useControllerSupportEnabled()
    const shellInputSource = useLifeSyncInputSource()
    const ctx = useContext(TVModeContext)
    const { markIntroPlayed } = ctx || {}

    const animePluginOn = isPluginEnabled(prefs, 'pluginAnimeEnabled')
    const mangaPluginOn = isPluginEnabled(prefs, 'pluginMangaEnabled')
    const hManhwaVisible = isLifeSyncHManhwaVisible(prefs)
    const hentaiVisible = isLifeSyncHentaiHubVisible(prefs)

    const tabs = useMemo(() => {
        const t = [{ id: 'home', label: 'Home', isHome: true }]
        if (animePluginOn) t.push({ id: 'anime', label: 'Anime' })
        if (mangaPluginOn) t.push({ id: 'manga', label: 'Manga' })
        if (hManhwaVisible) t.push({ id: 'hmanhwa', label: 'H Manhwa' })
        if (hManhwaVisible) t.push({ id: 'mangadna', label: 'MangaDNA' })
        if (hentaiVisible) t.push({ id: 'hentai', label: 'Hentai' })
        t.push({ id: 'history', label: 'History' })
        t.push({ id: 'exit', label: 'Exit', isExit: true })
        return t
    }, [animePluginOn, mangaPluginOn, hManhwaVisible, hentaiVisible])

    const [activeTabIdx, setActiveTabIdx] = useState(0)
    const [focusPos, setFocusPos] = useState({ row: 0, col: 0 })
    const [detailItem, setDetailItem] = useState(null)
    const [filterOpen, setFilterOpen] = useState(false)
    // filterPanel holds the current section's filter data, set by onRegisterFilter
    const [filterPanel, setFilterPanel] = useState(null) // { title, filterConfig, filters, onFilterChange }
    const [exitConfirmOpen, setExitConfirmOpen] = useState(false)
    const [playerState, setPlayerState] = useState(null)
    const [pageByTab, setPageByTab] = useState({})
    const [pageJumpOpen, setPageJumpOpen] = useState(false)
    const [pageJumpValue, setPageJumpValue] = useState('')
    const [focusedItem, setFocusedItem] = useState(null)
    const [showIntro, setShowIntro] = useState(() => Boolean(ctx?.playIntroRef?.current))
    const [mangaReaderBackBlocked, setMangaReaderBackBlocked] = useState(false)
    const lastStartPressRef = useRef(0)
    const lastAPressRef = useRef(0)
    const lastPagePressRef = useRef(0)
    const inputBlockUntilRef = useRef(0)

    const activeTab = tabs[activeTabIdx]
    const currentPage = pageByTab[activeTab?.id] || 1
    const setCurrentPage = useCallback((updaterOrVal) => {
        setPageByTab(prev => {
            const next = typeof updaterOrVal === 'function' ? updaterOrVal(prev[activeTab?.id] || 1) : updaterOrVal
            return { ...prev, [activeTab?.id]: Math.max(1, next) }
        })
    }, [activeTab?.id])

    const SECTION_COLS = { anime: 5, manga: 5, hmanhwa: 5, mangadna: 5, hentai: 5, history: 5, exit: 1 }
    SECTION_COLS.home = 1
    const cols = SECTION_COLS[activeTab?.id] || 5

    const flatIndex = (detailItem || filterOpen) ? -1 : (focusPos.row * cols + focusPos.col)
    useFocusedCardScroll(flatIndex)

    // Reset per-section state when the active tab changes.
    // Using a ref + synchronous guard avoids setState-in-effect lint errors while
    // still resetting focus/detail/filter immediately on the same render cycle.
    const prevTabIdRef = useRef(activeTab?.id)
    if (prevTabIdRef.current !== activeTab?.id) {
        prevTabIdRef.current = activeTab?.id
        // These are synchronous during render — safe because we're inside a conditional
        // that only runs when activeTabIdx actually changes (same as getDerivedStateFromProps).
        if (focusPos.row !== 0 || focusPos.col !== 0) setFocusPos({ row: 0, col: 0 })
        if (detailItem !== null) setDetailItem(null)
        if (focusedItem !== null) setFocusedItem(null)
        if (filterOpen) setFilterOpen(false)
    }

    // Exit confirmation is shown whenever the exit tab is active OR was opened via B/START.
    const isOnExitTab = activeTab?.id === 'exit'
    const showExitConfirm = exitConfirmOpen || isOnExitTab

    const blocked = detailItem || filterOpen || playerState || showExitConfirm || pageJumpOpen
    const canPageJump = ['anime', 'manga', 'hmanhwa', 'mangadna', 'hentai'].includes(activeTab?.id)

    if (ctx?.playIntroRef?.current && !showIntro) {
        setShowIntro(true)
    }

    useEffect(() => {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
        inputBlockUntilRef.current = now + 600
    }, [])

    // Keyboard-as-controller is active for the whole TV mode session, so every
    // gamepad handler (shell, detail sheet, filters, players) also accepts
    // WASD/arrows, Q/E (LB/RB), N/M (LT/RT), Space (X), Tab (Y), Enter (A), Backspace (B).
    useEffect(() => {
        setLifeSyncKeyboardGamepadActive(true)
        return () => {
            setLifeSyncKeyboardGamepadActive(false)
            clearTVHomeImagesCache()
        }
    }, [])

    if (mangaReaderBackBlocked && playerState?.type !== 'manga') {
        setMangaReaderBackBlocked(false)
    }

    const openTabById = useCallback((tabId) => {
        const idx = tabs.findIndex(tab => tab.id === tabId)
        if (idx >= 0) setActiveTabIdx(idx)
    }, [tabs])

    const setHistoryFocusedStatus = useCallback(async () => {
        if (activeTab?.id !== 'history' || !focusedItem) return
        const options = focusedItem.type === 'manga'
            ? 'reading, on_hold, completed, dropped, plan_to_read, re_reading'
            : 'watching, completed, dropped'
        const nextStatus = window.prompt(`Set ${focusedItem.type} status (${options}). Leave empty to clear:`)
        if (nextStatus == null) return
        const status = nextStatus.trim()
        try {
            if (focusedItem.type === 'manga' && focusedItem.source && focusedItem.mangaId) {
                await lifesyncFetch('/api/v1/progress', {
                    method: 'POST',
                    json: {
                        bookId: `${focusedItem.source}:${focusedItem.mangaId}`,
                        source: focusedItem.source,
                        mangaId: focusedItem.mangaId,
                        progressPct: 0,
                        locator: { chapterId: focusedItem.lastChapterId || focusedItem.chapterId || '' },
                        updatedAt: new Date().toISOString(),
                        status: { readingStatus: status || null },
                    },
                })
            } else if (focusedItem.type === 'anime' && focusedItem.slug) {
                await lifesyncFetch(`/api/v1/anime/watch-progress/${encodeURIComponent(focusedItem.slug)}`, {
                    method: 'PATCH',
                    json: { status: status || null },
                }).catch(() => lifesyncFetch('/api/v1/anime/watch-progress', {
                    method: 'POST',
                    json: { animeId: focusedItem.slug, status: status || null },
                }))
            }
        } catch { /* best effort */ }
    }, [activeTab?.id, focusedItem])

    const handlers = useMemo(() => ({
        [XBOX_GAMEPAD_BUTTONS.LB]: () => {
            if (blocked) return
            setActiveTabIdx(prev => Math.max(0, prev - 1))
        },
        [XBOX_GAMEPAD_BUTTONS.RB]: () => {
            if (blocked) return
            setActiveTabIdx(prev => Math.min(tabs.length - 1, prev + 1))
        },
        [XBOX_GAMEPAD_BUTTONS.LT]: () => {
            if (blocked) return
            const now = Date.now()
            if (now - lastPagePressRef.current < 360) return
            lastPagePressRef.current = now
            setCurrentPage(p => Math.max(1, p - 1))
            setFocusPos({ row: 0, col: 0 })
        },
        [XBOX_GAMEPAD_BUTTONS.RT]: () => {
            if (blocked) return
            const now = Date.now()
            if (now - lastPagePressRef.current < 360) return
            lastPagePressRef.current = now
            setCurrentPage(p => p + 1)
            setFocusPos({ row: 0, col: 0 })
        },
        [XBOX_GAMEPAD_BUTTONS.DPAD_LEFT]: () => {
            if (blocked) return
            setFocusPos(pos => movePos(pos, 'left', 999, cols))
        },
        [XBOX_GAMEPAD_BUTTONS.DPAD_RIGHT]: () => {
            if (blocked) return
            setFocusPos(pos => movePos(pos, 'right', 999, cols))
        },
        [XBOX_GAMEPAD_BUTTONS.DPAD_UP]: () => {
            if (blocked) return
            setFocusPos(pos => movePos(pos, 'up', 999, cols))
        },
        [XBOX_GAMEPAD_BUTTONS.DPAD_DOWN]: () => {
            if (blocked) return
            setFocusPos(pos => movePos(pos, 'down', 999, cols))
        },
        [XBOX_GAMEPAD_BUTTONS.A]: () => {
            if (blocked) return
            const now = Date.now()
            if (now - lastAPressRef.current < 360) return
            lastAPressRef.current = now
            if (activeTab?.id === 'home') {
                const homeTabs = tabs.filter(tab => !tab.isHome && !tab.isExit)
                const target = homeTabs[focusPos.row]
                if (target) setActiveTabIdx(tabs.findIndex(tab => tab.id === target.id))
                return
            }
            if (focusedItem) setDetailItem(focusedItem)
        },
        [XBOX_GAMEPAD_BUTTONS.Y]: () => {
            if (detailItem || playerState || showExitConfirm || filterOpen || !filterPanel?.filterConfig?.length) return
            setFilterOpen(true)
        },
        [XBOX_GAMEPAD_BUTTONS.X]: () => {
            if (blocked) return
            if (activeTab?.id === 'history') {
                void setHistoryFocusedStatus()
                return
            }
            if (!canPageJump) return
            setPageJumpValue(String(currentPage))
            setPageJumpOpen(true)
        },
        [XBOX_GAMEPAD_BUTTONS.B]: () => {
            if (playerState?.type === 'manga' && mangaReaderBackBlocked) return
            if (pageJumpOpen) { setPageJumpOpen(false); return }
            if (playerState) { setPlayerState(null); return }
            if (detailItem) { setDetailItem(null); return }
            if (filterOpen) { setFilterOpen(false); return }
            if (showExitConfirm) { setExitConfirmOpen(false); setActiveTabIdx(tabs.length - 2); return }
            setActiveTabIdx(tabs.length - 1)
        },
        [XBOX_GAMEPAD_BUTTONS.START]: () => {
            const nowPerf = typeof performance !== 'undefined' ? performance.now() : Date.now()
            if (nowPerf < inputBlockUntilRef.current) return
            const now = Date.now()
            if (now - lastStartPressRef.current < 1000) return
            lastStartPressRef.current = now
            if (pageJumpOpen) { setPageJumpOpen(false); return }
            if (playerState) { setPlayerState(null); return }
            if (detailItem) { setDetailItem(null); return }
            if (filterOpen) { setFilterOpen(false); return }
            setActiveTabIdx(tabs.length - 1)
        },
    }), [activeTab?.id, blocked, canPageJump, cols, currentPage, detailItem, filterOpen, filterPanel?.filterConfig?.length, focusedItem, focusPos.row, mangaReaderBackBlocked, pageJumpOpen, playerState, setCurrentPage, setHistoryFocusedStatus, showExitConfirm, tabs])

    const confirmPageJump = useCallback(() => {
        const next = Number.parseInt(pageJumpValue, 10)
        if (Number.isFinite(next) && next > 0) {
            setCurrentPage(next)
            setFocusPos({ row: 0, col: 0 })
        }
        setPageJumpOpen(false)
    }, [pageJumpValue, setCurrentPage])

    useLifeSyncGamepadInput({
        enabled: controllerEnabled && !showIntro,
        handlers,
        repeatableButtons: [
            XBOX_GAMEPAD_BUTTONS.DPAD_LEFT, XBOX_GAMEPAD_BUTTONS.DPAD_RIGHT,
            XBOX_GAMEPAD_BUTTONS.DPAD_UP, XBOX_GAMEPAD_BUTTONS.DPAD_DOWN,
        ],
    })

    const handleIntroComplete = useCallback(() => {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
        inputBlockUntilRef.current = now + 600
        setShowIntro(false)
        markIntroPlayed?.()
    }, [markIntroPlayed])

    const handleRegisterFilter = useCallback((data) => {
        setFilterPanel(data)
    }, [])

    const sectionCommonProps = useMemo(() => ({
        focusPos,
        onItemSelect: setDetailItem,
        enabled: true,
        filterOpen,
        onRegisterFilter: handleRegisterFilter,
        onFocusedItemChange: setFocusedItem,
        page: currentPage,
        onPageChange: setCurrentPage,
    }), [currentPage, filterOpen, focusPos, handleRegisterFilter, setCurrentPage])

    const pageSubtitle = activeTab?.id === 'home'
        ? 'Choose a destination'
        : activeTab?.id !== 'history' && activeTab?.id !== 'exit'
        ? `Page ${currentPage} · ${tvHintLabel('LT/RT', shellInputSource)} to change`
        : activeTab?.id === 'history' ? 'Your watch & reading history' : null

    return (
        <div className="fixed inset-0 z-9999 flex h-dvh w-full flex-col overflow-hidden bg-[#07070b] text-white" style={{ cursor: 'none' }}>
            {/* Ambient scene — omitted on low-end devices to avoid GPU compositing */}
            {!LOW_END && (
                <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
                    <div className="absolute -left-40 -top-20 h-125 w-125 rounded-full bg-(--mx-color-c6ff00)/5 blur-[200px]" />
                    <div className="absolute right-0 bottom-0 h-100 w-100 rounded-full bg-indigo-500/6 blur-[180px]" />
                    <div className="absolute left-1/2 top-1/3 h-80 w-160 -translate-x-1/2 rounded-full bg-sky-500/4 blur-[160px]" />
                    {/* Vignette keeps edges cinematic and focus on the grid */}
                    <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_40%,transparent_55%,rgba(0,0,0,0.5)_100%)]" />
                </div>
            )}

            {/* Intro */}
            <AnimatePresence>
                {showIntro && <TVIntroAnimation key="intro" onComplete={handleIntroComplete} />}
            </AnimatePresence>

            {/* Tab bar */}
            {!playerState && <TVTabBar tabs={tabs} activeIndex={activeTabIdx} />}

            {/* Content */}
            <div className="relative min-h-0 flex-1 overflow-hidden">
                <div className={`h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${activeTab?.id === 'home' ? 'p-5' : 'px-8 py-6'}`}>
                    {activeTab?.id !== 'exit' && activeTab?.id !== 'home' && (
                        <TVSectionHeading
                            title={activeTab?.label || ''}
                            subtitle={pageSubtitle}
                        />
                    )}

                    <AnimatePresence mode="wait">
                        <Motion.div
                            key={activeTab?.id}
                            className={activeTab?.id === 'home' ? 'h-full' : undefined}
                            initial={{ opacity: 0, x: 40 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -40 }}
                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        >
                            {activeTab?.id === 'home' && <TVHomeSection tabs={tabs} focusPos={focusPos} onOpenTab={openTabById} />}
                            {activeTab?.id === 'anime' && <TVAnimeSection {...sectionCommonProps} />}
                            {activeTab?.id === 'manga' && <TVMangaSection {...sectionCommonProps} />}
                            {activeTab?.id === 'hmanhwa' && <TVHManhwaSection {...sectionCommonProps} />}
                            {activeTab?.id === 'mangadna' && <TVMangaDNASection {...sectionCommonProps} />}
                            {activeTab?.id === 'hentai' && <TVHentaiSection {...sectionCommonProps} />}
                            {activeTab?.id === 'history' && <TVHistorySection {...sectionCommonProps} />}
                            {activeTab?.id === 'exit' && (
                                <div className="flex min-h-[60vh] items-center justify-center">
                                    <p className="text-[17px] text-white/25">Opening exit menu…</p>
                                </div>
                            )}
                        </Motion.div>
                    </AnimatePresence>
                </div>

                {/* Filter panel — rendered at TVMode level so AnimatePresence is stable */}
                <AnimatePresence>
                    {filterOpen && filterPanel && (
                        <TVFilterPanel
                            key="tv-filter-panel"
                            title={filterPanel.title}
                            filterConfig={filterPanel.filterConfig}
                            filters={filterPanel.filters}
                            onFilterChange={filterPanel.onFilterChange}
                            onClose={() => setFilterOpen(false)}
                        />
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {pageJumpOpen && (
                        <TVNumberPrompt
                            title="Go to page"
                            value={pageJumpValue}
                            onValueChange={setPageJumpValue}
                            onConfirm={confirmPageJump}
                            onCancel={() => setPageJumpOpen(false)}
                        />
                    )}
                </AnimatePresence>

                {/* Detail sheet */}
                <AnimatePresence>
                    {detailItem && (
                        <TVDetailSheet
                            key={`detail-${detailItem.slug || detailItem.mangaId || detailItem.title}`}
                            item={detailItem}
                            onClose={() => setDetailItem(null)}
                            onOpenPlayer={(props) => { setPlayerState(props); setDetailItem(null) }}
                        />
                    )}
                </AnimatePresence>

                {/* Exit confirmation */}
                <AnimatePresence>
                    {showExitConfirm && (
                        <TVExitConfirmPopup
                            onConfirm={onExit}
                            onCancel={() => {
                                setExitConfirmOpen(false)
                                setActiveTabIdx(prev => Math.max(0, prev - 1))
                            }}
                        />
                    )}
                </AnimatePresence>

                {/* Players/readers — full overlay */}
                <AnimatePresence>
                    {playerState?.type === 'manga' && (
                        <TVMangaReader
                            key="manga-reader"
                            mangaId={playerState.mangaId}
                            chapterId={playerState.chapterId}
                            source={playerState.source}
                            allChapters={playerState.allChapters || []}
                            onChapterPickerToggle={setMangaReaderBackBlocked}
                            onBack={() => setPlayerState(null)}
                        />
                    )}
                    {playerState?.type === 'anime' && (
                        <TVAnimePlayer
                            key="anime-player"
                            animeId={playerState.animeId}
                            episodes={playerState.episodes || []}
                            initialEpisodeIndex={playerState.initialEpisodeIndex || 0}
                            onBack={() => setPlayerState(null)}
                        />
                    )}
                    {playerState?.type === 'hentai' && (
                        <TVHentaiPlayer
                            key="hentai-player"
                            series={playerState.series}
                            initialEpisodeIndex={playerState.initialEpisodeIndex || 0}
                            onBack={() => setPlayerState(null)}
                        />
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}

export function TVModePortal({ onExit }) {
    return createPortal(
        <LifeSyncTVModeInner onExit={onExit} />,
        document.body,
    )
}
