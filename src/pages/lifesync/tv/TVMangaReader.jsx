import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { lifesyncFetch } from '../../../lib/lifesyncApi'
import { useLifeSync } from '../../../context/LifeSyncContext'
import useLifeSyncGamepadInput from '../../../hooks/useLifeSyncGamepadInput'
import useControllerSupportEnabled from '../../../hooks/useControllerSupportEnabled'
import { XBOX_GAMEPAD_BUTTONS } from '../../../lib/lifeSyncControllerInput'
import useLifeSyncInputSource from '../../../hooks/useLifeSyncInputSource'
import { tvHintLabel } from '../../../lib/lifeSyncKeyboardGamepad'
import { readStoredReduceAnimationsSetting } from '../../../lib/lifeSyncReduceMotion'

/**
 * Fullscreen TV manga reader.
 * LB/RB = prev/next chapter, LT/RT = zoom, X = chapter picker, B = back.
 *
 * Scroll + zoom work the same way as LifeSyncMangaRead:
 * - Pages are plain <img> with loading="lazy" / fetchPriority
 * - Zoom is CSS transform:scale on the inner wrapper (no layout reflow per image)
 * - ResizeObserver on the inner div detects image-driven height changes
 * - Scroll progress uses a rAF-debounced callback
 * - useLayoutEffect preserves scroll position across zoom changes
 */

const ZOOM_STEP      = 2
const ZOOM_MIN       = 20
const ZOOM_MAX       = 80
const ZOOM_TRANSITION_MS = 180
const INITIAL_PAGE_BURST = 3
const LOW_END = readStoredReduceAnimationsSetting() === true

function clampZoom(v) {
    const n = Number(v)
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number.isFinite(n) ? n : 60))
}

function imgProps(url) {
    try {
        const host = new URL(String(url || ''), window.location.origin).hostname
        if (host.includes('mangadistrict') || host.includes('roliascan'))
            return { referrerPolicy: 'no-referrer' }
    } catch { /* ignore */ }
    return {}
}

