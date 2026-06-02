import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useLifeSync } from '../../context/LifeSyncContext'
import { isLifeSyncHentaiHubVisible } from '../../lib/lifesyncApi'
import useLifeSyncGamepadInput from '../../hooks/useLifeSyncGamepadInput'
import useControllerSupportEnabled from '../../hooks/useControllerSupportEnabled'
import { XBOX_GAMEPAD_BUTTONS } from '../../lib/lifeSyncControllerInput'
import { MotionDiv } from '../../lib/lifesyncMotion'
import { TVAnimeHistorySection } from './tv/TVAnimeHistorySection'
import { TVMangaHistorySection } from './tv/TVMangaHistorySection'
import { TVAnimeBrowseSection } from './tv/TVAnimeBrowseSection'
import { TVMangaBrowseSection } from './tv/TVMangaBrowseSection'
import { TVHentaiBrowseSection } from './tv/TVHentaiBrowseSection'
import { TVDetailSheet } from './tv/TVDetailSheet'

// ─── Spatial navigation helpers ────────────────────────────────────────────────

function colsInRow(itemCount, cols, row) {
    return Math.min(cols, itemCount - row * cols)
}
function maxRow(itemCount, cols) {
    if (itemCount === 0) return 0
    return Math.floor((itemCount - 1) / cols)
}

