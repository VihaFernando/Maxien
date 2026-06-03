import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { List, useDynamicRowHeight, useListRef } from 'react-window'
import { lifesyncFetch } from '../../../lib/lifesyncApi'
import useLifeSyncGamepadInput from '../../../hooks/useLifeSyncGamepadInput'
import useControllerSupportEnabled from '../../../hooks/useControllerSupportEnabled'
import { XBOX_GAMEPAD_BUTTONS } from '../../../lib/lifeSyncControllerInput'

/**
 * Fullscreen TV manga reader — vertical scroll pages.
 * LB/RB = prev/next chapter, LT/RT = zoom, X = chapter picker, B = back.
 *
 * Uses react-window List so only the visible pages (+2 overscan) exist in the DOM,
 * preventing OOM crashes and slow loads on memory-constrained devices (Xbox One).
 * useDynamicRowHeight measures each page's real height via ResizeObserver after load.
 */

function PageRow({ index, style, ariaAttributes, pages, zoomPct, currentChapterId, rowRef }) {
    const src = pages[index]
    const [loaded, setLoaded] = useState(false)
    const isEarly = index < 3
    const imgRef = useRef(null)

    // rowRef is called with the outer div so react-window can measure the real height
    const setRef = useCallback((el) => {
        rowRef?.(el)
    }, [rowRef])

    return (
        <div ref={setRef} style={style} {...ariaAttributes}>
            <div style={{ width: `${zoomPct}%`, margin: '0 auto', position: 'relative' }}>
                {/* Shimmer skeleton until image loaded */}
                {!loaded && (
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            minHeight: 120,
                            background: 'linear-gradient(90deg,#1a1a1a 25%,#262626 50%,#1a1a1a 75%)',
                            backgroundSize: '200% 100%',
                            animation: 'manga-shimmer 1.4s infinite',
                            borderRadius: 4,
                        }}
                    />
                )}
                <img
                    ref={imgRef}
                    key={`${currentChapterId}-${index}`}
                    src={src}
                    alt={`Page ${index + 1}`}
                    decoding="async"
                    onLoad={() => setLoaded(true)}
                    style={{
                        display: 'block',
                        width: '100%',
                        height: 'auto',
                        opacity: loaded ? 1 : 0,
                        transition: isEarly ? 'none' : 'opacity 0.3s ease',
                    }}
                    referrerPolicy="no-referrer"
                />
            </div>
        </div>
    )
}