export function TVMangaReader({ mangaId, chapterId: initialChapterId, source, allChapters = [], onBack, onChapterPickerToggle }) {
    const { isLifeSyncConnected } = useLifeSync()
    const controllerEnabled = useControllerSupportEnabled()
    const inputSource = useLifeSyncInputSource()
    const [pages, setPages] = useState([])
    const [zoomPct, setZoomPct] = useState(60)
    const [chapterPickerOpen, setChapterPickerOpen] = useState(false)
    const [chapterPickerIndex, setChapterPickerIndex] = useState(0)
    const [readProgress, setReadProgress] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [currentChapterId, setCurrentChapterId] = useState(initialChapterId)

    const scrollRef       = useRef(null)
    const pagesInnerRef   = useRef(null)
    const cancelRef       = useRef(false)
    const pickerOpenedAtRef  = useRef(0)
    const suppressBackUntilRef = useRef(0)
    const scrollRafRef    = useRef(null)
    const imageLoadRafRef = useRef(null)
    const zoomChanging    = useRef(false)
    const zoomResetTimer  = useRef(null)
    const zoomPrevPct     = useRef(60)
    const lastCommittedProg = useRef(0)
    const readProgressRef = useRef(0)

    const zoomScale = clampZoom(zoomPct) / 100

    // ── progress tracking (same rAF-debounced pattern as normal reader) ──

    const updateScrollProgress = useCallback(() => {
        if (zoomChanging.current) return
        const el = scrollRef.current
        if (!el) return
        const { scrollTop, scrollHeight, clientHeight } = el
        const max = scrollHeight - clientHeight
        const p = max <= 0 ? 1 : Math.min(1, Math.max(0, scrollTop / max))
        readProgressRef.current = p
        const prev = lastCommittedProg.current
        if (p === 0 || p === 1 || Math.abs(p - prev) >= 0.005) {
            lastCommittedProg.current = p
            setReadProgress(p)
        }
    }, [])

    const scheduleProgressUpdate = useCallback(() => {
        if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current)
        scrollRafRef.current = requestAnimationFrame(() => {
            scrollRafRef.current = null
            updateScrollProgress()
        })
    }, [updateScrollProgress])

    const onReaderScroll = useCallback(() => scheduleProgressUpdate(), [scheduleProgressUpdate])

    const onPageImageLoad = useCallback(() => {
        if (imageLoadRafRef.current != null) return
        imageLoadRafRef.current = requestAnimationFrame(() => {
            imageLoadRafRef.current = null
            updateScrollProgress()
        })
    }, [updateScrollProgress])

    useEffect(() => () => {
        if (scrollRafRef.current)    cancelAnimationFrame(scrollRafRef.current)
        if (imageLoadRafRef.current) cancelAnimationFrame(imageLoadRafRef.current)
        if (zoomResetTimer.current)  clearTimeout(zoomResetTimer.current)
    }, [])

    // ── progress save when chapter changes ──

    useEffect(() => {
        if (!isLifeSyncConnected || !mangaId || !source || !currentChapterId) return
        const ac = new AbortController()
        lifesyncFetch('/api/v1/progress', {
            method: 'POST',
            signal: ac.signal,
            json: {
                bookId:    `${source}:${mangaId}`,
                source,
                mangaId,
                progressPct: 0,
                locator:   { chapterId: currentChapterId },
                updatedAt: new Date().toISOString(),
            },
        }).catch(() => {})
        return () => ac.abort()
    }, [currentChapterId, isLifeSyncConnected, mangaId, source])

    // ── chapter navigation ──

    const sortedChapters = allChapters
    const chapterIdx  = sortedChapters.findIndex(c => String(c.id) === String(currentChapterId))
    const prevChapter = chapterIdx > 0 ? sortedChapters[chapterIdx - 1] : null
    const nextChapter = chapterIdx >= 0 && chapterIdx < sortedChapters.length - 1 ? sortedChapters[chapterIdx + 1] : null

    // ── load pages ──

    useEffect(() => {
        cancelRef.current = false
        Promise.resolve().then(() => {
            if (cancelRef.current) return
            setLoading(true)
            setError('')
            setPages([])
            setReadProgress(0)
            lastCommittedProg.current = 0
            readProgressRef.current = 0
            const el = scrollRef.current
            if (el) el.scrollTop = 0
        })

        const endpoint =
            source === 'mangadistrict'
                ? `/api/v1/manga/mangadistrict/chapter/${encodeURIComponent(mangaId)}/${encodeURIComponent(currentChapterId)}`
                : `/api/v1/manga/roliascan/chapter/${encodeURIComponent(mangaId)}/${encodeURIComponent(currentChapterId)}`

        lifesyncFetch(`${endpoint}?view=full`)
            .then(data => {
                if (cancelRef.current) return
                setPages(Array.isArray(data?.pages) ? data.pages.filter(Boolean) : [])
            })
            .catch(e => { if (!cancelRef.current) setError(e?.message || 'Failed to load chapter') })
            .finally(() => { if (!cancelRef.current) setLoading(false) })

        return () => { cancelRef.current = true }
    }, [currentChapterId, mangaId, source])

    // ── reset scroll + progress on chapter change ──

    useLayoutEffect(() => {
        const el = scrollRef.current
        zoomChanging.current = false
        if (zoomResetTimer.current) { clearTimeout(zoomResetTimer.current); zoomResetTimer.current = null }
        if (el) el.scrollTop = 0
        lastCommittedProg.current = 0
        setReadProgress(0)
    }, [currentChapterId])

    // ── zoom: preserve scroll position (same pattern as normal reader) ──

    useLayoutEffect(() => {
        const el = scrollRef.current
        if (!el || zoomPrevPct.current === zoomPct) { zoomPrevPct.current = zoomPct; return }

        const oldMax      = Math.max(0, el.scrollHeight - el.clientHeight)
        const oldProgress = oldMax > 0
            ? Math.min(1, Math.max(0, el.scrollTop / oldMax))
            : Math.min(1, Math.max(0, readProgressRef.current))

        zoomChanging.current = true
        if (zoomResetTimer.current) clearTimeout(zoomResetTimer.current)

        const raf = requestAnimationFrame(() => {
            const newMax = Math.max(0, el.scrollHeight - el.clientHeight)
            el.scrollTop = newMax * oldProgress
            zoomResetTimer.current = setTimeout(() => {
                zoomChanging.current = false
                scheduleProgressUpdate()
            }, ZOOM_TRANSITION_MS + 30)
        })

        zoomPrevPct.current = zoomPct
        return () => cancelAnimationFrame(raf)
    }, [zoomPct, scheduleProgressUpdate])

    // ── kick off progress update once pages finish loading ──

    useEffect(() => {
        if (loading) return
        scheduleProgressUpdate()
        return () => { if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current) }
    }, [loading, pages.length, currentChapterId, scheduleProgressUpdate])

    // ── ResizeObserver on inner pages div (image-driven height changes) ──

    useEffect(() => {
        const inner = pagesInnerRef.current
        if (!inner || loading) return
        const ro = new ResizeObserver(updateScrollProgress)
        ro.observe(inner)
        return () => ro.disconnect()
    }, [loading, pages.length, currentChapterId, updateScrollProgress])

    // ── zoom actions ──

    const adjustZoom = useCallback((dir) => {
        setZoomPct(prev => clampZoom(prev + (dir >= 0 ? ZOOM_STEP : -ZOOM_STEP)))
    }, [])

    // ── chapter picker ──

    const openChapterPicker = useCallback(() => {
        pickerOpenedAtRef.current = performance.now()
        if (chapterIdx >= 0) setChapterPickerIndex(chapterIdx)
        onChapterPickerToggle?.(true)
        setChapterPickerOpen(true)
    }, [chapterIdx, onChapterPickerToggle])

    const closeChapterPicker = useCallback(() => {
        suppressBackUntilRef.current = performance.now() + 420
        onChapterPickerToggle?.(false)
        setChapterPickerOpen(false)
    }, [onChapterPickerToggle])

    useEffect(() => {
        if (!chapterPickerOpen) return
        document.querySelector('[data-focused-reader-chapter="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, [chapterPickerIndex, chapterPickerOpen])

    // ── gamepad ──

    const handlers = useMemo(() => ({
        [XBOX_GAMEPAD_BUTTONS.LT]:        () => adjustZoom(-1),
        [XBOX_GAMEPAD_BUTTONS.RT]:        () => adjustZoom(1),
        [XBOX_GAMEPAD_BUTTONS.DPAD_UP]:   () => { const el = scrollRef.current; if (el) el.scrollBy({ top: -520, behavior: 'instant' }) },
        [XBOX_GAMEPAD_BUTTONS.DPAD_DOWN]: () => { const el = scrollRef.current; if (el) el.scrollBy({ top: 520, behavior: 'instant' }) },
        [XBOX_GAMEPAD_BUTTONS.DPAD_LEFT]: () => { const el = scrollRef.current; if (el) el.scrollBy({ top: -900, behavior: 'instant' }) },
        [XBOX_GAMEPAD_BUTTONS.DPAD_RIGHT]:() => { const el = scrollRef.current; if (el) el.scrollBy({ top: 900, behavior: 'instant' }) },
        [XBOX_GAMEPAD_BUTTONS.LB]:        () => { if (prevChapter) setCurrentChapterId(String(prevChapter.id)) },
        [XBOX_GAMEPAD_BUTTONS.RB]:        () => { if (nextChapter) setCurrentChapterId(String(nextChapter.id)) },
        [XBOX_GAMEPAD_BUTTONS.X]:         () => openChapterPicker(),
        [XBOX_GAMEPAD_BUTTONS.B]:         () => {
            if (performance.now() < suppressBackUntilRef.current) return
            onBack()
        },
        [XBOX_GAMEPAD_BUTTONS.START]:     () => onBack(),
    }), [adjustZoom, nextChapter, onBack, openChapterPicker, prevChapter])

    useLifeSyncGamepadInput({
        enabled: controllerEnabled && !chapterPickerOpen,
        handlers,
        repeatableButtons: [
            XBOX_GAMEPAD_BUTTONS.DPAD_UP,
            XBOX_GAMEPAD_BUTTONS.DPAD_DOWN,
            XBOX_GAMEPAD_BUTTONS.DPAD_LEFT,
            XBOX_GAMEPAD_BUTTONS.DPAD_RIGHT,
        ],
        repeatDelayMs: 260,
        repeatIntervalMs: 180,
    })

    const pickerHandlers = useMemo(() => ({
        [XBOX_GAMEPAD_BUTTONS.DPAD_UP]:   () => setChapterPickerIndex(prev => Math.max(0, prev - 1)),
        [XBOX_GAMEPAD_BUTTONS.DPAD_DOWN]: () => setChapterPickerIndex(prev => Math.min(Math.max(0, sortedChapters.length - 1), prev + 1)),
        [XBOX_GAMEPAD_BUTTONS.A]:         () => {
            const ch = sortedChapters[chapterPickerIndex]
            if (ch?.id) { setCurrentChapterId(String(ch.id)); closeChapterPicker() }
        },
        [XBOX_GAMEPAD_BUTTONS.X]:         () => {
            if (performance.now() - pickerOpenedAtRef.current < 420) return
            closeChapterPicker()
        },
        [XBOX_GAMEPAD_BUTTONS.B]:         () => closeChapterPicker(),
    }), [chapterPickerIndex, closeChapterPicker, sortedChapters])

    useLifeSyncGamepadInput({
        enabled: controllerEnabled && chapterPickerOpen,
        handlers: pickerHandlers,
        repeatableButtons: [XBOX_GAMEPAD_BUTTONS.DPAD_UP, XBOX_GAMEPAD_BUTTONS.DPAD_DOWN],
    })

    // ── derived ──

    const currentChapterLabel = sortedChapters[chapterIdx]?.title
        || sortedChapters[chapterIdx]?.chapter
        || sortedChapters[chapterIdx]?.name
        || currentChapterId

    const progressPct = `${Math.round(readProgress * 1000) / 10}%`

    // ── render ──

    return (
        <div className="absolute inset-0 z-20 flex flex-col bg-black" style={{ cursor: 'none' }}>

            {/* Scroll area */}
            <div
                ref={scrollRef}
                onScroll={onReaderScroll}
                className="min-h-0 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
                {loading && (
                    <div className="flex h-full min-h-[50vh] items-center justify-center text-center">
                        <div>
                            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-(--mx-color-c6ff00) border-t-transparent" />
                            <p className="mt-3 text-[14px] text-white/40">Loading chapter...</p>
                        </div>
                    </div>
                )}
                {error && !loading && (
                    <div className="flex h-full min-h-[50vh] items-center justify-center">
                        <p className="text-[15px] text-red-400">{error}</p>
                    </div>
                )}
                {!loading && !error && pages.length === 0 && (
                    <div className="flex h-full min-h-[50vh] items-center justify-center">
                        <p className="text-[15px] text-white/40">No pages available.</p>
                    </div>
                )}

                <div
                    ref={pagesInnerRef}
                    className="mx-auto pb-8 pt-0 max-w-3xl"
                    style={{
                        transform:       `scale(${zoomScale})`,
                        transformOrigin: 'top center',
                        transition:      `transform ${ZOOM_TRANSITION_MS}ms cubic-bezier(0.2,0,0,1)`,
                        willChange:      LOW_END ? 'auto' : 'transform',
                    }}
                >
                    {pages.map((src, i) => (
                        <div key={`${currentChapterId}-${i}`} className="w-full bg-black">
                            <img
                                src={src}
                                alt={`Page ${i + 1}`}
                                className="w-full bg-black"
                                loading={i < INITIAL_PAGE_BURST ? 'eager' : 'lazy'}
                                fetchPriority={i < INITIAL_PAGE_BURST ? 'high' : 'low'}
                                decoding="async"
                                style={{ willChange: 'transform', display: 'block' }}
                                onLoad={onPageImageLoad}
                                {...imgProps(src)}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-white/10">
                <div
                    className="h-full bg-(--mx-color-c6ff00) transition-all duration-150"
                    style={{ width: progressPct }}
                    role="progressbar"
                    aria-valuenow={Math.round(readProgress * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                />
            </div>

            {/* Bottom toolbar */}
            <div className={`shrink-0 flex items-center justify-between gap-4 border-t border-white/8 px-8 py-3 ${LOW_END ? 'bg-black' : 'bg-black/90 backdrop-blur-xl'}`}>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={onBack} className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-[13px] font-semibold text-white/60">
                        <span className="rounded bg-red-600/80 px-1.5 py-0.5 text-[10px] font-black text-white">{tvHintLabel('B', inputSource)}</span>
                        Back
                    </button>
                    <button type="button" onClick={openChapterPicker} className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-[13px] font-semibold text-white/60">
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-black">{tvHintLabel('X', inputSource)}</span>
                        Chapters
                    </button>
                </div>

                <div className="min-w-0 flex-1 text-center">
                    <p className="truncate text-[15px] font-black text-white">{currentChapterLabel}</p>
                    <p className="text-[11px] text-white/30 tabular-nums">{progressPct} · Zoom {Math.round(zoomScale * 100)}%</p>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-white/30">
                    <span className="rounded bg-white/8 px-1.5 py-0.5 font-black">↑↓</span>
                    <span>scroll</span>
                    <span className="rounded bg-white/8 px-1.5 py-0.5 font-black">{tvHintLabel('LT/RT', inputSource)}</span>
                    <span>zoom</span>
                    <span className="rounded bg-white/8 px-1.5 py-0.5 font-black">{tvHintLabel('LB/RB', inputSource)}</span>
                    <span>chapter</span>
                </div>
            </div>

            {/* Chapter picker overlay */}
            {chapterPickerOpen && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="flex max-h-[70vh] w-140 flex-col rounded-3xl bg-[#111116] p-5 shadow-2xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-[22px] font-black text-white">Go to chapter</h3>
                            <p className="text-[11px] text-white/35">{`↑↓ select · ${tvHintLabel('A', inputSource)} open · ${tvHintLabel('B', inputSource)} close`}</p>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {sortedChapters.map((chapter, index) => {
                                const focused = index === chapterPickerIndex
                                const active  = String(chapter.id) === String(currentChapterId)
                                return (
                                    <button
                                        key={chapter.id || index}
                                        type="button"
                                        data-focused-reader-chapter={focused ? 'true' : undefined}
                                        onClick={() => { if (chapter?.id) { setCurrentChapterId(String(chapter.id)); closeChapterPicker() } }}
                                        className={`mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                                            focused
                                                ? 'bg-(--mx-color-c6ff00) text-black'
                                                : active
                                                    ? 'bg-white/12 text-white'
                                                    : 'bg-white/5 text-white/60'
                                        }`}
                                    >
                                        <span className="shrink-0 rounded bg-black/10 px-2 py-1 text-[11px] font-black">CH</span>
                                        <span className="min-w-0 flex-1 truncate text-[14px] font-bold">
                                            {chapter.title || chapter.name || chapter.chapter || `Chapter ${index + 1}`}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
