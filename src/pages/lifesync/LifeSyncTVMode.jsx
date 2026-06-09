import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion as Motion } from 'framer-motion'
import { TVModeContext } from '../../context/TVModeContextObject'
import { useLifeSync } from '../../context/LifeSyncContext'
import { isLifeSyncHentaiHubVisible, isLifeSyncHManhwaVisible, isPluginEnabled, lifesyncFetch } from '../../lib/lifesyncApi'
import useLifeSyncGamepadInput from '../../hooks/useLifeSyncGamepadInput'
import useControllerSupportEnabled from '../../hooks/useControllerSupportEnabled'
import { XBOX_GAMEPAD_BUTTONS } from '../../lib/lifeSyncControllerInput'
import { useFocusedCardScroll } from '../../hooks/useFocusedCardScroll'
import { readStoredReduceAnimationsSetting } from '../../lib/lifeSyncReduceMotion'

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

function TVTabBar({ tabs, activeIndex, compact = false }) {
    return (
        <div className={`shrink-0 flex items-center justify-between border-b border-white/8 ${LOW_END ? 'bg-black' : 'bg-black/60 backdrop-blur-xl'} ${compact ? 'px-4 py-1.5' : 'px-6 py-3'}`}>
            <div className="flex items-center gap-2.5 mr-8">
                <div className={`flex items-center justify-center rounded-xl bg-(--mx-color-c6ff00) ${compact ? 'h-6 w-6' : 'h-8 w-8'}`}>
                    <svg className={compact ? 'h-3 w-3' : 'h-4 w-4'} fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="black" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                    </svg>
                </div>
                <span className={`font-black text-white ${compact ? 'text-[12px]' : 'text-[15px]'}`}>LifeSync TV</span>
            </div>

            <div className="flex items-center gap-1 flex-1">
                {tabs.map((tab, i) => (
                    <div
                        key={tab.id}
                        className={`relative rounded-xl font-black transition-all ${compact ? 'px-3 py-1 text-[12px]' : 'px-5 py-2 text-[15px]'} ${
                            i === activeIndex
                                ? 'bg-(--mx-color-c6ff00) text-black'
                                : tab.isExit
                                    ? 'text-white/35'
                                    : 'text-white/50'
                        }`}
                    >
                        {tab.label}
                        {tab.isExit && i !== activeIndex && <span className="ml-1 text-[11px] opacity-50">⏻</span>}
                    </div>
                ))}
            </div>

            <div className="ml-6 flex items-center gap-3 text-[11px] text-white/30">
                <div className="flex items-center gap-1">
                    <span className="rounded bg-white/10 px-1.5 py-0.5 font-black text-[10px]">LB</span>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 font-black text-[10px]">RB</span>
                    <span>tabs</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="rounded bg-white/10 px-1.5 py-0.5 font-black text-[10px]">LT</span>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 font-black text-[10px]">RT</span>
                    <span>page</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="rounded bg-(--mx-color-c6ff00)/80 px-1.5 py-0.5 font-black text-[10px] text-black">Y</span>
                    <span>filter</span>
                </div>
            </div>
        </div>
    )
}

function TVSectionHeading({ title, subtitle }) {
    return (
        <div className="mb-6 shrink-0">
            <h2 className="text-[32px] font-black leading-none tracking-tight text-white">{title}</h2>
            {subtitle && <p className="mt-1 text-[14px] text-white/40">{subtitle}</p>}
        </div>
    )
}