function movePos(pos, dir, itemCount, cols) {
    if (itemCount === 0) return pos
    const mRow = maxRow(itemCount, cols)
    let { row, col } = pos

    if (dir === 'right') {
        const maxCol = colsInRow(itemCount, cols, row) - 1
        col = Math.min(col + 1, maxCol)
    } else if (dir === 'left') {
        col = Math.max(col - 1, 0)
    } else if (dir === 'down') {
        const newRow = Math.min(row + 1, mRow)
        col = Math.min(col, colsInRow(itemCount, cols, newRow) - 1)
        row = newRow
    } else if (dir === 'up') {
        const newRow = Math.max(row - 1, 0)
        col = Math.min(col, colsInRow(itemCount, cols, newRow) - 1)
        row = newRow
    }

    return { row, col }
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

function TVTabBar({ tabs, activeIndex }) {
    return (
        <div className="flex items-center gap-1 px-10 pt-8 pb-4">
            {/* LifeSync wordmark */}
            <div className="mr-6 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--mx-color-c6ff00)]">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="black" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                    </svg>
                </div>
                <span className="text-[14px] font-black uppercase tracking-[0.2em] text-white/40">TV</span>
            </div>

            {tabs.map((tab, i) => {
                const active = i === activeIndex
                return (
                    <div
                        key={tab.id}
                        className={`relative rounded-2xl px-5 py-2.5 text-[16px] font-black tracking-tight transition-all duration-200 ${
                            active
                                ? 'bg-[var(--mx-color-c6ff00)] text-black'
                                : 'text-white/40'
                        }`}
                    >
                        {tab.label}
                    </div>
                )
            })}

            {/* Right side: controller hints */}
            <div className="ml-auto flex items-center gap-3 text-[12px] text-white/30">
                <span className="flex items-center gap-1.5">
                    <KbdChip label="LB" /> <KbdChip label="RB" />
                    <span>Switch tab</span>
                </span>
                <span className="flex items-center gap-1.5">
                    <KbdBtn color="bg-green-600" label="A" />
                    <span>Select</span>
                </span>
                <span className="flex items-center gap-1.5">
                    <KbdBtn color="bg-red-600" label="B" />
                    <span>Exit</span>
                </span>
            </div>
        </div>
    )
}

function KbdChip({ label }) {
    return (
        <span className="inline-flex h-5 items-center rounded bg-white/10 px-2 text-[10px] font-black text-white/60">
            {label}
        </span>
    )
}
function KbdBtn({ label, color }) {
    return (
        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${color} text-[9px] font-black text-white`}>
            {label}
        </span>
    )
}

// ─── Section heading ──────────────────────────────────────────────────────────

function TVSectionHeading({ title, subtitle }) {
    return (
        <div className="mb-6 px-10">
            <h2 className="text-[32px] font-black leading-tight tracking-tight text-white">{title}</h2>
            {subtitle && <p className="mt-1 text-[16px] text-white/40">{subtitle}</p>}
        </div>
    )
}

// ─── Main overlay ─────────────────────────────────────────────────────────────

function LifeSyncTVModeInner({ onExit }) {
    const { lifeSyncUser } = useLifeSync()
    const prefs = lifeSyncUser?.preferences
    const hentaiEnabled = isLifeSyncHentaiHubVisible(prefs)
    const controllerEnabled = useControllerSupportEnabled()

    const tabs = useMemo(() => {
        const t = [
            { id: 'ANIME_HISTORY', label: 'Anime History', cols: 4 },
            { id: 'MANGA_HISTORY', label: 'Manga History', cols: 4 },
            { id: 'ANIME_BROWSE', label: 'Anime', cols: 5 },
            { id: 'MANGA_BROWSE', label: 'Manga', cols: 5 },
        ]
        if (hentaiEnabled) t.push({ id: 'HENTAI_BROWSE', label: 'Hentai', cols: 4 })
        return t
    }, [hentaiEnabled])

    const [activeTabIndex, setActiveTabIndex] = useState(0)
    const [detailItem, setDetailItem] = useState(null)
    const [direction, setDirection] = useState(1) // 1=forward, -1=back for section animation

    const activeSection = tabs[activeTabIndex]?.id ?? 'ANIME_HISTORY'
    const activeCols = tabs[activeTabIndex]?.cols ?? 4
    const activeItemCount = 999

    // focusPos stored with its owning tab index — auto-resets to {0,0} when tab changes
    const [focusPosForTab, setFocusPosForTab] = useState({ tab: 0, pos: { row: 0, col: 0 } })
    const focusPos = useMemo(
        () => focusPosForTab.tab === activeTabIndex ? focusPosForTab.pos : { row: 0, col: 0 },
        [focusPosForTab, activeTabIndex]
    )
    const setFocusPos = useCallback(
        (updaterOrPos) => {
            setFocusPosForTab(prev => {
                const currentPos = prev.tab === activeTabIndex ? prev.pos : { row: 0, col: 0 }
                const next = typeof updaterOrPos === 'function' ? updaterOrPos(currentPos) : updaterOrPos
                return { tab: activeTabIndex, pos: next }
            })
        },
        [activeTabIndex]
    )

    // Scroll focused card into view
    useEffect(() => {
        const el = document.querySelector('[data-focused-card="true"]')
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }, [focusPos])

    const switchTab = useCallback((delta) => {
        setDirection(delta)
        setActiveTabIndex(prev => {
            const next = prev + delta
            if (next < 0) return tabs.length - 1
            if (next >= tabs.length) return 0
            return next
        })
    }, [tabs.length])

    const handleItemSelect = useCallback((item) => {
        setDetailItem(item)
    }, [])

    const handlers = useMemo(() => ({
        [XBOX_GAMEPAD_BUTTONS.START]: () => onExit(),
        [XBOX_GAMEPAD_BUTTONS.B]: () => {
            if (detailItem) {
                setDetailItem(null)
            } else {
                onExit()
            }
        },
        [XBOX_GAMEPAD_BUTTONS.A]: () => {
            // Handled by sections via onItemSelect; this is a fallback
        },
        [XBOX_GAMEPAD_BUTTONS.LB]: () => {
            if (detailItem) return
            switchTab(-1)
        },
        [XBOX_GAMEPAD_BUTTONS.RB]: () => {
            if (detailItem) return
            switchTab(1)
        },
        [XBOX_GAMEPAD_BUTTONS.DPAD_RIGHT]: () => {
            if (detailItem) return
            setFocusPos(prev => movePos(prev, 'right', activeItemCount, activeCols))
        },
        [XBOX_GAMEPAD_BUTTONS.DPAD_LEFT]: () => {
            if (detailItem) return
            setFocusPos(prev => movePos(prev, 'left', activeItemCount, activeCols))
        },
        [XBOX_GAMEPAD_BUTTONS.DPAD_DOWN]: () => {
            if (detailItem) return
            setFocusPos(prev => movePos(prev, 'down', activeItemCount, activeCols))
        },
        [XBOX_GAMEPAD_BUTTONS.DPAD_UP]: () => {
            if (detailItem) return
            setFocusPos(prev => movePos(prev, 'up', activeItemCount, activeCols))
        },
    }), [activeCols, activeItemCount, detailItem, onExit, setFocusPos, switchTab])

    useLifeSyncGamepadInput({
        enabled: controllerEnabled,
        handlers,
        repeatableButtons: [
            XBOX_GAMEPAD_BUTTONS.DPAD_RIGHT,
            XBOX_GAMEPAD_BUTTONS.DPAD_LEFT,
            XBOX_GAMEPAD_BUTTONS.DPAD_DOWN,
            XBOX_GAMEPAD_BUTTONS.DPAD_UP,
        ],
        repeatDelayMs: 300,
        repeatIntervalMs: 150,
    })

    const sectionProps = {
        focusPos,
        onFocusChange: setFocusPos,
        onItemSelect: handleItemSelect,
        enabled: true,
    }

    const sectionContent = (() => {
        switch (activeSection) {
            case 'ANIME_HISTORY': return <TVAnimeHistorySection {...sectionProps} />
            case 'MANGA_HISTORY': return <TVMangaHistorySection {...sectionProps} />
            case 'ANIME_BROWSE': return <TVAnimeBrowseSection {...sectionProps} />
            case 'MANGA_BROWSE': return <TVMangaBrowseSection {...sectionProps} />
            case 'HENTAI_BROWSE': return <TVHentaiBrowseSection {...sectionProps} />
            default: return null
        }
    })()

    const sectionMeta = {
        ANIME_HISTORY: { title: 'Continue Watching', subtitle: 'Your recent anime episodes' },
        MANGA_HISTORY: { title: 'Continue Reading', subtitle: 'Your recent manga chapters' },
        ANIME_BROWSE: { title: 'Anime', subtitle: 'Featured and ongoing series' },
        MANGA_BROWSE: { title: 'Manga Library', subtitle: 'Your reading shelf' },
        HENTAI_BROWSE: { title: 'Hentai', subtitle: 'Adults only' },
    }

    const meta = sectionMeta[activeSection] ?? { title: '', subtitle: '' }

    return (
        <div
            className="fixed inset-0 z-[9999] flex h-dvh w-full flex-col overflow-hidden bg-[#0a0a0f] text-white"
            style={{ cursor: 'none' }}
        >
            {/* Subtle ambient glow */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
                <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-[var(--mx-color-c6ff00)]/6 blur-[150px]" />
                <div className="absolute -right-40 bottom-0 h-[400px] w-[400px] rounded-full bg-indigo-500/6 blur-[130px]" />
            </div>

            {/* Tab bar */}
            <TVTabBar tabs={tabs} activeIndex={activeTabIndex} />

            {/* Section content — scrollable */}
            <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-10 pb-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <TVSectionHeading title={meta.title} subtitle={meta.subtitle} />

                <AnimatePresence mode="wait" initial={false}>
                    <MotionDiv
                        key={activeSection}
                        initial={{ opacity: 0, x: direction * 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -direction * 40 }}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    >
                        {sectionContent}
                    </MotionDiv>
                </AnimatePresence>
            </div>

            {/* Detail sheet */}
            <AnimatePresence>
                {detailItem && (
                    <TVDetailSheet
                        key={detailItem?.navigateTo ?? 'detail'}
                        item={detailItem}
                        onClose={() => setDetailItem(null)}
                        onExitTV={onExit}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── Portal wrapper ────────────────────────────────────────────────────────────

export function TVModePortal({ onExit }) {
    return createPortal(
        <AnimatePresence>
            <MotionDiv
                key="tv-mode-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
            >
                <LifeSyncTVModeInner onExit={onExit} />
            </MotionDiv>
        </AnimatePresence>,
        document.body
    )
}