export function TVMangaReader({ mangaId, chapterId: initialChapterId, source, allChapters = [], onBack, onChapterPickerToggle }) {
    const controllerEnabled = useControllerSupportEnabled()
    const [pages, setPages] = useState([])
    const [pageIndex, setPageIndex] = useState(0)
    const [zoomPct, setZoomPct] = useState(60)
    const [chapterPickerOpen, setChapterPickerOpen] = useState(false)
    const [chapterPickerIndex, setChapterPickerIndex] = useState(0)
    const [scrollProgress, setScrollProgress] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [currentChapterId, setCurrentChapterId] = useState(initialChapterId)
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

    const listRef = useListRef()
    const containerRef = useRef(null)
    const cancelRef = useRef(false)
    const pickerOpenedAtRef = useRef(0)
    const suppressBackUntilRef = useRef(0)
    const zoomAnchorRef = useRef(null)
    // Tracks scroll offset for progress + scrollByAmount
    const scrollOffsetRef = useRef(0)

    // useDynamicRowHeight measures each row after it renders via ResizeObserver.
    // Reset key forces a fresh measurement cache on chapter change.
    const estimatedPageHeight = containerSize.width > 0
        ? Math.round(containerSize.width * (zoomPct / 100) * 1.4)
        : 400
    const dynamicRowHeight = useDynamicRowHeight({
        defaultRowHeight: estimatedPageHeight,
        key: currentChapterId,
    })

    // Measure the scroll container so List gets accurate dimensions
    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const ro = new ResizeObserver(([entry]) => {
            setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height })
        })
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    // Chapter navigation
    const sortedChapters = allChapters
    const chapterIdx = sortedChapters.findIndex(c => String(c.id) === String(currentChapterId))
    const prevChapter = chapterIdx > 0 ? sortedChapters[chapterIdx - 1] : null
    const nextChapter = chapterIdx >= 0 && chapterIdx < sortedChapters.length - 1 ? sortedChapters[chapterIdx + 1] : null

    useEffect(() => {
        cancelRef.current = false
        Promise.resolve().then(() => {
            if (!cancelRef.current) {
                setLoading(true)
                setError('')
                setPages([])
                setPageIndex(0)
                setScrollProgress(0)
                scrollOffsetRef.current = 0
                listRef.current?.element?.scrollTo({ top: 0, behavior: 'instant' })
            }
        })

        const endpoint =
            source === 'mangadistrict'
                ? `/api/v1/manga/mangadistrict/chapter/${encodeURIComponent(mangaId)}/${encodeURIComponent(currentChapterId)}`
                : `/api/v1/manga/roliascan/chapter/${encodeURIComponent(mangaId)}/${encodeURIComponent(currentChapterId)}`

        lifesyncFetch(`${endpoint}?view=full`)
            .then(data => {
                if (cancelRef.current) return
                const imgs = Array.isArray(data?.pages) ? data.pages.filter(Boolean) : []
                setPages(imgs)
            })
            .catch(e => { if (!cancelRef.current) setError(e?.message || 'Failed to load chapter') })
            .finally(() => { if (!cancelRef.current) setLoading(false) })

        return () => { cancelRef.current = true }
    }, [currentChapterId, mangaId, source, listRef])

    const scrollByAmount = useCallback((delta) => {
        const el = listRef.current?.element
        if (!el) return
        const next = Math.max(0, scrollOffsetRef.current + delta)
        el.scrollTo({ top: next, behavior: 'instant' })
    }, [listRef])

    const setZoom = useCallback((delta) => {
        const el = listRef.current?.element
        if (el && el.scrollHeight > el.clientHeight) {
            zoomAnchorRef.current = el.scrollTop / (el.scrollHeight - el.clientHeight)
        }
        setZoomPct(prev => Math.max(20, Math.min(80, prev + delta)))
    }, [listRef])

    // Restore scroll position after zoom reflow
    useEffect(() => {
        const anchor = zoomAnchorRef.current
        if (anchor == null) return
        const id = window.requestAnimationFrame(() => {
            const el = listRef.current?.element
            if (el) {
                const maxScroll = el.scrollHeight - el.clientHeight
                el.scrollTo({ top: Math.round(maxScroll * anchor), behavior: 'instant' })
            }
            zoomAnchorRef.current = null
        })
        return () => window.cancelAnimationFrame(id)
    }, [zoomPct, listRef])

    const openChapterPicker = useCallback(() => {
        pickerOpenedAtRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now()
        if (chapterIdx >= 0) setChapterPickerIndex(chapterIdx)
        onChapterPickerToggle?.(true)
        setChapterPickerOpen(true)
    }, [chapterIdx, onChapterPickerToggle])

    const closeChapterPicker = useCallback(() => {
        suppressBackUntilRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 420
        onChapterPickerToggle?.(false)
        setChapterPickerOpen(false)
    }, [onChapterPickerToggle])

    const handlers = useMemo(() => ({
        [XBOX_GAMEPAD_BUTTONS.LT]: () => setZoom(-10),
        [XBOX_GAMEPAD_BUTTONS.RT]: () => setZoom(10),
        [XBOX_GAMEPAD_BUTTONS.DPAD_UP]: () => scrollByAmount(-520),
        [XBOX_GAMEPAD_BUTTONS.DPAD_DOWN]: () => scrollByAmount(520),
        [XBOX_GAMEPAD_BUTTONS.DPAD_LEFT]: () => scrollByAmount(-900),
        [XBOX_GAMEPAD_BUTTONS.DPAD_RIGHT]: () => scrollByAmount(900),
        [XBOX_GAMEPAD_BUTTONS.LB]: () => { if (prevChapter) setCurrentChapterId(String(prevChapter.id)) },
        [XBOX_GAMEPAD_BUTTONS.RB]: () => { if (nextChapter) setCurrentChapterId(String(nextChapter.id)) },
        [XBOX_GAMEPAD_BUTTONS.X]: () => openChapterPicker(),
        [XBOX_GAMEPAD_BUTTONS.B]: () => {
            const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
            if (now < suppressBackUntilRef.current) return
            onBack()
        },
        [XBOX_GAMEPAD_BUTTONS.START]: () => onBack(),
    }), [nextChapter, onBack, openChapterPicker, prevChapter, scrollByAmount, setZoom])

    useLifeSyncGamepadInput({
        enabled: controllerEnabled && !chapterPickerOpen,
        handlers,
        repeatableButtons: [XBOX_GAMEPAD_BUTTONS.DPAD_UP, XBOX_GAMEPAD_BUTTONS.DPAD_DOWN, XBOX_GAMEPAD_BUTTONS.DPAD_LEFT, XBOX_GAMEPAD_BUTTONS.DPAD_RIGHT],
        repeatDelayMs: 260,
        repeatIntervalMs: 180,
    })

    const pickerHandlers = useMemo(() => ({
        [XBOX_GAMEPAD_BUTTONS.DPAD_UP]: () => setChapterPickerIndex(prev => Math.max(0, prev - 1)),
        [XBOX_GAMEPAD_BUTTONS.DPAD_DOWN]: () => setChapterPickerIndex(prev => Math.min(Math.max(0, sortedChapters.length - 1), prev + 1)),
        [XBOX_GAMEPAD_BUTTONS.A]: () => {
            const chapter = sortedChapters[chapterPickerIndex]
            if (chapter?.id) {
                setCurrentChapterId(String(chapter.id))
                closeChapterPicker()
            }
        },
        [XBOX_GAMEPAD_BUTTONS.X]: () => {
            const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
            if (now - pickerOpenedAtRef.current < 420) return
            closeChapterPicker()
        },
        [XBOX_GAMEPAD_BUTTONS.B]: () => closeChapterPicker(),
    }), [chapterPickerIndex, closeChapterPicker, sortedChapters])

    useLifeSyncGamepadInput({
        enabled: controllerEnabled && chapterPickerOpen,
        handlers: pickerHandlers,
        repeatableButtons: [XBOX_GAMEPAD_BUTTONS.DPAD_UP, XBOX_GAMEPAD_BUTTONS.DPAD_DOWN],
    })

    useEffect(() => {
        if (!chapterPickerOpen) return
        document.querySelector('[data-focused-reader-chapter="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, [chapterPickerIndex, chapterPickerOpen])

    const handleScroll = useCallback((e) => {
        const el = e.currentTarget
        scrollOffsetRef.current = el.scrollTop
        if (pages.length <= 1) return
        const maxScroll = Math.max(1, el.scrollHeight - el.clientHeight)
        const ratio = el.scrollTop / maxScroll
        setScrollProgress(Math.max(0, Math.min(1, ratio)))
        setPageIndex(Math.max(0, Math.min(pages.length - 1, Math.round(ratio * (pages.length - 1)))))
    }, [pages.length])

    const selectChapter = (chapter) => {
        if (!chapter?.id) return
        setCurrentChapterId(String(chapter.id))
        closeChapterPicker()
    }

    const currentChapterLabel = sortedChapters[chapterIdx]?.title || sortedChapters[chapterIdx]?.chapter || sortedChapters[chapterIdx]?.name || currentChapterId

    // rowProps passed into every PageRow via List's rowProps — stable when deps don't change
    const rowProps = useMemo(() => ({ pages, zoomPct, currentChapterId }), [pages, zoomPct, currentChapterId])

    // rowComponent must be stable (defined outside render or memoized)
    const RowComponent = useCallback(({ index, style, ariaAttributes, pages: p, zoomPct: z, currentChapterId: cid, rowRef }) => (
        <PageRow
            index={index}
            style={style}
            ariaAttributes={ariaAttributes}
            pages={p}
            zoomPct={z}
            currentChapterId={cid}
            rowRef={rowRef}
        />
    ), [])

    return (
        <div className="absolute inset-0 z-20 flex flex-col bg-black" style={{ cursor: 'none' }}>
            <style>{`@keyframes manga-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

            {/* Scroll area */}
            <div ref={containerRef} className="relative min-h-0 flex-1">
                {loading && (
                    <div className="flex h-full items-center justify-center text-center">
                        <div>
                            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-(--mx-color-c6ff00) border-t-transparent" />
                            <p className="mt-3 text-[14px] text-white/40">Loading chapter...</p>
                        </div>
                    </div>
                )}
                {error && !loading && (
                    <div className="flex h-full items-center justify-center">
                        <p className="text-[15px] text-red-400">{error}</p>
                    </div>
                )}
                {!loading && !error && pages.length === 0 && (
                    <div className="flex h-full items-center justify-center">
                        <p className="text-[15px] text-white/40">No pages available.</p>
                    </div>
                )}
                {!loading && !error && pages.length > 0 && containerSize.height > 0 && (
                    <List
                        listRef={listRef}
                        rowComponent={RowComponent}
                        rowCount={pages.length}
                        rowHeight={dynamicRowHeight}
                        rowProps={rowProps}
                        overscanCount={2}
                        style={{ background: 'black', width: '100%', height: `${containerSize.height}px`, overflowY: 'auto' }}
                        onScroll={handleScroll}
                    />
                )}
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-white/10">
                <div
                    className="h-full bg-(--mx-color-c6ff00) transition-all duration-150"
                    style={{ width: `${Math.max(0.02, scrollProgress) * 100}%` }}
                />
            </div>

            {/* Bottom toolbar */}
            <div className="shrink-0 flex items-center justify-between gap-4 border-t border-white/8 bg-black/90 px-8 py-3 backdrop-blur-xl">
                <div className="flex items-center gap-2">
                    <button type="button" onClick={onBack} className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-[13px] font-semibold text-white/60">
                        <span className="rounded bg-red-600/80 px-1.5 py-0.5 text-[10px] font-black text-white">B</span>
                        Back
                    </button>
                    <button type="button" onClick={openChapterPicker} className="flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-[13px] font-semibold text-white/60">
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-black">X</span>
                        Chapters
                    </button>
                </div>

                <div className="min-w-0 flex-1 text-center">
                    <p className="truncate text-[15px] font-black text-white">{currentChapterLabel}</p>
                    {pages.length > 0 && (
                        <p className="text-[11px] text-white/30 tabular-nums">Page {pageIndex + 1} / {pages.length} · Zoom {zoomPct}%</p>
                    )}
                </div>

                <div className="flex items-center gap-2 text-[11px] text-white/30">
                    <span className="rounded bg-white/8 px-1.5 py-0.5 font-black">↑↓</span>
                    <span>scroll</span>
                    <span className="rounded bg-white/8 px-1.5 py-0.5 font-black">LT</span>
                    <span className="rounded bg-white/8 px-1.5 py-0.5 font-black">RT</span>
                    <span>zoom</span>
                    <span className="rounded bg-white/8 px-1.5 py-0.5 font-black">LB/RB</span>
                    <span>chapter</span>
                </div>
            </div>

            {/* Chapter picker overlay */}
            {chapterPickerOpen && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="flex max-h-[70vh] w-140 flex-col rounded-3xl bg-[#111116] p-5 shadow-2xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-[22px] font-black text-white">Go to chapter</h3>
                            <p className="text-[11px] text-white/35">↑↓ select · A open · B close</p>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {sortedChapters.map((chapter, index) => {
                                const focused = index === chapterPickerIndex
                                const active = String(chapter.id) === String(currentChapterId)
                                return (
                                    <button
                                        key={chapter.id || index}
                                        type="button"
                                        data-focused-reader-chapter={focused ? 'true' : undefined}
                                        onClick={() => selectChapter(chapter)}
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