function TVHomeSection({ tabs, focusPos, onOpenTab }) {
    const cards = tabs.filter(tab => !tab.isHome && !tab.isExit)
    return (
        <div className="space-y-8">
            <div className="relative overflow-hidden rounded-4xl border border-white/10 bg-white/4 p-8">
                <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-(--mx-color-c6ff00)/10 blur-3xl" />
                <p className="text-[13px] font-black uppercase tracking-[0.28em] text-(--mx-color-c6ff00)">Controller Ready</p>
                <h1 className="mt-3 max-w-3xl text-[54px] font-black leading-[0.95] tracking-tight text-white">
                    Pick a section and browse from the couch.
                </h1>
                <p className="mt-4 max-w-2xl text-[17px] font-semibold leading-relaxed text-white/45">
                    Use D-pad to move, A to open, Y for filters, X for page jump, and B to go back.
                </p>
            </div>

            <div className="grid grid-cols-5 gap-5">
                {cards.map((tab, index) => {
                    const focused = focusPos.row === 0 && focusPos.col === index
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            data-focused-card={focused ? 'true' : undefined}
                            onClick={() => onOpenTab(tab.id)}
                                className={`group relative min-h-52.5 overflow-hidden rounded-3xl border p-5 text-left transition-all ${
                                focused
                                    ? 'scale-[1.04] border-(--mx-color-c6ff00) bg-(--mx-color-c6ff00) text-black shadow-[0_0_0_4px_rgba(198,255,0,0.22)]'
                                    : 'border-white/10 bg-white/5.5 text-white hover:bg-white/8'
                            }`}
                        >
                            <div className={`mb-10 flex h-12 w-12 items-center justify-center rounded-2xl text-[20px] font-black ${
                                focused ? 'bg-black/15' : 'bg-white/10 text-(--mx-color-c6ff00)'
                            }`}>
                                {index + 1}
                            </div>
                            <h3 className="text-[28px] font-black tracking-tight">{tab.label}</h3>
                            <p className={`mt-2 text-[13px] font-semibold ${focused ? 'text-black/55' : 'text-white/35'}`}>
                                Press A to open {tab.label}.
                            </p>
                            {focused && (
                                <span className="absolute bottom-5 right-5 rounded-xl bg-black px-3 py-1.5 text-[11px] font-black text-(--mx-color-c6ff00)">
                                    A Open
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

function TVNumberPrompt({ title, value, onValueChange, onConfirm, onCancel }) {
    const controllerEnabled = useControllerSupportEnabled()
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
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-105 rounded-3xl bg-[#111116] p-6 shadow-2xl ring-1 ring-white/10">
                <h3 className="text-[24px] font-black text-white">{title}</h3>
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
                    className="mt-5 w-full rounded-2xl border border-white/12 bg-black/35 px-5 py-4 text-center text-[32px] font-black text-white outline-none focus:border-(--mx-color-c6ff00)"
                />
                <div className="mt-5 flex gap-3">
                    <button type="button" onClick={onConfirm} className="min-h-12 flex-1 rounded-2xl bg-(--mx-color-c6ff00) text-[16px] font-black text-black">Go</button>
                    <button type="button" onClick={onCancel} className="min-h-12 rounded-2xl bg-white/8 px-6 text-[16px] font-bold text-white/60">Cancel</button>
                </div>
                <p className="mt-3 text-center text-[11px] text-white/30">A confirm · B close</p>
            </div>
        </div>
    )
}

// ─── main inner component ─────────────────────────────────────────────────────

function LifeSyncTVModeInner({ onExit }) {
    const { lifeSyncUser } = useLifeSync()
    const prefs = lifeSyncUser?.preferences
    const controllerEnabled = useControllerSupportEnabled()
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

    const SECTION_COLS = { anime: 5, manga: 5, hmanhwa: 5, hentai: 5, history: 5, exit: 1 }
    SECTION_COLS.home = Math.max(1, tabs.filter(tab => !tab.isHome && !tab.isExit).length)
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
    const canPageJump = ['anime', 'manga', 'hmanhwa', 'hentai'].includes(activeTab?.id)

    if (ctx?.playIntroRef?.current && !showIntro) {
        setShowIntro(true)
    }

    useEffect(() => {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
        inputBlockUntilRef.current = now + 600
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
                const target = homeTabs[focusPos.col]
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
    }), [activeTab?.id, blocked, canPageJump, cols, currentPage, detailItem, filterOpen, filterPanel?.filterConfig?.length, focusedItem, focusPos.col, mangaReaderBackBlocked, pageJumpOpen, playerState, setCurrentPage, setHistoryFocusedStatus, showExitConfirm, tabs])

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
        ? `Page ${currentPage} · LT / RT to change`
        : activeTab?.id === 'history' ? 'Your watch & reading history' : null

    return (
        <div className="fixed inset-0 z-9999 flex h-dvh w-full flex-col overflow-hidden bg-[#0a0a0c] text-white" style={{ cursor: 'none' }}>
            {/* Ambient glow — omitted on low-end devices to avoid GPU compositing */}
            {!LOW_END && (
                <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
                    <div className="absolute -left-40 -top-20 h-125 w-125 rounded-full bg-(--mx-color-c6ff00)/4 blur-[200px]" />
                    <div className="absolute right-0 bottom-0 h-100 w-100 rounded-full bg-indigo-500/4 blur-[180px]" />
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
                <div className="h-full overflow-y-auto px-8 py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {activeTab?.id !== 'exit' && activeTab?.id !== 'home' && (
                        <TVSectionHeading
                            title={activeTab?.label || ''}
                            subtitle={pageSubtitle}
                        />
                    )}

                    <AnimatePresence mode="wait">
                        <Motion.div
                            key={activeTab?.id}
                            initial={{ opacity: 0, x: 40 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -40 }}
                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        >
                            {activeTab?.id === 'home' && <TVHomeSection tabs={tabs} focusPos={focusPos} onOpenTab={openTabById} />}
                            {activeTab?.id === 'anime' && <TVAnimeSection {...sectionCommonProps} />}
                            {activeTab?.id === 'manga' && <TVMangaSection {...sectionCommonProps} />}
                            {activeTab?.id === 'hmanhwa' && <TVHManhwaSection {...sectionCommonProps} />}
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
